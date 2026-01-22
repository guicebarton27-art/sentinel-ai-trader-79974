import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Input validation schema
const HistoricalDataSchema = z.object({
  symbol: z.string()
    .min(1, "Symbol is required")
    .max(20, "Symbol too long")
    .regex(/^[A-Z0-9]{2,10}\/[A-Z]{2,5}$|^[A-Z0-9]{4,12}$/, "Invalid symbol format (e.g., BTC/USD or BTCUSD)"),
  interval: z.enum(['1m', '5m', '15m', '30m', '1h', '4h', '1d', '1w'], {
    errorMap: () => ({ message: "Invalid interval. Use: 1m, 5m, 15m, 30m, 1h, 4h, 1d, 1w" })
  }),
  since: z.number().int().positive().optional(),
});

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

  return { user: { id: user.id, email: user.email ?? 'unknown' }, role };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Authenticate user and verify role
    const { user, role } = await authenticateUser(req);
    console.log(`User ${user.id} (${role}) fetching historical data`);

    // Parse and validate input
    const rawInput = await req.json();
    const parseResult = HistoricalDataSchema.safeParse(rawInput);
    
    if (!parseResult.success) {
      const errorMessage = parseResult.error.errors.map(e => e.message).join(', ');
      console.error('Validation error:', errorMessage);
      return new Response(
        JSON.stringify({ error: 'Invalid input', details: errorMessage }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { symbol, interval, since } = parseResult.data;
    
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
      throw new Error(`External API error. Please try again.`);
    }

    // Extract OHLC data
    const pairKey = Object.keys(data.result).find(key => key !== 'last');
    if (!pairKey) {
      throw new Error('No data returned from market data provider');
    }

    const ohlcData: KrakenOHLC[] = data.result[pairKey];
    
    console.log(`Retrieved ${ohlcData.length} candles`);

    // Initialize Supabase client with service role
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
      throw new Error('Failed to store historical data');
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
    
    const isAuthError = error.message?.includes('authorization') || 
                        error.message?.includes('token') || 
                        error.message?.includes('permission');
    
    return new Response(
      JSON.stringify({ error: isAuthError ? error.message : 'Failed to fetch historical data. Please try again.' }),
      { 
        status: isAuthError ? 401 : 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
