import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

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

  return {
    totalReturn,
    sharpeRatio,
    sortinoRatio,
    maxDrawdown,
    winRate,
    totalTrades: trades.length,
    winningTrades: winningTrades.length,
    losingTrades: losingTrades.length,
    profitFactor,
    avgWin,
    avgLoss,
  };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { 
      name,
      symbol, 
      interval, 
      startTimestamp, 
      endTimestamp, 
      initialCapital,
      strategyConfig 
    } = await req.json();

    console.log('Running backtest:', { name, symbol, interval, startTimestamp, endTimestamp });

    // Initialize Supabase client
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
        throw new Error(`No data found for ${startTimestamp} to ${endTimestamp}. Available data starts from ${oldestDate}. Try fetching historical data first.`);
      }
      
      throw new Error('No historical data available. Please fetch data first using the "Fetch Data" button.');
    }

    console.log(`Loaded ${candles.length} candles for backtest from ${new Date(candles[0].timestamp * 1000).toISOString()} to ${new Date(candles[candles.length - 1].timestamp * 1000).toISOString()}`);

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
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
