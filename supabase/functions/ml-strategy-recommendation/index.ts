import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { fetchWithResilience, getAiModelConfig, requireAiConfig } from "../_shared/ai.ts";
import { logError, logInfo, logWarn } from "../_shared/logging.ts";

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
    const traceId = crypto.randomUUID();
    logInfo({
      component: 'ml-strategy-recommendation',
      message: 'ML strategy recommendation request',
      trace_id: traceId,
      context: { user_id: user.id, role },
    });

    const { 
      symbol = 'BTC/USD',
      account_balance = 10000,
      risk_tolerance = 'moderate',
      current_positions = []
    } = await req.json();
    
    const aiConfig = requireAiConfig();
    const modelConfig = getAiModelConfig();
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    
    logInfo({
      component: 'ml-strategy-recommendation',
      message: 'Generating ML strategy recommendations',
      trace_id: traceId,
      context: { symbol, model: modelConfig.model, version: modelConfig.version },
    });

    // Fetch recent predictions
    const { data: predictions } = await supabase
      .from('ml_predictions')
      .select('*')
      .eq('symbol', symbol)
      .order('created_at', { ascending: false })
      .limit(5);

    // Fetch sentiment
    const { data: sentiment } = await supabase
      .from('sentiment_data')
      .select('*')
      .eq('symbol', symbol)
      .order('created_at', { ascending: false })
      .limit(5);

    // Fetch recent candles
    const { data: candles } = await supabase
      .from('historical_candles')
      .select('*')
      .eq('symbol', symbol)
      .eq('interval', '1h')
      .order('timestamp', { ascending: false })
      .limit(100);

    if (!candles || candles.length === 0) {
      throw new Error('No historical data available');
    }

    const prices = candles.map(c => parseFloat(c.close.toString())).reverse();
    const currentPrice = prices[prices.length - 1];

    // Calculate technical indicators
    const sma20 = prices.slice(-20).reduce((a, b) => a + b, 0) / 20;
    const sma50 = prices.slice(-50).reduce((a, b) => a + b, 0) / Math.min(50, prices.length);
    const ema12 = prices.slice(-12).reduce((a, b) => a + b, 0) / 12;
    const ema26 = prices.slice(-26).reduce((a, b) => a + b, 0) / 26;
    const macd = ema12 - ema26;

    // RSI
    let gains = 0, losses = 0;
    for (let i = prices.length - 14; i < prices.length; i++) {
      const change = prices[i] - prices[i - 1];
      if (change > 0) gains += change;
      else losses -= change;
    }
    const rsi = 100 - (100 / (1 + (gains / 14) / (losses / 14)));

    // Volatility
    const returns = prices.slice(-20).map((p, i, arr) => 
      i > 0 ? ((p - arr[i-1]) / arr[i-1]) : 0
    ).slice(1);
    const avgReturn = returns.reduce((a, b) => a + b, 0) / returns.length;
    const variance = returns.reduce((a, b) => a + Math.pow(b - avgReturn, 2), 0) / returns.length;
    const volatility = Math.sqrt(variance) * 100;

    // Aggregate ML signals
    const avgPredictedChange = predictions && predictions.length > 0
      ? predictions.reduce((sum, p) => {
          const val = p.prediction_value as any;
          return sum + (val.change_percent || 0);
        }, 0) / predictions.length
      : 0;

    const avgSentiment = sentiment && sentiment.length > 0
      ? sentiment.reduce((sum, s) => sum + parseFloat(s.sentiment_score.toString()), 0) / sentiment.length
      : 0;

    const prompt = `You are an advanced ML strategy recommendation system analyzing ${symbol}.

Current Market State:
- Price: $${currentPrice.toFixed(2)}
- SMA(20): $${sma20.toFixed(2)}
- SMA(50): $${sma50.toFixed(2)}
- MACD: ${macd.toFixed(4)}
- RSI(14): ${rsi.toFixed(2)}
- Volatility: ${volatility.toFixed(2)}%
- ML Predicted Change: ${avgPredictedChange.toFixed(2)}%
- Market Sentiment: ${avgSentiment.toFixed(2)}

Trading Context:
- Account Balance: $${account_balance.toFixed(2)}
- Risk Tolerance: ${risk_tolerance}
- Current Positions: ${current_positions.length}

Analyze and provide strategy recommendations:

1. Primary Strategy: [trend_following/mean_reversion/momentum/breakout/scalping]
2. Action: [buy/sell/hold]
3. Confidence: [0.0 to 1.0]
4. Entry Price: [price level]
5. Position Size: [percentage of account]
6. Stop Loss: [price level]
7. Take Profit Targets: [3 levels with percentages]
8. Time Horizon: [scalp/intraday/swing/position]
9. Market Regime: [trending/ranging/volatile/quiet]
10. Risk/Reward Ratio: [number]
11. Alternative Strategies: [list 2 backup strategies]
12. Key Signals: [bullet points of technical/ML signals supporting this]
13. Risk Factors: [bullet points of risks]
14. Execution Notes: [specific guidance on order types, timing]

Be precise and actionable.`;

    const response = await fetchWithResilience('ml-strategy-recommendation', aiConfig.gatewayUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${aiConfig.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: aiConfig.model,
        messages: [
          { role: 'system', content: 'You are an expert quantitative trading strategist specializing in algorithmic strategy design and ML-powered trading systems.' },
          { role: 'user', content: prompt }
        ],
      }),
    });

    let analysis = '';
    let usedFallback = false;

    if (!response.ok) {
      if (response.status === 429) {
        logWarn({
          component: 'ml-strategy-recommendation',
          message: 'Rate limited, using rule-based fallback',
          trace_id: traceId,
        });
        usedFallback = true;
        // Generate rule-based recommendation when rate limited
        const trend = currentPrice > sma20 && sma20 > sma50 ? 'bullish' : 
                     currentPrice < sma20 && sma20 < sma50 ? 'bearish' : 'neutral';
        const action = trend === 'bullish' && rsi < 70 ? 'buy' : 
                      trend === 'bearish' && rsi > 30 ? 'sell' : 'hold';
        const regime = volatility > 3 ? 'volatile' : volatility < 1 ? 'quiet' : 'trending';
        
        analysis = `1. Primary Strategy: ${trend === 'bullish' ? 'trend_following' : trend === 'bearish' ? 'mean_reversion' : 'momentum'}
2. Action: ${action}
3. Confidence: ${Math.abs(avgPredictedChange) > 2 ? 0.8 : 0.6}
4. Entry Price: $${currentPrice.toFixed(2)}
5. Position Size: ${risk_tolerance === 'aggressive' ? 10 : risk_tolerance === 'conservative' ? 3 : 5}%
6. Stop Loss: $${(currentPrice * (action === 'buy' ? 0.97 : 1.03)).toFixed(2)}
7. Take Profit Targets: $${(currentPrice * 1.02).toFixed(2)} (50%), $${(currentPrice * 1.04).toFixed(2)} (30%), $${(currentPrice * 1.06).toFixed(2)} (20%)
8. Time Horizon: swing
9. Market Regime: ${regime}
10. Risk/Reward Ratio: 2.5
11. Alternative Strategies: scalping, breakout
12. Key Signals: Price ${currentPrice > sma20 ? 'above' : 'below'} SMA20, RSI at ${rsi.toFixed(1)}, MACD ${macd > 0 ? 'positive' : 'negative'}
13. Risk Factors: Market volatility at ${volatility.toFixed(1)}%, sentiment ${avgSentiment > 0 ? 'positive' : 'mixed'}
14. Execution Notes: Use limit orders, scale into position`;
      } else if (response.status === 402) {
        logError({
          component: 'ml-strategy-recommendation',
          message: 'Payment required for AI service',
          trace_id: traceId,
        });
        throw new Error('AI credits exhausted. Please add funds to continue.');
      } else {
        const errorText = await response.text();
        logWarn({
          component: 'ml-strategy-recommendation',
          message: 'AI API error',
          trace_id: traceId,
          context: { status: response.status, error: errorText },
        });
        throw new Error('AI service temporarily unavailable');
      }
    } else {
      const data = await response.json();
      analysis = data.choices[0].message.content;
    }
    
    logInfo({
      component: 'ml-strategy-recommendation',
      message: 'Strategy recommendation parsed',
      trace_id: traceId,
      context: { usedFallback },
    });

    // Parse recommendations
    const strategyMatch = analysis.match(/Primary Strategy[:\s]+([\w_]+)/i);
    const actionMatch = analysis.match(/Action[:\s]+(buy|sell|hold)/i);
    const confidenceMatch = analysis.match(/Confidence[:\s]+([0-9.]+)/i);
    const entryMatch = analysis.match(/Entry Price[:\s]+\$?([0-9,.]+)/i);
    const sizeMatch = analysis.match(/Position Size[:\s]+([0-9.]+)/i);
    const stopMatch = analysis.match(/Stop Loss[:\s]+\$?([0-9,.]+)/i);
    const horizonMatch = analysis.match(/Time Horizon[:\s]+(scalp|intraday|swing|position)/i);
    const regimeMatch = analysis.match(/Market Regime[:\s]+([\w]+)/i);
    const rrMatch = analysis.match(/Risk\/Reward Ratio[:\s]+([0-9.]+)/i);
    const signalsMatch = analysis.match(/Key Signals[:\s]+(.+?)(?=\n\d+\.|Risk Factors)/is);
    const risksMatch = analysis.match(/Risk Factors[:\s]+(.+?)(?=\n\d+\.|Execution Notes|$)/is);
    const executionMatch = analysis.match(/Execution Notes[:\s]+(.+)/is);

    const recommendation = {
      symbol,
      timestamp: Date.now(),
      primary_strategy: strategyMatch ? strategyMatch[1].toLowerCase() : 'momentum',
      action: actionMatch ? actionMatch[1].toLowerCase() : 'hold',
      confidence: confidenceMatch ? parseFloat(confidenceMatch[1]) : 0.7,
      entry_price: entryMatch ? parseFloat(entryMatch[1].replace(/,/g, '')) : currentPrice,
      position_size: sizeMatch ? parseFloat(sizeMatch[1]) : 5,
      stop_loss: stopMatch ? parseFloat(stopMatch[1].replace(/,/g, '')) : currentPrice * 0.97,
      time_horizon: horizonMatch ? horizonMatch[1].toLowerCase() : 'swing',
      market_regime: regimeMatch ? regimeMatch[1].toLowerCase() : 'trending',
      risk_reward_ratio: rrMatch ? parseFloat(rrMatch[1]) : 2.0,
      key_signals: signalsMatch ? signalsMatch[1].trim() : '',
      risk_factors: risksMatch ? risksMatch[1].trim() : '',
      execution_notes: executionMatch ? executionMatch[1].trim() : '',
      technical_context: {
        rsi,
        macd,
        sma20,
        sma50,
        volatility,
        current_price: currentPrice,
      },
      ml_context: {
        predicted_change: avgPredictedChange,
        sentiment: avgSentiment,
      },
      full_analysis: analysis,
      model_version: modelConfig.version,
      trace_id: traceId,
      used_fallback: usedFallback,
    };

    return new Response(
      JSON.stringify(recommendation),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
    
  } catch (error: any) {
    logError({
      component: 'ml-strategy-recommendation',
      message: 'Error in strategy recommendation',
      context: { error: error.message },
    });
    
    const isAuthError = error.message?.includes('authorization') || 
                        error.message?.includes('token') || 
                        error.message?.includes('permission');
    
    return new Response(
      JSON.stringify({ error: isAuthError ? error.message : 'Failed to generate strategy recommendation. Please try again.' }),
      { status: isAuthError ? 401 : 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
