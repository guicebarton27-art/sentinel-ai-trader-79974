import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { 
      symbol = 'BTC/USD',
      side = 'buy',
      size = 0,
      order_type = 'market',
      urgency = 'normal'
    } = await req.json();
    
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY not configured');
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    
    console.log(`Routing ${side} order for ${size} ${symbol}`);

    // Fetch recent market data
    const { data: candles } = await supabase
      .from('historical_candles')
      .select('*')
      .eq('symbol', symbol)
      .eq('interval', '1h')
      .order('timestamp', { ascending: false })
      .limit(50);

    if (!candles || candles.length === 0) {
      throw new Error('No market data available');
    }

    const prices = candles.map(c => parseFloat(c.close.toString())).reverse();
    const volumes = candles.map(c => parseFloat(c.volume.toString())).reverse();
    const currentPrice = prices[prices.length - 1];
    const avgVolume = volumes.slice(-24).reduce((a, b) => a + b, 0) / 24;
    const recentVolume = volumes.slice(-3).reduce((a, b) => a + b, 0) / 3;

    // Calculate volatility
    const returns = prices.slice(-20).map((p, i, arr) => 
      i > 0 ? ((p - arr[i-1]) / arr[i-1]) : 0
    ).slice(1);
    const avgReturn = returns.reduce((a, b) => a + b, 0) / returns.length;
    const variance = returns.reduce((a, b) => a + Math.pow(b - avgReturn, 2), 0) / returns.length;
    const volatility = Math.sqrt(variance) * 100;

    // Calculate spread estimate (simplified)
    const spread = volatility * 0.1; // Rough estimate

    const prompt = `You are an advanced ML-powered execution router optimizing trade execution for ${symbol}.

Order Details:
- Side: ${side.toUpperCase()}
- Size: ${size}
- Type: ${order_type}
- Urgency: ${urgency}

Market Conditions:
- Current Price: $${currentPrice.toFixed(2)}
- Recent Volume: ${recentVolume.toFixed(2)}
- Average Volume (24h): ${avgVolume.toFixed(2)}
- Volume Ratio: ${(recentVolume / avgVolume).toFixed(2)}x
- Volatility: ${volatility.toFixed(2)}%
- Est. Spread: ${spread.toFixed(3)}%

Provide optimal execution strategy:

1. Recommended Venue: [exchange1/exchange2/aggregator/dex]
2. Order Type: [market/limit/iceberg/twap/vwap]
3. Execution Strategy: [immediate/patient/opportunistic/algorithmic]
4. Slice Count: [number of order slices]
5. Time Window: [execution time in minutes]
6. Limit Price: [price if applicable]
7. Expected Slippage: [percentage]
8. Expected Fill Time: [minutes]
9. Cost Estimate: [total cost in USD]
10. Price Impact: [percentage]
11. Alternative Routes: [list 2 backup routing strategies]
12. Risk Score: [0-100]
13. Execution Tips: [specific guidance on timing, conditions]
14. Market Impact Analysis: [assessment of how this order affects price]

Consider liquidity, spread, volatility, and market impact.`;

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: 'You are an expert execution trader specializing in smart order routing, algorithmic execution, and market microstructure optimization.' },
          { role: 'user', content: prompt }
        ],
      }),
    });

    if (!response.ok) {
      throw new Error(`AI API error: ${response.status}`);
    }

    const data = await response.json();
    const analysis = data.choices[0].message.content;
    
    console.log('Execution routing:', analysis);

    // Parse routing decision
    const venueMatch = analysis.match(/Recommended Venue[:\s]+([\w]+)/i);
    const typeMatch = analysis.match(/Order Type[:\s]+(market|limit|iceberg|twap|vwap)/i);
    const strategyMatch = analysis.match(/Execution Strategy[:\s]+([\w]+)/i);
    const sliceMatch = analysis.match(/Slice Count[:\s]+([0-9]+)/i);
    const timeMatch = analysis.match(/Time Window[:\s]+([0-9.]+)/i);
    const limitMatch = analysis.match(/Limit Price[:\s]+\$?([0-9,.]+)/i);
    const slippageMatch = analysis.match(/Expected Slippage[:\s]+([0-9.]+)/i);
    const fillMatch = analysis.match(/Expected Fill Time[:\s]+([0-9.]+)/i);
    const costMatch = analysis.match(/Cost Estimate[:\s]+\$?([0-9,.]+)/i);
    const impactMatch = analysis.match(/Price Impact[:\s]+([0-9.]+)/i);
    const riskMatch = analysis.match(/Risk Score[:\s]+([0-9]+)/i);
    const tipsMatch = analysis.match(/Execution Tips[:\s]+(.+?)(?=\n\d+\.|Market Impact|$)/is);
    const marketMatch = analysis.match(/Market Impact Analysis[:\s]+(.+)/is);

    const routing = {
      symbol,
      side,
      size,
      timestamp: Date.now(),
      recommended_venue: venueMatch ? venueMatch[1].toLowerCase() : 'exchange1',
      order_type: typeMatch ? typeMatch[1].toLowerCase() : order_type,
      execution_strategy: strategyMatch ? strategyMatch[1].toLowerCase() : 'immediate',
      slice_count: sliceMatch ? parseInt(sliceMatch[1]) : 1,
      time_window: timeMatch ? parseFloat(timeMatch[1]) : 5,
      limit_price: limitMatch ? parseFloat(limitMatch[1].replace(/,/g, '')) : currentPrice,
      expected_slippage: slippageMatch ? parseFloat(slippageMatch[1]) : 0.1,
      expected_fill_time: fillMatch ? parseFloat(fillMatch[1]) : 1,
      cost_estimate: costMatch ? parseFloat(costMatch[1].replace(/,/g, '')) : size * currentPrice,
      price_impact: impactMatch ? parseFloat(impactMatch[1]) : 0.05,
      risk_score: riskMatch ? parseInt(riskMatch[1]) : 50,
      execution_tips: tipsMatch ? tipsMatch[1].trim() : '',
      market_impact: marketMatch ? marketMatch[1].trim() : '',
      market_conditions: {
        current_price: currentPrice,
        volatility,
        volume_ratio: recentVolume / avgVolume,
        spread,
      },
      full_analysis: analysis,
    };

    return new Response(
      JSON.stringify(routing),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
    
  } catch (error) {
    console.error('Error in execution router:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
