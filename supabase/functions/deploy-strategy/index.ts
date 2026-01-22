import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface StrategyConfig {
  trendWeight: number;
  meanRevWeight: number;
  carryWeight: number;
  signalThreshold: number;
  stopLoss: number;
  takeProfit: number;
  maxPositionSize: number;
}

interface PerformanceMetrics {
  totalReturn: number;
  sharpeRatio: number;
  maxDrawdown: number;
  winRate: number;
  profitFactor: number;
  totalTrades: number;
}

interface DeployRequest {
  action: 'deploy' | 'pause' | 'resume' | 'stop' | 'list';
  strategyId?: string;
  name?: string;
  symbol?: string;
  config?: StrategyConfig;
  performance?: PerformanceMetrics;
}

async function authenticateUser(supabase: any, authHeader: string | null) {
  if (!authHeader) {
    throw { status: 401, message: 'Missing authorization header' };
  }

  const token = authHeader.replace('Bearer ', '');
  const { data: { user }, error: authError } = await supabase.auth.getUser(token);
  
  if (authError || !user) {
    throw { status: 401, message: 'Invalid or expired token' };
  }

  // Check user role
  const { data: roleData } = await supabase
    .from('user_roles')
    .select('role')
    .eq('user_id', user.id)
    .maybeSingle();

  const role = roleData?.role || 'viewer';
  if (!['admin', 'trader'].includes(role)) {
    throw { status: 403, message: 'Insufficient permissions' };
  }

  return { user: { id: user.id, email: user.email ?? 'unknown' }, role };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const authHeader = req.headers.get('Authorization');
    const { user } = await authenticateUser(supabase, authHeader);

    const body: DeployRequest = await req.json();
    const { action } = body;

    console.log(`Strategy deployment action: ${action} by user ${user.id}`);

    switch (action) {
      case 'deploy': {
        const { name, symbol, config, performance } = body;
        
        if (!name || !symbol || !config) {
          throw { status: 400, message: 'Missing required fields: name, symbol, config' };
        }

        // Check if strategy with same name already exists
        const { data: existing } = await supabase
          .from('deployed_strategies')
          .select('id')
          .eq('user_id', user.id)
          .eq('name', name)
          .maybeSingle();

        if (existing) {
          // Update existing strategy
          const { data: updated, error: updateError } = await supabase
            .from('deployed_strategies')
            .update({
              symbol,
              strategy_config: config,
              performance_metrics: performance,
              status: 'paper',
              deployed_at: new Date().toISOString(),
            })
            .eq('id', existing.id)
            .select()
            .single();

          if (updateError) throw { status: 500, message: updateError.message };

          return new Response(JSON.stringify({
            success: true,
            message: 'Strategy updated and redeployed to paper trading',
            strategy: updated,
          }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        // Insert new strategy
        const { data: inserted, error: insertError } = await supabase
          .from('deployed_strategies')
          .insert({
            user_id: user.id,
            name,
            symbol,
            strategy_config: config,
            performance_metrics: performance,
            status: 'paper',
          })
          .select()
          .single();

        if (insertError) throw { status: 500, message: insertError.message };

        return new Response(JSON.stringify({
          success: true,
          message: 'Strategy deployed to paper trading',
          strategy: inserted,
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      case 'pause': {
        const { strategyId } = body;
        if (!strategyId) throw { status: 400, message: 'Missing strategyId' };

        const { error } = await supabase
          .from('deployed_strategies')
          .update({ status: 'paused' })
          .eq('id', strategyId)
          .eq('user_id', user.id);

        if (error) throw { status: 500, message: error.message };

        return new Response(JSON.stringify({
          success: true,
          message: 'Strategy paused',
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      case 'resume': {
        const { strategyId } = body;
        if (!strategyId) throw { status: 400, message: 'Missing strategyId' };

        const { error } = await supabase
          .from('deployed_strategies')
          .update({ status: 'paper' })
          .eq('id', strategyId)
          .eq('user_id', user.id);

        if (error) throw { status: 500, message: error.message };

        return new Response(JSON.stringify({
          success: true,
          message: 'Strategy resumed',
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      case 'stop': {
        const { strategyId } = body;
        if (!strategyId) throw { status: 400, message: 'Missing strategyId' };

        const { error } = await supabase
          .from('deployed_strategies')
          .update({ status: 'stopped' })
          .eq('id', strategyId)
          .eq('user_id', user.id);

        if (error) throw { status: 500, message: error.message };

        return new Response(JSON.stringify({
          success: true,
          message: 'Strategy stopped',
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      case 'list': {
        const { data: strategies, error } = await supabase
          .from('deployed_strategies')
          .select('*')
          .eq('user_id', user.id)
          .order('deployed_at', { ascending: false });

        if (error) throw { status: 500, message: error.message };

        return new Response(JSON.stringify({
          success: true,
          strategies: strategies || [],
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      default:
        throw { status: 400, message: 'Invalid action' };
    }
  } catch (error: any) {
    console.error('Deploy strategy error:', error);
    
    const status = error.status || 500;
    const message = status === 401 || status === 403 
      ? 'Authentication required' 
      : error.message || 'Internal server error';

    return new Response(JSON.stringify({ error: message }), {
      status,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
