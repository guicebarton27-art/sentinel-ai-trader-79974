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
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    });

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Invalid or expired token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const body = await req.json();
    const { symbol = 'BTC/USD', interval = '1h', since, limit = 100 } = body;

    console.log(`User ${user.id} fetching candles for ${symbol} ${interval}`);

    // Kraken API interval mapping
    const intervalMap: { [key: string]: number } = {
      '1m': 1, '5m': 5, '15m': 15, '30m': 30,
      '1h': 60, '4h': 240, '1d': 1440, '1w': 10080,
    };

    const krakenInterval = intervalMap[interval] || 60;
    const krakenSymbol = symbol.replace('/', '');

    // First check DB for existing data
    const serviceClient = createClient(
      supabaseUrl,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const { data: existingCandles, error: dbError } = await serviceClient
      .from('historical_candles')
      .select('timestamp, open, high, low, close, volume')
      .eq('symbol', symbol)
      .eq('interval', interval)
      .order('timestamp', { ascending: false })
      .limit(limit);

    // If we have enough data, return it
    if (existingCandles && existingCandles.length >= limit * 0.8) {
      console.log(`Returning ${existingCandles.length} cached candles`);
      return new Response(
        JSON.stringify({
          success: true,
          source: 'cache',
          candles: existingCandles.reverse(),
          count: existingCandles.length
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Fetch from Kraken
    const krakenUrl = `https://api.kraken.com/0/public/OHLC?pair=${krakenSymbol}&interval=${krakenInterval}${since ? `&since=${since}` : ''}`;
    console.log('Fetching from Kraken:', krakenUrl);
    
    const response = await fetch(krakenUrl);
    const data = await response.json();

    if (data.error && data.error.length > 0) {
      console.error('Kraken API error:', data.error);
      // Return cached data if available
      if (existingCandles && existingCandles.length > 0) {
        return new Response(
          JSON.stringify({
            success: true,
            source: 'cache',
            candles: existingCandles.reverse(),
            count: existingCandles.length,
            warning: 'Using cached data due to API error'
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      throw new Error('Failed to fetch from market data provider');
    }

    const pairKey = Object.keys(data.result).find(key => key !== 'last');
    if (!pairKey) {
      throw new Error('No data returned from market data provider');
    }

    const ohlcData: KrakenOHLC[] = data.result[pairKey];
    console.log(`Retrieved ${ohlcData.length} candles from Kraken`);

    // Transform and upsert to DB
    const candles = ohlcData.map((c) => ({
      symbol,
      interval,
      timestamp: c[0],
      open: parseFloat(c[1]),
      high: parseFloat(c[2]),
      low: parseFloat(c[3]),
      close: parseFloat(c[4]),
      volume: parseFloat(c[6]),
    }));

    // Upsert to DB (dedupe on symbol, interval, timestamp)
    const { error: upsertError } = await serviceClient
      .from('historical_candles')
      .upsert(candles, {
        onConflict: 'symbol,interval,timestamp',
        ignoreDuplicates: true
      });

    if (upsertError) {
      console.error('Upsert error:', upsertError);
    }

    // Return the formatted candles
    const formattedCandles = candles.slice(-limit).map(c => ({
      timestamp: c.timestamp,
      open: c.open,
      high: c.high,
      low: c.low,
      close: c.close,
      volume: c.volume
    }));

    return new Response(
      JSON.stringify({
        success: true,
        source: 'kraken',
        candles: formattedCandles,
        count: formattedCandles.length,
        last: data.result.last
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    console.error('Error in fetch-candles:', error);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
