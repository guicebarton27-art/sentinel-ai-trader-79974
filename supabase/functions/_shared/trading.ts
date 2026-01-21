export type OrderSide = 'buy' | 'sell';

export interface MarketCandle {
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface MarketTick {
  symbol: string;
  price: number;
  bid: number;
  ask: number;
  volume_24h: number;
  change_24h: number;
}

export interface Signal {
  symbol: string;
  side: OrderSide;
  confidence: number;
  features_used: string[];
  rationale: string;
}

export interface TradeDecision {
  symbol: string;
  side: OrderSide;
  size: number;
  entry: number;
  stop: number;
  take_profit: number;
  confidence: number;
  rationale: string;
  trace_id: string;
}

export interface StrategyConfig {
  signalThreshold: number;
  maxSignalStrength: number;
}

export interface RiskInputs {
  currentCapital: number;
  dailyPnl: number;
  maxDailyLoss: number;
  maxPositionSize: number;
  stopLossPct: number;
  tradesLastHour: number;
  maxTradesPerHour: number;
  cooldownActive: boolean;
  lossStreakExceeded: boolean;
  killSwitchActive: boolean;
  liveTradingEnabled: boolean;
  mode: 'paper' | 'live';
}

export interface RiskCheckResult {
  allowed: boolean;
  flags: string[];
}

export const generateBaselineSignal = (
  market: MarketTick,
  config: StrategyConfig
): Signal | null => {
  const normalizedChange = market.change_24h / 100;
  const confidence = Math.min(Math.abs(normalizedChange) / config.maxSignalStrength, 1);

  if (normalizedChange >= config.signalThreshold) {
    return {
      symbol: market.symbol,
      side: 'buy',
      confidence,
      features_used: ['change_24h'],
      rationale: `24h change ${market.change_24h.toFixed(2)}% exceeds threshold`,
    };
  }

  if (normalizedChange <= -config.signalThreshold) {
    return {
      symbol: market.symbol,
      side: 'sell',
      confidence,
      features_used: ['change_24h'],
      rationale: `24h change ${market.change_24h.toFixed(2)}% below threshold`,
    };
  }

  return null;
};

export const evaluateRisk = (decision: TradeDecision, inputs: RiskInputs): RiskCheckResult => {
  const flags: string[] = [];

  if (inputs.mode === 'live') {
    if (!inputs.liveTradingEnabled) {
      flags.push('LIVE_TRADING_DISABLED');
    }
    if (inputs.killSwitchActive) {
      flags.push('KILL_SWITCH_ACTIVE');
    }
  }

  if (inputs.dailyPnl < -inputs.maxDailyLoss) {
    flags.push('DAILY_LOSS_LIMIT_EXCEEDED');
  }

  const orderValue = decision.size * decision.entry;
  if (orderValue > inputs.currentCapital * inputs.maxPositionSize) {
    flags.push('POSITION_SIZE_EXCEEDED');
  }

  if (inputs.stopLossPct <= 0) {
    flags.push('STOP_LOSS_REQUIRED');
  }

  if (inputs.tradesLastHour >= inputs.maxTradesPerHour) {
    flags.push('TRADE_FREQUENCY_LIMIT_EXCEEDED');
  }

  if (inputs.cooldownActive) {
    flags.push('COOLDOWN_ACTIVE');
  }

  if (inputs.lossStreakExceeded) {
    flags.push('LOSS_STREAK_LIMIT_EXCEEDED');
  }

  return { allowed: flags.length === 0, flags };
};
