import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ExchangePrice {
  exchange: string;
  symbol: string;
  bid: number;
  ask: number;
  last: number;
  volume24h: number;
  timestamp: number;
}

interface FundingRate {
  exchange: string;
  symbol: string;
  rate: number;
  nextFundingTime: number;
  predictedRate?: number;
  openInterest?: number;
  markPrice?: number;
  indexPrice?: number;
}

interface ArbitrageOpportunity {
  type: 'cross_exchange' | 'triangular' | 'funding_rate';
  exchanges: string[];
  symbol: string;
  buyExchange: string;
  sellExchange: string;
  buyPrice: number;
  sellPrice: number;
  spreadPercentage: number;
  estimatedProfit: number;
  volumeAvailable: number;
  feesEstimate: number;
  netProfit: number;
  fundingData?: FundingRate[];
  hedgeRecommendation?: {
    action: 'long_short' | 'short_long' | 'none';
    longExchange: string;
    shortExchange: string;
    expectedFundingCapture: number;
    holdPeriodHours: number;
  };
}

// Supported exchanges with their fee structures
const EXCHANGES = {
  kraken: { maker: 0.0016, taker: 0.0026, name: 'Kraken' },
  binance: { maker: 0.001, taker: 0.001, name: 'Binance' },
  coinbase: { maker: 0.004, taker: 0.006, name: 'Coinbase' },
  bybit: { maker: 0.0001, taker: 0.0006, name: 'Bybit' },
  okx: { maker: 0.0008, taker: 0.001, name: 'OKX' },
};

const SYMBOLS = ['BTC/USD', 'ETH/USD', 'XRP/USD', 'SOL/USD'];

// Authenticate user
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

  return { user, role, supabase };
}

// Fetch real prices from Kraken
async function fetchKrakenPrices(symbols: string[]): Promise<ExchangePrice[]> {
  const prices: ExchangePrice[] = [];
  
  try {
    const pairMap: Record<string, string> = {
      'BTC/USD': 'XXBTZUSD',
      'ETH/USD': 'XETHZUSD',
      'XRP/USD': 'XXRPZUSD',
      'SOL/USD': 'SOLUSD',
    };
    
    const pairs = symbols.map(s => pairMap[s]).filter(Boolean).join(',');
    const response = await fetch(`https://api.kraken.com/0/public/Ticker?pair=${pairs}`);
    const data = await response.json();
    
    if (data.result) {
      for (const [pair, ticker] of Object.entries(data.result)) {
        const t = ticker as any;
        const symbol = Object.entries(pairMap).find(([_, v]) => v === pair)?.[0];
        if (symbol) {
          prices.push({
            exchange: 'kraken',
            symbol,
            bid: parseFloat(t.b[0]),
            ask: parseFloat(t.a[0]),
            last: parseFloat(t.c[0]),
            volume24h: parseFloat(t.v[1]),
            timestamp: Date.now(),
          });
        }
      }
    }
  } catch (error) {
    console.error('Error fetching Kraken prices:', error);
  }
  
  return prices;
}

// Simulate prices from other exchanges based on Kraken + realistic spreads
function simulateExchangePrices(krakenPrices: ExchangePrice[]): ExchangePrice[] {
  const allPrices: ExchangePrice[] = [...krakenPrices];
  const otherExchanges = ['binance', 'coinbase', 'bybit', 'okx'];
  
  for (const krakenPrice of krakenPrices) {
    for (const exchange of otherExchanges) {
      // Add realistic price variations (-0.3% to +0.3%)
      const variation = (Math.random() - 0.5) * 0.006;
      const spreadMultiplier = exchange === 'coinbase' ? 1.002 : 1.0005;
      
      const midPrice = krakenPrice.last * (1 + variation);
      const spread = midPrice * (spreadMultiplier - 1);
      
      allPrices.push({
        exchange,
        symbol: krakenPrice.symbol,
        bid: midPrice - spread / 2,
        ask: midPrice + spread / 2,
        last: midPrice,
        volume24h: krakenPrice.volume24h * (0.5 + Math.random()),
        timestamp: Date.now(),
      });
    }
  }
  
  return allPrices;
}

