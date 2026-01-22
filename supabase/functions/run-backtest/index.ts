import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";
import { requireEnv } from "../_shared/env.ts";
import { logError, logInfo } from "../_shared/logging.ts";
import { MarketCandle, MarketTick, evaluateRisk, RiskInputs } from "../_shared/trading.ts";
import { createTraceId, selectStrategyDecision } from "../_shared/spine.ts";

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
  seed: z.number().int().optional(),
}).refine(data => data.endTimestamp > data.startTimestamp, {
  message: "End timestamp must be after start timestamp",
  path: ["endTimestamp"],
});

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

interface AuthResult {
  user: { id: string; email: string };
  role: string;
  isService?: boolean;
}

interface BacktestPosition {
  side: 'buy' | 'sell';
  entry_price: number;
  entry_timestamp: number;
  size: number;
}

interface EventRecord {
  event_type: string;
  message: string;
  severity?: string;
  payload?: Record<string, unknown>;
}

// Authenticate user and check role
async function authenticateUser(req: Request): Promise<AuthResult> {
  const authHeader = req.headers.get('Authorization');
  const serviceHeader = req.headers.get('x-service-role');
  const serviceKey = requireEnv('SUPABASE_SERVICE_ROLE_KEY');

  if (serviceHeader && serviceHeader === serviceKey) {
    return {
      user: { id: 'service', email: 'service@local' },
      role: 'admin',
      isService: true,
    };
  }

  if (!authHeader) {
    throw new Error('Missing authorization header');
  }

  const supabaseUrl = requireEnv('SUPABASE_URL');
  const supabaseAnonKey = requireEnv('SUPABASE_ANON_KEY');
  
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

  return { user: { id: user.id, email: user.email ?? 'unknown' }, role };
}

const normalizePercent = (value: number) => (value <= 1 ? value * 100 : value);

const buildMarketTick = (symbol: string, candle: MarketCandle, prev?: MarketCandle): MarketTick => {
  const change = prev ? ((candle.close - prev.close) / prev.close) * 100 : 0;
  return {
    symbol,
    price: candle.close,
    bid: candle.close,
    ask: candle.close,
    volume_24h: candle.volume,
    change_24h: change,
  };
};

