# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- **Production Readiness Audit**: Created `/docs/audit.md` documenting real vs fake data flows
- **Bot Lifecycle Integration Tests**: New Edge Function `bot-lifecycle-test` that validates the complete bot lifecycle: create → start → trade → stop → verify state
- **Extended Trading Unit Tests**: Added comprehensive Deno tests for signal generation, risk evaluation, state machine validation
- **Real Data Indicators**: LiveCandleChart now shows "DB Connected" or "Demo Mode" badge
- Comprehensive project documentation (README, CONTRIBUTING, DEPLOYMENT)
- GitHub Actions CI/CD pipeline
- Issue and PR templates
- Environment configuration examples
- MIT License with trading disclaimer

### Changed
- **LiveCandleChart**: Now accepts real positions/orders from database, falls back to simulated data gracefully
- **TradingDashboard strategies**: Removed hardcoded mock array, now derives from active bot data
- Enhanced README with detailed feature list and setup instructions
- Improved project structure documentation

### Security
- Added RLS policies for backtest tables with user_id columns
- Fixed run-backtest edge function to include user_id for proper data isolation

### Fixed
- Build configuration optimizations
- TradingDashboard now fetches real strategy data instead of hardcoded mock data
- LiveCandleChart connected to real positions and orders via props

## [1.0.0] - 2024-12-31

### Added
- Initial release of Sentinel AI Trader
- Multi-strategy trading engine (Momentum, Breakout, Mean Reversion)
- AI/ML integration for sentiment analysis and price prediction
- AutoML agent for automated model training
- Portfolio optimization and rebalancing
- Arbitrage detection across exchanges
- Real-time risk monitoring (VaR, drawdown, correlation)
- Position limits and circuit breakers
- Smart order routing and execution
- Backtesting engine with performance metrics
- Supabase authentication and database integration
- React + TypeScript + Vite frontend
- Shadcn UI component library
- Responsive dashboard with real-time updates
- Bot controls (start, pause, stop, emergency kill)
- API key management for exchange integration
- Kraken exchange support
- Paper trading mode
- Real-time price charts
- Trade history and analytics
- Meta-learning for strategy selection
- Chaos runner for stress testing

### Security
- Encrypted API key storage
- Row-level security in Supabase
- JWT-based authentication
- Environment variable management

---

## Release Types

- **Added** for new features
- **Changed** for changes in existing functionality
- **Deprecated** for soon-to-be removed features
- **Removed** for now removed features
- **Fixed** for any bug fixes
- **Security** for vulnerability fixes

## Links

- [Unreleased]: https://github.com/guicebarton27-art/sentinel-ai-trader-79974/compare/v1.0.0...HEAD
- [1.0.0]: https://github.com/guicebarton27-art/sentinel-ai-trader-79974/releases/tag/v1.0.0
