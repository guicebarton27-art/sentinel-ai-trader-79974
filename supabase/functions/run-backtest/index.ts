import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Input validation schemas
const StrategyConfigSchema = z.object({
  trendWeight: z.number().min(0).max(1),
  meanRevWeight: z.number().min(0).max(1),
  carryWeight: z.number().min(0).max(1),
  signalThreshold: z.number().min(0).max(1),
  stopLoss: z.number().min(0).max(1),
  takeProfit: z.number().min(0).max(1),
  maxPositionSize: z.number().min(0).max(1),
});

const BacktestSchema = z.object({
  name: z.string().min(1, "Name is required").max(100, "Name too long"),
  symbol: z.string()
    .min(1)
    .max(20)
    .regex(/^[A-Z0-9]{2,10}\/[A-Z]{2,5}$|^[A-Z0-9]{4,12}$/, "Invalid symbol format"),
  interval: z.enum(['1m', '5m', '15m', '30m', '1h', '4h', '1d', '1w'], {
    errorMap: () => ({ message: "Invalid interval" })
  }),
  startTimestamp: z.number().int().positive().max(Math.floor(Date.now() / 1000) + 86400),
  endTimestamp: z.number().int().positive().max(Math.floor(Date.now() / 1000) + 86400),
  initialCapital: z.number().positive().min(100, "Minimum capital is $100").max(1000000000, "Maximum capital is $1B"),
  strategyConfig: StrategyConfigSchema,
}).refine(data => data.endTimestamp > data.startTimestamp, {
  message: "End timestamp must be after start timestamp",
  path: ["endTimestamp"],
});

interface Candle {
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

interface Trade {
  entry_timestamp: number;
  exit_timestamp: number;
  side: 'long' | 'short';
  entry_price: number;
  exit_price: number;
  size: number;
  pnl: number;
  pnl_percentage: number;
  signal_strength: number;
}

interface StrategyConfig {
  trendWeight: number;
  meanRevWeight: number;
  carryWeight: number;
  signalThreshold: number;
  stopLoss: number;
  takeProfit: number;
  maxPositionSize: number;
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

