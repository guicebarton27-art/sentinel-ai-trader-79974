import { evaluateRisk, generateBaselineSignal, MarketTick, TradeDecision } from "./trading.ts";

Deno.test("generateBaselineSignal produces buy signal on strong positive change", () => {
  const tick: MarketTick = {
    symbol: "BTC/USD",
    price: 100,
    bid: 99,
    ask: 101,
    volume_24h: 1000,
    change_24h: 5,
  };

  const signal = generateBaselineSignal(tick, { signalThreshold: 0.02, maxSignalStrength: 0.08 });
  if (!signal) {
    throw new Error("Expected signal to be generated");
  }

  if (signal.side !== "buy") {
    throw new Error(`Expected buy signal, got ${signal.side}`);
  }
});

Deno.test("evaluateRisk blocks trades when limits are exceeded", () => {
  const decision: TradeDecision = {
    symbol: "BTC/USD",
    side: "buy",
    size: 2,
    entry: 1000,
    stop: 900,
    take_profit: 1200,
    confidence: 0.9,
    rationale: "Test",
    trace_id: "trace-1",
  };

  const result = evaluateRisk(decision, {
    currentCapital: 1000,
    dailyPnl: -200,
    maxDailyLoss: 100,
    maxPositionSize: 0.1,
    stopLossPct: 0,
    tradesLastHour: 10,
    maxTradesPerHour: 5,
    cooldownActive: true,
    lossStreakExceeded: true,
    killSwitchActive: true,
    liveTradingEnabled: false,
    mode: "live",
  });

  if (result.allowed) {
    throw new Error("Expected risk evaluation to block trade");
  }

  if (result.flags.length < 3) {
    throw new Error("Expected multiple risk flags to be returned");
  }
});
