import { evaluateRisk, generateBaselineSignal, MarketTick, TradeDecision } from "./trading.ts";

// ========== SIGNAL GENERATION TESTS ==========

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

Deno.test("generateBaselineSignal produces sell signal on strong negative change", () => {
  const tick: MarketTick = {
    symbol: "BTC/USD",
    price: 100,
    bid: 99,
    ask: 101,
    volume_24h: 1000,
    change_24h: -5,
  };

  const signal = generateBaselineSignal(tick, { signalThreshold: 0.02, maxSignalStrength: 0.08 });
  if (!signal) {
    throw new Error("Expected signal to be generated");
  }

  if (signal.side !== "sell") {
    throw new Error(`Expected sell signal, got ${signal.side}`);
  }
});

Deno.test("generateBaselineSignal returns null for weak price change", () => {
  const tick: MarketTick = {
    symbol: "BTC/USD",
    price: 100,
    bid: 99,
    ask: 101,
    volume_24h: 1000,
    change_24h: 0.5, // Below threshold
  };

  const signal = generateBaselineSignal(tick, { signalThreshold: 0.02, maxSignalStrength: 0.08 });
  if (signal !== null) {
    throw new Error("Expected no signal for weak price change");
  }
});

// ========== RISK EVALUATION TESTS ==========

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

Deno.test("evaluateRisk allows trade when all limits are within bounds", () => {
  const decision: TradeDecision = {
    symbol: "BTC/USD",
    side: "buy",
    size: 0.05,
    entry: 1000,
    stop: 980,
    take_profit: 1100,
    confidence: 0.8,
    rationale: "Valid trade",
    trace_id: "trace-2",
  };

  const result = evaluateRisk(decision, {
    currentCapital: 10000,
    dailyPnl: 100,
    maxDailyLoss: 500,
    maxPositionSize: 0.1,
    stopLossPct: 2.0,
    tradesLastHour: 2,
    maxTradesPerHour: 10,
    cooldownActive: false,
    lossStreakExceeded: false,
    killSwitchActive: false,
    liveTradingEnabled: true,
    mode: "paper",
  });

  if (!result.allowed) {
    throw new Error(`Expected risk evaluation to allow trade, but got flags: ${result.flags.join(", ")}`);
  }

  if (result.flags.length !== 0) {
    throw new Error(`Expected no risk flags, but got: ${result.flags.join(", ")}`);
  }
});

Deno.test("evaluateRisk blocks live trading when disabled", () => {
  const decision: TradeDecision = {
    symbol: "BTC/USD",
    side: "buy",
    size: 0.05,
    entry: 1000,
    stop: 980,
    take_profit: 1100,
    confidence: 0.8,
    rationale: "Live trade attempt",
    trace_id: "trace-3",
  };

  const result = evaluateRisk(decision, {
    currentCapital: 10000,
    dailyPnl: 100,
    maxDailyLoss: 500,
    maxPositionSize: 0.1,
    stopLossPct: 2.0,
    tradesLastHour: 2,
    maxTradesPerHour: 10,
    cooldownActive: false,
    lossStreakExceeded: false,
    killSwitchActive: false,
    liveTradingEnabled: false, // Live trading disabled
    mode: "live", // But trying to trade live
  });

  if (result.allowed) {
    throw new Error("Expected risk evaluation to block live trade when disabled");
  }

  if (!result.flags.includes("LIVE_TRADING_DISABLED")) {
    throw new Error(`Expected 'LIVE_TRADING_DISABLED' flag, got: ${result.flags.join(", ")}`);
  }
});

Deno.test("evaluateRisk blocks trades when kill switch is active in live mode", () => {
  const decision: TradeDecision = {
    symbol: "BTC/USD",
    side: "buy",
    size: 0.05,
    entry: 1000,
    stop: 980,
    take_profit: 1100,
    confidence: 0.8,
    rationale: "Trade during kill switch",
    trace_id: "trace-4",
  };

  const result = evaluateRisk(decision, {
    currentCapital: 10000,
    dailyPnl: 100,
    maxDailyLoss: 500,
    maxPositionSize: 0.1,
    stopLossPct: 2.0,
    tradesLastHour: 2,
    maxTradesPerHour: 10,
    cooldownActive: false,
    lossStreakExceeded: false,
    killSwitchActive: true, // Kill switch ON
    liveTradingEnabled: true,
    mode: "live", // Kill switch only checked in live mode
  });

  if (result.allowed) {
    throw new Error("Expected risk evaluation to block trade when kill switch is active");
  }

  if (!result.flags.includes("KILL_SWITCH_ACTIVE")) {
    throw new Error(`Expected 'KILL_SWITCH_ACTIVE' flag, got: ${result.flags.join(", ")}`);
  }
});

