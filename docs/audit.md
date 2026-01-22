# Sentinel AI Trader - Audit Report

## Executive Summary

This audit identifies the sources of truth and data flow integrity across the trading platform. The backend is **fully operational** and the UI is now properly wired to canonical database tables.

## Status: ✅ Fully Operational

---

## 1. Source of Truth Inventory

### ✅ REAL (Database-Backed)

| Component | Table(s) | Status |
|-----------|----------|--------|
| Bots | `bots` | ✅ Fully operational |
| Bot Events | `bot_events` | ✅ Audit log working |
| Orders | `orders` | ✅ Paper trades persisted |
| Positions | `positions` | ✅ Open/closed tracked |
| Bot Runs | `bot_runs` | ✅ Created on start, updated per tick |
| Backtest Runs | `backtest_runs` | ✅ Results persisted |
| Backtest Trades | `backtest_trades` | ✅ Trade details stored |
| Backtest Equity Curve | `backtest_equity_curve` | ✅ Equity snapshots stored |
| Deployed Strategies | `deployed_strategies` | ✅ User strategies stored |
| API Keys | `api_keys` | ✅ Encrypted at rest |
| User Profiles | `profiles` | ✅ Kill switch working |
| Historical Candles | `historical_candles` | ✅ OHLCV data for charting |
| Sentiment Data | `sentiment_data` | ✅ ML sentiment scores |
| ML Predictions | `ml_predictions` | ✅ Price predictions |

### UI Component Wiring Status

| Component | Data Source | Status |
|-----------|-------------|--------|
| `TradingChart.tsx` | `historical_candles` via `useChartData` | ✅ Real data |
| `MarketData.tsx` | Kraken API via `useMultipleTickers` | ✅ Real data |
| `StrategyEngine.tsx` | `deployed_strategies` | ✅ Real data |
| `BotControls.tsx` | `bots`, `bot_events` via `useBotController` | ✅ Real data |
| `LiveCandleChart.tsx` | `positions`, `orders` + live ticker | ✅ Real data |
| `BacktestPanel.tsx` | `backtest_runs`, `backtest_trades` | ✅ Real data |
| `PortfolioOverview.tsx` | `positions`, `orders` | ✅ Real data |

### Visual-Only Components (Real Data with Visualization)

| Component | Purpose | Status |
|-----------|---------|--------|
| `AICommandCenter.tsx` | Neural signal visualization | ✅ Wired to `bot_events`, `sentiment_data` |
| `NeuralDecisionViz.tsx` | Network activation display | ✅ Wired to `ml_predictions`, `sentiment_data` |
| `AutonomousAgentViz.tsx` | Agent confidence animation | ✅ Wired to `bots`, `orders`, `positions`, `ml_predictions` |
| `AIStrategyEngine.tsx` | AI strategy execution | ✅ Wired to `ai-strategy-engine` edge function |
| `CompactStrategyPanel.tsx` | Strategy overview | ✅ Wired to `deployed_strategies`, `bots` |

---

## 2. Data Flow Architecture

### Market Data Pipeline

```
┌─────────────────────────────────────────────────────────────────────┐
│                      marketDataService.ts                           │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │  Source Priority:                                            │   │
│  │  1. historical_candles (Supabase) - charting/backtests       │   │
│  │  2. fetch-candles edge function - fills gaps from Kraken     │   │
│  │  3. Kraken Public API - live ticker updates                  │   │
│  └─────────────────────────────────────────────────────────────┘   │
└──────────────────────────────────────┬──────────────────────────────┘
                                       │
        ┌──────────────────────────────┼──────────────────────────────┐
        │                              │                              │
        ▼                              ▼                              ▼
  useCandles()              useTicker()              useChartData()
  (DB + auto-fetch)         (Live Kraken)           (Combined)
```

### Bot Execution Pipeline

```
┌──────────────────────────────────────────────────────────────────────┐
│                        tick-bots (Cron: * * * * *)                   │
├──────────────────────────────────────────────────────────────────────┤
│  1. Fetch running bots: SELECT * FROM bots WHERE status='running'   │
│  2. For each bot:                                                    │
│     a. Fetch market data from Kraken API                            │
│     b. Generate baseline signal (trend/breakout/mean-revert)        │
│     c. Optional: Call AI strategy engine for enhanced decision      │
│     d. Evaluate risk limits (daily loss, position size, cooldown)   │
│     e. Execute trade (paper or live)                                │
│     f. Update bot_runs with tick_count, heartbeat                   │
│     g. Log event to bot_events                                      │
│  3. Update last_heartbeat_at on bots table                          │
└──────────────────────────────────────────────────────────────────────┘
```

### Session Tracking (bot_runs)

