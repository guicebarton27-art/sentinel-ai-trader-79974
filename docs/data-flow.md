# Sentinel AI Trader - Data Flow Architecture

## Overview

This document maps the sources of truth and how data flows through the trading system.

## Canonical Data Model

### Core Tables

| Table | Purpose | Owner |
|-------|---------|-------|
| `bots` | Bot configuration and runtime state | User |
| `bot_runs` | Execution sessions with metrics | Bot |
| `orders` | Trade orders with state machine | Bot |
| `positions` | Open/closed positions | Bot |
| `bot_events` | Audit log of all bot actions | System |
| `deployed_strategies` | Strategy configurations | User |
| `profiles` | User settings + kill switch | User |
| `api_keys` | Exchange credentials (encrypted) | User |

### Market Data Tables

| Table | Purpose | Source |
|-------|---------|--------|
| `historical_candles` | OHLCV data for backtesting | Exchange API |
| `sentiment_data` | Market sentiment scores | AI analysis |
| `ml_predictions` | Price predictions | ML models |

### Analytics Tables

| Table | Purpose |
|-------|---------|
| `backtest_runs` | Backtest execution results |
| `backtest_trades` | Individual backtest trades |
| `backtest_equity_curve` | Portfolio value over time |

## Data Flow Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│                         USER INTERFACE                               │
│  TradingDashboard → BotControls → BacktestPanel → StrategyEngine   │
└────────────────────────────────┬────────────────────────────────────┘
                                 │
                    ┌────────────▼────────────┐
                    │   useBotController Hook  │
                    │  (Real-time subscriptions)│
                    └────────────┬────────────┘
                                 │
        ┌────────────────────────┼────────────────────────┐
        │                        │                        │
        ▼                        ▼                        ▼
┌───────────────┐      ┌─────────────────┐      ┌────────────────┐
│ bot-controller│      │    tick-bots     │      │  run-backtest  │
│ (User actions)│      │  (Cron: 1 min)   │      │ (On-demand)    │
└───────┬───────┘      └────────┬────────┘      └───────┬────────┘
        │                       │                        │
        └───────────────────────┼────────────────────────┘
                                │
                    ┌───────────▼───────────┐
                    │   SUPABASE DATABASE   │
                    │                       │
                    │  ┌─────────────────┐  │
                    │  │      bots       │  │
                    │  │    bot_runs     │  │
                    │  │     orders      │  │
                    │  │   positions     │  │
                    │  │   bot_events    │  │
                    │  └─────────────────┘  │
                    └───────────────────────┘
```

## Execution Modes

### Paper Trading (Default)
```
Market Data (Kraken API) → Strategy Engine → Risk Check → Simulated Fill → DB Update
```

### Live Trading (Gated)
```
Market Data (Kraken API) → Strategy Engine → Risk Check → exchange-kraken → Real Fill → DB Update
```

### Backtesting
```
historical_candles → Strategy Replay → Simulated Fills → backtest_trades → Metrics Calculation
```

## Server-Side Loop (`tick-bots`)

The `tick-bots` edge function runs every minute via Supabase cron:

1. **Fetch running bots**: `SELECT * FROM bots WHERE status = 'running'`
2. **For each bot**:
   - Fetch market data from Kraken
   - Generate baseline signal
   - (Optional) Call AI strategy engine
   - Evaluate risk limits
   - Execute trade (paper or live)
   - Update `bot_runs`, `orders`, `positions`
   - Log event to `bot_events`
3. **Update heartbeat**: `last_tick_at = now()`

## Risk Guardrails

All trades pass through `evaluateRisk()`:

| Check | Flag |
|-------|------|
| Daily loss exceeded | `DAILY_LOSS_LIMIT_EXCEEDED` |
| Position too large | `POSITION_SIZE_EXCEEDED` |
| No stop loss | `STOP_LOSS_REQUIRED` |
| Trade frequency | `TRADE_FREQUENCY_LIMIT_EXCEEDED` |
| Cooldown active | `COOLDOWN_ACTIVE` |
| Loss streak | `LOSS_STREAK_LIMIT_EXCEEDED` |
| Kill switch (live only) | `KILL_SWITCH_ACTIVE` |
| Live trading disabled | `LIVE_TRADING_DISABLED` |

## Integration Tests

### Unit Tests (Deno)
```bash
npm test
# Runs: deno test --allow-env --allow-read supabase/functions/_shared
```

Tests:
- Signal generation (`generateBaselineSignal`)
- Risk evaluation (`evaluateRisk`)
- State machine validation (bot status, order status, position lifecycle)

### Integration Tests (Edge Functions)

| Function | Purpose |
|----------|---------|
| `test-trading-loop` | Verifies DB write/read for bot runs, orders, positions |
| `bot-lifecycle-test` | Full lifecycle: create → start → trade → stop → verify |

Run via service role authenticated request.

## Real-Time Subscriptions

The `useBotController` hook subscribes to:
- `bots` table changes
- `bot_events` for the active bot
- `positions` for open positions
- `orders` for recent orders

## Security Model

- All user tables have Row-Level Security (RLS)
- Policies enforce `auth.uid() = user_id`
- Service role used for cron jobs (bypasses RLS)
- API keys encrypted at rest
- Live trading gated by environment variable