// Generate simulated funding rates
function generateFundingRates(symbols: string[]): FundingRate[] {
  const rates: FundingRate[] = [];
  const perpetualExchanges = ['binance', 'bybit', 'okx'];
  
  for (const symbol of symbols) {
    for (const exchange of perpetualExchanges) {
      // Funding rates typically range from -0.1% to +0.1% per 8 hours
      const rate = (Math.random() - 0.45) * 0.002; // Slight positive bias
      const nextFunding = Date.now() + Math.random() * 8 * 60 * 60 * 1000;
      
      rates.push({
        exchange,
        symbol,
        rate,
        nextFundingTime: nextFunding,
        predictedRate: rate * (0.8 + Math.random() * 0.4),
        openInterest: Math.random() * 1000000000,
        markPrice: 0, // Will be set from prices
        indexPrice: 0,
      });
    }
  }
  
  return rates;
}

// Find cross-exchange arbitrage opportunities
function findCrossExchangeArbitrage(prices: ExchangePrice[]): ArbitrageOpportunity[] {
  const opportunities: ArbitrageOpportunity[] = [];
  const minProfitThreshold = 0.001; // 0.1% minimum net profit
  
  // Group prices by symbol
  const pricesBySymbol: Record<string, ExchangePrice[]> = {};
  for (const price of prices) {
    if (!pricesBySymbol[price.symbol]) {
      pricesBySymbol[price.symbol] = [];
    }
    pricesBySymbol[price.symbol].push(price);
  }
  
  // Find arbitrage for each symbol
  for (const [symbol, symbolPrices] of Object.entries(pricesBySymbol)) {
    for (let i = 0; i < symbolPrices.length; i++) {
      for (let j = i + 1; j < symbolPrices.length; j++) {
        const priceA = symbolPrices[i];
        const priceB = symbolPrices[j];
        
        // Check A buy -> B sell
        const spreadAB = (priceB.bid - priceA.ask) / priceA.ask;
        const feesAB = (EXCHANGES[priceA.exchange as keyof typeof EXCHANGES]?.taker || 0.003) +
                       (EXCHANGES[priceB.exchange as keyof typeof EXCHANGES]?.taker || 0.003);
        const netProfitAB = spreadAB - feesAB;
        
        if (netProfitAB > minProfitThreshold) {
          const volume = Math.min(priceA.volume24h, priceB.volume24h) * 0.01;
          const estimatedProfit = volume * priceA.ask * netProfitAB;
          
          opportunities.push({
            type: 'cross_exchange',
            exchanges: [priceA.exchange, priceB.exchange],
            symbol,
            buyExchange: priceA.exchange,
            sellExchange: priceB.exchange,
            buyPrice: priceA.ask,
            sellPrice: priceB.bid,
            spreadPercentage: spreadAB * 100,
            estimatedProfit: volume * priceA.ask * spreadAB,
            volumeAvailable: volume,
            feesEstimate: volume * priceA.ask * feesAB,
            netProfit: estimatedProfit,
          });
        }
        
        // Check B buy -> A sell
        const spreadBA = (priceA.bid - priceB.ask) / priceB.ask;
        const feesBA = feesAB;
        const netProfitBA = spreadBA - feesBA;
        
        if (netProfitBA > minProfitThreshold) {
          const volume = Math.min(priceA.volume24h, priceB.volume24h) * 0.01;
          const estimatedProfit = volume * priceB.ask * netProfitBA;
          
          opportunities.push({
            type: 'cross_exchange',
            exchanges: [priceB.exchange, priceA.exchange],
            symbol,
            buyExchange: priceB.exchange,
            sellExchange: priceA.exchange,
            buyPrice: priceB.ask,
            sellPrice: priceA.bid,
            spreadPercentage: spreadBA * 100,
            estimatedProfit: volume * priceB.ask * spreadBA,
            volumeAvailable: volume,
            feesEstimate: volume * priceB.ask * feesBA,
            netProfit: estimatedProfit,
          });
        }
      }
    }
  }
  
  return opportunities.sort((a, b) => b.netProfit - a.netProfit);
}

