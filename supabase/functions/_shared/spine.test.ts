import { selectStrategyDecision, transitionRunStatus } from "./spine.ts";
import { MarketTick } from "./trading.ts";

Deno.test("transitionRunStatus allows start from STOPPED", () => {
  const next = transitionRunStatus('STOPPED', 'start');
  if (next !== 'STARTING') {
    throw new Error(`Expected STARTING, got ${next}`);
  }
});

Deno.test("selectStrategyDecision falls back when AI confidence is low", () => {
  const market: MarketTick = {
    symbol: "BTC/USD",
    price: 100,
    bid: 99,
    ask: 101,
    volume_24h: 1000,
    change_24h: 5,
  };

  const bot = {
    user_id: "user-1",
    symbol: "BTC/USD",
    current_capital: 10000,
    daily_pnl: 0,
    strategy_id: "trend_following",
    strategy_config: {},
    max_position_size: 0.1,
    max_daily_loss: 100,
    stop_loss_pct: 2,
    take_profit_pct: 4,
    max_leverage: 1,
  };

  const result = selectStrategyDecision(
    bot,
    market,
    "trace-1",
    {
      action: "BUY",
      confidence: 10,
      reasoning: "Low confidence",
      positionSize: 1,
      stopLoss: 2,
      takeProfit: 4,
      riskScore: 1,
      expectedReturn: 0.1,
      timeHorizon: "short",
    },
    0.5,
  );

  if (result.source !== 'baseline') {
    throw new Error(`Expected baseline fallback, got ${result.source}`);
  }
  if (!result.decision) {
    throw new Error("Expected baseline decision to be present");
  }
});
