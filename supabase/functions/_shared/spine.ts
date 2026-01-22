import { generateBaselineSignal, MarketTick, OrderSide, TradeDecision } from "./trading.ts";

export type RunStatus =
  | 'STOPPED'
  | 'STARTING'
  | 'RUNNING'
  | 'PAUSING'
  | 'PAUSED'
  | 'STOPPING'
  | 'KILL_SWITCHED';

export type RunMode = 'paper' | 'backtest' | 'live';

export interface RunConfig {
  ai_enabled?: boolean;
  ai_confidence_threshold?: number;
  live_armed?: boolean;
}

export interface BotRiskProfile {
  max_position_size: number;
  max_daily_loss: number;
  stop_loss_pct: number;
  take_profit_pct: number;
  max_leverage: number;
}

export interface BotStrategyProfile {
  strategy_id: string;
  strategy_config: Record<string, unknown>;
}

export interface BotState extends BotRiskProfile, BotStrategyProfile {
  id?: string | null;
  user_id: string;
  name?: string;
  symbol: string;
  current_capital: number;
  daily_pnl: number;
}

export interface AiStrategyDecision {
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

export interface StrategyDecisionResult {
  decision: TradeDecision | null;
  source: 'ai' | 'baseline' | 'none';
  rationale: string;
}

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

export const createTraceId = () => crypto.randomUUID();

export const transitionRunStatus = (current: RunStatus, action: 'start' | 'pause' | 'stop' | 'kill') => {
  const transitions: Record<RunStatus, Partial<Record<typeof action, RunStatus>>> = {
    STOPPED: { start: 'STARTING', kill: 'KILL_SWITCHED' },
    STARTING: { stop: 'STOPPING', kill: 'KILL_SWITCHED' },
    RUNNING: { pause: 'PAUSING', stop: 'STOPPING', kill: 'KILL_SWITCHED' },
    PAUSING: { stop: 'STOPPING', kill: 'KILL_SWITCHED' },
    PAUSED: { start: 'STARTING', stop: 'STOPPING', kill: 'KILL_SWITCHED' },
    STOPPING: { kill: 'KILL_SWITCHED' },
    KILL_SWITCHED: {},
  };

  const next = transitions[current]?.[action];
  if (!next) {
    throw new Error(`Invalid transition ${action} from ${current}`);
  }
  return next;
};

export const getStrategyConfig = (strategyId: string) => {
  if (strategyId === 'mean_reversion') {
    return { signalThreshold: 0.025, maxSignalStrength: 0.08 };
  }

  if (strategyId === 'breakout') {
    return { signalThreshold: 0.02, maxSignalStrength: 0.06 };
  }

  return { signalThreshold: 0.02, maxSignalStrength: 0.08 };
};

export const buildDecisionFromSignal = (
  bot: BotState,
  marketData: MarketTick,
  signal: ReturnType<typeof generateBaselineSignal>,
  traceId: string,
): TradeDecision | null => {
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
};

export const buildAiTradeDecision = (
  bot: BotState,
  marketData: MarketTick,
  aiDecision: AiStrategyDecision,
  traceId: string,
): TradeDecision | null => {
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
};

export const selectStrategyDecision = (
  bot: BotState,
  marketData: MarketTick,
  traceId: string,
  aiDecision: AiStrategyDecision | null,
  aiConfidenceThreshold: number,
): StrategyDecisionResult => {
  if (aiDecision) {
    const aiTrade = buildAiTradeDecision(bot, marketData, aiDecision, traceId);
    if (aiTrade && aiTrade.confidence >= aiConfidenceThreshold) {
      return { decision: aiTrade, source: 'ai', rationale: aiTrade.rationale };
    }
  }

  const baselineSignal = generateBaselineSignal(marketData, getStrategyConfig(bot.strategy_id));
  const baselineDecision = buildDecisionFromSignal(bot, marketData, baselineSignal, traceId);

  if (baselineDecision) {
    return { decision: baselineDecision, source: 'baseline', rationale: baselineDecision.rationale };
  }

  return { decision: null, source: 'none', rationale: 'No actionable signal' };
};
