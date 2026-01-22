import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { parseBoolean, parseNumber, requireEnv } from "../_shared/env.ts";
import { logError } from "../_shared/logging.ts";
import { createTraceId, transitionRunStatus } from "../_shared/spine.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

type RunAction = 'start' | 'pause' | 'stop' | 'kill' | 'arm_live';

async function authenticateUser(req: Request) {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader) {
    throw new Error('Missing authorization header');
  }

  const supabaseClient = createClient(
    requireEnv('SUPABASE_URL'),
    requireEnv('SUPABASE_ANON_KEY'),
    { global: { headers: { Authorization: authHeader } } }
  );

  const { data: { user }, error } = await supabaseClient.auth.getUser();
  if (error || !user) {
    throw new Error('Invalid authentication');
  }

  return { user, supabaseClient };
}

function getServiceClient() {
  return createClient(
    requireEnv('SUPABASE_URL'),
    requireEnv('SUPABASE_SERVICE_ROLE_KEY')
  );
}

async function logRunEvent(
  botId: string | null,
  userId: string,
  runId: string | null,
  traceId: string,
  eventType: string,
  message: string,
  payload: Record<string, unknown> = {},
  severity: string = 'info'
) {
  const serviceClient = getServiceClient();
  await serviceClient.from('bot_events').insert({
    bot_id: botId,
    user_id: userId,
    run_id: runId,
    trace_id: traceId,
    event_type: eventType,
    severity,
    message,
    payload,
    payload_json: payload,
  });
}

