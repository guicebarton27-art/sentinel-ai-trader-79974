import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface HealthStatus {
  status: "healthy" | "degraded" | "unhealthy";
  timestamp: string;
  version: string;
  components: {
    database: ComponentStatus;
    scheduler: ComponentStatus;
    bots: BotsStatus;
    errors: ErrorsStatus;
  };
  uptime_info: {
    last_tick_at: string | null;
    seconds_since_last_tick: number | null;
  };
}

interface ComponentStatus {
  status: "ok" | "warning" | "error";
  message?: string;
  latency_ms?: number;
}

interface BotsStatus extends ComponentStatus {
  total: number;
  running: number;
  paused: number;
  stopped: number;
  error: number;
}

interface ErrorsStatus extends ComponentStatus {
  count_last_hour: number;
  count_last_24h: number;
  recent_errors: Array<{
    bot_id: string;
    bot_name: string;
    message: string;
    timestamp: string;
  }>;
}

interface BotRow {
  status: string;
  last_tick_at: string | null;
}

interface BotEventRow {
  bot_id: string;
  message: string;
  created_at: string;
  bots: { name: string } | null;
}

// Get service client for server-side operations
function getServiceClient(): SupabaseClient {
  return createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
  );
}

// Check database connectivity
async function checkDatabase(supabase: SupabaseClient): Promise<ComponentStatus> {
  const start = Date.now();
  try {
    const { error } = await supabase.from("bots").select("id").limit(1);
    const latency = Date.now() - start;

    if (error) {
      return { status: "error", message: error.message, latency_ms: latency };
    }

    if (latency > 1000) {
      return { status: "warning", message: "High latency detected", latency_ms: latency };
    }

    return { status: "ok", latency_ms: latency };
  } catch (err) {
    return { status: "error", message: (err as Error).message, latency_ms: Date.now() - start };
  }
}

// Get last tick time from bots
async function getLastTickTime(supabase: SupabaseClient): Promise<string | null> {
  const { data } = await supabase
    .from("bots")
    .select("last_tick_at")
    .order("last_tick_at", { ascending: false })
    .limit(1);

  if (!data || data.length === 0) return null;
  const row = data[0] as BotRow;
  return row.last_tick_at || null;
}

// Check scheduler health based on last tick
function checkScheduler(lastTickAt: string | null): ComponentStatus {
  if (!lastTickAt) {
    return { status: "warning", message: "No tick recorded yet" };
  }

  const lastTick = new Date(lastTickAt).getTime();
  const now = Date.now();
  const secondsSinceLastTick = Math.floor((now - lastTick) / 1000);

  // Expect ticks every 60 seconds, warn if more than 2 minutes, error if more than 5
  if (secondsSinceLastTick > 300) {
    return { status: "error", message: `No tick in ${secondsSinceLastTick}s - scheduler may be down` };
  }

  if (secondsSinceLastTick > 120) {
    return { status: "warning", message: `Last tick ${secondsSinceLastTick}s ago` };
  }

  return { status: "ok", message: `Last tick ${secondsSinceLastTick}s ago` };
}

// Get bot statistics
async function getBotsStatus(supabase: SupabaseClient): Promise<BotsStatus> {
  const { data: bots, error } = await supabase
    .from("bots")
    .select("status");

  if (error) {
    return {
      status: "error",
      message: error.message,
      total: 0,
      running: 0,
      paused: 0,
      stopped: 0,
      error: 0,
    };
  }

  const counts = {
    running: 0,
    paused: 0,
    stopped: 0,
    error: 0,
  };

  for (const bot of (bots || []) as BotRow[]) {
    const status = bot.status as keyof typeof counts;
    if (status in counts) {
      counts[status]++;
    }
  }

  const total = (bots || []).length;
  const hasErrors = counts.error > 0;

  return {
    status: hasErrors ? "warning" : "ok",
    message: hasErrors ? `${counts.error} bot(s) in error state` : undefined,
    total,
    ...counts,
  };
}

