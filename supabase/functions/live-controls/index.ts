import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { parseBoolean, parseNumber, requireEnv } from "../_shared/env.ts";
import { logError } from "../_shared/logging.ts";
import { checkLiveSecretsReady } from "../_shared/execution.ts";
import { performConnectivityCheck } from "./logic.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

async function authenticateUser(req: Request) {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    throw new Error("Missing authorization header");
  }

  const supabaseClient = createClient(
    requireEnv("SUPABASE_URL"),
    requireEnv("SUPABASE_ANON_KEY"),
    { global: { headers: { Authorization: authHeader } } }
  );

  const { data: { user }, error } = await supabaseClient.auth.getUser();
  if (error || !user) {
    throw new Error("Invalid authentication");
  }

  return { user, supabaseClient };
}

const generateToken = () => {
  const array = new Uint8Array(16);
  crypto.getRandomValues(array);
  return Array.from(array).map((b) => b.toString(16).padStart(2, "0")).join("");
};

const hashToken = async (token: string) => {
  const encoder = new TextEncoder();
  const hashBuffer = await crypto.subtle.digest("SHA-256", encoder.encode(token));
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
};

async function logBotEvent(
  serviceClient: ReturnType<typeof createClient>,
  botId: string,
  userId: string,
  eventType: string,
  message: string,
  payload: Record<string, unknown>,
) {
  await serviceClient.from("bot_events").insert({
    bot_id: botId,
    user_id: userId,
    event_type: eventType,
    severity: "info",
    message,
    payload,
  });
}