// Find funding rate arbitrage opportunities
function findFundingRateArbitrage(
  prices: ExchangePrice[],
  fundingRates: FundingRate[]
): ArbitrageOpportunity[] {
  const opportunities: ArbitrageOpportunity[] = [];
  const minAnnualizedReturn = 0.10; // 10% annualized minimum
  
  // Group funding rates by symbol
  const ratesBySymbol: Record<string, FundingRate[]> = {};
  for (const rate of fundingRates) {
    if (!ratesBySymbol[rate.symbol]) {
      ratesBySymbol[rate.symbol] = [];
    }
    ratesBySymbol[rate.symbol].push(rate);
  }
  
  for (const [symbol, rates] of Object.entries(ratesBySymbol)) {
    // Find exchanges with significantly different funding rates
    rates.sort((a, b) => a.rate - b.rate);
    
    if (rates.length < 2) continue;
    
    const lowestRate = rates[0];
    const highestRate = rates[rates.length - 1];
    
    const rateDiff = highestRate.rate - lowestRate.rate;
    const annualizedReturn = rateDiff * 3 * 365; // 3 funding periods per day
    
    if (annualizedReturn > minAnnualizedReturn) {
      // Get spot prices for the symbol
      const spotPrices = prices.filter(p => p.symbol === symbol);
      const avgPrice = spotPrices.reduce((sum, p) => sum + p.last, 0) / spotPrices.length;
      
      // Estimate position size (1% of average volume)
      const volume = spotPrices.reduce((sum, p) => sum + p.volume24h, 0) / spotPrices.length * 0.01;
      const positionValue = volume * avgPrice;
      
      // Funding capture per 8 hours
      const fundingCapture = positionValue * rateDiff;
      const dailyCapture = fundingCapture * 3;
      
      opportunities.push({
        type: 'funding_rate',
        exchanges: [lowestRate.exchange, highestRate.exchange],
        symbol,
        buyExchange: highestRate.exchange, // Long where funding is paid to longs
        sellExchange: lowestRate.exchange, // Short where funding is received
        buyPrice: avgPrice,
        sellPrice: avgPrice,
        spreadPercentage: rateDiff * 100,
        estimatedProfit: dailyCapture * 30, // Monthly estimate
        volumeAvailable: volume,
        feesEstimate: positionValue * 0.002, // Entry/exit fees
        netProfit: dailyCapture * 30 - positionValue * 0.002,
        fundingData: [lowestRate, highestRate],
        hedgeRecommendation: {
          action: highestRate.rate > 0 ? 'long_short' : 'short_long',
          longExchange: highestRate.rate > 0 ? lowestRate.exchange : highestRate.exchange,
          shortExchange: highestRate.rate > 0 ? highestRate.exchange : lowestRate.exchange,
          expectedFundingCapture: dailyCapture,
          holdPeriodHours: 24,
        },
      });
    }
  }
  
  return opportunities.sort((a, b) => b.netProfit - a.netProfit);
}

// Store opportunities in database
async function storeOpportunities(
  supabase: any,
  userId: string,
  opportunities: ArbitrageOpportunity[]
) {
  const records = opportunities.slice(0, 10).map(opp => ({
    user_id: userId,
    opportunity_type: opp.type,
    exchanges: opp.exchanges,
    symbol: opp.symbol,
    buy_exchange: opp.buyExchange,
    sell_exchange: opp.sellExchange,
    buy_price: opp.buyPrice,
    sell_price: opp.sellPrice,
    spread_percentage: opp.spreadPercentage,
    estimated_profit: opp.estimatedProfit,
    volume_available: opp.volumeAvailable,
    fees_estimate: opp.feesEstimate,
    net_profit: opp.netProfit,
    funding_rate_data: opp.fundingData || {},
    hedge_details: opp.hedgeRecommendation || {},
  }));
  
  if (records.length > 0) {
    const { error } = await supabase
      .from('arbitrage_opportunities')
      .insert(records);
    
    if (error) {
      console.error('Error storing opportunities:', error);
    }
  }
}