// Get recent errors
async function getErrorsStatus(supabase: SupabaseClient): Promise<ErrorsStatus> {
  const now = new Date();
  const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000).toISOString();
  const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();

  // Count errors in last hour
  const { count: countLastHour } = await supabase
    .from("bot_events")
    .select("*", { count: "exact", head: true })
    .eq("event_type", "error")
    .gte("created_at", oneHourAgo);

  // Count errors in last 24 hours
  const { count: countLast24h } = await supabase
    .from("bot_events")
    .select("*", { count: "exact", head: true })
    .eq("event_type", "error")
    .gte("created_at", oneDayAgo);

  // Get recent error details (without join to avoid type issues)
  const { data: recentErrors } = await supabase
    .from("bot_events")
    .select("bot_id, message, created_at")
    .eq("event_type", "error")
    .gte("created_at", oneHourAgo)
    .order("created_at", { ascending: false })
    .limit(5);

  const errorCount = countLastHour || 0;
  const status: "ok" | "warning" | "error" = 
    errorCount > 10 ? "error" : 
    errorCount > 0 ? "warning" : "ok";

  // Get bot names for errors
  const errorList: Array<{ bot_id: string; bot_name: string; message: string; timestamp: string }> = [];
  
  if (recentErrors) {
    for (const e of recentErrors as Array<{ bot_id: string; message: string; created_at: string }>) {
      const { data: botData } = await supabase
        .from("bots")
        .select("name")
        .eq("id", e.bot_id)
        .single();
      
      errorList.push({
        bot_id: e.bot_id,
        bot_name: (botData as { name: string } | null)?.name || "Unknown",
        message: e.message,
        timestamp: e.created_at,
      });
    }
  }

  return {
    status,
    message: errorCount > 0 ? `${errorCount} error(s) in last hour` : undefined,
    count_last_hour: countLastHour || 0,
    count_last_24h: countLast24h || 0,
    recent_errors: errorList,
  };
}

// Calculate overall health status
function calculateOverallStatus(components: HealthStatus["components"]): "healthy" | "degraded" | "unhealthy" {
  const statuses = [
    components.database.status,
    components.scheduler.status,
    components.bots.status,
    components.errors.status,
  ];

  if (statuses.includes("error")) {
    return "unhealthy";
  }

  if (statuses.includes("warning")) {
    return "degraded";
  }

  return "healthy";
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = getServiceClient();

  try {
    // Run most checks in parallel
    const [database, lastTickAt, bots, errors] = await Promise.all([
      checkDatabase(supabase),
      getLastTickTime(supabase),
      getBotsStatus(supabase),
      getErrorsStatus(supabase),
    ]);

    const scheduler = checkScheduler(lastTickAt);

    const secondsSinceLastTick = lastTickAt
      ? Math.floor((Date.now() - new Date(lastTickAt).getTime()) / 1000)
      : null;

    const components = { database, scheduler, bots, errors };

    const health: HealthStatus = {
      status: calculateOverallStatus(components),
      timestamp: new Date().toISOString(),
      version: "1.0.0",
      components,
      uptime_info: {
        last_tick_at: lastTickAt,
        seconds_since_last_tick: secondsSinceLastTick,
      },
    };

    // Return appropriate HTTP status based on health
    const httpStatus = health.status === "unhealthy" ? 503 : 200;

    return new Response(JSON.stringify(health), {
      status: httpStatus,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("[health] Error:", err);

    const errorHealth: HealthStatus = {
      status: "unhealthy",
      timestamp: new Date().toISOString(),
      version: "1.0.0",
      components: {
        database: { status: "error", message: (err as Error).message },
        scheduler: { status: "error", message: "Unable to check" },
        bots: { status: "error", total: 0, running: 0, paused: 0, stopped: 0, error: 0 },
        errors: { status: "error", count_last_hour: 0, count_last_24h: 0, recent_errors: [] },
      },
      uptime_info: {
        last_tick_at: null,
        seconds_since_last_tick: null,
      },
    };

    return new Response(JSON.stringify(errorHealth), {
      status: 503,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