async function callKrakenFunction(
  authHeader: string | null,
  payload: Record<string, unknown>,
) {
  const response = await fetch(`${requireEnv("SUPABASE_URL")}/functions/v1/exchange-kraken`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: authHeader ?? "",
    },
    body: JSON.stringify(payload),
  });

  const data = await response.json();
  return { ok: response.ok, data };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { user, supabaseClient } = await authenticateUser(req);
    const serviceClient = createClient(
      requireEnv("SUPABASE_URL"),
      requireEnv("SUPABASE_SERVICE_ROLE_KEY")
    );

    const url = new URL(req.url);
    const pathParts = url.pathname.split("/").filter(Boolean);
    const action = pathParts[pathParts.length - 1];

    let body: Record<string, unknown> = {};
    if (req.method === "POST") {
      const text = await req.text();
      if (text && text.trim()) {
        body = JSON.parse(text);
      }
    }

    switch (action) {
      case "status": {
        const { data: profile } = await supabaseClient
          .from("profiles")
          .select("global_kill_switch, kill_switch_activated_at")
          .eq("user_id", user.id)
          .maybeSingle();

        const liveEnabled = parseBoolean(Deno.env.get("LIVE_TRADING_ENABLED"), false);
        const secretsReady = checkLiveSecretsReady();

        return new Response(JSON.stringify({
          live_enabled: liveEnabled,
          kill_switch_active: profile?.global_kill_switch ?? false,
          kill_switch_activated_at: profile?.kill_switch_activated_at ?? null,
          secrets_ready: secretsReady,
          live_ready: liveEnabled && secretsReady,
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "request-arm": {
        const botId = body.bot_id as string | undefined;
        if (!botId) throw new Error("bot_id required");

        const { data: bot } = await supabaseClient
          .from("bots")
          .select("id, mode, status")
          .eq("id", botId)
          .eq("user_id", user.id)
          .single();

        if (!bot || bot.mode !== "live") {
          throw new Error("Bot must be in live mode to arm");
        }

        if (bot.status !== "running") {
          throw new Error("Bot must be running before arming live");
        }

        const { data: run } = await supabaseClient
          .from("bot_runs")
          .select("id, mode, status, live_armed")
          .eq("bot_id", botId)
          .order("started_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (!run || run.mode !== "live" || run.status !== "running") {
          throw new Error("Active live run not found");
        }

        const token = generateToken();
        const tokenHash = await hashToken(token);
        const traceId = crypto.randomUUID();
        const nowIso = new Date().toISOString();

        await serviceClient
          .from("bot_runs")
          .update({
            arm_requested_at: nowIso,
            arm_token_hash: tokenHash,
            live_armed: false,
          } as unknown)
          .eq("id", run.id);

        await logBotEvent(serviceClient, botId, user.id, "config_change", "Live arming requested", {
          trace_id: traceId,
          run_id: run.id,
          requested_at: nowIso,
        });

        return new Response(JSON.stringify({
          token,
          run_id: run.id,
          trace_id: traceId,
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "confirm-arm": {
        const botId = body.bot_id as string | undefined;
        const confirmationToken = body.confirmation_token as string | undefined;
        if (!botId || !confirmationToken) throw new Error("bot_id and confirmation_token required");

        const { data: run } = await supabaseClient
          .from("bot_runs")
          .select("id, mode, status, arm_token_hash")
          .eq("bot_id", botId)
          .order("started_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (!run || run.mode !== "live" || run.status !== "running") {
          throw new Error("Active live run not found");
        }

        const tokenHash = await hashToken(confirmationToken);
        if (!run.arm_token_hash || run.arm_token_hash !== tokenHash) {
          throw new Error("Invalid confirmation token");
        }

        const nowIso = new Date().toISOString();
        const traceId = crypto.randomUUID();
        const cooldownSeconds = parseNumber(Deno.env.get("LIVE_ARM_COOLDOWN_SECONDS"), 60);

        await serviceClient
          .from("bot_runs")
          .update({
            live_armed: true,
            armed_at: nowIso,
            arm_token_hash: null,
          } as unknown)
          .eq("id", run.id);

        await logBotEvent(serviceClient, botId, user.id, "config_change", "Live arming confirmed", {
          trace_id: traceId,
          run_id: run.id,
          armed_at: nowIso,
          cooldown_seconds: cooldownSeconds,
        });

        return new Response(JSON.stringify({
          live_armed: true,
          cooldown_ends_at: new Date(Date.now() + cooldownSeconds * 1000).toISOString(),
          trace_id: traceId,
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "connectivity-check": {
        const botId = body.bot_id as string | undefined;
        if (!botId) throw new Error("bot_id required");

        const { data: bot } = await supabaseClient
          .from("bots")
          .select("id, api_key_id, symbol")
          .eq("id", botId)
          .eq("user_id", user.id)
          .single();

        if (!bot?.api_key_id) {
          throw new Error("API key is required for connectivity check");
        }

        const authHeader = req.headers.get("Authorization");
        const result = await performConnectivityCheck({
          authHeader,
          apiKeyId: bot.api_key_id,
          symbol: bot.symbol,
        });

        return new Response(JSON.stringify(result), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "dry-run": {
        const botId = body.bot_id as string | undefined;
        if (!botId) throw new Error("bot_id required");

        const { data: bot } = await supabaseClient
          .from("bots")
          .select("id, api_key_id, symbol")
          .eq("id", botId)
          .eq("user_id", user.id)
          .single();

        if (!bot?.api_key_id) {
          throw new Error("API key is required for dry-run");
        }

        const authHeader = req.headers.get("Authorization");
        const krakenSymbol = bot.symbol.replace("BTC", "XBT").replace("/", "");

        const result = await callKrakenFunction(authHeader, {
          action: "add_order",
          api_key_id: bot.api_key_id,
          pair: krakenSymbol,
          type: "buy",
          ordertype: "market",
          volume: "0.0001",
          validate: "true",
        });

        return new Response(JSON.stringify({
          success: result.data?.success ?? false,
          data: result.data?.data ?? null,
          error: result.data?.error ?? null,
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "set-kill-switch": {
        const enabled = Boolean(body.enabled);
        const nowIso = new Date().toISOString();

        await serviceClient
          .from("profiles")
          .update({
            global_kill_switch: enabled,
            kill_switch_activated_at: enabled ? nowIso : null,
          } as unknown)
          .eq("user_id", user.id);

        return new Response(JSON.stringify({
          kill_switch_active: enabled,
          updated_at: nowIso,
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      default:
        return new Response(JSON.stringify({ error: "Unknown action" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }
  } catch (err: unknown) {
    const error = err as Error;
    logError({
      component: "live-controls",
      message: "Live control error",
      context: { error: error.message },
    });

    return new Response(JSON.stringify({ error: error.message }), {
      status: error.message?.includes("authorization") || error.message?.includes("authentication") ? 401 : 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
