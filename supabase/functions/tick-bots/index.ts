import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { parseBoolean, parseNumber, requireEnv } from "../_shared/env.ts";
import { logError, logInfo, logWarn } from "../_shared/logging.ts";
import { ExecutionEngine, ExecutionMarketData, ExecutionRun, getLiveConfig, LiveKrakenExecutionEngine, PaperExecutionEngine } from "../_shared/execution.ts";
import { generateBaselineSignal, evaluateRisk, MarketTick, OrderSide, TradeDecision, RiskInputs } from "../_shared/trading.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// This function is called by a cron job to tick all running bots
// It reads bot state from DB, executes strategy logic, and places orders

interface Bot {
  id: string;
  user_id: string;
  status: string;
  mode: 'paper' | 'live';
  symbol: string;
  strategy_id: string;
  strategy_config: Record<string, unknown>;
  max_position_size: number;
  max_daily_loss: number;
  stop_loss_pct: number;
  take_profit_pct: number;
  current_capital: number;
  daily_pnl: number;
  total_pnl: number;
  total_trades: number;
  winning_trades: number;
  error_count: number;
  api_key_id: string | null;
}

interface Position {
  id: string;
  symbol: string;
  side: 'buy' | 'sell';
  quantity: number;
  entry_price: number;
  stop_loss_price: number | null;
  take_profit_price: number | null;
  total_fees: number;
}

interface MarketData {
  symbol: string;
  price: number;
  bid: number;
  ask: number;
  volume_24h: number;
  change_24h: number;
  source: 'live' | 'fallback';
  fetched_at: string;
}

interface AiStrategyDecision {
  action: 'BUY' | 'SELL' | 'HOLD';
  confidence: number;
  reasoning: string;
  positionSize: number;
  stopLoss: number;
  takeProfit: number;
  riskScore: number;
  expectedReturn: number;
  timeHorizon: string;
}

interface UserProfile {
  global_kill_switch: boolean;
}

interface RiskState {
  tradesLastHour: number;
  cooldownActive: boolean;
  lossStreakExceeded: boolean;
  killSwitchActive: boolean;
}