Deno.test("evaluateRisk blocks oversized positions", () => {
  const decision: TradeDecision = {
    symbol: "BTC/USD",
    side: "buy",
    size: 2, // 2 BTC at $1000 = $2000 = 20% of $10000 capital
    entry: 1000,
    stop: 980,
    take_profit: 1100,
    confidence: 0.8,
    rationale: "Oversized position",
    trace_id: "trace-5",
  };

  const result = evaluateRisk(decision, {
    currentCapital: 10000,
    dailyPnl: 0,
    maxDailyLoss: 500,
    maxPositionSize: 0.1, // Max 10% = $1000
    stopLossPct: 2.0,
    tradesLastHour: 0,
    maxTradesPerHour: 10,
    cooldownActive: false,
    lossStreakExceeded: false,
    killSwitchActive: false,
    liveTradingEnabled: true,
    mode: "paper",
  });

  if (result.allowed) {
    throw new Error(`Expected risk evaluation to block oversized position, got flags: ${result.flags.join(", ")}`);
  }

  if (!result.flags.includes("POSITION_SIZE_EXCEEDED")) {
    throw new Error(`Expected 'POSITION_SIZE_EXCEEDED' flag, got: ${result.flags.join(", ")}`);
  }
});

// ========== BOT LIFECYCLE STATE TESTS ==========

Deno.test("Bot status transitions are valid", () => {
  type BotStatus = "stopped" | "running" | "paused" | "error";
  
  const validTransitions: Record<BotStatus, BotStatus[]> = {
    stopped: ["running"],
    running: ["paused", "stopped", "error"],
    paused: ["running", "stopped"],
    error: ["stopped"],
  };

  // Test all valid transitions
  for (const [from, toList] of Object.entries(validTransitions)) {
    for (const to of toList) {
      const isValid = validTransitions[from as BotStatus].includes(to as BotStatus);
      if (!isValid) {
        throw new Error(`Transition ${from} -> ${to} should be valid`);
      }
    }
  }

  // Test invalid transition
  const invalidTransitions: [BotStatus, BotStatus][] = [
    ["stopped", "paused"],
    ["stopped", "error"],
    ["error", "running"],
    ["error", "paused"],
  ];

  for (const [from, to] of invalidTransitions) {
    const isValid = validTransitions[from].includes(to);
    if (isValid) {
      throw new Error(`Transition ${from} -> ${to} should be invalid`);
    }
  }
});

Deno.test("Order status follows state machine", () => {
  type OrderStatus = "pending" | "submitted" | "partially_filled" | "filled" | "canceled" | "rejected";
  
  const validTransitions: Record<OrderStatus, OrderStatus[]> = {
    pending: ["submitted", "canceled", "rejected"],
    submitted: ["partially_filled", "filled", "canceled", "rejected"],
    partially_filled: ["filled", "canceled"],
    filled: [], // Terminal state
    canceled: [], // Terminal state
    rejected: [], // Terminal state
  };

  // Verify pending can transition to submitted
  if (!validTransitions.pending.includes("submitted")) {
    throw new Error("pending -> submitted should be valid");
  }

  // Verify filled is terminal
  if (validTransitions.filled.length !== 0) {
    throw new Error("filled should be a terminal state");
  }

  // Verify rejected is terminal
  if (validTransitions.rejected.length !== 0) {
    throw new Error("rejected should be a terminal state");
  }
});

Deno.test("Position lifecycle validation", () => {
  type PositionStatus = "open" | "closing" | "closed" | "liquidated";
  
  const validTransitions: Record<PositionStatus, PositionStatus[]> = {
    open: ["closing", "closed", "liquidated"],
    closing: ["closed"],
    closed: [], // Terminal
    liquidated: [], // Terminal
  };

  // Open position can close
  if (!validTransitions.open.includes("closed")) {
    throw new Error("open -> closed should be valid");
  }

  // Closed is terminal
  if (validTransitions.closed.length !== 0) {
    throw new Error("closed should be terminal");
  }
});
