import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { parseBoolean, parseNumber, requireEnv } from "./env.ts";
import { logError, logWarn } from "./logging.ts";
import { TradeDecision } from "./trading.ts";

export type ExecutionStatus = 'pending' | 'submitted' | 'rejected' | 'filled';

export interface ExecutionResult {
  status: ExecutionStatus;
  order_id?: string | null;
  exchange_order_id?: string | null;
  message?: string;
}

export interface ExecutionEngine {
  executeTrade(decision: TradeDecision): Promise<ExecutionResult>;
}

export interface ExecutionBot {
  id: string;
  user_id: string;
  symbol: string;
  strategy_id: string;
  mode: 'paper' | 'live';
  max_position_size: number;
  max_daily_loss: number;
  stop_loss_pct: number;
  take_profit_pct: number;
  max_leverage: number;
  current_capital: number;
  total_pnl: number;
  daily_pnl: number;
  total_trades: number;
  winning_trades: number;
  api_key_id: string | null;
}

export interface ExecutionRun {
  id: string;
  mode: string;
  status: string;
  live_armed: boolean | null;
  arm_requested_at?: string | null;
  armed_at?: string | null;
  summary?: Record<string, unknown> | null;
}

export interface ExecutionMarketData {
  price: number;
  bid: number;
  ask: number;
  source: 'live' | 'fallback';
  fetched_at: string;
}

export interface LiveConfig {
  liveTradingEnabled: boolean;
  killSwitchActive: boolean;
  secretsReady: boolean;
  cooldownSeconds: number;
  maxConsecutiveFailures: number;
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

interface OrderRecord {
  id: string;
}

const sanitizeError = (error: unknown) => ({
  message: (error as Error)?.message ?? 'Unknown error',
});

export const normalizeKrakenOrderResponse = (result: Record<string, unknown> | null) => {
  const txid = Array.isArray(result?.txid) ? result?.txid?.[0] : null;
  return {
    exchange_order_id: typeof txid === 'string' ? txid : null,
    status: txid ? 'submitted' : 'rejected',
  } as const;
};

export const evaluateLiveEligibility = (input: {
  run: ExecutionRun | null;
  liveTradingEnabled: boolean;
  killSwitchActive: boolean;
  secretsReady: boolean;
  cooldownSeconds: number;
  now: Date;
}) => {
  const reasons: string[] = [];

  if (!input.secretsReady) {
    reasons.push('SECRETS_NOT_CONFIGURED');
  }
  if (!input.liveTradingEnabled) {
    reasons.push('LIVE_TRADING_DISABLED');
  }
  if (input.killSwitchActive) {
    reasons.push('KILL_SWITCH_ACTIVE');
  }
  if (!input.run || input.run.mode !== 'live') {
    reasons.push('NO_ACTIVE_LIVE_RUN');
  }
  if (!input.run?.live_armed) {
    reasons.push('LIVE_NOT_ARMED');
  }
  if (input.run?.armed_at) {
    const cooldownEndsAt = new Date(input.run.armed_at).getTime() + input.cooldownSeconds * 1000;
    if (input.now.getTime() < cooldownEndsAt) {
      reasons.push('LIVE_COOLDOWN_ACTIVE');
    }
  }

  return { allowed: reasons.length === 0, reasons };
};

const buildFailureSummary = (
  summary: Record<string, unknown> | null | undefined,
  nowIso: string,
  nextCount: number,
) => ({
  ...(summary ?? {}),
  live_failure_count: nextCount,
  last_live_failure_at: nowIso,
});

export const getNextFailureState = (
  summary: Record<string, unknown> | null | undefined,
  threshold: number,
) => {
  const currentCount = Number(summary?.live_failure_count ?? 0);
  const nextCount = currentCount + 1;
  return {
    nextCount,
    triggered: nextCount >= threshold,
  };
};

const estimateBpsValue = (decision: TradeDecision, bps: number) =>
  decision.size * decision.entry * (bps / 10000);

const logEvent = async (
  supabase: SupabaseClient,
  botId: string,
  userId: string,
  eventType: string,
  message: string,
  severity: string = 'info',
  payload: Record<string, unknown> = {},
) => {
  try {
    await supabase.from('bot_events').insert([{
      bot_id: botId,
      user_id: userId,
      event_type: eventType,
      severity,
      message,
      payload,
    }] as unknown[]);
  } catch (err) {
    logError({
      component: 'execution-engine',
      message: 'Failed to log bot event',
      context: { error: (err as Error).message },
    });
  }
};

export class PaperExecutionEngine implements ExecutionEngine {
  private supabase: SupabaseClient;
  private bot: ExecutionBot;
  private runId?: string;

  constructor(supabase: SupabaseClient, bot: ExecutionBot, runId?: string) {
    this.supabase = supabase;
    this.bot = bot;
    this.runId = runId;
  }

