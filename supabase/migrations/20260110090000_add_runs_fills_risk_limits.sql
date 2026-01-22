-- Create run state machine tables and add trace/run identifiers

-- Run state enums
CREATE TYPE public.run_state AS ENUM ('requested', 'running', 'completed', 'failed', 'canceled');
CREATE TYPE public.run_trigger AS ENUM ('manual', 'scheduled', 'backtest');

-- Runs table
CREATE TABLE public.runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bot_id UUID REFERENCES public.bots(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  run_type TEXT NOT NULL DEFAULT 'tick',
  trigger run_trigger NOT NULL DEFAULT 'scheduled',
  state run_state NOT NULL DEFAULT 'requested',
  trace_id TEXT NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  requested_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_runs_bot_id ON public.runs(bot_id);
CREATE INDEX idx_runs_user_id ON public.runs(user_id);
CREATE INDEX idx_runs_state ON public.runs(state);
CREATE INDEX idx_runs_created_at ON public.runs(created_at DESC);

-- Strategy configs table
CREATE TABLE public.strategy_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bot_id UUID NOT NULL REFERENCES public.bots(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  strategy_id TEXT NOT NULL,
  config JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT strategy_configs_bot_unique UNIQUE (bot_id)
);

CREATE INDEX idx_strategy_configs_bot_id ON public.strategy_configs(bot_id);
CREATE INDEX idx_strategy_configs_user_id ON public.strategy_configs(user_id);

-- Risk limits table
CREATE TABLE public.risk_limits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bot_id UUID NOT NULL REFERENCES public.bots(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  max_position_size DECIMAL(20, 8) NOT NULL DEFAULT 0.1,
  max_daily_loss DECIMAL(20, 8) NOT NULL DEFAULT 100,
  max_correlation DECIMAL(5, 2) NOT NULL DEFAULT 0.7,
  kill_switch_drawdown DECIMAL(5, 2) NOT NULL DEFAULT 0.15,
  max_leverage DECIMAL(5, 2) NOT NULL DEFAULT 1.0,
  max_trades_per_hour INTEGER NOT NULL DEFAULT 5,
  cooldown_minutes INTEGER NOT NULL DEFAULT 30,
  max_consecutive_losses INTEGER NOT NULL DEFAULT 3,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT risk_limits_bot_unique UNIQUE (bot_id)
);

CREATE INDEX idx_risk_limits_bot_id ON public.risk_limits(bot_id);
CREATE INDEX idx_risk_limits_user_id ON public.risk_limits(user_id);

-- Fills table
CREATE TABLE public.fills (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  bot_id UUID NOT NULL REFERENCES public.bots(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  run_id UUID REFERENCES public.runs(id) ON DELETE SET NULL,
  trace_id TEXT,
  symbol TEXT NOT NULL,
  side order_side NOT NULL,
  quantity DECIMAL(20, 8) NOT NULL,
  price DECIMAL(20, 8) NOT NULL,
  fee DECIMAL(20, 8) DEFAULT 0,
  fee_currency TEXT DEFAULT 'USD',
  liquidity TEXT,
  executed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_fills_order_id ON public.fills(order_id);
CREATE INDEX idx_fills_bot_id ON public.fills(bot_id);
CREATE INDEX idx_fills_run_id ON public.fills(run_id);

-- Add run_id and trace_id to trading tables
ALTER TABLE public.orders ADD COLUMN run_id UUID REFERENCES public.runs(id) ON DELETE SET NULL;
ALTER TABLE public.orders ADD COLUMN trace_id TEXT;
ALTER TABLE public.positions ADD COLUMN run_id UUID REFERENCES public.runs(id) ON DELETE SET NULL;
ALTER TABLE public.positions ADD COLUMN trace_id TEXT;
ALTER TABLE public.bot_events ADD COLUMN run_id UUID REFERENCES public.runs(id) ON DELETE SET NULL;
ALTER TABLE public.bot_events ADD COLUMN trace_id TEXT;
ALTER TABLE public.bot_runs ADD COLUMN run_id UUID REFERENCES public.runs(id) ON DELETE SET NULL;
ALTER TABLE public.bot_runs ADD COLUMN trace_id TEXT;
ALTER TABLE public.backtest_runs ADD COLUMN run_id UUID REFERENCES public.runs(id) ON DELETE SET NULL;
ALTER TABLE public.backtest_runs ADD COLUMN trace_id TEXT;

CREATE INDEX idx_orders_run_id ON public.orders(run_id);
CREATE INDEX idx_positions_run_id ON public.positions(run_id);
CREATE INDEX idx_bot_events_run_id ON public.bot_events(run_id);
CREATE INDEX idx_bot_runs_run_id ON public.bot_runs(run_id);
CREATE INDEX idx_backtest_runs_run_id ON public.backtest_runs(run_id);

-- Enforce append-only bot events
CREATE OR REPLACE FUNCTION public.prevent_bot_event_mutation()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'bot_events is append-only';
END;
$$;

CREATE TRIGGER bot_events_no_update
  BEFORE UPDATE OR DELETE ON public.bot_events
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_bot_event_mutation();

-- Run state machine transition function
CREATE OR REPLACE FUNCTION public.request_run_transition(
  run_id UUID,
  target_state run_state,
  transition_trace_id TEXT DEFAULT NULL,
  transition_note TEXT DEFAULT NULL
)
RETURNS public.runs
LANGUAGE plpgsql
AS $$
DECLARE
  current_state run_state;
  run_record public.runs;
BEGIN
  SELECT * INTO run_record FROM public.runs WHERE id = run_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Run % not found', run_id;
  END IF;

  current_state := run_record.state;

  IF current_state = target_state THEN
    RETURN run_record;
  END IF;

  IF current_state = 'requested' AND target_state NOT IN ('running', 'canceled') THEN
    RAISE EXCEPTION 'Invalid transition from % to %', current_state, target_state;
  ELSIF current_state = 'running' AND target_state NOT IN ('completed', 'failed', 'canceled') THEN
    RAISE EXCEPTION 'Invalid transition from % to %', current_state, target_state;
  ELSIF current_state IN ('completed', 'failed', 'canceled') THEN
    RAISE EXCEPTION 'Run % is already finalized', run_id;
  END IF;

  UPDATE public.runs
  SET state = target_state,
      started_at = CASE WHEN target_state = 'running' AND run_record.started_at IS NULL THEN NOW() ELSE run_record.started_at END,
      completed_at = CASE WHEN target_state IN ('completed', 'failed', 'canceled') THEN NOW() ELSE run_record.completed_at END,
      metadata = CASE
        WHEN transition_note IS NULL AND transition_trace_id IS NULL THEN run_record.metadata
        ELSE jsonb_strip_nulls(run_record.metadata || jsonb_build_object(
          'last_transition_note', transition_note,
          'last_transition_trace_id', transition_trace_id,
          'last_transition_at', NOW()
        ))
      END,
      updated_at = NOW()
  WHERE id = run_id
  RETURNING * INTO run_record;

  RETURN run_record;
END;
$$;

-- Row level security
ALTER TABLE public.runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.strategy_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.risk_limits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fills ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own runs" ON public.runs
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create their own runs" ON public.runs
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own runs" ON public.runs
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can view their own strategy configs" ON public.strategy_configs
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create their own strategy configs" ON public.strategy_configs
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own strategy configs" ON public.strategy_configs
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can view their own risk limits" ON public.risk_limits
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create their own risk limits" ON public.risk_limits
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own risk limits" ON public.risk_limits
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can view their own fills" ON public.fills
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create their own fills" ON public.fills
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Triggers for updated_at
CREATE TRIGGER update_runs_updated_at
  BEFORE UPDATE ON public.runs
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_strategy_configs_updated_at
  BEFORE UPDATE ON public.strategy_configs
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_risk_limits_updated_at
  BEFORE UPDATE ON public.risk_limits
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.runs;
ALTER PUBLICATION supabase_realtime ADD TABLE public.strategy_configs;
ALTER PUBLICATION supabase_realtime ADD TABLE public.risk_limits;
ALTER PUBLICATION supabase_realtime ADD TABLE public.fills;

-- Cron scheduler helper for tick-bots
CREATE OR REPLACE FUNCTION public.invoke_tick_bots()
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  functions_url TEXT := current_setting('app.settings.supabase_functions_url', true);
  service_key TEXT := current_setting('app.settings.supabase_service_role_key', true);
BEGIN
  IF functions_url IS NULL OR service_key IS NULL THEN
    RAISE NOTICE 'Tick-bots scheduler not configured';
    RETURN;
  END IF;

  PERFORM net.http_post(
    url := functions_url || '/tick-bots',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-service-role', service_key
    ),
    body := '{}'::jsonb
  );
END;
$$;

SELECT cron.schedule('tick-bots-schedule', '*/1 * * * *', $$SELECT public.invoke_tick_bots();$$);