const buildRunConfig = () => ({
  ai_enabled: parseBoolean(Deno.env.get('AI_STRATEGY_ENABLED'), true),
  ai_confidence_threshold: parseNumber(Deno.env.get('AI_CONFIDENCE_THRESHOLD'), 0.55),
  live_armed: false,
});

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { user, supabaseClient } = await authenticateUser(req);
    const url = new URL(req.url);
    const pathParts = url.pathname.split('/').filter(Boolean);
    const action = pathParts[pathParts.length - 1];

    let body: Record<string, unknown> = {};
    if (req.method === 'POST') {
      try {
        body = await req.json();
      } catch {
        body = {};
      }
    }

    switch (action) {
      case 'create_run': {
        const botId = body.bot_id as string | undefined;
        if (!botId) throw new Error('bot_id required');

        const { data: bot, error: botError } = await supabaseClient
          .from('bots')
          .select('*')
          .eq('id', botId)
          .eq('user_id', user.id)
          .single();

        if (botError || !bot) throw botError ?? new Error('Bot not found');

        const { data: run, error: runError } = await supabaseClient
          .from('runs')
          .insert({
            bot_id: botId,
            user_id: user.id,
            status: 'STOPPED',
            mode: (body.mode as string | undefined) ?? bot.mode,
            config_json: buildRunConfig(),
          })
          .select()
          .single();

        if (runError || !run) throw runError ?? new Error('Failed to create run');

        await logRunEvent(botId, user.id, run.id, createTraceId(), 'start', 'Run created', {
          run_id: run.id,
          mode: run.mode,
        });

        return new Response(JSON.stringify({ run }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      case 'request_transition': {
        const botId = body.bot_id as string | undefined;
        const requestedAction = body.action as RunAction | undefined;
        const modeOverride = body.mode as string | undefined;

        if (!botId || !requestedAction) {
          throw new Error('bot_id and action required');
        }

        const { data: bot, error: botError } = await supabaseClient
          .from('bots')
          .select('*')
          .eq('id', botId)
          .eq('user_id', user.id)
          .single();

        if (botError || !bot) throw botError ?? new Error('Bot not found');

        const { data: run } = await supabaseClient
          .from('runs')
          .select('*')
          .eq('bot_id', botId)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        let activeRun = run;
        if (!activeRun) {
          const { data: newRun, error: newRunError } = await supabaseClient
            .from('runs')
            .insert({
              bot_id: botId,
              user_id: user.id,
              status: 'STOPPED',
              mode: modeOverride ?? bot.mode,
              config_json: buildRunConfig(),
            })
            .select()
            .single();

          if (newRunError || !newRun) throw newRunError ?? new Error('Failed to create run');
          activeRun = newRun;
        }

        if (requestedAction === 'arm_live') {
          const { data: updated } = await supabaseClient
            .from('runs')
            .update({
              config_json: {
                ...(activeRun.config_json ?? {}),
                live_armed: true,
              }
            })
            .eq('id', activeRun.id)
            .select()
            .single();

          await logRunEvent(botId, user.id, activeRun.id, createTraceId(), 'config_change', 'Live trading armed', {
            run_id: activeRun.id,
          });

          return new Response(JSON.stringify({ run: updated }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        const transitionState = transitionRunStatus(activeRun.status as any, requestedAction as any);

        const desiredMode = modeOverride ?? activeRun.mode ?? bot.mode;
        const liveTradingEnabled = parseBoolean(Deno.env.get('LIVE_TRADING_ENABLED'), false);
        const systemKillSwitch = parseBoolean(Deno.env.get('KILL_SWITCH_ENABLED'), true);
        const { data: profile } = await supabaseClient
          .from('profiles')
          .select('global_kill_switch')
          .eq('user_id', user.id)
          .maybeSingle();

        if (requestedAction === 'start' && desiredMode === 'live') {
          if (!liveTradingEnabled) {
            throw new Error('Live trading is disabled by environment configuration');
          }
          if (systemKillSwitch || profile?.global_kill_switch) {
            throw new Error('Live trading is blocked by kill switch');
          }
          if (!(activeRun.config_json as { live_armed?: boolean } | null)?.live_armed) {
            throw new Error('Live trading must be armed before starting');
          }
        }

        const finalStatus = requestedAction === 'start'
          ? 'RUNNING'
          : requestedAction === 'pause'
            ? 'PAUSED'
            : requestedAction === 'stop'
              ? 'STOPPED'
              : 'KILL_SWITCHED';

        const { data: updatedRun, error: updateError } = await supabaseClient
          .from('runs')
          .update({
            status: finalStatus,
            mode: desiredMode,
            last_tick_at: requestedAction === 'start' ? new Date().toISOString() : activeRun.last_tick_at,
          })
          .eq('id', activeRun.id)
          .select()
          .single();

        if (updateError || !updatedRun) throw updateError ?? new Error('Failed to update run');

        await supabaseClient
          .from('bots')
          .update({
            status: requestedAction === 'start'
              ? 'running'
              : requestedAction === 'pause'
                ? 'paused'
                : requestedAction === 'kill'
                  ? 'error'
                  : 'stopped',
            last_heartbeat_at: requestedAction === 'start' ? new Date().toISOString() : bot.last_heartbeat_at,
            last_error: requestedAction === 'kill' ? 'Kill switch engaged' : null,
          })
          .eq('id', botId);

        await logRunEvent(botId, user.id, activeRun.id, createTraceId(), requestedAction, `Run transitioned to ${finalStatus}`, {
          run_id: activeRun.id,
          previous_status: activeRun.status,
          transition_state: transitionState,
          final_status: finalStatus,
        });

        return new Response(JSON.stringify({ run: updatedRun }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      case 'run_one_tick': {
        const runId = body.run_id as string | undefined;
        const botId = body.bot_id as string | undefined;

        if (!runId && !botId) throw new Error('run_id or bot_id required');

        const { data: run } = runId
          ? await supabaseClient.from('runs').select('*').eq('id', runId).single()
          : await supabaseClient.from('runs')
            .select('*')
            .eq('bot_id', botId)
            .order('created_at', { ascending: false })
            .limit(1)
            .single();

        if (!run) throw new Error('Run not found');

        const response = await fetch(`${requireEnv('SUPABASE_URL')}/functions/v1/tick-bots`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-service-role': requireEnv('SUPABASE_SERVICE_ROLE_KEY'),
          },
          body: JSON.stringify({ run_id: run.id }),
        });

        if (!response.ok) {
          const text = await response.text();
          throw new Error(`Tick failed: ${text}`);
        }

        const payload = await response.json();

        await logRunEvent(run.bot_id ?? null, user.id, run.id, createTraceId(), 'tick', 'Manual tick executed', {
          run_id: run.id,
          payload,
        });

        return new Response(JSON.stringify({ run, payload }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      default:
        return new Response(JSON.stringify({ error: 'Unknown action' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
    }
  } catch (err: unknown) {
    const error = err as Error;
    logError({ component: 'run-controller', message: 'Run controller error', context: { error: error.message } });
    return new Response(JSON.stringify({ error: error.message }), {
      status: error.message?.includes('authorization') || error.message?.includes('authentication') ? 401 : 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
