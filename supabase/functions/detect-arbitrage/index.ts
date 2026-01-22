import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ArbitrageOpportunity {
  path: string[];
  profitPercentage: number;
  volume: number;
  timestamp: number;
  prices: { [key: string]: number };
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

  return { user, role };
}

// Calculate triangular arbitrage opportunities from real Kraken data
function calculateTriangularArbitrage(tickers: any): ArbitrageOpportunity[] {
  const opportunities: ArbitrageOpportunity[] = [];
  const now = Date.now();
  
  // Define triangular paths and their trading fees
  const triangularPaths = [
    { 
      path: ['BTC/USD', 'ETH/USD', 'ETH/BTC'],
      pairs: ['XXBTZUSD', 'XETHZUSD', 'XETHXXBT'],
      volumeKey: 'XXBTZUSD'
    },
    { 
      path: ['BTC/USD', 'XRP/USD', 'XRP/BTC'],
      pairs: ['XXBTZUSD', 'XXRPZUSD', 'XXRPXXBT'],
      volumeKey: 'XXBTZUSD'
    },
    { 
      path: ['ETH/USD', 'XRP/USD', 'XRP/ETH'],
      pairs: ['XETHZUSD', 'XXRPZUSD', 'XETHXXRP'],
      volumeKey: 'XETHZUSD'
    }
  ];
  
  const feePerTrade = 0.0026; // 0.26% Kraken fee
  const totalFees = feePerTrade * 3;
  
  for (const { path, pairs, volumeKey } of triangularPaths) {
    try {
      // Check if all pairs exist
      const allPairsExist = pairs.every(p => tickers[p]?.c?.[0]);
      if (!allPairsExist) continue;
      
      // Get real prices from Kraken tickers
      const prices: { [key: string]: number } = {};
      pairs.forEach((p, i) => {
        prices[path[i]] = parseFloat(tickers[p].c[0]);
      });
      
      // Calculate forward path profit
      // Start with $1000 USD
      // Path: USD -> BTC -> ETH -> USD (for BTC/USD, ETH/USD, ETH/BTC path)
      let amount = 1000;
      
      // Buy first asset with USD
      const firstPrice = parseFloat(tickers[pairs[0]].c[0]);
      amount = (amount / firstPrice) * (1 - feePerTrade);
      
      // Sell for second asset  
      const secondPrice = parseFloat(tickers[pairs[1]].c[0]);
      const crossRate = parseFloat(tickers[pairs[2]].c[0]);
      
      // For ETH/BTC path: we have BTC, buy ETH, then sell ETH for USD
      amount = (amount / crossRate) * (1 - feePerTrade); // Now have ETH
      amount = (amount * secondPrice) * (1 - feePerTrade); // Back to USD
      
      const profitPercentage = ((amount - 1000) / 1000) * 100;
      
      // Also check reverse path
      let reverseAmount = 1000;
      reverseAmount = (reverseAmount / secondPrice) * (1 - feePerTrade); // Buy ETH
      reverseAmount = (reverseAmount * crossRate) * (1 - feePerTrade); // Sell for BTC
      reverseAmount = (reverseAmount * firstPrice) * (1 - feePerTrade); // Sell BTC for USD
      
      const reverseProfitPercentage = ((reverseAmount - 1000) / 1000) * 100;
      
      // Get 24h volume from the main pair
      const volume24h = parseFloat(tickers[volumeKey]?.v?.[1] || '0') * firstPrice;
      
      // Only include if profitable after fees (threshold: 0.05%)
      if (profitPercentage > 0.05) {
        opportunities.push({
          path,
          profitPercentage: Math.round(profitPercentage * 1000) / 1000,
          volume: Math.round(volume24h),
          timestamp: now,
          prices
        });
      }
      
      if (reverseProfitPercentage > 0.05) {
        opportunities.push({
          path: [...path].reverse(),
          profitPercentage: Math.round(reverseProfitPercentage * 1000) / 1000,
          volume: Math.round(volume24h),
          timestamp: now,
          prices
        });
      }
    } catch (e) {
      console.error(`Error calculating path ${path.join(' -> ')}:`, e);
    }
  }
  
  // Sort by profit percentage descending
  opportunities.sort((a, b) => b.profitPercentage - a.profitPercentage);
  
  return opportunities;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Authenticate user and verify role
    const { user, role } = await authenticateUser(req);
    console.log(`User ${user.id} (${role}) detecting arbitrage opportunities`);

    console.log('Fetching real-time ticker data from Kraken...');

    // Fetch ticker data from Kraken for multiple pairs
    const krakenUrl = 'https://api.kraken.com/0/public/Ticker?pair=BTCUSD,ETHUSD,ETHBTC,XRPUSD,XRPBTC';
    const response = await fetch(krakenUrl);
    const data = await response.json();

    if (data.error && data.error.length > 0) {
      console.error('Kraken API error:', data.error);
      throw new Error('Failed to fetch market data from Kraken');
    }

    const tickers = data.result;
    console.log('Received tickers for pairs:', Object.keys(tickers));

    // Calculate real arbitrage opportunities
    const opportunities = calculateTriangularArbitrage(tickers);

    console.log(`Found ${opportunities.length} real arbitrage opportunities`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        opportunities,
        count: opportunities.length,
        source: 'Kraken API',
        timestamp: new Date().toISOString()
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('Error detecting arbitrage:', error);
    
    const isAuthError = error.message?.includes('authorization') || 
                        error.message?.includes('token') || 
                        error.message?.includes('permission');
    
    return new Response(
      JSON.stringify({ error: isAuthError ? error.message : 'Failed to detect arbitrage opportunities. Please try again.' }),
      { 
        status: isAuthError ? 401 : 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
