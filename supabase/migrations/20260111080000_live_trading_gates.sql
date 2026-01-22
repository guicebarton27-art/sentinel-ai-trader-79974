-- Add LIVE trading arming fields to bot_runs
ALTER TABLE public.bot_runs
  ADD COLUMN IF NOT EXISTS live_armed BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS arm_requested_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS armed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS arm_token_hash TEXT;

CREATE INDEX IF NOT EXISTS idx_bot_runs_live_armed
  ON public.bot_runs(live_armed)
  WHERE mode = 'live';
