import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Secure key derivation using PBKDF2 with 100k iterations
async function deriveEncryptionKey(saltBytes: Uint8Array): Promise<CryptoKey> {
  const encryptionSecret = Deno.env.get('API_ENCRYPTION_KEY');
  if (!encryptionSecret) {
    throw new Error('API_ENCRYPTION_KEY not configured');
  }

  const encoder = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    encoder.encode(encryptionSecret),
    { name: 'PBKDF2' },
    false,
    ['deriveBits', 'deriveKey']
  );

  // Create a fresh ArrayBuffer to avoid type issues
  const saltBuffer = new ArrayBuffer(saltBytes.length);
  new Uint8Array(saltBuffer).set(saltBytes);

  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: saltBuffer,
      iterations: 100000,
      hash: 'SHA-256'
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

// Legacy key derivation for backward compatibility
async function getLegacyEncryptionKey(): Promise<CryptoKey> {
  const secret = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
  const encoder = new TextEncoder();
  return crypto.subtle.importKey(
    'raw',
    encoder.encode(secret.slice(0, 32).padEnd(32, '0')),
    { name: 'AES-GCM' },
    false,
    ['encrypt', 'decrypt']
  );
}

// Enhanced encryption with unique salt per operation
// Format: v2:{salt_base64}:{iv_base64}:{ciphertext_base64}
async function encryptSecret(plaintext: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveEncryptionKey(salt);

  const encoder = new TextEncoder();
  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    encoder.encode(plaintext)
  );

  const saltB64 = btoa(String.fromCharCode(...salt));
  const ivB64 = btoa(String.fromCharCode(...iv));
  const cipherB64 = btoa(String.fromCharCode(...new Uint8Array(encrypted)));

  return `v2:${saltB64}:${ivB64}:${cipherB64}`;
}

// Backward-compatible decryption supporting both formats
async function decryptSecret(ciphertext: string): Promise<string> {
  const decoder = new TextDecoder();

  if (ciphertext.startsWith('v2:')) {
    // New format: v2:salt:iv:ciphertext
    const parts = ciphertext.split(':');
    if (parts.length !== 4) {
      throw new Error('Invalid v2 encryption format');
    }

    const [, saltB64, ivB64, dataB64] = parts;
    const salt = Uint8Array.from(atob(saltB64), c => c.charCodeAt(0));
    const iv = Uint8Array.from(atob(ivB64), c => c.charCodeAt(0));
    const data = Uint8Array.from(atob(dataB64), c => c.charCodeAt(0));

    const key = await deriveEncryptionKey(salt);
    const decrypted = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv },
      key,
      data
    );

    return decoder.decode(decrypted);
  } else {
    // Legacy format: base64(iv + ciphertext)
    const combined = Uint8Array.from(atob(ciphertext), c => c.charCodeAt(0));
    const iv = combined.slice(0, 12);
    const data = combined.slice(12);

    const key = await getLegacyEncryptionKey();
    const decrypted = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv },
      key,
      data
    );

    return decoder.decode(decrypted);
  }
}

// Check if a ciphertext uses legacy format
function isLegacyFormat(ciphertext: string): boolean {
  return !ciphertext.startsWith('v2:');
}

