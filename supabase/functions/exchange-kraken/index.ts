import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Kraken API endpoints
const KRAKEN_API_URL = "https://api.kraken.com";
const KRAKEN_API_VERSION = "0";

// Rate limiting tracking (per user, in-memory for function instance)
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT_REQUESTS = 15; // Per minute
const RATE_LIMIT_WINDOW = 60000; // 1 minute in ms

interface KrakenCredentials {
  apiKey: string;
  apiSecret: string;
}

interface KrakenResponse {
  error: string[];
  result?: Record<string, unknown>;
}

interface ApiKeyData {
  encrypted_key: string;
  encrypted_secret: string;
  exchange: string;
  is_active: boolean | null;
}

// Check rate limit for user
function checkRateLimit(userId: string): { allowed: boolean; remaining: number } {
  const now = Date.now();
  const userLimit = rateLimitMap.get(userId);

  if (!userLimit || now > userLimit.resetAt) {
    rateLimitMap.set(userId, { count: 1, resetAt: now + RATE_LIMIT_WINDOW });
    return { allowed: true, remaining: RATE_LIMIT_REQUESTS - 1 };
  }

  if (userLimit.count >= RATE_LIMIT_REQUESTS) {
    return { allowed: false, remaining: 0 };
  }

  userLimit.count++;
  return { allowed: true, remaining: RATE_LIMIT_REQUESTS - userLimit.count };
}

// Decrypt API credentials from database
async function decryptSecret(ciphertext: string): Promise<string> {
  const decoder = new TextDecoder();

  if (ciphertext.startsWith("v2:")) {
    // New format: v2:salt:iv:ciphertext
    const parts = ciphertext.split(":");
    if (parts.length !== 4) {
      throw new Error("Invalid v2 encryption format");
    }

    const [, saltB64, ivB64, dataB64] = parts;
    const salt = Uint8Array.from(atob(saltB64), (c) => c.charCodeAt(0));
    const iv = Uint8Array.from(atob(ivB64), (c) => c.charCodeAt(0));
    const data = Uint8Array.from(atob(dataB64), (c) => c.charCodeAt(0));

    const key = await deriveEncryptionKey(salt);
    const decrypted = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, data);

    return decoder.decode(decrypted);
  } else {
    // Legacy format: base64(iv + ciphertext)
    const combined = Uint8Array.from(atob(ciphertext), (c) => c.charCodeAt(0));
    const iv = combined.slice(0, 12);
    const data = combined.slice(12);

    const key = await getLegacyEncryptionKey();
    const decrypted = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, data);

    return decoder.decode(decrypted);
  }
}

async function deriveEncryptionKey(saltBytes: Uint8Array): Promise<CryptoKey> {
  const encryptionSecret = Deno.env.get("API_ENCRYPTION_KEY");
  if (!encryptionSecret) {
    throw new Error("API_ENCRYPTION_KEY not configured");
  }

  const encoder = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    encoder.encode(encryptionSecret),
    { name: "PBKDF2" },
    false,
    ["deriveBits", "deriveKey"]
  );

  const saltBuffer = new ArrayBuffer(saltBytes.length);
  new Uint8Array(saltBuffer).set(saltBytes);

  return crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: saltBuffer,
      iterations: 100000,
      hash: "SHA-256",
    },
    keyMaterial,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );
}

async function getLegacyEncryptionKey(): Promise<CryptoKey> {
  const secret = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  const encoder = new TextEncoder();
  return crypto.subtle.importKey(
    "raw",
    encoder.encode(secret.slice(0, 32).padEnd(32, "0")),
    { name: "AES-GCM" },
    false,
    ["encrypt", "decrypt"]
  );
}

// Create Kraken API signature using Web Crypto API
async function createKrakenSignature(
  path: string,
  nonce: string,
  postData: string,
  apiSecret: string
): Promise<string> {
  const encoder = new TextEncoder();
  
  // Decode base64 secret
  const secretBytes = Uint8Array.from(atob(apiSecret), c => c.charCodeAt(0));
  
  // Create SHA256 hash of nonce + postData
  const sha256Hash = await crypto.subtle.digest(
    "SHA-256",
    encoder.encode(nonce + postData)
  );
  
  // Create message to sign: path + sha256(nonce + postData)
  const pathBytes = encoder.encode(path);
  const message = new Uint8Array(pathBytes.length + sha256Hash.byteLength);
  message.set(pathBytes, 0);
  message.set(new Uint8Array(sha256Hash), pathBytes.length);
  
  // Import secret key for HMAC-SHA512
  const hmacKey = await crypto.subtle.importKey(
    "raw",
    secretBytes,
    { name: "HMAC", hash: "SHA-512" },
    false,
    ["sign"]
  );
  
  // Sign with HMAC-SHA512
  const signature = await crypto.subtle.sign("HMAC", hmacKey, message);
  
  // Return base64 encoded signature
  return btoa(String.fromCharCode(...new Uint8Array(signature)));
}