  // Check user role - traders and admins can run backtests
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

// Calculate technical indicators
function calculateSMA(candles: Candle[], period: number): number[] {
  const sma: number[] = [];
  for (let i = 0; i < candles.length; i++) {
    if (i < period - 1) {
      sma.push(NaN);
    } else {
      const sum = candles.slice(i - period + 1, i + 1).reduce((acc, c) => acc + c.close, 0);
      sma.push(sum / period);
    }
  }
  return sma;
}

function calculateRSI(candles: Candle[], period: number = 14): number[] {
  const rsi: number[] = [];
  const gains: number[] = [];
  const losses: number[] = [];

  for (let i = 1; i < candles.length; i++) {
    const change = candles[i].close - candles[i - 1].close;
    gains.push(change > 0 ? change : 0);
    losses.push(change < 0 ? -change : 0);
  }

  for (let i = 0; i < candles.length; i++) {
    if (i < period) {
      rsi.push(NaN);
    } else {
      const avgGain = gains.slice(i - period, i).reduce((a, b) => a + b, 0) / period;
      const avgLoss = losses.slice(i - period, i).reduce((a, b) => a + b, 0) / period;
      const rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
      rsi.push(100 - (100 / (1 + rs)));
    }
  }
  return rsi;
}

// Generate trading signal
function generateSignal(candles: Candle[], index: number, config: StrategyConfig): number {
  if (index < 50) return 0; // Need enough data for indicators

  const sma20 = calculateSMA(candles.slice(0, index + 1), 20);
  const sma50 = calculateSMA(candles.slice(0, index + 1), 50);
  const rsi = calculateRSI(candles.slice(0, index + 1), 14);

  const currentSMA20 = sma20[sma20.length - 1];
  const currentSMA50 = sma50[sma50.length - 1];
  const currentRSI = rsi[rsi.length - 1];
  const currentPrice = candles[index].close;

  // Trend component
  const trendSignal = (currentSMA20 - currentSMA50) / currentSMA50;

  // Mean reversion component
  const meanRevSignal = (currentSMA20 - currentPrice) / currentPrice;

  // Momentum component (RSI-based)
  const momentumSignal = (currentRSI - 50) / 50;

  // Combined signal
  const signal = 
    config.trendWeight * trendSignal +
    config.meanRevWeight * meanRevSignal +
    config.carryWeight * momentumSignal;

  return signal;
}

// Run backtest
function runBacktest(candles: Candle[], config: StrategyConfig, initialCapital: number) {
  const trades: Trade[] = [];
  const equityCurve: { timestamp: number; equity: number; drawdown: number }[] = [];
  
  let capital = initialCapital;
  let position: { side: 'long' | 'short'; entry_price: number; entry_timestamp: number; size: number; signal: number } | null = null;
  let peakEquity = initialCapital;

  for (let i = 50; i < candles.length; i++) {
    const candle = candles[i];
    const signal = generateSignal(candles, i, config);

    // Record equity
    const currentEquity = position 
      ? capital + (position.side === 'long' 
          ? position.size * (candle.close - position.entry_price)
          : position.size * (position.entry_price - candle.close))
      : capital;
    
    peakEquity = Math.max(peakEquity, currentEquity);
    const drawdown = ((peakEquity - currentEquity) / peakEquity) * 100;
    
    equityCurve.push({ timestamp: candle.timestamp, equity: currentEquity, drawdown });

    // Exit logic
    if (position) {
      const priceChange = position.side === 'long' 
        ? (candle.close - position.entry_price) / position.entry_price
        : (position.entry_price - candle.close) / position.entry_price;

      const shouldExit = 
        priceChange <= -config.stopLoss ||
        priceChange >= config.takeProfit ||
        (position.side === 'long' && signal < -config.signalThreshold) ||
        (position.side === 'short' && signal > config.signalThreshold);

      if (shouldExit) {
        const pnl = position.side === 'long'
          ? position.size * (candle.close - position.entry_price)
          : position.size * (position.entry_price - candle.close);
        
        const pnlPercentage = (pnl / (position.entry_price * position.size)) * 100;
        
        capital += pnl;

        trades.push({
          entry_timestamp: position.entry_timestamp,
          exit_timestamp: candle.timestamp,
          side: position.side,
          entry_price: position.entry_price,
          exit_price: candle.close,
          size: position.size,
          pnl,
          pnl_percentage: pnlPercentage,
          signal_strength: position.signal,
        });

        position = null;
      }
    }

    // Entry logic
    if (!position) {
      if (signal > config.signalThreshold) {
        const positionSize = Math.min(capital * config.maxPositionSize, capital * 0.95) / candle.close;
        position = {
          side: 'long',
          entry_price: candle.close,
          entry_timestamp: candle.timestamp,
          size: positionSize,
          signal,
        };
      } else if (signal < -config.signalThreshold) {
        const positionSize = Math.min(capital * config.maxPositionSize, capital * 0.95) / candle.close;
        position = {
          side: 'short',
          entry_price: candle.close,
          entry_timestamp: candle.timestamp,
          size: positionSize,
          signal,
        };
      }
    }
  }

  // Close any open position
  if (position) {
    const lastCandle = candles[candles.length - 1];
    const pnl = position.side === 'long'
      ? position.size * (lastCandle.close - position.entry_price)
      : position.size * (position.entry_price - lastCandle.close);
    
    capital += pnl;

    trades.push({
      entry_timestamp: position.entry_timestamp,
      exit_timestamp: lastCandle.timestamp,
      side: position.side,
      entry_price: position.entry_price,
      exit_price: lastCandle.close,
      size: position.size,
      pnl,
      pnl_percentage: (pnl / (position.entry_price * position.size)) * 100,
      signal_strength: position.signal,
    });
  }

  return { trades, equityCurve, finalCapital: capital };
}

// Calculate performance metrics
function calculateMetrics(trades: Trade[], initialCapital: number, finalCapital: number, equityCurve: any[]) {
  const winningTrades = trades.filter(t => t.pnl > 0);
  const losingTrades = trades.filter(t => t.pnl < 0);
  
  const totalReturn = ((finalCapital - initialCapital) / initialCapital) * 100;
  const winRate = trades.length > 0 ? (winningTrades.length / trades.length) * 100 : 0;
  
  const avgWin = winningTrades.length > 0
    ? winningTrades.reduce((sum, t) => sum + t.pnl, 0) / winningTrades.length
    : 0;
  
  const avgLoss = losingTrades.length > 0
    ? Math.abs(losingTrades.reduce((sum, t) => sum + t.pnl, 0) / losingTrades.length)
    : 0;
  
  const profitFactor = avgLoss > 0 ? (avgWin * winningTrades.length) / (avgLoss * losingTrades.length) : 0;
  
  const maxDrawdown = Math.max(...equityCurve.map(e => e.drawdown));
  
  // Calculate Sharpe ratio (simplified, assuming daily returns)
  const returns = trades.map(t => t.pnl_percentage);
  const avgReturn = returns.reduce((a, b) => a + b, 0) / returns.length;
  const stdDev = Math.sqrt(returns.reduce((sum, r) => sum + Math.pow(r - avgReturn, 2), 0) / returns.length);
  const sharpeRatio = stdDev > 0 ? (avgReturn / stdDev) * Math.sqrt(252) : 0;
  
  // Sortino ratio (only downside deviation)
  const downsideReturns = returns.filter(r => r < 0);
  const downsideStdDev = downsideReturns.length > 0
    ? Math.sqrt(downsideReturns.reduce((sum, r) => sum + Math.pow(r, 2), 0) / downsideReturns.length)
    : 0;
  const sortinoRatio = downsideStdDev > 0 ? (avgReturn / downsideStdDev) * Math.sqrt(252) : 0;

  // Calculate Calmar Ratio (annualized return / max drawdown)
  const calmarRatio = maxDrawdown > 0 ? (totalReturn / maxDrawdown) : 0;
  
  // Calculate Omega Ratio (sum of gains / sum of losses)
  const totalGains = winningTrades.reduce((sum, t) => sum + t.pnl, 0);
  const totalLosses = Math.abs(losingTrades.reduce((sum, t) => sum + t.pnl, 0));
  const omegaRatio = totalLosses > 0 ? totalGains / totalLosses : 0;
  
  // Calculate Expectancy (average win * win rate - average loss * loss rate)
  const expectancy = (avgWin * winRate) - (Math.abs(avgLoss) * (1 - winRate));

  return {
    total_return: totalReturn,
    sharpe_ratio: sharpeRatio,
    sortino_ratio: sortinoRatio,
    max_drawdown: maxDrawdown,
    win_rate: winRate,
    total_trades: trades.length,
    winning_trades: winningTrades.length,
    losing_trades: losingTrades.length,
    profit_factor: profitFactor,
    avg_win: avgWin,
    avg_loss: avgLoss,
    calmar_ratio: calmarRatio,
    omega_ratio: omegaRatio,
    expectancy: expectancy,
  };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Authenticate user and verify role
    const { user, role } = await authenticateUser(req);
    console.log(`User ${user.id} (${role}) running backtest`);

    // Parse and validate input
    const rawInput = await req.json();
    const parseResult = BacktestSchema.safeParse(rawInput);
    
    if (!parseResult.success) {
      const errorMessage = parseResult.error.errors.map(e => e.message).join(', ');
      console.error('Validation error:', errorMessage);
      return new Response(
        JSON.stringify({ error: 'Invalid input', details: errorMessage }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { name, symbol, interval, startTimestamp, endTimestamp, initialCapital, strategyConfig } = parseResult.data;

    console.log('Running backtest:', { name, symbol, interval, startTimestamp, endTimestamp });

    // Initialize Supabase client with service role for data access
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Fetch historical data
    const { data: candles, error: fetchError } = await supabase
      .from('historical_candles')
      .select('*')
      .eq('symbol', symbol)
      .eq('interval', interval)
      .gte('timestamp', startTimestamp)
      .lte('timestamp', endTimestamp)
      .order('timestamp', { ascending: true });

    if (fetchError) throw fetchError;
    
    if (!candles || candles.length === 0) {
      // Try to get available date range to help user
      const { data: availableData } = await supabase
        .from('historical_candles')
        .select('timestamp')
        .eq('symbol', symbol)
        .eq('interval', interval)
        .order('timestamp', { ascending: true })
        .limit(1);
        
      if (availableData && availableData.length > 0) {
        const oldestDate = new Date(availableData[0].timestamp * 1000).toISOString().split('T')[0];
        throw new Error(`No data found for selected date range. Available data starts from ${oldestDate}. Try fetching historical data first.`);
      }
      
      throw new Error('No historical data available. Please fetch data first.');
    }

    console.log(`Loaded ${candles.length} candles for backtest`);

    // Run backtest
    const { trades, equityCurve, finalCapital } = runBacktest(
      candles as Candle[],
      strategyConfig,
      initialCapital
    );

    console.log(`Backtest complete: ${trades.length} trades, final capital: ${finalCapital}`);

    // Calculate metrics
    const metrics = calculateMetrics(trades, initialCapital, finalCapital, equityCurve);

    // Store backtest run
    const { data: backtestRun, error: runError } = await supabase
      .from('backtest_runs')
      .insert({
        name,
        symbol,
        interval,
        start_timestamp: startTimestamp,
        end_timestamp: endTimestamp,
        initial_capital: initialCapital,
        final_capital: finalCapital,
        ...metrics,
        strategy_config: strategyConfig,
      })
      .select()
      .single();

    if (runError) throw runError;

    // Store trades
    if (trades.length > 0) {
      const tradesWithRunId = trades.map(trade => ({
        ...trade,
        backtest_run_id: backtestRun.id,
      }));

      const { error: tradesError } = await supabase
        .from('backtest_trades')
        .insert(tradesWithRunId);

      if (tradesError) throw tradesError;
    }

    // Store equity curve (sample every 100 points to reduce storage)
    const sampledEquityCurve = equityCurve.filter((_, i) => i % Math.max(1, Math.floor(equityCurve.length / 1000)) === 0);
    if (sampledEquityCurve.length > 0) {
      const equityCurveWithRunId = sampledEquityCurve.map(point => ({
        ...point,
        backtest_run_id: backtestRun.id,
      }));

      const { error: equityError } = await supabase
        .from('backtest_equity_curve')
        .insert(equityCurveWithRunId);

      if (equityError) throw equityError;
    }

    return new Response(
      JSON.stringify({ 
        success: true,
        backtest_run_id: backtestRun.id,
        metrics,
        trades_count: trades.length,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('Error running backtest:', error);
    
    // Return user-friendly error messages
    const isAuthError = error.message?.includes('authorization') || 
                        error.message?.includes('token') || 
                        error.message?.includes('permission');
    
    return new Response(
      JSON.stringify({ 
        error: isAuthError ? error.message : 'Failed to run backtest. Please try again.' 
      }),
      { 
        status: isAuthError ? 401 : 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