```
┌─────────────────────────────────────────────────────────────────────┐
│  bot-controller/start                                               │
│  → Creates new bot_runs entry with status='running'                 │
├─────────────────────────────────────────────────────────────────────┤
│  tick-bots (each tick)                                              │
│  → Updates: tick_count++, last_tick_at, last_heartbeat_at          │
│  → Updates: total_trades, total_pnl, error_count                   │
├─────────────────────────────────────────────────────────────────────┤
│  bot-controller/stop                                                │
│  → Updates: status='stopped', ended_at, ending_capital             │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 3. Reconciliation System

The `reconcile-positions` edge function provides a safety layer:

```
┌─────────────────────────────────────────────────────────────────────┐
│  reconcile-positions (Read-Only by Default)                         │
├─────────────────────────────────────────────────────────────────────┤
│  Preconditions:                                                     │
│  - LIVE_TRADING_ENABLED must be true                               │
│  - User's global_kill_switch must be false                         │
│  - Bot must have api_key_id configured                             │
├─────────────────────────────────────────────────────────────────────┤
│  Process:                                                           │
│  1. Fetch open positions from Kraken exchange                      │
│  2. Compare against positions table in DB                          │
│  3. Log discrepancies to bot_events as 'risk_alert'                │
│  4. Return summary (NO automatic trade execution)                  │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 4. Risk Guardrails

All trades pass through `evaluateRisk()`:

| Check | Flag | Impact |
|-------|------|--------|
| Daily loss exceeded | `DAILY_LOSS_LIMIT_EXCEEDED` | Block trade |
| Position too large | `POSITION_SIZE_EXCEEDED` | Block trade |
| No stop loss | `STOP_LOSS_REQUIRED` | Block trade |
| Trade frequency | `TRADE_FREQUENCY_LIMIT_EXCEEDED` | Block trade |
| Cooldown active | `COOLDOWN_ACTIVE` | Block trade |
| Loss streak | `LOSS_STREAK_LIMIT_EXCEEDED` | Block trade |
| Kill switch (live only) | `KILL_SWITCH_ACTIVE` | Block trade |
| Live trading disabled | `LIVE_TRADING_DISABLED` | Block live trades |

---

## 5. Acceptance Test Checklist

| Test | Status | Evidence |
|------|--------|----------|
| A. Clean clone → install → run | ✅ | `npm install && npm run dev` |
| B. Migrations apply cleanly | ✅ | All migrations applied |
| C. dev:all runs without fatal errors | ✅ | Worker + UI + Edge Functions |
| D. Create bot → start paper → see DB updates | ✅ | bot_runs created, tick_count incrementing |
| E. Backtest runs and persists results | ✅ | backtest_runs in DB with metrics |
| F. TradingChart shows real candles | ✅ | useChartData queries historical_candles |
| G. MarketData shows real prices | ✅ | useMultipleTickers fetches from Kraken |
| H. StrategyEngine shows deployed_strategies | ✅ | Queries database, handles empty state |
| I. No console errors on core pages | ✅ | Verified |
| J. Live trading OFF by default | ✅ | `LIVE_TRADING_ENABLED=false` |
| K. Reconciliation logs only (no auto-trades) | ✅ | Writes to bot_events only |

---

## 6. Edge Function Inventory

| Function | Purpose | Status |
|----------|---------|--------|
| `bot-controller` | CRUD + start/stop/kill bots | ✅ Operational |
| `tick-bots` | Cron-driven trading loop | ✅ Operational |
| `fetch-candles` | Fetch + store OHLCV from Kraken | ✅ Operational |
| `reconcile-positions` | Compare exchange vs DB | ✅ Operational |
| `run-backtest` | Execute strategy backtests | ✅ Operational |
| `ai-strategy-engine` | AI-powered trade decisions | ✅ Operational |
| `exchange-kraken` | Kraken API adapter | ✅ Operational |
| `health` | System health check | ✅ Operational |

---

## 7. Security Notes

- ✅ RLS policies enforced on all user tables
- ✅ API keys encrypted with AES-GCM
- ✅ Live trading gated by env variable + kill switch
- ✅ Service role never exposed to client
- ✅ JWT validation on all authenticated endpoints
- ✅ Audit log immutable (no UPDATE/DELETE)

---

## 8. Environment Configuration

| Variable | Default | Purpose |
|----------|---------|---------|
| `LIVE_TRADING_ENABLED` | `false` | Gate for live trading |
| `KILL_SWITCH_ENABLED` | `true` | System-wide emergency stop |
| `AI_STRATEGY_ENABLED` | `true` | Enable AI strategy engine |
| `AI_CONFIDENCE_THRESHOLD` | `0.55` | Min AI confidence for trade |
| `MAX_TRADES_PER_HOUR` | `5` | Rate limit |
| `COOLDOWN_MINUTES_AFTER_LOSS` | `30` | Post-loss cooldown |
| `MAX_CONSECUTIVE_LOSSES` | `3` | Streak limit |

---

*Last Updated: 2026-01-22*
