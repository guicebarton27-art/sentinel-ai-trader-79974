import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { requireEnv } from "../_shared/env.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

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

async function logBotEvent(
  botId: string,
  userId: string,
  eventType: string,
  message: string,
  severity: string = 'info',
  payload: Record<string, unknown> = {},
  traceContext?: { runId?: string; traceId?: string }
) {
  const serviceClient = getServiceClient();

  await serviceClient.from('bot_events').insert({
    bot_id: botId,
    user_id: userId,
    event_type: eventType,
    severity,
    message,
    payload,
    run_id: traceContext?.runId ?? null,
    trace_id: traceContext?.traceId ?? null,
  });
}

const transitionMap: Record<string, { target: string; note: string; event: string; severity: string }> = {
  start: { target: 'running', note: 'Run started', event: 'start', severity: 'info' },
  pause: { target: 'canceled', note: 'Run paused', event: 'pause', severity: 'warn' },
  stop: { target: 'completed', note: 'Run stopped', event: 'stop', severity: 'info' },
  kill: { target: 'failed', note: 'Run killed', event: 'stop', severity: 'critical' },
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const pathParts = url.pathname.split('/').filter(Boolean);
    const action = pathParts[pathParts.length - 1];

    const { user, supabaseClient } = await authenticateUser(req);

    let body: Record<string, unknown> = {};
    if (req.method === 'POST') {
      const text = await req.text();
      if (text && text.trim()) {
        body = JSON.parse(text);
      }
    }

    const traceId = crypto.randomUUID();

    switch (action) {
      case 'create-run': {
        const botId = body.bot_id as string | undefined;
        const mode = body.mode as string | undefined;

        if (!botId) {
          return new Response(JSON.stringify({ error: 'bot_id is required' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        const { data: bot, error: botError } = await supabaseClient
          .from('bots')
          .select('id, mode')
          .eq('id', botId)
          .eq('user_id', user.id)
          .single();

        if (botError || !bot) {
          return new Response(JSON.stringify({ error: 'Bot not found' }), {
            status: 404,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        const { data: run, error: runError } = await supabaseClient
          .from('runs')
          .insert({
            bot_id: botId,
            user_id: user.id,
            run_type: 'tick',
            trigger: 'manual',
            state: 'requested',
            trace_id: traceId,
            metadata: { mode: mode ?? bot.mode },
          })
          .select()
          .single();

        if (runError || !run) {
          throw runError;
        }

        await logBotEvent(
          botId,
          user.id,
          'start',
          'Run created',
          'info',
          { run_id: run.id, mode: mode ?? bot.mode },
          { runId: run.id, traceId }
        );

        return new Response(JSON.stringify({ run }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      case 'request-transition': {
        const runId = body.run_id as string | undefined;
        const transition = body.transition as string | undefined;

        if (!runId || !transition) {
          return new Response(JSON.stringify({ error: 'run_id and transition are required' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        const mapping = transitionMap[transition];
        if (!mapping) {
          return new Response(JSON.stringify({ error: 'Invalid transition' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        const { data: run, error: runError } = await supabaseClient
          .from('runs')
          .select('id, bot_id')
          .eq('id', runId)
          .eq('user_id', user.id)
          .single();

        if (runError || !run) {
          return new Response(JSON.stringify({ error: 'Run not found' }), {
            status: 404,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        const serviceClient = getServiceClient();
        const { data: updatedRun, error } = await serviceClient.rpc('request_run_transition', {
          run_id: runId,
          target_state: mapping.target,
          transition_trace_id: traceId,
          transition_note: mapping.note,
        });

        if (error) {
          throw error;
        }

        await logBotEvent(
          run.bot_id,
          user.id,
          mapping.event,
          `Run transition: ${transition}`,
          mapping.severity,
          { run_id: runId, transition, target_state: mapping.target },
          { runId, traceId }
        );

        return new Response(JSON.stringify({ run: updatedRun }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      case 'run-one-tick': {
        const runId = body.run_id as string | undefined;

        if (!runId) {
          return new Response(JSON.stringify({ error: 'run_id is required' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        const { data: run, error: runError } = await supabaseClient
          .from('runs')
          .select('id, bot_id')
          .eq('id', runId)
          .eq('user_id', user.id)
          .single();

        if (runError || !run) {
          return new Response(JSON.stringify({ error: 'Run not found' }), {
            status: 404,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        const response = await fetch(`${requireEnv('SUPABASE_URL')}/functions/v1/tick-bots`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-service-role': requireEnv('SUPABASE_SERVICE_ROLE_KEY'),
          },
          body: JSON.stringify({ bot_id: run.bot_id, run_id: runId, trigger: 'manual' }),
        });

        if (!response.ok) {
          const text = await response.text();
          throw new Error(`Manual tick failed (${response.status}): ${text}`);
        }

        const payload = await response.json();

        await logBotEvent(
          run.bot_id,
          user.id,
          'tick',
          'Manual tick requested',
          'info',
          { run_id: runId, trigger: 'manual' },
          { runId, traceId }
        );

        return new Response(JSON.stringify({ payload }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      default:
        return new Response(JSON.stringify({ error: 'Unknown action' }), {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
    }
  } catch (err) {
    const error = err as Error;
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
