// Trading Components - Organized by Domain
// This barrel export groups related components for cleaner imports

// ============================================
// Quick Start & Simplified UX
// ============================================
export { QuickStartWizard } from './QuickStartWizard';
export { SimplifiedDashboard } from './SimplifiedDashboard';
export { MobileNavBar } from './MobileNavBar';

// ============================================
// ML & Intelligence (AI-powered analysis)
// ============================================
export * from './ml';

// ============================================
// Risk & Safety (guardrails and validation)
// ============================================
export * from './risk';

// ============================================
// Execution (orders and bot control)
// ============================================
export * from './execution';

// ============================================
// Market Data (charts and prices)
// ============================================
export * from './market';

// ============================================
// Arbitrage (cross-exchange opportunities)
// ============================================
export * from './arbitrage';

// ============================================
// Strategy (engine and management)
// ============================================
export * from './strategy';

// ============================================
// Portfolio (overview and optimization)
// ============================================
export * from './portfolio';

// ============================================
// Backtesting (historical validation)
// ============================================
export * from './backtest';

// ============================================
// System (status and configuration)
// ============================================
export * from './system';

// ============================================
// Monitoring (run status and alerts)
// ============================================
export { RunStatusPanel } from './RunStatusPanel';
export { AlertsWidget } from './AlertsWidget';

// ============================================
// Shared UI (loading, error states)
// ============================================
export * from './shared';