// Make authenticated Kraken API request
async function krakenPrivateRequest(
  endpoint: string,
  params: Record<string, string>,
  credentials: KrakenCredentials
): Promise<KrakenResponse> {
  const path = `/${KRAKEN_API_VERSION}/private/${endpoint}`;
  const url = `${KRAKEN_API_URL}${path}`;
  
  const nonce = (Date.now() * 1000).toString();
  const postParams = new URLSearchParams({ nonce, ...params });
  const postData = postParams.toString();
  
  const signature = await createKrakenSignature(path, nonce, postData, credentials.apiSecret);
  
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "API-Key": credentials.apiKey,
      "API-Sign": signature,
    },
    body: postData,
  });
  
  if (!response.ok) {
    throw new Error(`Kraken API error: ${response.status} ${response.statusText}`);
  }
  
  return await response.json();
}

// Make public Kraken API request
async function krakenPublicRequest(
  endpoint: string,
  params: Record<string, string> = {}
): Promise<KrakenResponse> {
  const searchParams = new URLSearchParams(params);
  const url = `${KRAKEN_API_URL}/${KRAKEN_API_VERSION}/public/${endpoint}?${searchParams}`;
  
  const response = await fetch(url);
  
  if (!response.ok) {
    throw new Error(`Kraken API error: ${response.status} ${response.statusText}`);
  }
  
  return await response.json();
}

// Normalize Kraken errors into consistent format
function normalizeKrakenError(errors: string[]): { code: string; message: string } {
  if (errors.length === 0) {
    return { code: "UNKNOWN", message: "Unknown error" };
  }
  
  const error = errors[0];
  
  // Common Kraken error codes
  const errorMap: Record<string, { code: string; message: string }> = {
    "EAPI:Invalid key": { code: "INVALID_API_KEY", message: "Invalid API key" },
    "EAPI:Invalid signature": { code: "INVALID_SIGNATURE", message: "Invalid API signature" },
    "EAPI:Invalid nonce": { code: "INVALID_NONCE", message: "Invalid nonce - request too old" },
    "EOrder:Insufficient funds": { code: "INSUFFICIENT_FUNDS", message: "Insufficient funds for order" },
    "EOrder:Order minimum not met": { code: "ORDER_MIN_NOT_MET", message: "Order size below minimum" },
    "EOrder:Rate limit exceeded": { code: "RATE_LIMIT", message: "Exchange rate limit exceeded" },
    "EGeneral:Permission denied": { code: "PERMISSION_DENIED", message: "API key lacks required permissions" },
    "EService:Unavailable": { code: "SERVICE_UNAVAILABLE", message: "Kraken service temporarily unavailable" },
  };
  
  return errorMap[error] || { code: "KRAKEN_ERROR", message: error };
}

// Get user credentials from database
async function getUserCredentials(
  supabaseAdmin: SupabaseClient,
  userId: string,
  apiKeyId: string
): Promise<KrakenCredentials> {
  const { data, error } = await supabaseAdmin
    .from("api_keys")
    .select("encrypted_key, encrypted_secret, exchange, is_active")
    .eq("id", apiKeyId)
    .eq("user_id", userId)
    .single();

  if (error || !data) {
    throw new Error("API key not found");
  }

  const keyData = data as ApiKeyData;

  if (!keyData.is_active) {
    throw new Error("API key is disabled");
  }

  if (keyData.exchange !== "kraken") {
    throw new Error("API key is not for Kraken exchange");
  }

  const apiKey = await decryptSecret(keyData.encrypted_key);
  const apiSecret = await decryptSecret(keyData.encrypted_secret);

  return { apiKey, apiSecret };
}

// Authenticate user from JWT
async function authenticateUser(req: Request) {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    throw new Error("Missing authorization header");
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authHeader } },
  });

  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) {
    throw new Error("Invalid or expired token");
  }

  return { id: user.id, email: user.email ?? 'unknown' };
}