// Authenticate user
async function authenticateUser(req: Request) {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader) {
    throw new Error('Missing authorization header');
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
  
  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authHeader } }
  });

  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) {
    throw new Error('Invalid or expired token');
  }

  return { user, supabase };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { user } = await authenticateUser(req);
    const { action, ...params } = await req.json();
    
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    console.log(`User ${user.id} performing ${action} on API keys`);

    switch (action) {
      case 'list': {
        const { data: keys, error } = await supabaseAdmin
          .from('api_keys')
          .select('id, exchange, key_name, is_active, created_at, updated_at')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false });

        if (error) throw error;

        return new Response(
          JSON.stringify({ success: true, keys }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'add': {
        const { exchange, key_name, api_key, api_secret } = params;

        if (!exchange || !key_name || !api_key || !api_secret) {
          return new Response(
            JSON.stringify({ error: 'Missing required fields' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Validate input lengths
        if (key_name.length > 100 || exchange.length > 50) {
          return new Response(
            JSON.stringify({ error: 'Field length exceeds maximum' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Encrypt with new secure method
        const encryptedKey = await encryptSecret(api_key);
        const encryptedSecret = await encryptSecret(api_secret);

        const { data: newKey, error } = await supabaseAdmin
          .from('api_keys')
          .insert({
            user_id: user.id,
            exchange,
            key_name,
            encrypted_key: encryptedKey,
            encrypted_secret: encryptedSecret,
            is_active: true,
          })
          .select('id, exchange, key_name, is_active, created_at')
          .single();

        if (error) {
          console.error('Error inserting API key:', error);
          throw error;
        }

        console.log(`API key ${newKey.id} added for user ${user.id} (v2 encryption)`);

        return new Response(
          JSON.stringify({ success: true, key: newKey }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'delete': {
        const { key_id } = params;

        if (!key_id) {
          return new Response(
            JSON.stringify({ error: 'Missing key_id' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Verify ownership before deletion
        const { data: existingKey } = await supabaseAdmin
          .from('api_keys')
          .select('id')
          .eq('id', key_id)
          .eq('user_id', user.id)
          .single();

        if (!existingKey) {
          return new Response(
            JSON.stringify({ error: 'API key not found or access denied' }),
            { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const { error } = await supabaseAdmin
          .from('api_keys')
          .delete()
          .eq('id', key_id)
          .eq('user_id', user.id);

        if (error) throw error;

        console.log(`API key ${key_id} deleted for user ${user.id}`);

        return new Response(
          JSON.stringify({ success: true }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'toggle': {
        const { key_id, is_active } = params;

        if (!key_id || typeof is_active !== 'boolean') {
          return new Response(
            JSON.stringify({ error: 'Missing key_id or is_active' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const { data: updatedKey, error } = await supabaseAdmin
          .from('api_keys')
          .update({ is_active })
          .eq('id', key_id)
          .eq('user_id', user.id)
          .select('id, is_active')
          .single();

        if (error) throw error;

        console.log(`API key ${key_id} toggled to ${is_active} for user ${user.id}`);

        return new Response(
          JSON.stringify({ success: true, key: updatedKey }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'get_decrypted': {
        const { key_id } = params;

        if (!key_id) {
          return new Response(
            JSON.stringify({ error: 'Missing key_id' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const { data: keyData, error } = await supabaseAdmin
          .from('api_keys')
          .select('*')
          .eq('id', key_id)
          .eq('user_id', user.id)
          .eq('is_active', true)
          .single();

        if (error || !keyData) {
          return new Response(
            JSON.stringify({ error: 'API key not found or inactive' }),
            { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Decrypt the keys (backward compatible)
        const decryptedKey = await decryptSecret(keyData.encrypted_key);
        const decryptedSecret = await decryptSecret(keyData.encrypted_secret);

        // If legacy format, auto-migrate to v2
        if (isLegacyFormat(keyData.encrypted_key) || isLegacyFormat(keyData.encrypted_secret)) {
          const newEncryptedKey = await encryptSecret(decryptedKey);
          const newEncryptedSecret = await encryptSecret(decryptedSecret);

          await supabaseAdmin
            .from('api_keys')
            .update({
              encrypted_key: newEncryptedKey,
              encrypted_secret: newEncryptedSecret,
            })
            .eq('id', key_id);

          console.log(`API key ${key_id} auto-migrated to v2 encryption for user ${user.id}`);
        }

        console.log(`API key ${key_id} decrypted for user ${user.id} at ${new Date().toISOString()}`);

        return new Response(
          JSON.stringify({
            success: true,
            exchange: keyData.exchange,
            api_key: decryptedKey,
            api_secret: decryptedSecret,
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'migrate': {
        // Manually migrate all user keys to v2 encryption
        const { data: keys, error } = await supabaseAdmin
          .from('api_keys')
          .select('id, encrypted_key, encrypted_secret')
          .eq('user_id', user.id);

        if (error) throw error;

        let migrated = 0;
        for (const key of keys || []) {
          if (isLegacyFormat(key.encrypted_key) || isLegacyFormat(key.encrypted_secret)) {
            try {
              const decryptedKey = await decryptSecret(key.encrypted_key);
              const decryptedSecret = await decryptSecret(key.encrypted_secret);

              const newEncryptedKey = await encryptSecret(decryptedKey);
              const newEncryptedSecret = await encryptSecret(decryptedSecret);

              await supabaseAdmin
                .from('api_keys')
                .update({
                  encrypted_key: newEncryptedKey,
                  encrypted_secret: newEncryptedSecret,
                })
                .eq('id', key.id);

              migrated++;
            } catch (e) {
              console.error(`Failed to migrate key ${key.id}:`, e);
            }
          }
        }

        console.log(`User ${user.id} migrated ${migrated} keys to v2 encryption`);

        return new Response(
          JSON.stringify({ success: true, migrated }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      default:
        return new Response(
          JSON.stringify({ error: 'Invalid action' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }
  } catch (error: any) {
    console.error('Error in manage-api-keys:', error);
    
    const isAuthError = error.message?.includes('authorization') || 
                        error.message?.includes('token');
    
    return new Response(
      JSON.stringify({ error: isAuthError ? error.message : 'Failed to process request' }),
      { status: isAuthError ? 401 : 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
