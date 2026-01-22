import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { requireEnv } from "../_shared/env.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { run_id, target_state, trace_id, note } = body ?? {};

    if (!run_id || !target_state) {
      return new Response(JSON.stringify({ error: 'run_id and target_state are required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseUrl = requireEnv('SUPABASE_URL');
    const serviceKey = requireEnv('SUPABASE_SERVICE_ROLE_KEY');
    const anonKey = requireEnv('SUPABASE_ANON_KEY');

    const serviceClient = createClient(supabaseUrl, serviceKey);

    const serviceHeader = req.headers.get('x-service-role');
    if (!serviceHeader || serviceHeader !== serviceKey) {
      const authHeader = req.headers.get('Authorization');
      if (!authHeader) {
        return new Response(JSON.stringify({ error: 'Missing authorization header' }), {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const userClient = createClient(supabaseUrl, anonKey, {
        global: { headers: { Authorization: authHeader } },
      });

      const { data: { user }, error: authError } = await userClient.auth.getUser();
      if (authError || !user) {
        return new Response(JSON.stringify({ error: 'Invalid authentication' }), {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const { data: run, error: runError } = await userClient
        .from('runs')
        .select('id')
        .eq('id', run_id)
        .eq('user_id', user.id)
        .single();

      if (runError || !run) {
        return new Response(JSON.stringify({ error: 'Run not found' }), {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    const { data: run, error } = await serviceClient.rpc('request_run_transition', {
      run_id,
      target_state,
      transition_trace_id: trace_id ?? null,
      transition_note: note ?? null,
    });

    if (error) {
      throw error;
    }

    return new Response(JSON.stringify({ run }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    const error = err as Error;
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
