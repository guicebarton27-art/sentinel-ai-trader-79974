import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Bot status types
type BotStatus = 'stopped' | 'running' | 'paused' | 'error';
type BotMode = 'paper' | 'live';

// Authenticate user from JWT
async function authenticateUser(req: Request) {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader) {
    throw new Error('Missing authorization header');
  }

  const supabaseClient = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_ANON_KEY') ?? '',
    { global: { headers: { Authorization: authHeader } } }
  );

  const { data: { user }, error } = await supabaseClient.auth.getUser();
  if (error || !user) {
    throw new Error('Invalid authentication');
  }

  return { user, supabaseClient };
}

// Log bot event - uses service client to bypass RLS
async function logBotEvent(
  botId: string,
  userId: string,
  eventType: string,
  message: string,
  severity: string = 'info',
  payload: Record<string, unknown> = {},
  metrics?: { capital?: number; pnl?: number; price?: number }
) {
  const serviceClient = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  );

  await serviceClient.from('bot_events').insert({
    bot_id: botId,
    user_id: userId,
    event_type: eventType,
    severity,
    message,
    payload,
    bot_capital: metrics?.capital ?? null,
    bot_pnl: metrics?.pnl ?? null,
    market_price: metrics?.price ?? null,
  });
}

// Create service client for admin operations
function getServiceClient() {
  return createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  );
}

serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { user, supabaseClient } = await authenticateUser(req);
    const url = new URL(req.url);
    const pathParts = url.pathname.split('/').filter(Boolean);
    const action = pathParts[pathParts.length - 1];

    // Safely parse body - handle empty requests
    // deno-lint-ignore no-explicit-any
    let body: any = {};
    if (req.method === 'POST') {
      try {
        const text = await req.text();
        if (text && text.trim()) {
          body = JSON.parse(text);
        }
      } catch {
        // Empty or invalid body is ok for some actions like 'list'
      }
    }

    switch (action) {
      case 'list': {
        // List all bots for user
        const { data: bots, error } = await supabaseClient
          .from('bots')
          .select('*')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false });

        if (error) throw error;
        return new Response(JSON.stringify({ bots }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      case 'create': {
        // Create a new bot
        const { name, symbol, mode, strategy_id, strategy_config, risk_params } = body;

        const botData = {
          user_id: user.id,
          name: name || 'My Trading Bot',
          symbol: symbol || 'BTC/USD',
          mode: mode || 'paper',
          status: 'stopped' as BotStatus,
          strategy_id: strategy_id || 'trend_following',
          strategy_config: strategy_config || {},
          max_position_size: risk_params?.max_position_size || 0.1,
          max_daily_loss: risk_params?.max_daily_loss || 100,
          stop_loss_pct: risk_params?.stop_loss_pct || 2.0,
          take_profit_pct: risk_params?.take_profit_pct || 5.0,
          max_leverage: risk_params?.max_leverage || 1.0,
          starting_capital: risk_params?.starting_capital || 10000,
          current_capital: risk_params?.starting_capital || 10000,
          api_key_id: body.api_key_id || null,
        };

        const { data: bot, error } = await supabaseClient
          .from('bots')
          .insert(botData)
          .select()
          .single();

        if (error) throw error;

        await logBotEvent(
          bot.id,
          user.id,
          'config_change',
          `Bot "${bot.name}" created`,
          'info',
          { action: 'create', config: botData }
        );

        return new Response(JSON.stringify({ bot }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      case 'start': {
        const { bot_id, mode } = body;
        if (!bot_id) throw new Error('bot_id required');

        // Get current bot state
        const { data: bot, error: fetchError } = await supabaseClient
          .from('bots')
          .select('*')
          .eq('id', bot_id)
          .eq('user_id', user.id)
          .single();

        if (fetchError || !bot) throw new Error('Bot not found');

        // Validate: if live mode, require API key
        const targetMode = mode || bot.mode;
        if (targetMode === 'live' && !bot.api_key_id) {
          throw new Error('Live trading requires a configured API key');
        }

        // Update bot status
        const { data: updatedBot, error } = await supabaseClient
          .from('bots')
          .update({
            status: 'running',
            mode: targetMode,
            last_heartbeat_at: new Date().toISOString(),
            error_count: 0,
            last_error: null,
          })
          .eq('id', bot_id)
          .select()
          .single();

        if (error) throw error;

        await logBotEvent(
          bot_id,
          user.id,
          'start',
          `Bot started in ${targetMode} mode`,
          'info',
          { mode: targetMode, previous_status: bot.status },
          { capital: Number(bot.current_capital), pnl: Number(bot.total_pnl) }
        );

        return new Response(JSON.stringify({ bot: updatedBot, message: `Bot started in ${targetMode} mode` }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      case 'pause': {
        const { bot_id } = body;
        if (!bot_id) throw new Error('bot_id required');

        const { data: bot, error } = await supabaseClient
          .from('bots')
          .update({ status: 'paused' })
          .eq('id', bot_id)
          .eq('user_id', user.id)
          .select()
          .single();

        if (error) throw error;

        await logBotEvent(bot_id, user.id, 'pause', 'Bot paused', 'info');

        return new Response(JSON.stringify({ bot, message: 'Bot paused' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      case 'stop': {
        const { bot_id } = body;
        if (!bot_id) throw new Error('bot_id required');

        const { data: bot, error } = await supabaseClient
          .from('bots')
          .update({ status: 'stopped' })
          .eq('id', bot_id)
          .eq('user_id', user.id)
          .select()
          .single();

        if (error) throw error;

        await logBotEvent(bot_id, user.id, 'stop', 'Bot stopped gracefully', 'info');

        return new Response(JSON.stringify({ bot, message: 'Bot stopped' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      case 'kill': {
        // Emergency stop - also cancel all pending orders
        const { bot_id } = body;
        if (!bot_id) throw new Error('bot_id required');

        const serviceClient = getServiceClient();

        // Cancel all pending orders
        await serviceClient
          .from('orders')
          .update({ status: 'canceled', canceled_at: new Date().toISOString() })
          .eq('bot_id', bot_id)
          .in('status', ['pending', 'submitted']);

        // Stop the bot
        const { data: bot, error } = await supabaseClient
          .from('bots')
          .update({ status: 'stopped', last_error: 'Emergency kill switch activated' })
          .eq('id', bot_id)
          .eq('user_id', user.id)
          .select()
          .single();

        if (error) throw error;

        await logBotEvent(
          bot_id,
          user.id,
          'stop',
          'EMERGENCY KILL: Bot stopped, all pending orders canceled',
          'critical',
          { action: 'kill' }
        );

        return new Response(JSON.stringify({ bot, message: 'Emergency stop executed' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      case 'status': {
        const { bot_id } = body;
        if (!bot_id) throw new Error('bot_id required');

        const { data: bot, error: botError } = await supabaseClient
          .from('bots')
          .select('*')
          .eq('id', bot_id)
          .eq('user_id', user.id)
          .single();

        if (botError) throw botError;

        // Get open positions
        const { data: positions } = await supabaseClient
          .from('positions')
          .select('*')
          .eq('bot_id', bot_id)
          .eq('status', 'open');

        // Get recent orders
        const { data: recentOrders } = await supabaseClient
          .from('orders')
          .select('*')
          .eq('bot_id', bot_id)
          .order('created_at', { ascending: false })
          .limit(10);

        // Get recent events
        const { data: recentEvents } = await supabaseClient
          .from('bot_events')
          .select('*')
          .eq('bot_id', bot_id)
          .order('created_at', { ascending: false })
          .limit(20);

        // Check heartbeat health
        const lastHeartbeat = bot.last_heartbeat_at ? new Date(bot.last_heartbeat_at) : null;
        const heartbeatAge = lastHeartbeat ? (Date.now() - lastHeartbeat.getTime()) / 1000 : null;
        const isHealthy = bot.status !== 'running' || (heartbeatAge !== null && heartbeatAge < 120);

        return new Response(JSON.stringify({
          bot,
          positions: positions || [],
          recent_orders: recentOrders || [],
          recent_events: recentEvents || [],
          health: {
            is_healthy: isHealthy,
            last_heartbeat_age_seconds: heartbeatAge,
            error_count: bot.error_count,
          }
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      case 'update': {
        const { bot_id, ...updates } = body;
        if (!bot_id) throw new Error('bot_id required');

        // Only allow updating certain fields
        const allowedFields = [
          'name', 'symbol', 'strategy_id', 'strategy_config',
          'max_position_size', 'max_daily_loss', 'stop_loss_pct',
          'take_profit_pct', 'max_leverage', 'api_key_id'
        ];

        const filteredUpdates: Record<string, unknown> = {};
        for (const key of allowedFields) {
          if (updates[key] !== undefined) {
            filteredUpdates[key] = updates[key];
          }
        }

        const { data: bot, error } = await supabaseClient
          .from('bots')
          .update(filteredUpdates)
          .eq('id', bot_id)
          .eq('user_id', user.id)
          .select()
          .single();

        if (error) throw error;

        await logBotEvent(
          bot_id,
          user.id,
          'config_change',
          'Bot configuration updated',
          'info',
          { updates: filteredUpdates }
        );

        return new Response(JSON.stringify({ bot }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      case 'delete': {
        const { bot_id } = body;
        if (!bot_id) throw new Error('bot_id required');

        // First check bot is stopped
        const { data: bot } = await supabaseClient
          .from('bots')
          .select('status')
          .eq('id', bot_id)
          .eq('user_id', user.id)
          .single();

        if (bot?.status === 'running') {
          throw new Error('Cannot delete a running bot. Stop it first.');
        }

        const { error } = await supabaseClient
          .from('bots')
          .delete()
          .eq('id', bot_id)
          .eq('user_id', user.id);

        if (error) throw error;

        return new Response(JSON.stringify({ message: 'Bot deleted' }), {
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
    console.error('Bot controller error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: error.message?.includes('authorization') || error.message?.includes('authentication') ? 401 : 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