// Log audit event
async function logAuditEvent(
  supabaseAdmin: SupabaseClient,
  userId: string,
  action: string,
  entityType: string,
  entityId: string | null,
  details: Record<string, unknown>
) {
  try {
    // Insert directly into audit_log table
    await supabaseAdmin.from("audit_log").insert({
      user_id: userId,
      action: action,
      entity_type: entityType,
      entity_id: entityId,
      new_values: details,
    });
  } catch (err) {
    console.error("Failed to log audit event:", err);
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

  try {
    const user = await authenticateUser(req);
    
    // Check rate limit
    const rateLimit = checkRateLimit(user.id);
    if (!rateLimit.allowed) {
      return new Response(
        JSON.stringify({
          success: false,
          error: { code: "RATE_LIMIT", message: "Rate limit exceeded. Try again later." },
        }),
        {
          status: 429,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
            "X-RateLimit-Remaining": "0",
          },
        }
      );
    }

    const body = await req.json();
    const { action, api_key_id, ...params } = body;

    console.log(`[exchange-kraken] User ${user.id} action: ${action}`);

    // Public endpoints don't need API keys
    const publicEndpoints = ["ticker", "ohlc", "depth", "trades", "spread", "time", "assets", "asset_pairs"];
    
    if (publicEndpoints.includes(action)) {
      const endpointMap: Record<string, string> = {
        ticker: "Ticker",
        ohlc: "OHLC",
        depth: "Depth",
        trades: "Trades",
        spread: "Spread",
        time: "Time",
        assets: "Assets",
        asset_pairs: "AssetPairs",
      };

      const result = await krakenPublicRequest(endpointMap[action], params);

      if (result.error && result.error.length > 0) {
        const normalized = normalizeKrakenError(result.error);
        return new Response(
          JSON.stringify({ success: false, error: normalized }),
          {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      return new Response(
        JSON.stringify({ success: true, data: result.result }),
        {
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
            "X-RateLimit-Remaining": rateLimit.remaining.toString(),
          },
        }
      );
    }

    // Private endpoints require API key
    if (!api_key_id) {
      return new Response(
        JSON.stringify({
          success: false,
          error: { code: "MISSING_API_KEY", message: "api_key_id is required for private endpoints" },
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const credentials = await getUserCredentials(supabaseAdmin, user.id, api_key_id);

    // Map actions to Kraken endpoints
    const privateEndpoints: Record<string, { endpoint: string; auditAction?: string }> = {
      balance: { endpoint: "Balance" },
      trade_balance: { endpoint: "TradeBalance" },
      open_orders: { endpoint: "OpenOrders" },
      closed_orders: { endpoint: "ClosedOrders" },
      query_orders: { endpoint: "QueryOrders" },
      trades_history: { endpoint: "TradesHistory" },
      query_trades: { endpoint: "QueryTrades" },
      open_positions: { endpoint: "OpenPositions" },
      ledgers: { endpoint: "Ledgers" },
      add_order: { endpoint: "AddOrder", auditAction: "kraken_add_order" },
      cancel_order: { endpoint: "CancelOrder", auditAction: "kraken_cancel_order" },
      cancel_all: { endpoint: "CancelAll", auditAction: "kraken_cancel_all" },
    };

    const endpointConfig = privateEndpoints[action];
    if (!endpointConfig) {
      return new Response(
        JSON.stringify({
          success: false,
          error: { code: "INVALID_ACTION", message: `Unknown action: ${action}` },
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Execute the request
    const result = await krakenPrivateRequest(endpointConfig.endpoint, params, credentials);

    // Check for Kraken errors
    if (result.error && result.error.length > 0) {
      const normalized = normalizeKrakenError(result.error);
      
      // Log failed order attempts
      if (endpointConfig.auditAction) {
        await logAuditEvent(supabaseAdmin, user.id, `${endpointConfig.auditAction}_failed`, "order", null, {
          action,
          params,
          error: normalized,
        });
      }

      return new Response(
        JSON.stringify({ success: false, error: normalized }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Log successful trading actions
    if (endpointConfig.auditAction) {
      await logAuditEvent(supabaseAdmin, user.id, endpointConfig.auditAction, "order", null, {
        action,
        params,
        result: result.result,
      });
    }

    return new Response(
      JSON.stringify({ success: true, data: result.result }),
      {
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
          "X-RateLimit-Remaining": rateLimit.remaining.toString(),
        },
      }
    );
  } catch (error: unknown) {
    const err = error as Error;
    console.error("[exchange-kraken] Error:", err);

    const isAuthError =
      err.message?.includes("authorization") || err.message?.includes("token");

    return new Response(
      JSON.stringify({
        success: false,
        error: {
          code: isAuthError ? "AUTH_ERROR" : "INTERNAL_ERROR",
          message: isAuthError ? err.message : "Failed to process request",
        },
      }),
      {
        status: isAuthError ? 401 : 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
