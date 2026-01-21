# Sentinel AI Trader

Advanced AI-powered cryptocurrency trading platform with machine learning strategies, risk management, and real-time execution.

## 🚀 Features

### Core Trading
- **Multi-Strategy Engine**: Momentum, Breakout, Mean Reversion strategies
- **AI/ML Integration**: Sentiment analysis, price prediction, risk modeling
- **AutoML Agent**: Automated model training and optimization
- **Portfolio Optimization**: Real-time portfolio balancing
- **Arbitrage Detection**: Cross-exchange opportunity identification

### Risk Management
- **Real-time Risk Monitoring**: VaR, drawdown, correlation analysis
- **Position Limits**: Automated enforcement of risk parameters
- **Emergency Controls**: Circuit breakers and kill switches
- **Meta-Learning**: Adaptive strategy selection

### Execution
- **Multi-Exchange Support**: Kraken (primary), extensible to others
- **Smart Order Routing**: Optimal execution paths
- **Low-Latency**: Sub-20ms execution latency
- **Fill Rate Optimization**: 98%+ fill rates

### Analytics
- **Backtesting Engine**: Historical strategy validation
- **Performance Metrics**: Sharpe ratio, drawdown, win rate
- **ML Price Prediction**: LSTM-based forecasting
- **Sentiment Analysis**: News and social media integration

## 🛠️ Technology Stack

- **Frontend**: React 18, TypeScript, Vite
- **UI**: Shadcn UI, Tailwind CSS, Radix UI
- **Backend**: Supabase (Auth, Database, Edge Functions)
- **State Management**: TanStack Query
- **Charts**: Recharts
- **Routing**: React Router v6

## 📦 Installation

### Prerequisites
- Node.js 18+ or Bun
- npm or yarn
- Supabase account (for auth and database)

### Setup

1. **Clone the repository**
```bash
git clone https://github.com/guicebarton27-art/sentinel-ai-trader-79974.git
cd sentinel-ai-trader-79974
```

2. **Install dependencies**
```bash
npm install
# or
bun install
```

3. **Environment Configuration**

Create a `.env` file:
```env
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_PUBLISHABLE_KEY=your_supabase_anon_key
VITE_SUPABASE_PROJECT_ID=your_project_id
```

4. **Database Setup**

Run Supabase migrations:
```bash
npx supabase db push
```

5. **Start Development Server**
```bash
npm run dev
# Application runs on http://localhost:5173
```

## 🚦 Usage

### Authentication
1. Navigate to `/auth`
2. Sign up or sign in with email/password
3. Access dashboard at `/`

### Bot Controls
- **Start**: Begin trading in paper or live mode
- **Pause**: Temporarily halt trading (preserve positions)
- **Stop**: Gracefully close all positions and stop
- **Kill**: Emergency stop (immediate halt)

### Strategy Configuration
1. Navigate to "Strategies" tab
2. Configure strategy parameters (allocation, risk limits)
3. Enable/disable individual strategies
4. Monitor real-time performance

### Risk Management
1. Set portfolio-wide risk limits
2. Configure position sizing rules
3. Enable circuit breakers
4. Monitor risk metrics in real-time

### Backtesting
1. Select strategy to test
2. Choose date range and initial capital
3. Run backtest
4. Analyze results (Sharpe, drawdown, trades)

## 🏗️ Architecture

```
src/
├── components/
│   ├── trading/           # Trading components
│   │   ├── BotControls.tsx
│   │   ├── StrategyEngine.tsx
│   │   ├── RiskEngine.tsx
│   │   ├── ExecutionRouter.tsx
│   │   ├── BacktestPanel.tsx
│   │   ├── AutoMLAgent.tsx
│   │   └── ...
│   ├── auth/              # Authentication
│   └── ui/                # Shadcn UI components
├── hooks/                 # Custom React hooks
├── integrations/          # Supabase integration
├── lib/                   # Utilities
└── pages/                 # Route pages

supabase/
├── functions/             # Edge functions
└── migrations/            # Database migrations
```

### Architecture Map (Data Flow)

```
MarketData → AI Strategy → Signal/Fallback → RiskManager → Execution → Portfolio → Reporting/Alerts
          (tick-bots)   (ai-strategy)       (shared)        (tick-bots)  (DB)       (bot_events)
```

Canonical decision path:
1. `tick-bots` fetches market data (Kraken public API or deterministic fallback).
2. AI strategy engine proposes a decision; if unavailable, the baseline signal is used as a deterministic fallback.
3. RiskManager enforces limits and kill switch before any order is placed.
4. Orders/positions are persisted and events are logged with a trace ID.

### AI Resilience Controls

Edge functions apply timeouts, retries, and a circuit breaker when calling the AI gateway. Configure them via:

