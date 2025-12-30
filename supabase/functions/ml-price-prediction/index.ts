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
    console.log(`User ${user.id} (${role}) requesting ML price prediction`);

    const { symbol = 'BTC/USD', horizons = ['1H', '4H', '24H', '7D'] } = await req.json();
    
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    if (!LOVABLE_API_KEY) {
      throw new Error('AI service not configured');
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    
    console.log(`Generating ML price predictions for ${symbol} across ${horizons.length} horizons`);

    // Fetch recent market data
    const { data: candles } = await supabase
      .from('historical_candles')
      .select('*')
      .eq('symbol', symbol)
      .eq('interval', '1h')
      .order('timestamp', { ascending: false })
      .limit(168); // 7 days of hourly data

    if (!candles || candles.length === 0) {
      throw new Error('No historical data available');
    }

    // Calculate technical indicators
    const prices = candles.map(c => parseFloat(c.close.toString())).reverse();
    const volumes = candles.map(c => parseFloat(c.volume.toString())).reverse();
    
    const currentPrice = prices[prices.length - 1];
    const sma20 = prices.slice(-20).reduce((a, b) => a + b, 0) / 20;
    const sma50 = prices.slice(-50).reduce((a, b) => a + b, 0) / Math.min(50, prices.length);
    
    // RSI calculation
    let gains = 0, losses = 0;
    for (let i = prices.length - 14; i < prices.length; i++) {
      const change = prices[i] - prices[i - 1];
      if (change > 0) gains += change;
      else losses -= change;
    }
    const rsi = 100 - (100 / (1 + (gains / 14) / (losses / 14)));
    
    // Volume trend
    const recentVolume = volumes.slice(-10).reduce((a, b) => a + b, 0) / 10;
    const olderVolume = volumes.slice(-20, -10).reduce((a, b) => a + b, 0) / 10;
    const volumeTrend = ((recentVolume - olderVolume) / olderVolume) * 100;

    // Momentum
    const momentum = ((currentPrice - prices[prices.length - 10]) / prices[prices.length - 10]) * 100;

    // Volatility (standard deviation)
    const returns = prices.slice(-20).map((p, i, arr) => i > 0 ? (p - arr[i-1]) / arr[i-1] : 0).slice(1);
    const avgReturn = returns.reduce((a, b) => a + b, 0) / returns.length;
    const variance = returns.reduce((a, b) => a + Math.pow(b - avgReturn, 2), 0) / returns.length;
    const volatility = Math.sqrt(variance) * 100;

    const predictions = [];
    const timestamp = Date.now();

    // Fetch recent sentiment for context
    const { data: sentimentData } = await supabase
      .from('sentiment_data')
      .select('sentiment_score, confidence, source')
      .eq('symbol', symbol)
      .order('created_at', { ascending: false })
      .limit(3);

    const avgSentiment = sentimentData && sentimentData.length > 0
      ? sentimentData.reduce((sum, s) => sum + parseFloat(s.sentiment_score.toString()), 0) / sentimentData.length
      : 0;

    for (const horizon of horizons) {
      const prompt = `You are an advanced ML price prediction model analyzing ${symbol}.

Current Market Data:
- Current Price: $${currentPrice.toFixed(2)}
- SMA(20): $${sma20.toFixed(2)}
- SMA(50): $${sma50.toFixed(2)}
- RSI(14): ${rsi.toFixed(2)}
- Momentum (10 periods): ${momentum.toFixed(2)}%
- Volatility (20 periods): ${volatility.toFixed(2)}%
- Volume Trend: ${volumeTrend.toFixed(2)}%
- Market Sentiment: ${avgSentiment.toFixed(2)} (${avgSentiment > 0.2 ? 'bullish' : avgSentiment < -0.2 ? 'bearish' : 'neutral'})

Prediction Horizon: ${horizon}

Using multi-model ensemble approach (combining TFT, N-BEATS, and LSTM patterns), provide your price prediction:

1. Predicted Price: [exact number]
2. Direction: [up/down/sideways]
3. Confidence: [0.0 to 1.0]
4. Expected Change %: [percentage]
5. Support Level: [price]
6. Resistance Level: [price]
7. Volatility Forecast: [low/medium/high]
8. Key Factors: [2-3 sentences explaining the prediction]

Be data-driven and realistic in your analysis.`;

      try {
        const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${LOVABLE_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'google/gemini-2.5-flash',
            messages: [
              { role: 'system', content: 'You are an expert quantitative analyst and ML engineer specializing in time-series price prediction for cryptocurrency markets.' },
              { role: 'user', content: prompt }
            ],
          }),
        });

        if (!response.ok) {
          console.error(`AI API error for ${horizon}: ${response.status}`);
          continue;
        }

        const data = await response.json();
        const analysis = data.choices[0].message.content;
        
        console.log(`ML prediction for ${horizon}:`, analysis);

        // Parse AI response
        const priceMatch = analysis.match(/Predicted Price[:\s]+\$?([0-9,.]+)/i);
        const directionMatch = analysis.match(/Direction[:\s]+(up|down|sideways)/i);
        const confidenceMatch = analysis.match(/Confidence[:\s]+([0-9.]+)/i);
        const changeMatch = analysis.match(/Expected Change[:\s%]+(-?[0-9.]+)/i);
        const supportMatch = analysis.match(/Support Level[:\s]+\$?([0-9,.]+)/i);
        const resistanceMatch = analysis.match(/Resistance Level[:\s]+\$?([0-9,.]+)/i);
        const volatilityMatch = analysis.match(/Volatility Forecast[:\s]+(low|medium|high)/i);
        const factorsMatch = analysis.match(/Key Factors[:\s]+(.+)/is);

        const predictedPrice = priceMatch ? parseFloat(priceMatch[1].replace(/,/g, '')) : currentPrice;
        const direction = directionMatch ? directionMatch[1].toLowerCase() : 'sideways';
        const confidence = confidenceMatch ? parseFloat(confidenceMatch[1]) : 0.6;
        const expectedChange = changeMatch ? parseFloat(changeMatch[1]) : 0;
        const supportLevel = supportMatch ? parseFloat(supportMatch[1].replace(/,/g, '')) : currentPrice * 0.97;
        const resistanceLevel = resistanceMatch ? parseFloat(resistanceMatch[1].replace(/,/g, '')) : currentPrice * 1.03;
        const volatilityForecast = volatilityMatch ? volatilityMatch[1].toLowerCase() : 'medium';
        const keyFactors = factorsMatch ? factorsMatch[1].trim() : analysis;

        const predictionData = {
          symbol,
          prediction_type: 'price',
          horizon,
          timestamp: Math.floor(timestamp / 1000),
          prediction_value: {
            price: predictedPrice,
            direction,
            change_percent: expectedChange,
            support: supportLevel,
            resistance: resistanceLevel,
            volatility: volatilityForecast,
            factors: keyFactors,
          },
          confidence,
          model_id: null, // Will be linked to model registry later
        };

        predictions.push(predictionData);

        // Store prediction
        const { error: insertError } = await supabase
          .from('ml_predictions')
          .insert(predictionData);

        if (insertError) {
          console.error(`Error storing ${horizon} prediction:`, insertError);
        }

        await new Promise(resolve => setTimeout(resolve, 500));
        
      } catch (error) {
        console.error(`Error analyzing ${horizon}:`, error);
        continue;
      }
    }

    return new Response(
      JSON.stringify({
        symbol,
        predictions,
        market_data: {
          current_price: currentPrice,
          sma20,
          sma50,
          rsi,
          momentum,
          volatility,
          volume_trend: volumeTrend,
          sentiment: avgSentiment,
        },
        timestamp,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
    
  } catch (error: any) {
    console.error('Error in ML price prediction:', error);
    
    const isAuthError = error.message?.includes('authorization') || 
                        error.message?.includes('token') || 
                        error.message?.includes('permission');
    
    return new Response(
      JSON.stringify({ error: isAuthError ? error.message : 'Failed to generate predictions. Please try again.' }),
      { status: isAuthError ? 401 : 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