// Store funding rates in database
async function storeFundingRates(supabase: any, rates: FundingRate[]) {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  
  const adminClient = createClient(supabaseUrl, serviceRoleKey);
  
  const records = rates.map(rate => ({
    exchange: rate.exchange,
    symbol: rate.symbol,
    funding_rate: rate.rate,
    next_funding_time: new Date(rate.nextFundingTime).toISOString(),
    predicted_rate: rate.predictedRate,
    open_interest: rate.openInterest,
    mark_price: rate.markPrice,
    index_price: rate.indexPrice,
  }));
  
  // Use upsert to avoid duplicates
  const { error } = await adminClient
    .from('funding_rates')
    .upsert(records, { onConflict: 'exchange,symbol,created_at' });
  
  if (error) {
    console.error('Error storing funding rates:', error);
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { user, supabase } = await authenticateUser(req);
    console.log(`User ${user.id} scanning multi-exchange arbitrage`);

    const body = await req.json().catch(() => ({}));
    const action = body.action || 'scan';

    if (action === 'scan') {
      // Fetch real Kraken prices
      const krakenPrices = await fetchKrakenPrices(SYMBOLS);
      
      // Simulate other exchange prices
      const allPrices = simulateExchangePrices(krakenPrices);
      
      // Generate funding rates
      const fundingRates = generateFundingRates(SYMBOLS);
      
      // Find opportunities
      const crossExchangeOpps = findCrossExchangeArbitrage(allPrices);
      const fundingRateOpps = findFundingRateArbitrage(allPrices, fundingRates);
      
      // Combine and sort all opportunities
      const allOpportunities = [...crossExchangeOpps, ...fundingRateOpps]
        .sort((a, b) => b.netProfit - a.netProfit);
      
      // Store in database
      await storeOpportunities(supabase, user.id, allOpportunities);
      await storeFundingRates(supabase, fundingRates);
      
      return new Response(
        JSON.stringify({
          success: true,
          opportunities: allOpportunities.slice(0, 20),
          fundingRates: fundingRates,
          exchangePrices: allPrices,
          summary: {
            totalOpportunities: allOpportunities.length,
            crossExchange: crossExchangeOpps.length,
            fundingRate: fundingRateOpps.length,
            bestProfit: allOpportunities[0]?.netProfit || 0,
            totalPotentialProfit: allOpportunities.reduce((sum, o) => sum + o.netProfit, 0),
          },
          timestamp: new Date().toISOString(),
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (action === 'execute') {
      const { opportunityId, mode = 'paper' } = body;
      
      if (!opportunityId) {
        throw new Error('Opportunity ID required');
      }

      // Fetch the opportunity
      const { data: opportunity, error: fetchError } = await supabase
        .from('arbitrage_opportunities')
        .select('*')
        .eq('id', opportunityId)
        .eq('user_id', user.id)
        .single();

      if (fetchError || !opportunity) {
        throw new Error('Opportunity not found');
      }

      if (opportunity.status !== 'detected') {
        throw new Error('Opportunity already processed');
      }

      // Update status to executing
      await supabase
        .from('arbitrage_opportunities')
        .update({ status: 'executing', executed_at: new Date().toISOString() })
        .eq('id', opportunityId);

      // Simulate execution (in paper mode)
      const executionResult = {
        buyOrderId: crypto.randomUUID(),
        sellOrderId: crypto.randomUUID(),
        buyFillPrice: opportunity.buy_price * (1 + (Math.random() - 0.5) * 0.001),
        sellFillPrice: opportunity.sell_price * (1 + (Math.random() - 0.5) * 0.001),
        slippage: Math.random() * 0.001,
        actualProfit: opportunity.net_profit * (0.9 + Math.random() * 0.2),
        executionTimeMs: 50 + Math.random() * 200,
      };

      // Update with execution details
      await supabase
        .from('arbitrage_opportunities')
        .update({
          status: 'completed',
          closed_at: new Date().toISOString(),
          execution_details: executionResult,
        })
        .eq('id', opportunityId);

      return new Response(
        JSON.stringify({
          success: true,
          execution: executionResult,
          mode,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (action === 'create_hedge') {
      const { opportunityId, longExchange, shortExchange, size } = body;

      if (!opportunityId || !longExchange || !shortExchange || !size) {
        throw new Error('Missing required parameters for hedge creation');
      }

      // Fetch the opportunity
      const { data: opportunity, error: fetchError } = await supabase
        .from('arbitrage_opportunities')
        .select('*')
        .eq('id', opportunityId)
        .eq('user_id', user.id)
        .single();

      if (fetchError || !opportunity) {
        throw new Error('Opportunity not found');
      }

      // Create hedge position
      const hedgePosition = {
        user_id: user.id,
        arbitrage_id: opportunityId,
        symbol: opportunity.symbol,
        long_exchange: longExchange,
        short_exchange: shortExchange,
        long_size: size,
        short_size: size,
        long_entry_price: opportunity.buy_price,
        short_entry_price: opportunity.sell_price,
        long_current_price: opportunity.buy_price,
        short_current_price: opportunity.sell_price,
        status: 'open',
      };

      const { data: hedge, error: insertError } = await supabase
        .from('hedge_positions')
        .insert(hedgePosition)
        .select()
        .single();

      if (insertError) {
        throw new Error('Failed to create hedge position');
      }

      // Update opportunity with hedge status
      await supabase
        .from('arbitrage_opportunities')
        .update({ hedge_status: 'hedged' })
        .eq('id', opportunityId);

      return new Response(
        JSON.stringify({
          success: true,
          hedge,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (action === 'get_hedges') {
      const { data: hedges, error } = await supabase
        .from('hedge_positions')
        .select('*, arbitrage_opportunities(*)')
        .eq('user_id', user.id)
        .eq('status', 'open')
        .order('opened_at', { ascending: false });

      if (error) {
        throw new Error('Failed to fetch hedge positions');
      }

      return new Response(
        JSON.stringify({
          success: true,
          hedges,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (action === 'close_hedge') {
      const { hedgeId } = body;

      if (!hedgeId) {
        throw new Error('Hedge ID required');
      }

      // Fetch and close the hedge
      const { data: hedge, error: fetchError } = await supabase
        .from('hedge_positions')
        .select('*')
        .eq('id', hedgeId)
        .eq('user_id', user.id)
        .single();

      if (fetchError || !hedge) {
        throw new Error('Hedge position not found');
      }

      // Calculate realized PnL (simulated)
      const longPnL = (hedge.long_current_price - hedge.long_entry_price) * hedge.long_size;
      const shortPnL = (hedge.short_entry_price - hedge.short_current_price) * hedge.short_size;
      const realizedPnL = longPnL + shortPnL + (hedge.funding_collected || 0);

      const { error: updateError } = await supabase
        .from('hedge_positions')
        .update({
          status: 'closed',
          closed_at: new Date().toISOString(),
          realized_pnl: realizedPnL,
        })
        .eq('id', hedgeId);

      if (updateError) {
        throw new Error('Failed to close hedge position');
      }

      return new Response(
        JSON.stringify({
          success: true,
          realizedPnL,
          closedAt: new Date().toISOString(),
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Automated execution with optional auto-hedging
    if (action === 'auto_execute') {
      const { opportunity, config: execConfig } = body;

      if (!opportunity) {
        throw new Error('Opportunity data required for auto-execution');
      }

      const maxPositionSize = execConfig?.maxPositionSize || 10000;
      const autoHedge = execConfig?.autoHedge ?? true;
      const hedgeMinFundingCapture = execConfig?.hedgeMinFundingCapture || 5;

      console.log(`Auto-executing opportunity: ${opportunity.symbol} ${opportunity.type}`);

      // First, store the opportunity in DB to get an ID
      const opportunityRecord = {
        user_id: user.id,
        opportunity_type: opportunity.type,
        exchanges: opportunity.exchanges,
        symbol: opportunity.symbol,
        buy_exchange: opportunity.buyExchange,
        sell_exchange: opportunity.sellExchange,
        buy_price: opportunity.buyPrice,
        sell_price: opportunity.sellPrice,
        spread_percentage: opportunity.spreadPercentage,
        estimated_profit: opportunity.estimatedProfit,
        volume_available: Math.min(opportunity.volumeAvailable, maxPositionSize / opportunity.buyPrice),
        fees_estimate: opportunity.feesEstimate,
        net_profit: opportunity.netProfit,
        status: 'executing',
        executed_at: new Date().toISOString(),
        funding_rate_data: opportunity.fundingData || {},
        hedge_details: opportunity.hedgeRecommendation || {},
      };

      const { data: storedOpp, error: insertError } = await supabase
        .from('arbitrage_opportunities')
        .insert(opportunityRecord)
        .select()
        .single();

      if (insertError) {
        console.error('Failed to store opportunity:', insertError);
        throw new Error('Failed to store opportunity for execution');
      }

      // Simulate execution with realistic slippage and timing
      const slippageFactor = 0.9 + Math.random() * 0.2; // 90% to 110% of expected
      const executionTimeMs = 50 + Math.random() * 200;
      
      const executionResult = {
        buyOrderId: crypto.randomUUID(),
        sellOrderId: crypto.randomUUID(),
        buyFillPrice: opportunity.buyPrice * (1 + (Math.random() - 0.5) * 0.001),
        sellFillPrice: opportunity.sellPrice * (1 + (Math.random() - 0.5) * 0.001),
        slippage: (slippageFactor - 1) * 100,
        actualProfit: opportunity.netProfit * slippageFactor,
        executionTimeMs,
        executedAt: new Date().toISOString(),
        mode: 'paper',
      };

      // Update opportunity with execution details
      await supabase
        .from('arbitrage_opportunities')
        .update({
          status: 'completed',
          closed_at: new Date().toISOString(),
          execution_details: executionResult,
        })
        .eq('id', storedOpp.id);

      // Auto-create hedge if conditions met
      let hedgeCreated = false;
      let hedgeData = null;

      if (autoHedge && opportunity.hedgeRecommendation) {
        const recommendation = opportunity.hedgeRecommendation;
        
        // Check if funding capture meets threshold
        if (recommendation.expectedFundingCapture >= hedgeMinFundingCapture) {
          console.log(`Auto-creating hedge for ${opportunity.symbol}`);

          const hedgeSize = Math.min(
            opportunity.volumeAvailable,
            maxPositionSize / opportunity.buyPrice
          );

          const hedgePosition = {
            user_id: user.id,
            arbitrage_id: storedOpp.id,
            symbol: opportunity.symbol,
            long_exchange: recommendation.longExchange,
            short_exchange: recommendation.shortExchange,
            long_size: hedgeSize,
            short_size: hedgeSize,
            long_entry_price: opportunity.buyPrice,
            short_entry_price: opportunity.sellPrice,
            long_current_price: opportunity.buyPrice,
            short_current_price: opportunity.sellPrice,
            status: 'open',
          };

          const { data: hedge, error: hedgeError } = await supabase
            .from('hedge_positions')
            .insert(hedgePosition)
            .select()
            .single();

          if (!hedgeError && hedge) {
            hedgeCreated = true;
            hedgeData = hedge;

            // Update opportunity with hedge status
            await supabase
              .from('arbitrage_opportunities')
              .update({ hedge_status: 'hedged' })
              .eq('id', storedOpp.id);

            console.log(`Hedge created: ${hedge.id}`);
          } else {
            console.error('Failed to create auto-hedge:', hedgeError);
          }
        }
      }

      return new Response(
        JSON.stringify({
          success: true,
          opportunityId: storedOpp.id,
          execution: executionResult,
          hedgeCreated,
          hedge: hedgeData,
          summary: {
            symbol: opportunity.symbol,
            type: opportunity.type,
            profit: executionResult.actualProfit,
            executionTime: executionTimeMs,
          },
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    throw new Error(`Unknown action: ${action}`);

  } catch (error: any) {
    console.error('Error in multi-exchange-arbitrage:', error);
    
    const isAuthError = error.message?.includes('authorization') || 
                        error.message?.includes('token') || 
                        error.message?.includes('permission');
    
    return new Response(
      JSON.stringify({ 
        error: error.message || 'Internal server error',
        success: false,
      }),
      { 
        status: isAuthError ? 401 : 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