  async executeTrade(decision: TradeDecision): Promise<ExecutionResult> {
    const clientOrderId = `paper_${this.bot.id}_${decision.trace_id}`;
    const fee = decision.size * decision.entry * 0.001;

    const { data: existingOrder } = await this.supabase
      .from('orders')
      .select('id')
      .eq('client_order_id', clientOrderId)
      .maybeSingle();

    if (existingOrder) {
      await logEvent(
        this.supabase,
        this.bot.id,
        this.bot.user_id,
        'order',
        'Duplicate paper order prevented',
        'warn',
        { decision, client_order_id: clientOrderId, run_id: this.runId }
      );
      return { status: 'rejected', order_id: existingOrder.id, message: 'Duplicate order' };
    }

    const orderData = {
      bot_id: this.bot.id,
      user_id: this.bot.user_id,
      client_order_id: clientOrderId,
      symbol: this.bot.symbol,
      side: decision.side,
      order_type: 'market',
      status: 'filled',
      quantity: decision.size,
      filled_quantity: decision.size,
      average_fill_price: decision.entry,
      fee,
      fee_currency: 'USD',
      strategy_id: this.bot.strategy_id,
      reason: decision.rationale,
      risk_checked: true,
      submitted_at: new Date().toISOString(),
      filled_at: new Date().toISOString(),
      risk_flags: { trace_id: decision.trace_id, run_id: this.runId },
    };

    const { data: orderResult, error: orderError } = await this.supabase
      .from('orders')
      .insert([orderData] as unknown[])
      .select()
      .single();

    if (orderError) {
      throw orderError;
    }

    const order = orderResult as OrderRecord;

    const { data: existingPositions } = await this.supabase
      .from('positions')
      .select('*')
      .eq('bot_id', this.bot.id)
      .eq('symbol', this.bot.symbol)
      .eq('status', 'open');

    const existingPosition = existingPositions && existingPositions.length > 0
      ? existingPositions[0] as Position
      : null;

    if (existingPosition) {
      const exitPnl = decision.side === 'sell'
        ? (decision.entry - existingPosition.entry_price) * existingPosition.quantity
        : (existingPosition.entry_price - decision.entry) * existingPosition.quantity;

      await this.supabase
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

      await this.supabase
        .from('bots')
        .update({
          current_capital: Number(this.bot.current_capital) + exitPnl - fee,
          total_pnl: (this.bot.total_pnl || 0) + exitPnl - fee,
          daily_pnl: (this.bot.daily_pnl || 0) + exitPnl - fee,
          total_trades: (this.bot.total_trades || 0) + 1,
          winning_trades: exitPnl > 0 ? (this.bot.winning_trades || 0) + 1 : this.bot.winning_trades,
        } as unknown)
        .eq('id', this.bot.id);
    } else {
      const stopLoss = decision.side === 'buy'
        ? decision.entry * (1 - this.bot.stop_loss_pct / 100)
        : decision.entry * (1 + this.bot.stop_loss_pct / 100);

      const takeProfit = decision.side === 'buy'
        ? decision.entry * (1 + this.bot.take_profit_pct / 100)
        : decision.entry * (1 - this.bot.take_profit_pct / 100);

      await this.supabase
        .from('positions')
        .insert([{
          bot_id: this.bot.id,
          user_id: this.bot.user_id,
          symbol: this.bot.symbol,
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
      this.supabase,
      this.bot.id,
      this.bot.user_id,
      'fill',
      `Paper ${decision.side} ${decision.size.toFixed(6)} ${this.bot.symbol} @ ${decision.entry.toFixed(2)}`,
      'info',
      { decision, fee, run_id: this.runId }
    );

    return { status: 'filled', order_id: order.id };
  }
}

export class LiveKrakenExecutionEngine implements ExecutionEngine {
  private supabase: SupabaseClient;
  private bot: ExecutionBot;
  private run: ExecutionRun | null;
  private config: LiveConfig;
  private marketData: ExecutionMarketData;
  private traceId: string;

  constructor(options: {
    supabase: SupabaseClient;
    bot: ExecutionBot;
    run: ExecutionRun | null;
    config: LiveConfig;
    marketData: ExecutionMarketData;
    traceId: string;
  }) {
    this.supabase = options.supabase;
    this.bot = options.bot;
    this.run = options.run;
    this.config = options.config;
    this.marketData = options.marketData;
    this.traceId = options.traceId;
  }

  async executeTrade(decision: TradeDecision): Promise<ExecutionResult> {
    if (!this.bot.api_key_id) {
      await logEvent(this.supabase, this.bot.id, this.bot.user_id, 'error', 'Live trade failed: No API key configured', 'error', {
        decision,
        trace_id: this.traceId,
        run_id: this.run?.id ?? null,
      });
      return { status: 'rejected', message: 'Missing API key' };
    }

    const eligibility = evaluateLiveEligibility({
      run: this.run,
      liveTradingEnabled: this.config.liveTradingEnabled,
      killSwitchActive: this.config.killSwitchActive,
      secretsReady: this.config.secretsReady,
      cooldownSeconds: this.config.cooldownSeconds,
      now: new Date(),
    });

    if (!eligibility.allowed) {
      await logEvent(this.supabase, this.bot.id, this.bot.user_id, 'risk_alert', 'Live trade blocked by gating rules', 'warn', {
        trace_id: this.traceId,
        run_id: this.run?.id ?? null,
        reasons: eligibility.reasons,
      });
      return { status: 'rejected', message: eligibility.reasons.join(', ') };
    }

    if (this.marketData.source !== 'live') {
      await logEvent(this.supabase, this.bot.id, this.bot.user_id, 'risk_alert', 'Live trade blocked due to stale market data', 'warn', {
        trace_id: this.traceId,
        run_id: this.run?.id ?? null,
        market_source: this.marketData.source,
      });
      return { status: 'rejected', message: 'Stale market data' };
    }

    const clientOrderId = `live_${this.bot.id}_${decision.trace_id}`;
    const { data: existingOrder } = await this.supabase
      .from('orders')
      .select('id')
      .eq('client_order_id', clientOrderId)
      .maybeSingle();

    if (existingOrder) {
      await logEvent(
        this.supabase,
        this.bot.id,
        this.bot.user_id,
        'order',
        'Duplicate live order prevented',
        'warn',
        { decision, client_order_id: clientOrderId, trace_id: this.traceId, run_id: this.run?.id ?? null }
      );
      return { status: 'rejected', order_id: existingOrder.id, message: 'Duplicate order' };
    }

    const feeBps = parseNumber(Deno.env.get('LIVE_FEE_BPS'), 10);
    const slippageBps = parseNumber(Deno.env.get('LIVE_SLIPPAGE_BPS'), 8);
    const feeEstimate = estimateBpsValue(decision, feeBps);
    const slippageEstimate = estimateBpsValue(decision, slippageBps);

    const { data: order, error: orderError } = await this.supabase
      .from('orders')
      .insert([{
        bot_id: this.bot.id,
        user_id: this.bot.user_id,
        client_order_id: clientOrderId,
        symbol: this.bot.symbol,
        side: decision.side,
        order_type: 'market',
        status: 'pending',
        quantity: decision.size,
        filled_quantity: 0,
        strategy_id: this.bot.strategy_id,
        reason: decision.rationale,
        risk_checked: true,
        risk_flags: { trace_id: decision.trace_id, run_id: this.run?.id ?? null },
        fee: feeEstimate,
        slippage: slippageEstimate,
      }] as unknown[])
      .select()
      .single();

    if (orderError) {
      await logEvent(this.supabase, this.bot.id, this.bot.user_id, 'error', `Order creation failed: ${orderError.message}`, 'error', {
        trace_id: this.traceId,
        run_id: this.run?.id ?? null,
      });
      return { status: 'rejected', message: orderError.message };
    }

    await logEvent(this.supabase, this.bot.id, this.bot.user_id, 'order', 'Live order attempt submitted to Kraken', 'info', {
      trace_id: this.traceId,
      run_id: this.run?.id ?? null,
      order_id: (order as OrderRecord).id,
      symbol: decision.symbol,
      side: decision.side,
      size: decision.size,
      fee_estimate: feeEstimate,
      slippage_estimate: slippageEstimate,
    });

    try {
      const krakenSymbol = this.bot.symbol.replace('BTC', 'XBT').replace('/', '');
      const response = await fetch(`${requireEnv('SUPABASE_URL')}/functions/v1/exchange-kraken`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-service-role': requireEnv('SUPABASE_SERVICE_ROLE_KEY'),
        },
        body: JSON.stringify({
          action: 'add_order',
          api_key_id: this.bot.api_key_id,
          user_id: this.bot.user_id,
          pair: krakenSymbol,
          type: decision.side,
          ordertype: 'market',
          volume: decision.size.toString(),
        }),
      });

      const result = await response.json();

      if (!result?.success) {
        const errorDetails = result?.error ?? { code: 'UNKNOWN', message: 'Unknown error' };
        await this.supabase
          .from('orders')
          .update({ status: 'rejected', reason: errorDetails.message } as unknown)
          .eq('id', (order as OrderRecord).id);

        await logEvent(this.supabase, this.bot.id, this.bot.user_id, 'error', `Kraken order rejected: ${errorDetails.message}`, 'error', {
          trace_id: this.traceId,
          run_id: this.run?.id ?? null,
          order_id: (order as OrderRecord).id,
          error: errorDetails,
        });

        await this.handleLiveFailure(errorDetails.message);
        return { status: 'rejected', order_id: (order as OrderRecord).id, message: errorDetails.message };
      }

      const normalized = normalizeKrakenOrderResponse(result.data ?? null);
      await this.supabase
        .from('orders')
        .update({
          status: normalized.status,
          exchange_order_id: normalized.exchange_order_id,
          submitted_at: new Date().toISOString(),
        } as unknown)
        .eq('id', (order as OrderRecord).id);

      await this.resetLiveFailures();

      await logEvent(this.supabase, this.bot.id, this.bot.user_id, 'order', 'Live order acknowledged by Kraken', 'info', {
        trace_id: this.traceId,
        run_id: this.run?.id ?? null,
        order_id: (order as OrderRecord).id,
        exchange_order_id: normalized.exchange_order_id,
        status: normalized.status,
      });

      return {
        status: normalized.status,
        order_id: (order as OrderRecord).id,
        exchange_order_id: normalized.exchange_order_id,
      };
    } catch (err) {
      const error = sanitizeError(err);
      await this.supabase
        .from('orders')
        .update({ status: 'rejected', reason: error.message } as unknown)
        .eq('id', (order as OrderRecord).id);

      await logEvent(this.supabase, this.bot.id, this.bot.user_id, 'error', `Live trade error: ${error.message}`, 'error', {
        trace_id: this.traceId,
        run_id: this.run?.id ?? null,
        order_id: (order as OrderRecord).id,
      });

      await this.handleLiveFailure(error.message);
      return { status: 'rejected', order_id: (order as OrderRecord).id, message: error.message };
    }
  }

  private async resetLiveFailures() {
    if (!this.run) {
      return;
    }

    const summary = {
      ...(this.run.summary ?? {}),
      live_failure_count: 0,
      last_live_failure_at: null,
    };

    await this.supabase
      .from('bot_runs')
      .update({ summary } as unknown)
      .eq('id', this.run.id);
  }

  private async handleLiveFailure(reason: string) {
    if (!this.run) {
      return;
    }

    const nowIso = new Date().toISOString();
    const { nextCount, triggered } = getNextFailureState(this.run.summary, this.config.maxConsecutiveFailures);
    const summary = buildFailureSummary(this.run.summary, nowIso, nextCount);

    await this.supabase
      .from('bot_runs')
      .update({ summary } as unknown)
      .eq('id', this.run.id);

    if (!triggered) {
      return;
    }

    await this.supabase
      .from('profiles')
      .update({ global_kill_switch: true, kill_switch_activated_at: nowIso } as unknown)
      .eq('user_id', this.bot.user_id);

    await this.supabase
      .from('bots')
      .update({
        status: 'stopped',
        last_error: `Live circuit breaker triggered: ${reason}`,
      } as unknown)
      .eq('id', this.bot.id);

    await this.supabase
      .from('bot_runs')
      .update({
        status: 'killed',
        live_armed: false,
        ended_at: nowIso,
        summary: {
          ...(summary ?? {}),
          circuit_breaker_triggered: true,
          circuit_breaker_reason: reason,
        },
      } as unknown)
      .eq('id', this.run.id);

    await logEvent(this.supabase, this.bot.id, this.bot.user_id, 'risk_alert', 'Live circuit breaker triggered - kill switch activated', 'critical', {
      trace_id: this.traceId,
      run_id: this.run.id,
      failure_count: nextCount,
      reason,
    });

    logWarn({
      component: 'execution-engine',
      message: 'Circuit breaker triggered for live trading',
      context: { bot_id: this.bot.id, run_id: this.run.id, failure_count: nextCount },
    });
  }
}

export const checkLiveSecretsReady = () => {
  try {
    requireEnv('SUPABASE_URL');
    requireEnv('SUPABASE_SERVICE_ROLE_KEY');
    const encryptionKey = Deno.env.get('API_ENCRYPTION_KEY');
    if (!encryptionKey) {
      return false;
    }
    return true;
  } catch {
    return false;
  }
};

export const logEngineError = (component: string, error: unknown) => {
  logError({
    component,
    message: 'Execution engine error',
    context: { error: (error as Error).message },
  });
};

export const getLiveConfig = (killSwitchActive: boolean): LiveConfig => ({
  liveTradingEnabled: parseBoolean(Deno.env.get('LIVE_TRADING_ENABLED'), false),
  killSwitchActive,
  secretsReady: checkLiveSecretsReady(),
  cooldownSeconds: parseNumber(Deno.env.get('LIVE_ARM_COOLDOWN_SECONDS'), 60),
  maxConsecutiveFailures: Math.max(1, parseNumber(Deno.env.get('LIVE_CIRCUIT_BREAKER_THRESHOLD'), 3)),
});
