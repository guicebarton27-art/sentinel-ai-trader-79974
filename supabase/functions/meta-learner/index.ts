import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { fetchWithModelFallback } from "../_shared/ai-models.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface StrategyPerformance {
  strategy_id: string;
  strategy_name: string;
  sharpe_ratio: number;
  sortino_ratio: number;
  max_drawdown: number;
  win_rate: number;
  total_pnl: number;
}

// Authenticate user and check role
async function authenticateUser(req: Request) {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader) {
    throw { status: 401, message: 'Missing authorization header' };
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
  
  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authHeader } }
  });

  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) {
    throw { status: 401, message: 'Invalid or expired token' };
  }

  // Check user role - admin or trader for meta-learner
  const { data: roleData } = await supabase
    .from('user_roles')
    .select('role')
    .eq('user_id', user.id)
    .maybeSingle();

  const role = roleData?.role || 'viewer';
  if (!['admin', 'trader'].includes(role)) {
    throw { status: 403, message: 'Trader or Admin role required for meta-learner access' };
  }

  return { user, role, supabase };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Authenticate user and verify role
    const { user, role, supabase: userSupabase } = await authenticateUser(req);
    console.log(`User ${user.id} (${role}) accessing meta-learner`);

    const { strategies: inputStrategies } = await req.json();
    
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY not configured');
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    
    console.log('Meta-Learner: Fetching real strategy data...');

    // Fetch real deployed strategies from database
    const { data: deployedStrategies } = await supabase
      .from('deployed_strategies')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    // Fetch backtest results for metrics
    const { data: backtestRuns } = await supabase
      .from('backtest_runs')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(50);

    // Calculate real performance metrics from database
    const strategyMetrics: StrategyPerformance[] = [];

    if (deployedStrategies && deployedStrategies.length > 0) {
      for (const strategy of deployedStrategies) {
        const metrics = strategy.performance_metrics as any || {};
        
        // Get related backtest data if available
        const relatedBacktest = backtestRuns?.find(b => 
          b.name?.toLowerCase().includes(strategy.name?.toLowerCase()) ||
          (b.strategy_config as any)?.name === strategy.name
        );

        strategyMetrics.push({
          strategy_id: strategy.id,
          strategy_name: strategy.name,
          sharpe_ratio: metrics.sharpeRatio || relatedBacktest?.sharpe_ratio || 0,
          sortino_ratio: metrics.sortinoRatio || relatedBacktest?.sortino_ratio || 0,
          max_drawdown: Math.abs(metrics.maxDrawdown || relatedBacktest?.max_drawdown || 0),
          win_rate: metrics.winRate || relatedBacktest?.win_rate || 0,
          total_pnl: metrics.totalReturn || relatedBacktest?.total_return || 0,
        });
      }
    } else if (inputStrategies && inputStrategies.length > 0) {
      // Use input strategies if no deployed strategies
      for (const s of inputStrategies) {
        strategyMetrics.push({
          strategy_id: s.id || `strategy-${Date.now()}`,
          strategy_name: s.name || 'Unknown Strategy',
          sharpe_ratio: s.sharpe || 0,
          sortino_ratio: s.sortino || 0,
          max_drawdown: s.drawdown || 0,
          win_rate: s.winRate || 0,
          total_pnl: s.pnl || 0,
        });
      }
    }

    // If still no strategies, return empty result
    if (strategyMetrics.length === 0) {
      return new Response(
        JSON.stringify({
          timestamp: Date.now(),
          decisions: [],
          portfolio_health: 0,
          diversification_score: 0,
          rebalancing_needed: false,
          message: 'No strategies found to evaluate. Deploy strategies first.'
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const prompt = `You are an advanced Meta-Learning system for algorithmic trading strategy management.

Analyze these strategy performances and decide which to promote, demote, or maintain:

${strategyMetrics.map((s, i) => `
Strategy ${i + 1}: ${s.strategy_name} (${s.strategy_id})
- Sharpe Ratio: ${s.sharpe_ratio.toFixed(2)}
- Sortino Ratio: ${s.sortino_ratio.toFixed(2)}
- Max Drawdown: ${s.max_drawdown.toFixed(2)}%
- Win Rate: ${s.win_rate.toFixed(2)}%
- Total P&L: $${s.total_pnl.toFixed(2)}
`).join('\n')}

Evaluation Criteria:
- Sharpe > 1.5: Strong performance
- Sortino > 2.0: Excellent downside management
- Max Drawdown > 15%: Risk concern
- Win Rate < 45%: Underperforming
- Negative P&L for 3+ periods: Consider demotion

For EACH strategy, provide:
1. Strategy ID: [id]
2. Decision: [promote/demote/maintain/pause/kill]
3. New Allocation Weight: [0.0 to 0.5]
4. Performance Score: [0 to 100]
5. Rank: [1 to N]
6. Reasoning: [1 sentence]

Then provide:
- Overall Portfolio Health: [0 to 100]
- Diversification Score: [0 to 100]
- Rebalancing Needed: [yes/no]
- Key Actions: [bullet points of recommended changes]`;

    const { response, model, usedFallback } = await fetchWithModelFallback(
      LOVABLE_API_KEY,
      [
        { role: 'system', content: 'You are an expert quantitative portfolio manager specializing in strategy selection, allocation optimization, and meta-learning for trading systems.' },
        { role: 'user', content: prompt }
      ],
      { config: { timeoutMs: 15000 } }
    );

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: 'Rate limit exceeded, please try again later' }), {
          status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: 'AI credits exhausted, please add funds' }), {
          status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
      throw new Error(`AI API error: ${response.status}`);
    }

    console.log(`Meta-learner using ${model}${usedFallback ? ' (fallback)' : ''}`);

    const data = await response.json();
    const analysis = data.choices[0].message.content;
    
    console.log('Meta-Learner analysis complete');

    // Parse decisions for each strategy
    const decisions = [];
    for (const strategy of strategyMetrics) {
      const decisionRegex = new RegExp(`${strategy.strategy_id}[\\s\\S]*?Decision[:\\s]+(promote|demote|maintain|pause|kill)`, 'i');
      const weightRegex = new RegExp(`${strategy.strategy_id}[\\s\\S]*?Allocation Weight[:\\s]+([0-9.]+)`, 'i');
      const scoreRegex = new RegExp(`${strategy.strategy_id}[\\s\\S]*?Performance Score[:\\s]+([0-9]+)`, 'i');
      const rankRegex = new RegExp(`${strategy.strategy_id}[\\s\\S]*?Rank[:\\s]+([0-9]+)`, 'i');

      const decisionMatch = analysis.match(decisionRegex);
      const weightMatch = analysis.match(weightRegex);
      const scoreMatch = analysis.match(scoreRegex);
      const rankMatch = analysis.match(rankRegex);

      const decision = decisionMatch ? decisionMatch[1].toLowerCase() : 'maintain';
      const weight = weightMatch ? parseFloat(weightMatch[1]) : 0.25;
      const score = scoreMatch ? parseInt(scoreMatch[1]) : 50;
      const rankValue: number = rankMatch ? parseInt(rankMatch[1]) : decisions.length + 1;

      // Map decision to status
      const statusMap: { [key: string]: string } = {
        'promote': 'promoted',
        'demote': 'demoted',
        'maintain': 'active',
        'pause': 'paused',
        'kill': 'killed'
      };

      const ranking: Record<string, any> = {
        strategy_id: strategy.strategy_id,
        strategy_name: strategy.strategy_name,
        status: statusMap[decision] || 'active',
        sharpe_ratio: strategy.sharpe_ratio,
        sortino_ratio: strategy.sortino_ratio,
        max_drawdown: strategy.max_drawdown,
        win_rate: strategy.win_rate,
        total_pnl: strategy.total_pnl,
        allocation_weight: weight,
        performance_score: score,
        rank: rankValue,
        last_evaluated_at: new Date().toISOString(),
      };

      decisions.push(ranking);
    }

    // Parse overall metrics
    const healthMatch = analysis.match(/Portfolio Health[:\s]+([0-9]+)/i);
    const divMatch = analysis.match(/Diversification Score[:\s]+([0-9]+)/i);
    const rebalanceMatch = analysis.match(/Rebalancing Needed[:\s]+(yes|no)/i);

    const result = {
      timestamp: Date.now(),
      decisions,
      portfolio_health: healthMatch ? parseInt(healthMatch[1]) : 75,
      diversification_score: divMatch ? parseInt(divMatch[1]) : 70,
      rebalancing_needed: rebalanceMatch ? rebalanceMatch[1].toLowerCase() === 'yes' : false,
      full_analysis: analysis,
    };

    return new Response(
      JSON.stringify(result),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
    
  } catch (error: any) {
    console.error('Error in meta-learner:', error);
    
    const isAuthError = error.status === 401 || error.status === 403;
    
    return new Response(
      JSON.stringify({ error: isAuthError ? error.message : 'Internal server error' }),
      { status: error.status || 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
