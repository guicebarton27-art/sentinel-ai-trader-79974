-- Create run status enum
DO $$ BEGIN
  CREATE TYPE public.run_status AS ENUM (
    'STOPPED',
    'STARTING',
    'RUNNING',
    'PAUSING',
    'PAUSED',
    'STOPPING',
    'KILL_SWITCHED'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Create runs table
CREATE TABLE IF NOT EXISTS public.runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bot_id UUID REFERENCES public.bots(id) ON DELETE SET NULL,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status public.run_status NOT NULL DEFAULT 'STOPPED',
  mode TEXT NOT NULL DEFAULT 'paper' CHECK (mode IN ('paper', 'backtest', 'live')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_tick_at TIMESTAMPTZ,
  config_json JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_runs_user_status ON public.runs(user_id, status);
CREATE INDEX IF NOT EXISTS idx_runs_bot_created ON public.runs(bot_id, created_at DESC);

ALTER TABLE public.runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own runs" ON public.runs
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create their own runs" ON public.runs
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own runs" ON public.runs
  FOR UPDATE USING (auth.uid() = user_id);

CREATE TRIGGER update_runs_updated_at
  BEFORE UPDATE ON public.runs
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Extend orders, positions, bot_events to include run/trace context
ALTER TABLE public.orders ALTER COLUMN bot_id DROP NOT NULL;
ALTER TABLE public.positions ALTER COLUMN bot_id DROP NOT NULL;
ALTER TABLE public.bot_events ALTER COLUMN bot_id DROP NOT NULL;

ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS run_id UUID REFERENCES public.runs(id) ON DELETE SET NULL;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS trace_id TEXT;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS meta_json JSONB NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE public.positions ADD COLUMN IF NOT EXISTS run_id UUID REFERENCES public.runs(id) ON DELETE SET NULL;
ALTER TABLE public.positions ADD COLUMN IF NOT EXISTS avg_price DECIMAL(20, 8);
ALTER TABLE public.positions ADD COLUMN IF NOT EXISTS meta_json JSONB NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE public.bot_events ADD COLUMN IF NOT EXISTS run_id UUID REFERENCES public.runs(id) ON DELETE SET NULL;
ALTER TABLE public.bot_events ADD COLUMN IF NOT EXISTS trace_id TEXT;
ALTER TABLE public.bot_events ADD COLUMN IF NOT EXISTS payload_json JSONB NOT NULL DEFAULT '{}'::jsonb;

CREATE INDEX IF NOT EXISTS idx_orders_run_id ON public.orders(run_id);
CREATE INDEX IF NOT EXISTS idx_positions_run_id ON public.positions(run_id);
CREATE INDEX IF NOT EXISTS idx_bot_events_run_id ON public.bot_events(run_id, created_at DESC);

-- Market snapshots table
CREATE TABLE IF NOT EXISTS public.market_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ts TIMESTAMPTZ NOT NULL DEFAULT now(),
  run_id UUID REFERENCES public.runs(id) ON DELETE SET NULL,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  symbol TEXT NOT NULL,
  timeframe TEXT NOT NULL,
  source TEXT NOT NULL,
  data_json JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_market_snapshots_symbol_ts ON public.market_snapshots(symbol, ts DESC);
CREATE INDEX IF NOT EXISTS idx_market_snapshots_run_id ON public.market_snapshots(run_id, ts DESC);

ALTER TABLE public.market_snapshots ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view their own market snapshots" ON public.market_snapshots
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own market snapshots" ON public.market_snapshots
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Strategy decisions table
CREATE TABLE IF NOT EXISTS public.strategy_decisions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ts TIMESTAMPTZ NOT NULL DEFAULT now(),
  run_id UUID REFERENCES public.runs(id) ON DELETE SET NULL,
  trace_id TEXT NOT NULL,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  symbol TEXT NOT NULL,
  signal TEXT NOT NULL,
  confidence DECIMAL(6, 4) NOT NULL,
  rationale TEXT,
  inputs_json JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_strategy_decisions_run_id ON public.strategy_decisions(run_id, ts DESC);

ALTER TABLE public.strategy_decisions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view their own strategy decisions" ON public.strategy_decisions
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own strategy decisions" ON public.strategy_decisions
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Fills table
CREATE TABLE IF NOT EXISTS public.fills (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ts TIMESTAMPTZ NOT NULL DEFAULT now(),
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  run_id UUID REFERENCES public.runs(id) ON DELETE SET NULL,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  price DECIMAL(20, 8) NOT NULL,
  qty DECIMAL(20, 8) NOT NULL,
  fee DECIMAL(20, 8) DEFAULT 0,
  meta_json JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_fills_order_id ON public.fills(order_id);
CREATE INDEX IF NOT EXISTS idx_fills_run_id ON public.fills(run_id, ts DESC);

ALTER TABLE public.fills ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view their own fills" ON public.fills
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own fills" ON public.fills
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Risk limits table
CREATE TABLE IF NOT EXISTS public.risk_limits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  max_position DECIMAL(20, 8) NOT NULL DEFAULT 0.1,
  max_daily_loss DECIMAL(20, 8) NOT NULL DEFAULT 1000,
  max_leverage DECIMAL(10, 4) NOT NULL DEFAULT 1,
  max_trades_per_hour INTEGER NOT NULL DEFAULT 5,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_risk_limits_user_id ON public.risk_limits(user_id);

ALTER TABLE public.risk_limits ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view their own risk limits" ON public.risk_limits
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can manage their own risk limits" ON public.risk_limits
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own risk limits" ON public.risk_limits
  FOR UPDATE USING (auth.uid() = user_id);
