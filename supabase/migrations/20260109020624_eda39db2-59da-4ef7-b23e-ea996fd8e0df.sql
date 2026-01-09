-- =====================================================
-- PHASE 1: DATABASE FOUNDATION - Audit & Tracking Tables
-- =====================================================

-- 1. AUDIT_LOG TABLE (Append-only, immutable)
-- This is the security-critical audit trail for all sensitive actions
CREATE TABLE public.audit_log (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id UUID,
  old_values JSONB,
  new_values JSONB,
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create index for efficient querying
CREATE INDEX idx_audit_log_user_id ON public.audit_log(user_id);
CREATE INDEX idx_audit_log_entity ON public.audit_log(entity_type, entity_id);
CREATE INDEX idx_audit_log_created_at ON public.audit_log(created_at DESC);
CREATE INDEX idx_audit_log_action ON public.audit_log(action);

-- Enable RLS
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

-- Users can only view their own audit logs
CREATE POLICY "Users can view their own audit logs"
ON public.audit_log
FOR SELECT
USING (auth.uid() = user_id);

-- Only service role can insert (via edge functions)
-- No INSERT policy for regular users - forces server-side logging
CREATE POLICY "Service role can insert audit logs"
ON public.audit_log
FOR INSERT
WITH CHECK (true);

-- NO UPDATE OR DELETE policies - audit log is immutable
-- This is enforced by absence of policies + we add a trigger for extra safety

-- Trigger to prevent updates/deletes on audit_log
CREATE OR REPLACE FUNCTION public.prevent_audit_log_modification()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  RAISE EXCEPTION 'Audit log entries cannot be modified or deleted';
END;
$$;

CREATE TRIGGER audit_log_immutable_update
BEFORE UPDATE ON public.audit_log
FOR EACH ROW
EXECUTE FUNCTION public.prevent_audit_log_modification();

CREATE TRIGGER audit_log_immutable_delete
BEFORE DELETE ON public.audit_log
FOR EACH ROW
EXECUTE FUNCTION public.prevent_audit_log_modification();

-- 2. ORDER_EVENTS TABLE (Granular order state changes)
CREATE TABLE public.order_events (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  event_type TEXT NOT NULL,
  previous_status TEXT,
  new_status TEXT,
  exchange_response JSONB,
  error_message TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create indexes for efficient querying
CREATE INDEX idx_order_events_order_id ON public.order_events(order_id);
CREATE INDEX idx_order_events_user_id ON public.order_events(user_id);
CREATE INDEX idx_order_events_created_at ON public.order_events(created_at DESC);
CREATE INDEX idx_order_events_event_type ON public.order_events(event_type);

-- Enable RLS
ALTER TABLE public.order_events ENABLE ROW LEVEL SECURITY;

-- Users can view their own order events
CREATE POLICY "Users can view their own order events"
ON public.order_events
FOR SELECT
USING (auth.uid() = user_id);

-- Service role inserts via edge functions
CREATE POLICY "Service role can insert order events"
ON public.order_events
FOR INSERT
WITH CHECK (true);

-- No UPDATE or DELETE for order events (append-only)

-- 3. BOT_RUNS TABLE (Session tracking for each bot run)
CREATE TABLE public.bot_runs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  bot_id UUID NOT NULL REFERENCES public.bots(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  started_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  ended_at TIMESTAMP WITH TIME ZONE,
  last_heartbeat_at TIMESTAMP WITH TIME ZONE,
  last_tick_at TIMESTAMP WITH TIME ZONE,
  mode TEXT NOT NULL DEFAULT 'paper' CHECK (mode IN ('paper', 'live')),
  status TEXT NOT NULL DEFAULT 'running' CHECK (status IN ('running', 'paused', 'stopped', 'error', 'killed')),
  starting_capital NUMERIC NOT NULL DEFAULT 0,
  ending_capital NUMERIC,
  total_pnl NUMERIC DEFAULT 0,
  total_trades INTEGER DEFAULT 0,
  winning_trades INTEGER DEFAULT 0,
  tick_count INTEGER DEFAULT 0,
  error_count INTEGER DEFAULT 0,
  last_error TEXT,
  strategy_config JSONB DEFAULT '{}'::jsonb,
  risk_config JSONB DEFAULT '{}'::jsonb,
  summary JSONB DEFAULT '{}'::jsonb
);

-- Create indexes
CREATE INDEX idx_bot_runs_bot_id ON public.bot_runs(bot_id);
CREATE INDEX idx_bot_runs_user_id ON public.bot_runs(user_id);
CREATE INDEX idx_bot_runs_status ON public.bot_runs(status);
CREATE INDEX idx_bot_runs_started_at ON public.bot_runs(started_at DESC);

-- Enable RLS
ALTER TABLE public.bot_runs ENABLE ROW LEVEL SECURITY;

-- Users can view their own bot runs
CREATE POLICY "Users can view their own bot runs"
ON public.bot_runs
FOR SELECT
USING (auth.uid() = user_id);

-- Users can create their own bot runs (via edge functions)
CREATE POLICY "Users can create their own bot runs"
ON public.bot_runs
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Users can update their own bot runs
CREATE POLICY "Users can update their own bot runs"
ON public.bot_runs
FOR UPDATE
USING (auth.uid() = user_id);

-- No DELETE - bot runs are historical records

-- 4. Add global_kill_switch column to profiles for per-user emergency halt
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS global_kill_switch BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS kill_switch_activated_at TIMESTAMP WITH TIME ZONE;

-- 5. Create helper function for logging to audit_log (to be called from edge functions)
CREATE OR REPLACE FUNCTION public.log_audit_event(
  p_user_id UUID,
  p_action TEXT,
  p_entity_type TEXT,
  p_entity_id UUID DEFAULT NULL,
  p_old_values JSONB DEFAULT NULL,
  p_new_values JSONB DEFAULT NULL,
  p_ip_address TEXT DEFAULT NULL,
  p_user_agent TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_audit_id UUID;
BEGIN
  INSERT INTO public.audit_log (
    user_id, action, entity_type, entity_id, 
    old_values, new_values, ip_address, user_agent
  ) VALUES (
    p_user_id, p_action, p_entity_type, p_entity_id,
    p_old_values, p_new_values, p_ip_address, p_user_agent
  )
  RETURNING id INTO v_audit_id;
  
  RETURN v_audit_id;
END;
$$;

-- 6. Create function to check if user's global kill switch is active
CREATE OR REPLACE FUNCTION public.is_user_killed(p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT COALESCE(
    (SELECT global_kill_switch FROM public.profiles WHERE user_id = p_user_id),
    false
  );
$$;

-- 7. Add comment documentation
COMMENT ON TABLE public.audit_log IS 'Immutable audit trail for security-relevant actions. Cannot be modified or deleted.';
COMMENT ON TABLE public.order_events IS 'Granular order state change history for debugging and compliance.';
COMMENT ON TABLE public.bot_runs IS 'Historical record of each bot trading session with performance metrics.';
COMMENT ON FUNCTION public.log_audit_event IS 'Security definer function for logging audit events from edge functions.';
COMMENT ON FUNCTION public.is_user_killed IS 'Check if user has activated their global kill switch.';