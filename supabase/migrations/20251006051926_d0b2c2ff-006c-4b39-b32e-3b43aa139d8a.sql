-- Create historical OHLCV data table
CREATE TABLE public.historical_candles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  symbol TEXT NOT NULL,
  interval TEXT NOT NULL, -- '1m', '5m', '1h', '1d', etc.
  timestamp BIGINT NOT NULL,
  open DECIMAL(20, 8) NOT NULL,
  high DECIMAL(20, 8) NOT NULL,
  low DECIMAL(20, 8) NOT NULL,
  close DECIMAL(20, 8) NOT NULL,
  volume DECIMAL(20, 8) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create index for fast queries
CREATE UNIQUE INDEX idx_candles_symbol_interval_timestamp 
  ON public.historical_candles(symbol, interval, timestamp);

CREATE INDEX idx_candles_timestamp 
  ON public.historical_candles(timestamp);

-- Enable RLS
ALTER TABLE public.historical_candles ENABLE ROW LEVEL SECURITY;

-- Public read access for historical data
CREATE POLICY "Historical candles are viewable by everyone" 
  ON public.historical_candles 
  FOR SELECT 
  USING (true);

-- Create backtest runs table
CREATE TABLE public.backtest_runs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  symbol TEXT NOT NULL,
  interval TEXT NOT NULL,
  start_timestamp BIGINT NOT NULL,
  end_timestamp BIGINT NOT NULL,
  initial_capital DECIMAL(20, 8) NOT NULL,
  final_capital DECIMAL(20, 8) NOT NULL,
  total_return DECIMAL(10, 4) NOT NULL,
  sharpe_ratio DECIMAL(10, 4),
  sortino_ratio DECIMAL(10, 4),
  max_drawdown DECIMAL(10, 4) NOT NULL,
  win_rate DECIMAL(10, 4) NOT NULL,
  total_trades INTEGER NOT NULL,
  winning_trades INTEGER NOT NULL,
  losing_trades INTEGER NOT NULL,
  profit_factor DECIMAL(10, 4),
  avg_win DECIMAL(20, 8),
  avg_loss DECIMAL(20, 8),
  strategy_config JSONB NOT NULL,
  status TEXT NOT NULL DEFAULT 'completed',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.backtest_runs ENABLE ROW LEVEL SECURITY;

-- Public read access
CREATE POLICY "Backtest runs are viewable by everyone" 
  ON public.backtest_runs 
  FOR SELECT 
  USING (true);

-- Create backtest trades table
CREATE TABLE public.backtest_trades (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  backtest_run_id UUID NOT NULL REFERENCES public.backtest_runs(id) ON DELETE CASCADE,
  entry_timestamp BIGINT NOT NULL,
  exit_timestamp BIGINT NOT NULL,
  side TEXT NOT NULL, -- 'long' or 'short'
  entry_price DECIMAL(20, 8) NOT NULL,
  exit_price DECIMAL(20, 8) NOT NULL,
  size DECIMAL(20, 8) NOT NULL,
  pnl DECIMAL(20, 8) NOT NULL,
  pnl_percentage DECIMAL(10, 4) NOT NULL,
  signal_strength DECIMAL(10, 4),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX idx_backtest_trades_run_id 
  ON public.backtest_trades(backtest_run_id);

CREATE INDEX idx_backtest_trades_entry_timestamp 
  ON public.backtest_trades(entry_timestamp);

-- Enable RLS
ALTER TABLE public.backtest_trades ENABLE ROW LEVEL SECURITY;

-- Public read access
CREATE POLICY "Backtest trades are viewable by everyone" 
  ON public.backtest_trades 
  FOR SELECT 
  USING (true);

-- Create equity curve table
CREATE TABLE public.backtest_equity_curve (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  backtest_run_id UUID NOT NULL REFERENCES public.backtest_runs(id) ON DELETE CASCADE,
  timestamp BIGINT NOT NULL,
  equity DECIMAL(20, 8) NOT NULL,
  drawdown DECIMAL(10, 4) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX idx_equity_curve_run_id 
  ON public.backtest_equity_curve(backtest_run_id);

CREATE INDEX idx_equity_curve_timestamp 
  ON public.backtest_equity_curve(timestamp);

-- Enable RLS
ALTER TABLE public.backtest_equity_curve ENABLE ROW LEVEL SECURITY;

-- Public read access
CREATE POLICY "Equity curves are viewable by everyone" 
  ON public.backtest_equity_curve 
  FOR SELECT 
  USING (true);