const createEvent = (event: EventRecord) => ({
  event_type: event.event_type,
  message: event.message,
  severity: event.severity ?? 'info',
  payload: event.payload ?? {},
});

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { user, isService } = await authenticateUser(req);
    const supabaseUrl = requireEnv('SUPABASE_URL');
    const supabase = isService
      ? createClient(supabaseUrl, requireEnv('SUPABASE_SERVICE_ROLE_KEY'))
      : createClient(supabaseUrl, requireEnv('SUPABASE_ANON_KEY'), {
        global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } }
      });

    const body = await req.json();
    const input = BacktestSchema.parse(body);
    const { name, symbol, interval, startTimestamp, endTimestamp, initialCapital, strategyConfig } = input;

    logInfo({ component: 'run-backtest', message: 'Starting backtest', context: { symbol, interval } });

    const { data: candlesData, error: candlesError } = await supabase
      .from('historical_candles')
      .select('*')
      .eq('symbol', symbol)
      .eq('interval', interval)
      .gte('timestamp', startTimestamp)
      .lte('timestamp', endTimestamp)
      .order('timestamp', { ascending: true });

    if (candlesError) throw candlesError;
    if (!candlesData || candlesData.length === 0) {
      throw new Error('No data found for the selected range. Please fetch historical data first.');
    }

    const candles = candlesData as MarketCandle[];

    const runConfig = {
      ai_enabled: false,
      ai_confidence_threshold: 0.55,
      live_armed: false,
      strategy_config: strategyConfig,
      symbol,
      interval,
      initial_capital: initialCapital,
    };

    const { data: run, error: runError } = await supabase
      .from('runs')
      .insert({
        user_id: user.id,
        status: 'RUNNING',
        mode: 'backtest',
        config_json: runConfig,
      })
      .select()
      .single();

    if (runError || !run) throw runError ?? new Error('Failed to create run');

    const { data: riskLimits } = await supabase
      .from('risk_limits')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle();

    const bot = {
      user_id: user.id,
      symbol,
      current_capital: initialCapital,
      daily_pnl: 0,
      strategy_id: 'trend_following',
      strategy_config: {},
      max_position_size: strategyConfig.maxPositionSize,
      max_daily_loss: initialCapital * 0.05,
      stop_loss_pct: normalizePercent(strategyConfig.stopLoss),
      take_profit_pct: normalizePercent(strategyConfig.takeProfit),
      max_leverage: 1,
    };

    let capital = initialCapital;
    let position: BacktestPosition | null = null;
    let peakEquity = initialCapital;
    let maxDrawdown = 0;
    const trades: Trade[] = [];
    const equityCurve: { timestamp: number; equity: number; drawdown: number }[] = [];
    const tradeTimestamps: number[] = [];

    for (let i = 1; i < candles.length; i++) {
      const candle = candles[i];
      const prev = candles[i - 1];
      const traceId = createTraceId();
      const marketTick = buildMarketTick(symbol, candle, prev);

      await supabase.from('market_snapshots').insert([{
        run_id: run.id,
        user_id: user.id,
        symbol,
        timeframe: interval,
        source: 'historical',
        data_json: marketTick,
      }] as unknown[]);

      const decisionResult = selectStrategyDecision(
        {
          ...bot,
          current_capital: capital,
          daily_pnl: capital - initialCapital,
        },
        marketTick,
        traceId,
        null,
        0.55,
      );

      await supabase.from('strategy_decisions').insert([{
        run_id: run.id,
        trace_id: traceId,
        user_id: user.id,
        symbol,
        signal: decisionResult.decision ? decisionResult.decision.side : 'hold',
        confidence: decisionResult.decision?.confidence ?? 0,
        rationale: decisionResult.rationale,
        inputs_json: { source: decisionResult.source },
      }] as unknown[]);

      const events: EventRecord[] = [
        createEvent({
          event_type: 'tick',
          message: 'Backtest tick',
          payload: { trace_id: traceId, price: marketTick.price },
        }),
      ];

      if (decisionResult.decision && !position) {
        const nowTimestamp = candle.timestamp;
        const tradesLastHour = tradeTimestamps.filter((ts) => ts >= nowTimestamp - 3600).length;
        const riskInputs: RiskInputs = {
          currentCapital: capital,
          dailyPnl: capital - initialCapital,
          maxDailyLoss: riskLimits?.max_daily_loss ?? bot.max_daily_loss,
          maxPositionSize: riskLimits?.max_position ?? bot.max_position_size,
          stopLossPct: bot.stop_loss_pct,
          tradesLastHour,
          maxTradesPerHour: riskLimits?.max_trades_per_hour ?? 5,
          cooldownActive: false,
          lossStreakExceeded: false,
          killSwitchActive: false,
          liveTradingEnabled: false,
          mode: 'backtest',
        };

        const riskCheck = evaluateRisk(decisionResult.decision, riskInputs);

        if (riskCheck.allowed) {
          const orderId = crypto.randomUUID();
          await supabase.from('orders').insert([{
            id: orderId,
            bot_id: null,
            user_id: user.id,
            run_id: run.id,
            trace_id: traceId,
            client_order_id: `backtest_${run.id}_${traceId}`,
            symbol,
            side: decisionResult.decision.side,
            order_type: 'market',
            status: 'filled',
            quantity: decisionResult.decision.size,
            filled_quantity: decisionResult.decision.size,
            average_fill_price: decisionResult.decision.entry,
            fee: decisionResult.decision.size * decisionResult.decision.entry * 0.001,
            strategy_id: bot.strategy_id,
            reason: decisionResult.decision.rationale,
            risk_checked: true,
            risk_flags: { trace_id: traceId },
            submitted_at: new Date(candle.timestamp * 1000).toISOString(),
            filled_at: new Date(candle.timestamp * 1000).toISOString(),
            meta_json: { mode: 'backtest' },
          }] as unknown[]);

          await supabase.from('fills').insert([{
            order_id: orderId,
            run_id: run.id,
            user_id: user.id,
            price: decisionResult.decision.entry,
            qty: decisionResult.decision.size,
            fee: decisionResult.decision.size * decisionResult.decision.entry * 0.001,
            meta_json: { mode: 'backtest' },
          }] as unknown[]);

          await supabase.from('positions').insert([{
            bot_id: null,
            user_id: user.id,
            run_id: run.id,
            symbol,
            side: decisionResult.decision.side,
            status: 'open',
            quantity: decisionResult.decision.size,
            entry_price: decisionResult.decision.entry,
            avg_price: decisionResult.decision.entry,
            current_price: decisionResult.decision.entry,
            stop_loss_price: decisionResult.decision.stop,
            take_profit_price: decisionResult.decision.take_profit,
            total_fees: decisionResult.decision.size * decisionResult.decision.entry * 0.001,
            entry_order_id: orderId,
            opened_at: new Date(candle.timestamp * 1000).toISOString(),
            meta_json: { trace_id: traceId, mode: 'backtest' },
          }] as unknown[]);

          position = {
            side: decisionResult.decision.side,
            entry_price: decisionResult.decision.entry,
            entry_timestamp: candle.timestamp,
            size: decisionResult.decision.size,
          };
          tradeTimestamps.push(candle.timestamp);
          events.push(createEvent({
            event_type: 'order',
            message: `Backtest ${decisionResult.decision.side} order executed`,
            payload: { trace_id: traceId, price: decisionResult.decision.entry },
          }));
        } else {
          events.push(createEvent({
            event_type: 'risk_alert',
            severity: 'warn',
            message: `Order blocked: ${riskCheck.flags.join(', ')}`,
            payload: { trace_id: traceId, flags: riskCheck.flags },
          }));
        }
      } else if (position && decisionResult.decision) {
        const exitPrice = decisionResult.decision.entry;
        const pnl = position.side === 'buy'
          ? (exitPrice - position.entry_price) * position.size
          : (position.entry_price - exitPrice) * position.size;
        capital += pnl;

        trades.push({
          entry_timestamp: position.entry_timestamp,
          exit_timestamp: candle.timestamp,
          side: position.side === 'buy' ? 'long' : 'short',
          entry_price: position.entry_price,
          exit_price: exitPrice,
          size: position.size,
          pnl,
          pnl_percentage: (pnl / (position.entry_price * position.size)) * 100,
          signal_strength: decisionResult.decision.confidence,
        });

        await supabase.from('positions')
          .update({
            status: 'closed',
            exit_price: exitPrice,
            realized_pnl: pnl,
            closed_at: new Date(candle.timestamp * 1000).toISOString(),
          } as unknown)
          .eq('run_id', run.id)
          .eq('status', 'open');

        position = null;
        events.push(createEvent({
          event_type: 'fill',
          message: 'Backtest position closed',
          payload: { trace_id: traceId, pnl },
        }));
      }

      const equity = position
        ? capital + (marketTick.price - position.entry_price) * position.size
        : capital;
      peakEquity = Math.max(peakEquity, equity);
      const drawdown = peakEquity > 0 ? ((peakEquity - equity) / peakEquity) * 100 : 0;
      maxDrawdown = Math.max(maxDrawdown, drawdown);
      equityCurve.push({ timestamp: candle.timestamp, equity, drawdown });

      await supabase.from('bot_events').insert(events.map((event) => ({
        bot_id: null,
        user_id: user.id,
        run_id: run.id,
        trace_id: traceId,
        event_type: event.event_type,
        severity: event.severity ?? 'info',
        message: event.message,
        payload: event.payload ?? {},
        payload_json: event.payload ?? {},
        created_at: new Date(candle.timestamp * 1000).toISOString(),
      })) as unknown[]);
    }

    if (position) {
      const lastCandle = candles[candles.length - 1];
      const exitPrice = lastCandle.close;
      const pnl = position.side === 'buy'
        ? (exitPrice - position.entry_price) * position.size
        : (position.entry_price - exitPrice) * position.size;
      capital += pnl;
      trades.push({
        entry_timestamp: position.entry_timestamp,
        exit_timestamp: lastCandle.timestamp,
        side: position.side === 'buy' ? 'long' : 'short',
        entry_price: position.entry_price,
        exit_price: exitPrice,
        size: position.size,
        pnl,
        pnl_percentage: (pnl / (position.entry_price * position.size)) * 100,
        signal_strength: 1,
      });
    }

    const totalTrades = trades.length;
    const winningTrades = trades.filter((trade) => trade.pnl > 0).length;
    const losingTrades = totalTrades - winningTrades;
    const totalReturn = ((capital - initialCapital) / initialCapital) * 100;
    const winRate = totalTrades > 0 ? (winningTrades / totalTrades) * 100 : 0;

    const { data: backtestRun, error: backtestRunError } = await supabase
      .from('backtest_runs')
      .insert({
        name,
        symbol,
        interval,
        start_timestamp: startTimestamp,
        end_timestamp: endTimestamp,
        initial_capital: initialCapital,
        final_capital: capital,
        total_return: totalReturn,
        max_drawdown: maxDrawdown,
        win_rate: winRate,
        total_trades: totalTrades,
        winning_trades: winningTrades,
        losing_trades: losingTrades,
        strategy_config: strategyConfig,
        status: 'completed',
      })
      .select()
      .single();

    if (backtestRunError) throw backtestRunError;

    if (trades.length > 0) {
      await supabase
        .from('backtest_trades')
        .insert(trades.map((trade) => ({
          backtest_run_id: backtestRun.id,
          entry_timestamp: trade.entry_timestamp,
          exit_timestamp: trade.exit_timestamp,
          side: trade.side,
          entry_price: trade.entry_price,
          exit_price: trade.exit_price,
          size: trade.size,
          pnl: trade.pnl,
          pnl_percentage: trade.pnl_percentage,
          signal_strength: trade.signal_strength,
        })) as unknown[]);
    }

    if (equityCurve.length > 0) {
      await supabase
        .from('backtest_equity_curve')
        .insert(equityCurve.map((point) => ({
          backtest_run_id: backtestRun.id,
          timestamp: point.timestamp,
          equity: point.equity,
          drawdown: point.drawdown,
        })) as unknown[]);
    }

    await supabase
      .from('runs')
      .update({
        status: 'STOPPED',
        last_tick_at: new Date().toISOString(),
        config_json: {
          ...runConfig,
          final_capital: capital,
          total_return: totalReturn,
          total_trades: totalTrades,
        }
      })
      .eq('id', run.id);

    return new Response(JSON.stringify({
      backtest_run_id: backtestRun.id,
      run_id: run.id,
      trades_count: totalTrades,
      final_capital: capital,
      total_return: totalReturn,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  } catch (err: unknown) {
    const error = err as Error;
    logError({ component: 'run-backtest', message: 'Backtest error', context: { error: error.message } });
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
