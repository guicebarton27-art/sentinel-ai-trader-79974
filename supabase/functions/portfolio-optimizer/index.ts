import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";
import { fetchWithModelFallback } from "../_shared/ai-models.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Input validation schema
const PortfolioSchema = z.object({
  assets: z.array(
    z.string()
      .min(1)
      .max(20)
      .regex(/^[A-Z0-9]{2,10}\/[A-Z]{2,5}$|^[A-Z0-9]{4,12}$/, "Invalid asset symbol format")
  ).min(1, "At least one asset required").max(20, "Maximum 20 assets allowed").default(['BTC/USD', 'ETH/USD', 'SOL/USD']),
  total_capital: z.number()
    .positive("Capital must be positive")
    .min(100, "Minimum capital is $100")
    .max(100000000, "Maximum capital is $100,000,000")
    .default(10000),
  risk_tolerance: z.enum(['conservative', 'moderate', 'aggressive'], {
    errorMap: () => ({ message: "Risk tolerance must be: conservative, moderate, or aggressive" })
  }).default('moderate'),
});

// Authenticate user and check role
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

  // Check user role
  const { data: roleData } = await supabase
    .from('user_roles')
    .select('role')
    .eq('user_id', user.id)
    .single();

  const role = roleData?.role || 'viewer';
  if (!['admin', 'trader'].includes(role)) {
    throw new Error('Insufficient permissions. Trader or admin role required.');
  }

  return { user, role };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Authenticate user and verify role
    const { user, role } = await authenticateUser(req);
    console.log(`User ${user.id} (${role}) requesting portfolio optimization`);

    // Parse and validate input
    const rawInput = await req.json();
    const parseResult = PortfolioSchema.safeParse(rawInput);
    
    if (!parseResult.success) {
      const errorMessage = parseResult.error.errors.map(e => e.message).join(', ');
      console.error('Validation error:', errorMessage);
      return new Response(
        JSON.stringify({ error: 'Invalid input', details: errorMessage }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { assets, total_capital, risk_tolerance } = parseResult.data;
    
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    if (!LOVABLE_API_KEY) {
      throw new Error('AI service not configured');
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    
    console.log(`Optimizing portfolio for ${assets.length} assets with ${risk_tolerance} risk tolerance`);

    // Fetch data for each asset
    const assetData = [];
    for (const symbol of assets) {
      // Get recent predictions
      const { data: predictions } = await supabase
        .from('ml_predictions')
        .select('prediction_value, confidence')
        .eq('symbol', symbol)
        .order('created_at', { ascending: false })
        .limit(3);

      // Get sentiment
      const { data: sentiment } = await supabase
        .from('sentiment_data')
        .select('sentiment_score, confidence')
        .eq('symbol', symbol)
        .order('created_at', { ascending: false })
        .limit(3);

      // Get historical data for volatility calc
      const { data: candles } = await supabase
        .from('historical_candles')
        .select('close')
        .eq('symbol', symbol)
        .eq('interval', '1h')
        .order('timestamp', { ascending: false })
        .limit(168);

      let volatility = 0;
      let expectedReturn = 0;
      let sentimentScore = 0;

      if (candles && candles.length > 20) {
        const prices = candles.map(c => parseFloat(c.close.toString())).reverse();
        const returns = prices.slice(-50).map((p, i, arr) => 
          i > 0 ? ((p - arr[i-1]) / arr[i-1]) : 0
        ).slice(1);
        
        const avgReturn = returns.reduce((a, b) => a + b, 0) / returns.length;
        const variance = returns.reduce((a, b) => a + Math.pow(b - avgReturn, 2), 0) / returns.length;
        volatility = Math.sqrt(variance * 365 * 24); // Annualized
        expectedReturn = avgReturn * 365 * 24 * 100; // Annualized %
      }

      if (predictions && predictions.length > 0) {
        const avgChange = predictions.reduce((sum, p) => {
          const val = p.prediction_value as any;
          return sum + (val.change_percent || 0);
        }, 0) / predictions.length;
        expectedReturn = (expectedReturn + avgChange) / 2; // Blend historical and predicted
      }

      if (sentiment && sentiment.length > 0) {
        sentimentScore = sentiment.reduce((sum, s) => 
          sum + parseFloat(s.sentiment_score.toString()), 0
        ) / sentiment.length;
      }

      assetData.push({
        symbol,
        expected_return: expectedReturn,
        volatility,
        sentiment: sentimentScore,
      });
    }

    const prompt = `You are an advanced portfolio optimization AI using Modern Portfolio Theory and machine learning.

Assets to Optimize:
${assetData.map((a, i) => `
${i + 1}. ${a.symbol}
   - Expected Annual Return: ${a.expected_return.toFixed(2)}%
   - Annualized Volatility: ${(a.volatility * 100).toFixed(2)}%
   - Sentiment Score: ${a.sentiment.toFixed(2)}
   - Sharpe Estimate: ${(a.expected_return / (a.volatility * 100)).toFixed(2)}
`).join('\n')}

Portfolio Constraints:
- Total Capital: $${total_capital.toFixed(2)}
- Risk Tolerance: ${risk_tolerance}
- Objective: ${risk_tolerance === 'conservative' ? 'Minimize volatility' : risk_tolerance === 'aggressive' ? 'Maximize returns' : 'Optimize Sharpe ratio'}

Using mean-variance optimization and considering correlations, market sentiment, and predicted returns, provide optimal portfolio allocation:

For each asset, specify:
1. Asset: [symbol]
2. Weight: [percentage, must sum to 100%]
3. Allocation: [dollar amount]
4. Rationale: [1 sentence why this allocation]

Then provide:
- Expected Portfolio Return: [percentage]
- Expected Portfolio Volatility: [percentage]
- Expected Sharpe Ratio: [number]
- Diversification Score: [0 to 100]
- Risk-Adjusted Score: [0 to 100]
- Rebalancing Frequency: [daily/weekly/monthly]
- Key Insights: [2-3 sentences about the portfolio strategy]

Be quantitative and data-driven.`;

    const { response, model, usedFallback } = await fetchWithModelFallback(
      LOVABLE_API_KEY,
      [
        { role: 'system', content: 'You are an expert portfolio manager and quantitative analyst specializing in cryptocurrency portfolio optimization using MPT and machine learning.' },
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
      throw new Error('AI service error');
    }

    console.log(`Portfolio optimization using ${model}${usedFallback ? ' (fallback)' : ''}`);

    const data = await response.json();
    const analysis = data.choices[0].message.content;
    
    console.log('Portfolio optimization:', analysis);

    // Parse allocations
    const allocations = [];
    for (const asset of assets) {
      const weightRegex = new RegExp(`${asset.replace('/', '\\/')}[\\s\\S]*?Weight[:\\s]+([0-9.]+)`, 'i');
      const weightMatch = analysis.match(weightRegex);
      const weight = weightMatch ? parseFloat(weightMatch[1]) : (100 / assets.length);
      
      allocations.push({
        symbol: asset,
        weight,
        allocation: (total_capital * weight / 100),
        ...assetData.find(a => a.symbol === asset),
      });
    }

    // Normalize weights to sum to 100%
    const totalWeight = allocations.reduce((sum, a) => sum + a.weight, 0);
    allocations.forEach(a => {
      a.weight = (a.weight / totalWeight) * 100;
      a.allocation = (total_capital * a.weight / 100);
    });

    const portReturnMatch = analysis.match(/Expected Portfolio Return[^:]+[:\s]+([0-9.]+)/i);
    const portVolMatch = analysis.match(/Expected Portfolio Volatility[^:]+[:\s]+([0-9.]+)/i);
    const sharpeMatch = analysis.match(/Expected Sharpe Ratio[^:]+[:\s]+([0-9.]+)/i);
    const divScoreMatch = analysis.match(/Diversification Score[^:]+[:\s]+([0-9]+)/i);
    const riskScoreMatch = analysis.match(/Risk-Adjusted Score[^:]+[:\s]+([0-9]+)/i);
    const rebalanceMatch = analysis.match(/Rebalancing Frequency[^:]+[:\s]+(daily|weekly|monthly)/i);
    const insightsMatch = analysis.match(/Key Insights[:\s]+(.+)/is);

    const optimization = {
      allocations,
      portfolio_metrics: {
        expected_return: portReturnMatch ? parseFloat(portReturnMatch[1]) : 
          allocations.reduce((sum, a) => sum + ((a.expected_return || 0) * a.weight / 100), 0),
        expected_volatility: portVolMatch ? parseFloat(portVolMatch[1]) : 
          Math.sqrt(allocations.reduce((sum, a) => sum + Math.pow((a.volatility || 0) * a.weight / 100, 2), 0)) * 100,
        sharpe_ratio: sharpeMatch ? parseFloat(sharpeMatch[1]) : 1.5,
        diversification_score: divScoreMatch ? parseInt(divScoreMatch[1]) : 75,
        risk_adjusted_score: riskScoreMatch ? parseInt(riskScoreMatch[1]) : 70,
      },
      rebalancing_frequency: rebalanceMatch ? rebalanceMatch[1] : 'weekly',
      insights: insightsMatch ? insightsMatch[1].trim() : analysis,
      timestamp: Date.now(),
      risk_tolerance,
      total_capital,
    };

    return new Response(
      JSON.stringify(optimization),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
    
  } catch (error: any) {
    console.error('Error in portfolio optimizer:', error);
    
    const isAuthError = error.message?.includes('authorization') || 
                        error.message?.includes('token') || 
                        error.message?.includes('permission');
    
    return new Response(
      JSON.stringify({ error: isAuthError ? error.message : 'Failed to optimize portfolio. Please try again.' }),
      { status: isAuthError ? 401 : 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