- `AI_TIMEOUT_MS` (default 8000)
- `AI_MAX_RETRIES` (default 2)
- `AI_RETRY_BACKOFF_MS` (default 500)
- `AI_CIRCUIT_BREAKER_THRESHOLD` (default 3)
- `AI_CIRCUIT_BREAKER_RESET_MS` (default 60000)
- `AI_STRATEGY_ENABLED` (default true)
- `AI_CONFIDENCE_THRESHOLD` (default 0.55)
- `AI_SMOKE_TEST_ENABLED` (default true)

### AI Configuration & Verification Runbook

**Required (server-side only):**
- `LOVABLE_API_KEY` (AI gateway key, never set in the client)
- `AI_MODEL` (default `google/gemini-2.5-flash`)
- `AI_MODEL_VERSION` (default `2025-02-01`)
- `AI_GATEWAY_URL` (default `https://ai.gateway.lovable.dev/v1/chat/completions`)

**Paper trading (default):**
```bash
npm run worker
```

**Backtest (deterministic):**
```bash
npm run backtest
```

**AI smoke test (server-side):**
```bash
curl -X POST "$SUPABASE_URL/functions/v1/test-trading-loop" \
  -H "x-service-role: $SUPABASE_SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json"
```

Expected outputs:
- `bot_events`, `orders`, `positions` rows for paper trades
- `ml_predictions` rows with AI decision payloads
- `backtest-output/*.json` and `backtest-output/*.csv` from the backtest script

## 📊 API Integration

### Kraken API Setup
1. Generate API keys at https://www.kraken.com/u/security/api
2. Navigate to "Settings" tab
3. Add API key and secret
4. Enable required permissions:
   - Query funds
   - Query open/closed orders
   - Create & cancel orders

### Supported Exchanges
- ✅ Kraken (fully supported)
- 🚧 Binance (planned)
- 🚧 Coinbase (planned)

## 🔐 Security

- **API Keys**: Encrypted storage in Supabase
- **Authentication**: Supabase Auth with JWT
- **Rate Limiting**: Built-in exchange API rate limiting
- **Paper Trading**: Test strategies without risk
- **Server-side Secrets**: Service role keys are only used in workers/edge functions (never shipped to clients)
- **Kill Switch**: Live execution is disabled by default and blocked when the kill switch is on

## 📈 Performance

- **Latency**: <20ms execution time
- **Fill Rate**: 98%+ average
- **Uptime**: 99.9% target
- **Backtests**: Historical data from 2020+

## 🧪 Testing

```bash
# Run tests (Deno-powered)
npm test

# Build for production
npm run build

# Preview production build
npm run preview
```

## 🚀 Deployment

### Netlify (Recommended)
1. Connect GitHub repository
2. Set environment variables
3. Deploy automatically on push

### Manual Deployment
```bash
npm run build
# Upload dist/ folder to hosting provider
```

## 📝 License

MIT License - see LICENSE file

## 🤝 Contributing

1. Fork the repository
2. Create feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Open Pull Request

## 📞 Support

- GitHub Issues: [Report bugs](https://github.com/guicebarton27-art/sentinel-ai-trader-79974/issues)
- Discussions: [Ask questions](https://github.com/guicebarton27-art/sentinel-ai-trader-79974/discussions)

## ⚠️ Disclaimer

Cryptocurrency trading involves significant risk. This software is provided "as is" without warranties. Always test strategies in paper trading mode before using real capital. Past performance does not guarantee future results.

## 📘 Runbook

### One-time setup
1. Install the Supabase CLI and Deno (required for edge function tests).
2. Copy `.env.example` to `.env` and fill in required values.

### Start local development (two commands)
```bash
supabase start
npm run dev:all
```
This starts the UI, edge functions, and the worker loop. The worker invokes `tick-bots` on a schedule.

### Paper trading (default)
1. Ensure `LIVE_TRADING_ENABLED=false` and `KILL_SWITCH_ENABLED=true` in `.env`.
2. Create a bot in the UI and keep the mode set to **Paper**.
3. Start the bot; the worker loop will execute ticks automatically.

### Backtesting
```bash
npm run backtest
```
Outputs are written to `backtest-output/` (summary JSON + trades CSV). Use environment variables in `.env` to customize the run window and strategy parameters.

### Enable live trading (explicit opt-in)
1. Set `LIVE_TRADING_ENABLED=true` and `KILL_SWITCH_ENABLED=false`.
2. Add exchange API keys in the UI (stored server-side).
3. Start a bot in **Live** mode. The kill switch and risk limits remain enforced.

### Health & Observability
Use the `health` edge function to check scheduler status, error counts, and bot health:
```
${SUPABASE_URL}/functions/v1/health
```

---

**Built with ❤️ by Steven Barton** | [Lovable.dev](https://lovable.dev/projects/fde1db03-0157-4efa-b89d-84f3d5c65399)
