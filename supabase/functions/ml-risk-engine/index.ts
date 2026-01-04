import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

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
    console.log(`User ${user.id} (${role}) requesting ML risk analysis`);

    const { 
      symbol = 'BTC/USD',
      position_size = 0,
      entry_price = 0,
      account_balance = 10000 
    } = await req.json();
    
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    if (!LOVABLE_API_KEY) {
      throw new Error('AI service not configured');
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    
    console.log(`Running ML risk analysis for ${symbol}`);

    // Fetch recent market data
    const { data: candles } = await supabase
      .from('historical_candles')
      .select('*')
      .eq('symbol', symbol)
      .eq('interval', '1h')
      .order('timestamp', { ascending: false })
      .limit(168);

    if (!candles || candles.length === 0) {
      throw new Error('No historical data available');
    }

    // Calculate risk metrics
    const prices = candles.map(c => parseFloat(c.close.toString())).reverse();
    const volumes = candles.map(c => parseFloat(c.volume.toString())).reverse();
    
    const currentPrice = prices[prices.length - 1];
    
    // Calculate returns
    const returns = prices.slice(-50).map((p, i, arr) => 
      i > 0 ? ((p - arr[i-1]) / arr[i-1]) : 0
    ).slice(1);
    
    // Volatility (annualized)
    const avgReturn = returns.reduce((a, b) => a + b, 0) / returns.length;
    const variance = returns.reduce((a, b) => a + Math.pow(b - avgReturn, 2), 0) / returns.length;
    const volatility = Math.sqrt(variance * 365 * 24); // Annualized hourly volatility
    
    // Historical drawdown
    let peak = prices[0];
    let maxDrawdown = 0;
    for (const price of prices) {
      if (price > peak) peak = price;
      const drawdown = (peak - price) / peak;
      if (drawdown > maxDrawdown) maxDrawdown = drawdown;
    }
    
    // Value at Risk (95% confidence)
    const sortedReturns = [...returns].sort((a, b) => a - b);
    const var95 = sortedReturns[Math.floor(returns.length * 0.05)];
    
    // Downside deviation (for Sortino ratio)
    const downReturns = returns.filter(r => r < 0);
    const downVariance = downReturns.reduce((a, b) => a + Math.pow(b, 2), 0) / downReturns.length;
    const downsideDeviation = Math.sqrt(downVariance);
    
    // Fetch sentiment
    const { data: sentimentData } = await supabase
      .from('sentiment_data')
      .select('sentiment_score, confidence')
      .eq('symbol', symbol)
      .order('created_at', { ascending: false })
      .limit(5);

    const avgSentiment = sentimentData && sentimentData.length > 0
      ? sentimentData.reduce((sum, s) => sum + parseFloat(s.sentiment_score.toString()), 0) / sentimentData.length
      : 0;

    // Fetch recent predictions
    const { data: predictions } = await supabase
      .from('ml_predictions')
      .select('prediction_value, confidence')
      .eq('symbol', symbol)
      .order('created_at', { ascending: false })
      .limit(3);

    const avgPredictedChange = predictions && predictions.length > 0
      ? predictions.reduce((sum, p) => {
          const val = p.prediction_value as any;
          return sum + (val.change_percent || 0);
        }, 0) / predictions.length
      : 0;

    const prompt = `You are an advanced ML risk management system analyzing ${symbol}.

Current Risk Metrics:
- Current Price: $${currentPrice.toFixed(2)}
- Annualized Volatility: ${(volatility * 100).toFixed(2)}%
- Historical Max Drawdown: ${(maxDrawdown * 100).toFixed(2)}%
- Value at Risk (95%): ${(var95 * 100).toFixed(2)}%
- Downside Deviation: ${(downsideDeviation * 100).toFixed(2)}%
- Market Sentiment: ${avgSentiment.toFixed(2)}
- Predicted Price Change: ${avgPredictedChange.toFixed(2)}%

Position Details:
- Position Size: ${position_size} ${symbol.split('/')[0]}
- Entry Price: $${entry_price > 0 ? entry_price.toFixed(2) : 'N/A'}
- Account Balance: $${account_balance.toFixed(2)}
- Current Exposure: ${entry_price > 0 ? ((position_size * entry_price / account_balance) * 100).toFixed(2) : '0'}%

Provide comprehensive risk assessment:

1. Risk Level: [low/medium/high/extreme]
2. Volatility Forecast (24h): [percentage]
3. Drawdown Probability (24h): [0.0 to 1.0]
4. Recommended Position Size: [percentage of account]
5. Suggested Stop Loss: [price or percentage]
6. Suggested Take Profit: [price or percentage]
7. Max Leverage: [1x to 10x]
8. Portfolio Heat: [percentage]
9. Risk Score: [0 to 100]
10. Risk Factors: [list 3-4 key risk factors]
11. Recommendations: [2-3 actionable recommendations]

Use quantitative risk models and market regime analysis.`;

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: 'You are an expert quantitative risk analyst specializing in cryptocurrency risk management and portfolio protection.' },
          { role: 'user', content: prompt }
        ],
      }),
    });

    let analysis = '';
    let usedFallback = false;

    if (!response.ok) {
      if (response.status === 429) {
        console.log('Rate limited, using rule-based risk fallback');
        usedFallback = true;
        
        // Rule-based risk assessment fallback
        const riskLevel = volatility > 0.8 ? 'high' : volatility > 0.4 ? 'medium' : 'low';
        const riskScore = Math.min(100, Math.floor(volatility * 50 + maxDrawdown * 100 + Math.abs(var95) * 200));
        const recommendedSize = volatility > 0.6 ? 2 : volatility > 0.3 ? 5 : 10;
        const stopLoss = currentPrice * (1 - Math.max(0.02, volatility * 0.1));
        const takeProfit = currentPrice * (1 + Math.max(0.03, volatility * 0.15));
        const maxLev = volatility > 0.6 ? 2 : volatility > 0.3 ? 5 : 10;
        
        analysis = `1. Risk Level: ${riskLevel}
2. Volatility Forecast (24h): ${(volatility * 100).toFixed(1)}%
3. Drawdown Probability (24h): ${(maxDrawdown * 0.5).toFixed(2)}
4. Recommended Position Size: ${recommendedSize}%
5. Suggested Stop Loss: $${stopLoss.toFixed(2)}
6. Suggested Take Profit: $${takeProfit.toFixed(2)}
7. Max Leverage: ${maxLev}x
8. Portfolio Heat: ${Math.min(100, riskScore * 0.8).toFixed(0)}%
9. Risk Score: ${riskScore}
10. Risk Factors: Volatility at ${(volatility * 100).toFixed(1)}%, Max drawdown ${(maxDrawdown * 100).toFixed(1)}%, VaR ${(Math.abs(var95) * 100).toFixed(1)}%
11. Recommendations: Monitor volatility closely, use stop-losses, consider position sizing based on current market conditions.`;
      } else if (response.status === 402) {
        console.error('Payment required for AI service');
        throw new Error('AI credits exhausted. Please add funds to continue.');
      } else {
        const errorText = await response.text();
        console.error('AI API error:', response.status, errorText);
        throw new Error('AI service temporarily unavailable');
      }
    } else {
      const data = await response.json();
      analysis = data.choices[0].message.content;
    }
    
    console.log('ML risk analysis:', usedFallback ? '(fallback)' : '(AI)', analysis.slice(0, 150));

    // Parse risk assessment
    const riskLevelMatch = analysis.match(/Risk Level[:\s]+(low|medium|high|extreme)/i);
    const volForecastMatch = analysis.match(/Volatility Forecast[^:]+[:\s]+([0-9.]+)/i);
    const drawdownProbMatch = analysis.match(/Drawdown Probability[^:]+[:\s]+([0-9.]+)/i);
    const posSizeMatch = analysis.match(/Recommended Position Size[^:]+[:\s]+([0-9.]+)/i);
    const stopLossMatch = analysis.match(/Suggested Stop Loss[^:]+[:\s]+\$?([0-9.]+)/i);
    const takeProfitMatch = analysis.match(/Suggested Take Profit[^:]+[:\s]+\$?([0-9.]+)/i);
    const leverageMatch = analysis.match(/Max Leverage[^:]+[:\s]+([0-9.]+)/i);
    const heatMatch = analysis.match(/Portfolio Heat[^:]+[:\s]+([0-9.]+)/i);
    const scoreMatch = analysis.match(/Risk Score[^:]+[:\s]+([0-9]+)/i);
    const factorsMatch = analysis.match(/Risk Factors[:\s]+(.+?)(?=\n\d+\.|$)/is);
    const recsMatch = analysis.match(/Recommendations[:\s]+(.+)/is);

    const riskAssessment = {
      symbol,
      timestamp: Date.now(),
      risk_level: riskLevelMatch ? riskLevelMatch[1].toLowerCase() : 'medium',
      volatility_forecast: volForecastMatch ? parseFloat(volForecastMatch[1]) : volatility * 100,
      drawdown_probability: drawdownProbMatch ? parseFloat(drawdownProbMatch[1]) : 0.2,
      recommended_position_size: posSizeMatch ? parseFloat(posSizeMatch[1]) : 5,
      stop_loss: stopLossMatch ? parseFloat(stopLossMatch[1]) : currentPrice * 0.95,
      take_profit: takeProfitMatch ? parseFloat(takeProfitMatch[1]) : currentPrice * 1.05,
      max_leverage: leverageMatch ? parseFloat(leverageMatch[1]) : 3,
      portfolio_heat: heatMatch ? parseFloat(heatMatch[1]) : 10,
      risk_score: scoreMatch ? parseInt(scoreMatch[1]) : 50,
      risk_factors: factorsMatch ? factorsMatch[1].trim() : '',
      recommendations: recsMatch ? recsMatch[1].trim() : '',
      metrics: {
        current_volatility: volatility,
        max_drawdown: maxDrawdown,
        var95,
        downside_deviation: downsideDeviation,
        sentiment: avgSentiment,
      },
    };

    return new Response(
      JSON.stringify(riskAssessment),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
    
  } catch (error: any) {
    console.error('Error in ML risk engine:', error);
    
    const isAuthError = error.message?.includes('authorization') || 
                        error.message?.includes('token') || 
                        error.message?.includes('permission');
    
    return new Response(
      JSON.stringify({ error: isAuthError ? error.message : 'Failed to analyze risk. Please try again.' }),
      { status: isAuthError ? 401 : 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
