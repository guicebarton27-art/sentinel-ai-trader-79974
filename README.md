# Sentinel AI Trader

Advanced AI-powered cryptocurrency trading platform with machine learning strategies, risk management, and real-time execution.

## Current Status

> **Last Updated:** January 2025

### ✅ Implemented & Working
- **Authentication**: Full auth flow with Supabase Auth
- **Bot Lifecycle**: Create, start, pause, stop, kill bots with session tracking (`bot_runs`)
- **Paper Trading**: Simulated order execution with position tracking
- **Market Data**: Live ticker data from Kraken public API
- **Historical Candles**: Fetch and store OHLC data in `historical_candles` table
- **Risk Management**: Daily loss limits, position sizing, stop-loss enforcement, kill switch
- **Backtesting**: Historical strategy validation with walk-forward analysis
- **AI Strategy Engine**: Lovable AI-powered trade recommendations (fallback to baseline signals)
- **Real-time UI**: Dashboard reflects database state via Supabase queries

### 🚧 In Progress / Partially Implemented
- **Live Trading**: Kraken integration exists but is explicitly disabled by default
- **Reconciliation**: Position comparison endpoint exists but auto-fix is not implemented
- **Multiple Exchanges**: Only Kraken is supported

### 📋 Planned (Roadmap)
- Binance/Coinbase exchange support
- Advanced ML models (LSTM, transformer-based forecasting)
- Mobile-responsive improvements
- Alert notifications (email/SMS)

## 🚀 Features

### Core Trading
- **Multi-Strategy Engine**: Momentum, Breakout, Mean Reversion strategies
- **AI/ML Integration**: AI-powered trade recommendations with confidence thresholds
- **Portfolio Optimization**: Capital allocation across strategies
- **Arbitrage Detection**: Cross-exchange opportunity identification (planned)

### Risk Management
- **Real-time Risk Monitoring**: Position limits, daily loss tracking
- **Emergency Controls**: Global kill switch at user and system level
- **Paper Trading Default**: All new bots start in paper mode

### Execution
- **Kraken Support**: Primary exchange integration
- **Smart Order Routing**: Optimal execution paths
- **Session Tracking**: Bot runs recorded with heartbeat and metrics

### Analytics
- **Backtesting Engine**: Historical strategy validation
- **Performance Metrics**: Sharpe ratio, drawdown, win rate
- **Walk-Forward Analysis**: Out-of-sample validation

## Performance Targets

> ⚠️ These are **targets**, not measured guarantees. Actual performance depends on market conditions, network latency, and strategy configuration.

- **Latency Target**: <100ms for paper trades, <500ms for live trades
- **Uptime Target**: 99% for scheduled tick processing
- **Fill Rate**: Depends on exchange liquidity (paper trades = 100% simulated fill)

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
│   │   └── ...
│   ├── auth/              # Authentication
│   └── ui/                # Shadcn UI components
├── hooks/                 # Custom React hooks
├── services/              # API services (marketDataService)
├── integrations/          # Supabase integration
├── lib/                   # Utilities
└── pages/                 # Route pages

supabase/
├── functions/             # Edge functions
└── migrations/            # Database migrations
```

### Data Flow

```
Kraken API → Market Data Service → UI Components
                    ↓
              historical_candles (Supabase)
                    ↓
tick-bots → Strategy Engine → Risk Check → Order Execution → positions/orders
                    ↓
              bot_runs (session tracking)
                    ↓
              bot_events (audit log)
```

### AI Resilience Controls

Edge functions apply timeouts, retries, and a circuit breaker when calling the AI gateway. Configure them via:

- `AI_TIMEOUT_MS` (default 8000)
- `AI_MAX_RETRIES` (default 2)
- `AI_STRATEGY_ENABLED` (default true)
- `AI_CONFIDENCE_THRESHOLD` (default 0.55)

## 📊 API Integration

### Kraken API Setup
1. Generate API keys at https://www.kraken.com/u/security/api
2. Navigate to "Settings" tab in the app
3. Add API key and secret
4. Enable required permissions:
   - Query funds
   - Query open/closed orders
   - Create & cancel orders (for live trading)

### Supported Exchanges
- ✅ Kraken (implemented)
- 📋 Binance (planned)
- 📋 Coinbase (planned)

## 🔐 Security

- **API Keys**: Encrypted storage in Supabase (AES-GCM)
- **Authentication**: Supabase Auth with JWT
- **Rate Limiting**: Built-in exchange API rate limiting (15 req/min per user)
- **Paper Trading**: Default mode for all new bots
- **Server-side Secrets**: Service role keys only used in edge functions
- **Kill Switch**: Global and per-user emergency stop

## 🧪 Testing

```bash
# Run edge function tests (Deno)
npm test

# Build for production
npm run build

# Preview production build
npm run preview
```

## 🚀 Deployment

### Lovable (Recommended)
The app is designed to be deployed via Lovable with built-in Supabase Cloud integration.

### Manual Deployment
```bash
npm run build
# Upload dist/ folder to hosting provider
# Configure environment variables
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

### Start local development
```bash
supabase start
npm run dev:all
```
This starts the UI, edge functions, and the worker loop.

### Paper trading (default)
1. Ensure `LIVE_TRADING_ENABLED=false` and `KILL_SWITCH_ENABLED=true` in `.env`.
2. Create a bot in the UI and keep the mode set to **Paper**.
3. Start the bot; the worker loop will execute ticks automatically.

### Backtesting
```bash
npm run backtest
```
Outputs are written to `backtest-output/` (summary JSON + trades CSV).

### Enable live trading (explicit opt-in)
1. Set `LIVE_TRADING_ENABLED=true` and `KILL_SWITCH_ENABLED=false`.
2. Add exchange API keys in the UI (stored server-side, encrypted).
3. Start a bot in **Live** mode. Risk limits remain enforced.

### Reconciliation
Call the `reconcile-positions` edge function to compare DB positions with exchange:
```bash
curl -X POST "${SUPABASE_URL}/functions/v1/reconcile-positions" \
  -H "Authorization: Bearer ${USER_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{"api_key_id": "your-api-key-id", "dry_run": true}'
```

### Health & Observability
Use the `health` edge function to check scheduler status:
```
${SUPABASE_URL}/functions/v1/health
```

---

**Built with ❤️ by Steven Barton** | [Lovable.dev](https://lovable.dev/projects/fde1db03-0157-4efa-b89d-84f3d5c65399)