async function getActiveRun(supabase: SupabaseClient, bot: Bot): Promise<ExecutionRun | null> {
  const { data: run } = await supabase
    .from('bot_runs')
    .select('id, mode, status, live_armed, arm_requested_at, armed_at, summary')
    .eq('bot_id', bot.id)
    .eq('status', 'running')
    .order('started_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  return run as ExecutionRun | null;
}

// Get service client for server-side operations
function getServiceClient(): SupabaseClient {
  return createClient(
    requireEnv('SUPABASE_URL'),
    requireEnv('SUPABASE_SERVICE_ROLE_KEY')
  );
}

// Fetch real market data from Kraken public API
async function fetchMarketData(symbol: string): Promise<MarketData> {
  const fetchedAt = new Date().toISOString();
  try {
    // Convert symbol format (BTC/USD -> XXBTZUSD)
    const krakenSymbol = symbol.replace('BTC', 'XBT').replace('/', '');
    const response = await fetch(`https://api.kraken.com/0/public/Ticker?pair=${krakenSymbol}`);
    const data = await response.json();
    
    if (data.error && data.error.length > 0) {
      throw new Error(data.error[0]);
    }

    const pairData = Object.values(data.result)[0] as {
      a: string[];
      b: string[];
      c: string[];
      v: string[];
      p: string[];
    };

    return {
      symbol,
      price: parseFloat(pairData.c[0]),
      bid: parseFloat(pairData.b[0]),
      ask: parseFloat(pairData.a[0]),
      volume_24h: parseFloat(pairData.v[1]),
      change_24h: parseFloat(pairData.p[1]),
      source: 'live',
      fetched_at: fetchedAt,
    };
  } catch (error) {
    logWarn({
      component: 'tick-bots',
      message: 'Error fetching market data, falling back to simulated prices',
      context: { error: (error as Error).message, symbol },
    });
    // Return simulated data as fallback
    const symbolSeed = symbol.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    const basePrice = 95000 + (symbolSeed % 1000);
    const change = ((symbolSeed % 100) - 50) / 10;
    const volume = 50000 + (symbolSeed % 5000);
    return {
      symbol,
      price: basePrice,
      bid: basePrice - 10,
      ask: basePrice + 10,
      volume_24h: volume,
      change_24h: change,
      source: 'fallback',
      fetched_at: fetchedAt,
    };
  }
}

// Simple strategy calculations
function getStrategyConfig(strategyId: string) {
  if (strategyId === 'mean_reversion') {
    return { signalThreshold: 0.025, maxSignalStrength: 0.08 };
  }

  if (strategyId === 'breakout') {
    return { signalThreshold: 0.02, maxSignalStrength: 0.06 };
  }

  return { signalThreshold: 0.02, maxSignalStrength: 0.08 };
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function buildDecisionFromSignal(
  bot: Bot,
  marketData: MarketData,
  signal: ReturnType<typeof generateBaselineSignal>,
  traceId: string,
): TradeDecision | null {
  if (!signal) {
    return null;
  }

  const positionValue = Number(bot.current_capital) * bot.max_position_size * signal.confidence;
  const quantity = positionValue / marketData.price;
  if (quantity <= 0) {
    return null;
  }

  return {
    symbol: bot.symbol,
    side: signal.side,
    size: quantity,
    entry: marketData.price,
    stop: signal.side === 'buy'
      ? marketData.price * (1 - bot.stop_loss_pct / 100)
      : marketData.price * (1 + bot.stop_loss_pct / 100),
    take_profit: signal.side === 'buy'
      ? marketData.price * (1 + bot.take_profit_pct / 100)
      : marketData.price * (1 - bot.take_profit_pct / 100),
    confidence: signal.confidence,
    rationale: signal.rationale,
    trace_id: traceId,
  };
}

async function fetchAiStrategyDecision(
  bot: Bot,
  marketData: MarketData,
  traceId: string,
): Promise<AiStrategyDecision | null> {
  const aiEnabled = parseBoolean(Deno.env.get('AI_STRATEGY_ENABLED'), true);
  if (!aiEnabled) {
    return null;
  }

  try {
    const response = await fetch(`${requireEnv('SUPABASE_URL')}/functions/v1/ai-strategy-engine`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-service-role': requireEnv('SUPABASE_SERVICE_ROLE_KEY'),
      },
      body: JSON.stringify({
        marketState: {
          symbol: bot.symbol,
          currentPrice: marketData.price,
          priceChange24h: marketData.change_24h,
          volume24h: marketData.volume_24h,
          sentiment: 0,
          volatility: Math.abs(marketData.change_24h),
          trendStrength: Math.abs(marketData.change_24h),
        },
        portfolio: {
          currentCapital: bot.current_capital,
          dailyPnl: bot.daily_pnl,
          openPosition: null,
        },
        riskTolerance: (bot.strategy_config?.riskTolerance as string | undefined) ?? 'moderate',
        traceId,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      logWarn({
        component: 'tick-bots',
        message: 'AI strategy engine returned error',
        context: { status: response.status, error: errorText, trace_id: traceId },
      });
      return null;
    }

    const data = await response.json();
    return data?.decision ?? null;
  } catch (error) {
    logWarn({
      component: 'tick-bots',
      message: 'AI strategy engine call failed',
      context: { error: (error as Error).message, trace_id: traceId },
    });
    return null;
  }
}

function buildAiTradeDecision(
  bot: Bot,
  marketData: MarketData,
  aiDecision: AiStrategyDecision,
  traceId: string,
): TradeDecision | null {
  if (aiDecision.action === 'HOLD') {
    return null;
  }

  const confidence = clamp(aiDecision.confidence / 100, 0, 1);
  const positionSizePct = clamp(aiDecision.positionSize, 0, 10);
  const positionValue = Number(bot.current_capital) * (positionSizePct / 100);
  const quantity = positionValue / marketData.price;

  if (quantity <= 0 || confidence <= 0) {
    return null;
  }

  const stopLossPct = clamp(aiDecision.stopLoss, 1, 20);
  const takeProfitPct = clamp(aiDecision.takeProfit, 1, 50);
  const side = aiDecision.action.toLowerCase() as OrderSide;

  return {
    symbol: bot.symbol,
    side,
    size: quantity,
    entry: marketData.price,
    stop: side === 'buy'
      ? marketData.price * (1 - stopLossPct / 100)
      : marketData.price * (1 + stopLossPct / 100),
    take_profit: side === 'buy'
      ? marketData.price * (1 + takeProfitPct / 100)
      : marketData.price * (1 - takeProfitPct / 100),
    confidence,
    rationale: `AI: ${aiDecision.reasoning}`,
    trace_id: traceId,
  };
}

// Log event to database - uses type assertion for new tables
async function logEvent(
  supabase: SupabaseClient,
  botId: string,
  userId: string,
  eventType: string,
  message: string,
  severity: string = 'info',
  payload: Record<string, unknown> = {},
  metrics?: { capital?: number; pnl?: number; price?: number },
  runId?: string | null
) {
  try {
    await supabase.from('bot_events').insert([{
      bot_id: botId,
      user_id: userId,
      event_type: eventType,
      severity,
      message,
      payload: { ...payload, run_id: runId ?? null },
      bot_capital: metrics?.capital ?? null,
      bot_pnl: metrics?.pnl ?? null,
      market_price: metrics?.price ?? null,
    }] as unknown[]);
  } catch (err) {
    logError({
      component: 'tick-bots',
      message: 'Failed to log event',
      context: { error: (err as Error).message },
    });
  }
}

// Execute paper trade (simulated)
async function executePaperTrade(
  supabase: SupabaseClient,
  bot: Bot,
  decision: TradeDecision
): Promise<void> {
  const clientOrderId = `paper_${bot.id}_${decision.trace_id}`;
  const fee = decision.size * decision.entry * 0.001; // 0.1% fee simulation

  const { data: existingOrder } = await supabase
    .from('orders')
    .select('id')
    .eq('client_order_id', clientOrderId)
    .maybeSingle();

  if (existingOrder) {
    await logEvent(
      supabase,
      bot.id,
      bot.user_id,
      'order',
      'Duplicate paper order prevented',
      'warn',
      { decision, client_order_id: clientOrderId }
    );
    return;
  }

  // Create order record
  const orderData = {
    bot_id: bot.id,
    user_id: bot.user_id,
    client_order_id: clientOrderId,
    symbol: bot.symbol,
    side: decision.side,
    order_type: 'market',
    status: 'filled',
    quantity: decision.size,
    filled_quantity: decision.size,
    average_fill_price: decision.entry,
    fee,
    fee_currency: 'USD',
    strategy_id: bot.strategy_id,
    reason: decision.rationale,
    risk_checked: true,
    submitted_at: new Date().toISOString(),
    filled_at: new Date().toISOString(),
    risk_flags: { trace_id: decision.trace_id },
  };

  const { data: orderResult, error: orderError } = await supabase
    .from('orders')
    .insert([orderData] as unknown[])
    .select()
    .single();

  if (orderError) {
    console.error('Failed to create order:', orderError);
    throw orderError;
  }

  const order = orderResult as { id: string };

  // Update or create position
  const { data: existingPositions } = await supabase
    .from('positions')
    .select('*')
    .eq('bot_id', bot.id)
    .eq('symbol', bot.symbol)
    .eq('status', 'open');

  const existingPosition = existingPositions && existingPositions.length > 0 ? existingPositions[0] as Position : null;

  if (existingPosition) {
    // Close existing position
    const exitPnl = decision.side === 'sell'
      ? (decision.entry - existingPosition.entry_price) * existingPosition.quantity
      : (existingPosition.entry_price - decision.entry) * existingPosition.quantity;

    await supabase
      .from('positions')
      .update({
        status: 'closed',
        exit_price: decision.entry,
        realized_pnl: exitPnl - fee,
        total_fees: (existingPosition.total_fees || 0) + fee,
        exit_order_id: order.id,
        closed_at: new Date().toISOString(),
      } as unknown)
      .eq('id', existingPosition.id);

    // Update bot capital
    await supabase
      .from('bots')
      .update({
        current_capital: Number(bot.current_capital) + exitPnl - fee,
        total_pnl: (bot.total_pnl || 0) + exitPnl - fee,
        daily_pnl: (bot.daily_pnl || 0) + exitPnl - fee,
        total_trades: (bot.total_trades || 0) + 1,
        winning_trades: exitPnl > 0 ? (bot.winning_trades || 0) + 1 : bot.winning_trades,
      } as unknown)
      .eq('id', bot.id);
  } else {
    // Open new position
    const stopLoss = decision.side === 'buy'
      ? decision.entry * (1 - bot.stop_loss_pct / 100)
      : decision.entry * (1 + bot.stop_loss_pct / 100);
    
    const takeProfit = decision.side === 'buy'
      ? decision.entry * (1 + bot.take_profit_pct / 100)
      : decision.entry * (1 - bot.take_profit_pct / 100);

    await supabase
      .from('positions')
      .insert([{
        bot_id: bot.id,
        user_id: bot.user_id,
        symbol: bot.symbol,
        side: decision.side,
        status: 'open',
        quantity: decision.size,
        entry_price: decision.entry,
        current_price: decision.entry,
        stop_loss_price: stopLoss,
        take_profit_price: takeProfit,
        total_fees: fee,
        entry_order_id: order.id,
      }] as unknown[]);
  }

  await logEvent(
    supabase,
    bot.id,
    bot.user_id,
    'fill',
    `Paper ${decision.side} ${decision.size.toFixed(6)} ${bot.symbol} @ ${decision.entry.toFixed(2)}`,
    'info',
    { decision, fee },
    { capital: Number(bot.current_capital), price: decision.entry }
  );
}

// Execute live trade via Kraken API
async function executeLiveTrade(
  supabase: SupabaseClient,
  bot: Bot,
  decision: TradeDecision
): Promise<void> {
  if (!bot.api_key_id) {
    await logEvent(supabase, bot.id, bot.user_id, 'error', 'Live trade failed: No API key configured', 'error');
    return;
  }

  const clientOrderId = `live_${bot.id}_${decision.trace_id}`;

  const { data: existingOrder } = await supabase
    .from('orders')
    .select('id')
    .eq('client_order_id', clientOrderId)
    .maybeSingle();

  if (existingOrder) {
    await logEvent(
      supabase,
      bot.id,
      bot.user_id,
      'order',
      'Duplicate live order prevented',
      'warn',
      { decision, client_order_id: clientOrderId }
    );
    return;
  }
  
  // Create pending order record
  const { data: order, error: orderError } = await supabase
    .from('orders')
    .insert([{
      bot_id: bot.id,
      user_id: bot.user_id,
      client_order_id: clientOrderId,
      symbol: bot.symbol,
      side: decision.side,
      order_type: 'market',
      status: 'pending',
      quantity: decision.size,
      filled_quantity: 0,
      strategy_id: bot.strategy_id,
      reason: decision.rationale,
      risk_checked: true,
      risk_flags: { trace_id: decision.trace_id },
    }] as unknown[])
    .select()
    .single();

  if (orderError) {
    console.error('Failed to create order:', orderError);
    await logEvent(supabase, bot.id, bot.user_id, 'error', `Order creation failed: ${orderError.message}`, 'error');
    return;
  }

  try {
    // Call exchange-kraken edge function
    const krakenSymbol = bot.symbol.replace('/', '');
    const krakenResponse = await fetch(`${requireEnv('SUPABASE_URL')}/functions/v1/exchange-kraken`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${requireEnv('SUPABASE_SERVICE_ROLE_KEY')}`,
      },
      body: JSON.stringify({
        action: 'add_order',
        api_key_id: bot.api_key_id,
        pair: krakenSymbol,
        type: decision.side,
        ordertype: 'market',
        volume: decision.size.toString(),
      }),
    });

    const result = await krakenResponse.json();

    if (!result.success) {
      // Update order as rejected
      await supabase.from('orders').update({ status: 'rejected', reason: result.error?.message } as unknown).eq('id', (order as { id: string }).id);
      await logEvent(supabase, bot.id, bot.user_id, 'error', `Kraken order rejected: ${result.error?.message}`, 'error', { error: result.error });
      return;
    }

    // Update order with exchange response
    const txid = result.data?.txid?.[0] || null;
    await supabase.from('orders').update({
      status: 'submitted',
      exchange_order_id: txid,
      submitted_at: new Date().toISOString(),
    } as unknown).eq('id', (order as { id: string }).id);

    await logEvent(supabase, bot.id, bot.user_id, 'order', `Live ${decision.side} order submitted: ${decision.size} ${bot.symbol}`, 'info', { txid, decision });
  } catch (err) {
    const error = err as Error;
    await supabase.from('orders').update({ status: 'rejected', reason: error.message } as unknown).eq('id', (order as { id: string }).id);
    await logEvent(supabase, bot.id, bot.user_id, 'error', `Live trade error: ${error.message}`, 'error');
  }
}

async function getRiskState(
  supabase: SupabaseClient,
  bot: Bot,
  tradeWindowMinutes: number,
  cooldownMinutes: number,
  lossStreakLimit: number
): Promise<RiskState> {
  const windowStart = new Date(Date.now() - tradeWindowMinutes * 60 * 1000).toISOString();

  const { count: tradesLastHour } = await supabase
    .from('orders')
    .select('id', { count: 'exact', head: true })
    .eq('bot_id', bot.id)
    .gte('created_at', windowStart);

  const { data: recentClosedPositions } = await supabase
    .from('positions')
    .select('realized_pnl, closed_at')
    .eq('bot_id', bot.id)
    .eq('status', 'closed')
    .order('closed_at', { ascending: false })
    .limit(lossStreakLimit);

  const lossStreakExceeded = (recentClosedPositions || []).length >= lossStreakLimit &&
    (recentClosedPositions || []).every((position) => (position.realized_pnl ?? 0) < 0);

  const lastLoss = (recentClosedPositions || []).find((position) => (position.realized_pnl ?? 0) < 0);
  const cooldownActive = lastLoss?.closed_at
    ? Date.now() - new Date(lastLoss.closed_at).getTime() < cooldownMinutes * 60 * 1000
    : false;

  const { data: profile } = await supabase
    .from('profiles')
    .select('global_kill_switch')
    .eq('user_id', bot.user_id)
    .maybeSingle();

  return {
    tradesLastHour: tradesLastHour ?? 0,
    cooldownActive,
    lossStreakExceeded,
    killSwitchActive: (profile as UserProfile | null)?.global_kill_switch ?? false,
  };
}

async function recordRiskRejection(
  supabase: SupabaseClient,
  bot: Bot,
  decision: TradeDecision,
  flags: string[],
  runId?: string | null
) {
  await supabase
    .from('orders')
    .insert([{
      bot_id: bot.id,
      user_id: bot.user_id,
      client_order_id: `rejected_${bot.id}_${decision.trace_id}`,
      symbol: decision.symbol,
      side: decision.side,
      order_type: 'market',
      status: 'rejected',
      quantity: decision.size,
      filled_quantity: 0,
      average_fill_price: null,
      fee: 0,
      strategy_id: bot.strategy_id,
      reason: decision.rationale,
      risk_checked: true,
      risk_flags: { flags, trace_id: decision.trace_id, run_id: runId ?? null },
      submitted_at: new Date().toISOString(),
    }] as unknown[])
    .select()
    .single();
}

async function executeDecisionWithRisk(
  supabase: SupabaseClient,
  bot: Bot,
  decision: TradeDecision,
  marketData: MarketData,
  run: ExecutionRun | null,
  traceId: string,
  aiConfidenceOk: boolean,
): Promise<void> {
  const cooldownMinutes = parseNumber(Deno.env.get('COOLDOWN_MINUTES_AFTER_LOSS'), 30);
  const tradeWindowMinutes = 60;
  const maxTradesPerHour = parseNumber(Deno.env.get('MAX_TRADES_PER_HOUR'), 5);
  const maxLossStreak = Math.max(1, parseNumber(Deno.env.get('MAX_CONSECUTIVE_LOSSES'), 3));
  const riskState = await getRiskState(supabase, bot, tradeWindowMinutes, cooldownMinutes, maxLossStreak);
  const systemKillSwitch = parseBoolean(Deno.env.get('KILL_SWITCH_ENABLED'), true);
  const marketDataFresh = bot.mode === 'paper' ? true : marketData.source === 'live';
  const riskInputs: RiskInputs = {
    currentCapital: Number(bot.current_capital),
    dailyPnl: Number(bot.daily_pnl),
    maxDailyLoss: Number(bot.max_daily_loss),
    maxPositionSize: Number(bot.max_position_size),
    maxLeverage: Number(bot.max_leverage),
    stopLossPct: Number(bot.stop_loss_pct),
    tradesLastHour: riskState.tradesLastHour,
    maxTradesPerHour,
    cooldownActive: riskState.cooldownActive,
    lossStreakExceeded: riskState.lossStreakExceeded,
    killSwitchActive: systemKillSwitch || riskState.killSwitchActive,
    liveTradingEnabled: parseBoolean(Deno.env.get('LIVE_TRADING_ENABLED'), false),
    marketDataFresh,
    aiConfidenceOk: bot.mode === 'paper' ? true : aiConfidenceOk,
    mode: bot.mode,
  };

  const riskCheck = evaluateRisk(decision, riskInputs);

  if (riskCheck.allowed) {
    const executionMarketData: ExecutionMarketData = {
      price: marketData.price,
      bid: marketData.bid,
      ask: marketData.ask,
      source: marketData.source,
      fetched_at: marketData.fetched_at,
    };
    const killSwitchActive = systemKillSwitch || riskState.killSwitchActive;
    const engine: ExecutionEngine = bot.mode === 'paper'
      ? new PaperExecutionEngine(supabase, bot, run?.id ?? undefined)
      : new LiveKrakenExecutionEngine({
        supabase,
        bot,
        run,
        config: getLiveConfig(killSwitchActive),
        marketData: executionMarketData,
        traceId,
      });

    await engine.executeTrade(decision);
  } else {
    await recordRiskRejection(supabase, bot, decision, riskCheck.flags, run?.id ?? null);
    await logEvent(
      supabase,
      bot.id,
      bot.user_id,
      'risk_alert',
      `Order blocked by risk limits: ${riskCheck.flags.join(', ')}`,
      'warn',
      { decision, riskCheck },
      undefined,
      run?.id ?? null
    );
  }
}

// Process a single bot tick
async function processBotTick(supabase: SupabaseClient, bot: Bot): Promise<void> {
  try {
    const traceId = crypto.randomUUID();
    const run = await getActiveRun(supabase, bot);

    // Fetch current market data
    const marketData = await fetchMarketData(bot.symbol);
    const marketTick: MarketTick = marketData;

    // Get open position if any
    const { data: positions } = await supabase
      .from('positions')
      .select('*')
      .eq('bot_id', bot.id)
      .eq('status', 'open');

    const position = positions && positions.length > 0 ? positions[0] as Position : null;

    // Update position with current price
    if (position) {
      const unrealizedPnl = position.side === 'buy'
        ? (marketData.price - position.entry_price) * position.quantity
        : (position.entry_price - marketData.price) * position.quantity;

      await supabase
        .from('positions')
        .update({
          current_price: marketData.price,
          unrealized_pnl: unrealizedPnl,
        } as unknown)
        .eq('id', position.id);

      // Check stop loss / take profit
      if (position.side === 'buy') {
        if (position.stop_loss_price && marketData.price <= position.stop_loss_price) {
          await executeDecisionWithRisk(supabase, bot, {
            symbol: bot.symbol,
            side: 'sell',
            size: position.quantity,
            entry: marketData.price,
            stop: position.stop_loss_price ?? marketData.price,
            take_profit: position.take_profit_price ?? marketData.price,
            confidence: 1,
            rationale: 'Stop loss triggered',
            trace_id: traceId,
          }, marketData, run, traceId, true);
          await logEvent(
            supabase,
            bot.id,
            bot.user_id,
            'risk_alert',
            'Stop loss triggered',
            'warn',
            { price: marketData.price, stop_loss: position.stop_loss_price, trace_id: traceId },
            undefined,
            run?.id ?? null
          );
          return;
        }
        if (position.take_profit_price && marketData.price >= position.take_profit_price) {
          await executeDecisionWithRisk(supabase, bot, {
            symbol: bot.symbol,
            side: 'sell',
            size: position.quantity,
            entry: marketData.price,
            stop: position.stop_loss_price ?? marketData.price,
            take_profit: position.take_profit_price ?? marketData.price,
            confidence: 1,
            rationale: 'Take profit triggered',
            trace_id: traceId,
          }, marketData, run, traceId, true);
          return;
        }
      } else {
        if (position.stop_loss_price && marketData.price >= position.stop_loss_price) {
          await executeDecisionWithRisk(supabase, bot, {
            symbol: bot.symbol,
            side: 'buy',
            size: position.quantity,
            entry: marketData.price,
            stop: position.stop_loss_price ?? marketData.price,
            take_profit: position.take_profit_price ?? marketData.price,
            confidence: 1,
            rationale: 'Stop loss triggered',
            trace_id: traceId,
          }, marketData, run, traceId, true);
          await logEvent(
            supabase,
            bot.id,
            bot.user_id,
            'risk_alert',
            'Stop loss triggered',
            'warn',
            { price: marketData.price, stop_loss: position.stop_loss_price, trace_id: traceId },
            undefined,
            run?.id ?? null
          );
          return;
        }
        if (position.take_profit_price && marketData.price <= position.take_profit_price) {
          await executeDecisionWithRisk(supabase, bot, {
            symbol: bot.symbol,
            side: 'buy',
            size: position.quantity,
            entry: marketData.price,
            stop: position.stop_loss_price ?? marketData.price,
            take_profit: position.take_profit_price ?? marketData.price,
            confidence: 1,
            rationale: 'Take profit triggered',
            trace_id: traceId,
          }, marketData, run, traceId, true);
          return;
        }
      }
    }

    // Calculate trading signal
    const strategyConfig = getStrategyConfig(bot.strategy_id);
    const signal = generateBaselineSignal(marketTick, strategyConfig);

    const aiDecision = await fetchAiStrategyDecision(bot, marketData, traceId);
    const aiConfidenceThreshold = parseNumber(Deno.env.get('AI_CONFIDENCE_THRESHOLD'), 0.55);
    const aiConfidenceOk = !aiDecision || aiDecision.confidence / 100 >= aiConfidenceThreshold;
    const aiTradeDecision = aiDecision && aiConfidenceOk
      ? buildAiTradeDecision(bot, marketData, aiDecision, traceId)
      : null;

    const fallbackDecision = signal && signal.confidence > 0.3
      ? buildDecisionFromSignal(bot, marketData, signal, traceId)
      : null;

    const decision = aiTradeDecision ?? fallbackDecision;

    if (decision && !position) {
      const decisionSource = aiTradeDecision ? 'ai' : 'baseline';
      await logEvent(
        supabase,
        bot.id,
        bot.user_id,
        'tick',
        `Signal generated (${decision.side}) via ${decisionSource}`,
        'info',
        { signal, aiDecision, decision, trace_id: traceId },
        undefined,
        run?.id ?? null
      );

      await executeDecisionWithRisk(supabase, bot, decision, marketData, run, traceId, aiConfidenceOk);
    }

    // Update heartbeat
    await supabase
      .from('bots')
      .update({
        last_heartbeat_at: new Date().toISOString(),
        last_tick_at: new Date().toISOString(),
      } as unknown)
      .eq('id', bot.id);

    // Log tick event (every 10th tick to reduce noise)
    const tickCount = Math.floor(Date.now() / 60000) % 10;
    if (tickCount === 0) {
      await logEvent(
        supabase,
        bot.id,
        bot.user_id,
        'heartbeat',
        `Tick processed: ${marketData.symbol} @ ${marketData.price.toFixed(2)}`,
        'info',
        { marketData, signal, hasPosition: !!position, trace_id: traceId },
        { capital: Number(bot.current_capital), pnl: Number(bot.total_pnl), price: marketData.price },
        run?.id ?? null
      );
    }
  } catch (err: unknown) {
    const error = err as Error;
    logError({
      component: 'tick-bots',
      message: 'Error processing bot tick',
      context: { bot_id: bot.id, error: error.message },
    });

    // Log error and increment error count
    await supabase
      .from('bots')
      .update({
        error_count: (bot.error_count || 0) + 1,
        last_error: error.message,
        status: (bot.error_count || 0) >= 5 ? 'error' : bot.status,
      } as unknown)
      .eq('id', bot.id);

    await logEvent(
      supabase,
      bot.id,
      bot.user_id,
      'error',
      `Tick error: ${error.message}`,
      'error',
      { error: error.message, stack: error.stack },
      undefined,
      run?.id ?? null
    );
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = getServiceClient();

  try {
    const serviceHeader = req.headers.get('x-service-role');
    if (!serviceHeader || serviceHeader !== requireEnv('SUPABASE_SERVICE_ROLE_KEY')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    logInfo({ component: 'tick-bots', message: 'Tick-bots starting' });

    // Get all running bots
    const { data: bots, error: botsError } = await supabase
      .from('bots')
      .select('*')
      .eq('status', 'running');

    if (botsError) throw botsError;

    if (!bots || bots.length === 0) {
      console.log('No running bots found');
      return new Response(JSON.stringify({ message: 'No running bots', processed: 0 }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    logInfo({ component: 'tick-bots', message: 'Processing running bots', context: { count: bots.length } });

    // Process each bot
    const results = await Promise.allSettled(
      bots.map(bot => processBotTick(supabase, bot as Bot))
    );

    const successful = results.filter(r => r.status === 'fulfilled').length;
    const failed = results.filter(r => r.status === 'rejected').length;

    logInfo({
      component: 'tick-bots',
      message: 'Tick complete',
      context: { processed: bots.length, successful, failed },
    });

    return new Response(JSON.stringify({
      message: 'Tick complete',
      processed: bots.length,
      successful,
      failed,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  } catch (err: unknown) {
    const error = err as Error;
    logError({ component: 'tick-bots', message: 'Tick-bots error', context: { error: error.message } });
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
