import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface KrakenOHLC {
  0: number; // timestamp
  1: string; // open
  2: string; // high
  3: string; // low
  4: string; // close
  5: string; // vwap
  6: string; // volume
  7: number; // count
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { symbol, interval, since } = await req.json();
    
    console.log('Fetching historical data:', { symbol, interval, since });

    // Kraken API interval mapping
    const intervalMap: { [key: string]: number } = {
      '1m': 1,
      '5m': 5,
      '15m': 15,
      '30m': 30,
      '1h': 60,
      '4h': 240,
      '1d': 1440,
      '1w': 10080,
    };

    const krakenInterval = intervalMap[interval] || 60;
    const krakenSymbol = symbol.replace('/', '');

    // Fetch from Kraken public API
    const krakenUrl = `https://api.kraken.com/0/public/OHLC?pair=${krakenSymbol}&interval=${krakenInterval}${since ? `&since=${since}` : ''}`;
    
    console.log('Kraken API URL:', krakenUrl);
    
    const response = await fetch(krakenUrl);
    const data = await response.json();

    if (data.error && data.error.length > 0) {
      throw new Error(`Kraken API error: ${data.error.join(', ')}`);
    }

    // Extract OHLC data
    const pairKey = Object.keys(data.result).find(key => key !== 'last');
    if (!pairKey) {
      throw new Error('No data returned from Kraken');
    }

    const ohlcData: KrakenOHLC[] = data.result[pairKey];
    
    console.log(`Retrieved ${ohlcData.length} candles`);

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Prepare candles for insertion
    const candles = ohlcData.map((candle: KrakenOHLC) => ({
      symbol,
      interval,
      timestamp: candle[0],
      open: parseFloat(candle[1]),
      high: parseFloat(candle[2]),
      low: parseFloat(candle[3]),
      close: parseFloat(candle[4]),
      volume: parseFloat(candle[6]),
    }));

    // Insert candles (upsert to handle duplicates)
    const { error: insertError } = await supabase
      .from('historical_candles')
      .upsert(candles, { 
        onConflict: 'symbol,interval,timestamp',
        ignoreDuplicates: true 
      });

    if (insertError) {
      console.error('Insert error:', insertError);
      throw insertError;
    }

    console.log(`Successfully stored ${candles.length} candles`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        count: candles.length,
        last: data.result.last 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('Error fetching historical data:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
