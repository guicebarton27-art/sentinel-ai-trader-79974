import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { symbol = "BTC/USD", timeframes = ["1H", "4H", "24H"] } = await req.json();
    
    console.log('Generating predictions for:', symbol, 'timeframes:', timeframes);

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Fetch recent historical data
    const { data: candles, error } = await supabase
      .from('historical_candles')
      .select('*')
      .eq('symbol', symbol)
      .eq('interval', '1h')
      .order('timestamp', { ascending: false })
      .limit(100);

    if (error) {
      console.error('Error fetching candles:', error);
      throw error;
    }

    if (!candles || candles.length === 0) {
      throw new Error('No historical data available. Please fetch data first.');
    }

    // Calculate technical indicators
    const prices = candles.map(c => c.close).reverse();
    const volumes = candles.map(c => c.volume).reverse();
    const currentPrice = prices[prices.length - 1];

    // Simple Moving Average (SMA)
    const sma20 = prices.slice(-20).reduce((a, b) => a + b, 0) / 20;
    const sma50 = prices.slice(-50).reduce((a, b) => a + b, 0) / 50;

    // RSI calculation
    const gains: number[] = [];
    const losses: number[] = [];
    for (let i = 1; i < Math.min(14, prices.length); i++) {
      const change = prices[i] - prices[i - 1];
      gains.push(change > 0 ? change : 0);
      losses.push(change < 0 ? -change : 0);
    }
    const avgGain = gains.reduce((a, b) => a + b, 0) / gains.length;
    const avgLoss = losses.reduce((a, b) => a + b, 0) / losses.length;
    const rsi = 100 - (100 / (1 + (avgGain / (avgLoss || 0.0001))));

    // Volume trend
    const recentVolume = volumes.slice(-10).reduce((a, b) => a + b, 0) / 10;
    const olderVolume = volumes.slice(-20, -10).reduce((a, b) => a + b, 0) / 10;
    const volumeTrend = ((recentVolume - olderVolume) / olderVolume) * 100;

    // Price momentum
    const momentum = ((currentPrice - prices[prices.length - 20]) / prices[prices.length - 20]) * 100;

    const marketData = {
      currentPrice,
      sma20,
      sma50,
      rsi,
      volumeTrend,
      momentum,
      recentPrices: prices.slice(-10)
    };

    console.log('Market data calculated:', marketData);

    // Call Lovable AI for predictions
    const predictions = [];
    
    for (const timeframe of timeframes) {
      const prompt = `You are a cryptocurrency price prediction expert. Analyze the following market data for ${symbol} and provide a price prediction for the next ${timeframe}.

Current Price: $${currentPrice}
20-period SMA: $${sma20.toFixed(2)}
50-period SMA: $${sma50.toFixed(2)}
RSI: ${rsi.toFixed(2)}
Volume Trend: ${volumeTrend.toFixed(2)}%
Price Momentum (20 periods): ${momentum.toFixed(2)}%
Recent 10 prices: ${marketData.recentPrices.map(p => p.toFixed(2)).join(', ')}

Provide your prediction in the following format:
1. Predicted price (specific number)
2. Direction (up or down)
3. Confidence (0.0 to 1.0)
4. Expected change percentage
5. Brief reasoning (2-3 sentences)

Be realistic and consider:
- If RSI > 70, market may be overbought (bearish)
- If RSI < 30, market may be oversold (bullish)
- If price is above SMA20 and SMA50, bullish trend
- If volume is increasing with price, trend confirmation
- Recent momentum and price action`;

      const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          messages: [
            { role: "system", content: "You are an expert cryptocurrency analyst providing realistic price predictions based on technical analysis." },
            { role: "user", content: prompt }
          ],
        }),
      });

      if (!response.ok) {
        if (response.status === 429) {
          throw new Error("Rate limits exceeded, please try again later.");
        }
        if (response.status === 402) {
          throw new Error("Payment required, please add funds to your Lovable AI workspace.");
        }
        const errorText = await response.text();
        console.error("AI gateway error:", response.status, errorText);
        throw new Error("AI gateway error");
      }

      const aiResponse = await response.json();
      const analysis = aiResponse.choices[0].message.content;
      
      console.log(`AI analysis for ${timeframe}:`, analysis);

      // Parse the AI response
      const priceMatch = analysis.match(/predicted price[:\s]+\$?([\d,]+\.?\d*)/i);
      const confidenceMatch = analysis.match(/confidence[:\s]+(0?\.\d+|1\.0)/i);
      const directionMatch = analysis.match(/direction[:\s]+(up|down)/i);
      const changeMatch = analysis.match(/change[:\s]+(-?\d+\.?\d*)%?/i);

      const predictedPrice = priceMatch ? parseFloat(priceMatch[1].replace(/,/g, '')) : currentPrice;
      const confidence = confidenceMatch ? parseFloat(confidenceMatch[1]) : 0.7;
      const direction = directionMatch ? directionMatch[1].toLowerCase() : (predictedPrice > currentPrice ? 'up' : 'down');
      const change = changeMatch ? parseFloat(changeMatch[1]) : ((predictedPrice - currentPrice) / currentPrice) * 100;

      predictions.push({
        timeframe,
        currentPrice,
        predictedPrice,
        confidence,
        direction,
        change,
        reasoning: analysis
      });
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        predictions,
        symbol,
        timestamp: Date.now()
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('Error in predict-price function:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
