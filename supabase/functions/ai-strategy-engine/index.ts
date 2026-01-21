import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { fetchWithResilience } from "../_shared/ai.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface MarketState {
  symbol: string;
  currentPrice: number;
  priceChange24h: number;
  volume24h: number;
  sentiment: number;
  volatility: number;
  trendStrength: number;
}

interface StrategyDecision {
  action: 'BUY' | 'SELL' | 'HOLD';
  confidence: number;
  reasoning: string;
  positionSize: number;
  stopLoss: number;
  takeProfit: number;
  riskScore: number;
  expectedReturn: number;
  timeHorizon: string;
}

async function authenticateUser(req: Request, supabase: any) {
  const serviceHeader = req.headers.get('x-service-role');
  if (serviceHeader && serviceHeader === Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')) {
    return { user: { id: 'service-role' }, role: 'service' };
  }

  const authHeader = req.headers.get('Authorization');
  if (!authHeader) {
    throw new Error('Missing authorization header');
  }

  const token = authHeader.replace('Bearer ', '');
  const { data: { user }, error } = await supabase.auth.getUser(token);
  
  if (error || !user) {
    throw new Error('Invalid or expired token');
  }

  const { data: roleData } = await supabase
    .from('user_roles')
    .select('role')
    .eq('user_id', user.id)
    .single();

  if (!roleData || !['admin', 'trader'].includes(roleData.role)) {
    throw new Error('Insufficient permissions - requires admin or trader role');
  }

  return { user, role: roleData.role };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    await authenticateUser(req, supabase);

    const { marketState, portfolio, riskTolerance = 'moderate' } = await req.json();

    if (!marketState || !marketState.symbol) {
      throw new Error('Market state with symbol is required');
    }

    // Fetch recent predictions and backtest data for context
    const [predictionsResult, backtestResult, sentimentResult] = await Promise.all([
      supabase
        .from('ml_predictions')
        .select('*')
        .eq('symbol', marketState.symbol)
        .order('timestamp', { ascending: false })
        .limit(10),
      supabase
        .from('backtest_runs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(5),
      supabase
        .from('sentiment_data')
        .select('*')
        .eq('symbol', marketState.symbol)
        .order('timestamp', { ascending: false })
        .limit(5)
    ]);

    const recentPredictions = predictionsResult.data || [];
    const backtestHistory = backtestResult.data || [];
    const sentimentHistory = sentimentResult.data || [];

    // Calculate aggregated metrics
    const avgSentiment = sentimentHistory.length > 0
      ? sentimentHistory.reduce((sum, s) => sum + (s.sentiment_score || 0), 0) / sentimentHistory.length
      : 0;

    const avgBacktestReturn = backtestHistory.length > 0
      ? backtestHistory.reduce((sum, b) => sum + (b.total_return || 0), 0) / backtestHistory.length
      : 0;

    const avgWinRate = backtestHistory.length > 0
      ? backtestHistory.reduce((sum, b) => sum + (b.win_rate || 0), 0) / backtestHistory.length
      : 0;

    // Construct AI prompt for strategy decision
    const systemPrompt = `You are an advanced AI trading strategy engine using reinforcement learning principles.
Your goal is to maximize risk-adjusted returns while managing downside risk.

You analyze market conditions and make trading decisions based on:
1. Price action and momentum indicators
2. Market sentiment analysis
3. Historical backtest performance
4. Portfolio risk constraints
5. Volatility regime detection

Risk Tolerance Levels:
- conservative: Max 1% position size, tight stops, focus on capital preservation
- moderate: Max 3% position size, balanced approach
- aggressive: Max 5% position size, higher risk for higher potential returns

Always provide structured decisions with clear reasoning.`;

    const userPrompt = `Analyze the following market state and provide a trading decision:

MARKET STATE:
- Symbol: ${marketState.symbol}
- Current Price: $${marketState.currentPrice}
- 24h Price Change: ${marketState.priceChange24h}%
- 24h Volume: $${marketState.volume24h}
- Sentiment Score: ${marketState.sentiment || avgSentiment} (-1 to 1 scale)
- Volatility: ${marketState.volatility}%
- Trend Strength: ${marketState.trendStrength || 'neutral'}

HISTORICAL CONTEXT:
- Recent Predictions: ${JSON.stringify(recentPredictions.slice(0, 3).map(p => ({ type: p.prediction_type, value: p.prediction_value, confidence: p.confidence })))}
- Avg Backtest Return: ${avgBacktestReturn.toFixed(2)}%
- Avg Win Rate: ${(avgWinRate * 100).toFixed(1)}%
- Avg Sentiment: ${avgSentiment.toFixed(2)}

PORTFOLIO STATE:
${portfolio ? JSON.stringify(portfolio) : 'Not provided'}

RISK TOLERANCE: ${riskTolerance}

Based on this analysis, provide your trading decision.`;

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY is not configured');
    }

    const aiResponse = await fetchWithResilience('ai-strategy-engine', 'https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        tools: [
          {
            type: 'function',
            function: {
              name: 'make_trading_decision',
              description: 'Generate a structured trading decision based on market analysis',
              parameters: {
                type: 'object',
                properties: {
                  action: {
                    type: 'string',
                    enum: ['BUY', 'SELL', 'HOLD'],
                    description: 'The recommended trading action'
                  },
                  confidence: {
                    type: 'number',
                    description: 'Confidence level 0-100'
                  },
                  reasoning: {
                    type: 'string',
                    description: 'Detailed explanation of the decision'
                  },
                  positionSize: {
                    type: 'number',
                    description: 'Recommended position size as percentage of portfolio (0-10)'
                  },
                  stopLoss: {
                    type: 'number',
                    description: 'Stop loss percentage below entry (1-20)'
                  },
                  takeProfit: {
                    type: 'number',
                    description: 'Take profit percentage above entry (1-50)'
                  },
                  riskScore: {
                    type: 'number',
                    description: 'Risk score 1-10 where 10 is highest risk'
                  },
                  expectedReturn: {
                    type: 'number',
                    description: 'Expected return percentage'
                  },
                  timeHorizon: {
                    type: 'string',
                    enum: ['scalp', 'intraday', 'swing', 'position'],
                    description: 'Recommended time horizon for the trade'
                  }
                },
                required: ['action', 'confidence', 'reasoning', 'positionSize', 'stopLoss', 'takeProfit', 'riskScore', 'expectedReturn', 'timeHorizon'],
                additionalProperties: false
              }
            }
          }
        ],
        tool_choice: { type: 'function', function: { name: 'make_trading_decision' } }
      }),
    });

    if (!aiResponse.ok) {
      if (aiResponse.status === 429) {
        return new Response(JSON.stringify({ error: 'Rate limit exceeded, please try again later' }), {
          status: 429,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      if (aiResponse.status === 402) {
        return new Response(JSON.stringify({ error: 'AI credits exhausted, please add funds' }), {
          status: 402,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      const errorText = await aiResponse.text();
      console.error('AI API error:', aiResponse.status, errorText);
      throw new Error('AI service temporarily unavailable');
    }

    const aiData = await aiResponse.json();
    console.log('AI Response:', JSON.stringify(aiData));

    let decision: StrategyDecision;

    // Parse tool call response
    const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
    if (toolCall?.function?.arguments) {
      decision = JSON.parse(toolCall.function.arguments);
    } else {
      // Fallback decision if AI doesn't use tool
      decision = {
        action: 'HOLD',
        confidence: 50,
        reasoning: 'Unable to determine clear market direction. Waiting for better signal.',
        positionSize: 0,
        stopLoss: 5,
        takeProfit: 10,
        riskScore: 5,
        expectedReturn: 0,
        timeHorizon: 'swing'
      };
    }

    // Store the decision in ML predictions
    await supabase.from('ml_predictions').insert({
      symbol: marketState.symbol,
      prediction_type: 'strategy_decision',
      prediction_value: decision,
      confidence: decision.confidence / 100,
      timestamp: Date.now(),
      horizon: decision.timeHorizon
    });

    return new Response(JSON.stringify({
      success: true,
      decision,
      context: {
        avgSentiment,
        avgBacktestReturn,
        avgWinRate,
        recentPredictionsCount: recentPredictions.length
      },
      timestamp: new Date().toISOString()
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('AI Strategy Engine error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const isAuthError = errorMessage.includes('authorization') || 
                        errorMessage.includes('token') || 
                        errorMessage.includes('permissions');
    
    return new Response(JSON.stringify({ 
      error: isAuthError ? 'Authentication failed' : (errorMessage || 'Strategy analysis failed')
    }), {
      status: isAuthError ? 401 : 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
