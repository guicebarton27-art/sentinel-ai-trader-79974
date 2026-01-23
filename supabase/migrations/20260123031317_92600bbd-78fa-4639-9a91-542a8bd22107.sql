-- =====================================================
-- SECURITY HARDENING MIGRATION
-- =====================================================

-- 1. Enable leaked password protection
-- (Needs to be done via configure-auth tool)

-- 2. Restrict AI/ML data to authenticated users only
-- Drop overly permissive public SELECT policies

-- Sentiment data: authenticated users only
DROP POLICY IF EXISTS "Sentiment data viewable by everyone" ON public.sentiment_data;
DROP POLICY IF EXISTS "Public read for sentiment data" ON public.sentiment_data;
CREATE POLICY "Authenticated users can read sentiment data"
ON public.sentiment_data FOR SELECT
TO authenticated
USING (true);

-- ML predictions: authenticated users only  
DROP POLICY IF EXISTS "ML predictions viewable by everyone" ON public.ml_predictions;
DROP POLICY IF EXISTS "Public read for ML predictions" ON public.ml_predictions;
CREATE POLICY "Authenticated users can read ML predictions"
ON public.ml_predictions FOR SELECT
TO authenticated
USING (true);

-- ML models: authenticated users only
DROP POLICY IF EXISTS "ML models viewable by everyone" ON public.ml_models;
CREATE POLICY "Authenticated users can read ML models"
ON public.ml_models FOR SELECT
TO authenticated
USING (true);

-- RL agent state: authenticated users only
DROP POLICY IF EXISTS "RL state viewable by everyone" ON public.rl_agent_state;
CREATE POLICY "Authenticated users can read RL state"
ON public.rl_agent_state FOR SELECT
TO authenticated
USING (true);

-- 3. Historical candles - keep public but remove duplicates
DROP POLICY IF EXISTS "Public read for historical candles" ON public.historical_candles;

-- Funding rates - keep public (needed for arbitrage detection)
-- No changes needed

-- 4. Add missing DELETE policies for data cleanup

-- Trading sessions: allow users to delete their own
CREATE POLICY "Users can delete their own trading sessions"
ON public.trading_sessions FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

-- Hedge positions: allow users to delete closed positions
CREATE POLICY "Users can delete their own closed hedge positions"
ON public.hedge_positions FOR DELETE
TO authenticated
USING (auth.uid() = user_id AND status = 'closed');

-- Arbitrage opportunities: allow cleanup of expired opportunities
CREATE POLICY "Users can delete their own expired opportunities"
ON public.arbitrage_opportunities FOR DELETE
TO authenticated
USING (auth.uid() = user_id AND (status = 'expired' OR expires_at < now()));

-- 5. Add performance indexes for frequently queried tables

-- Bot queries by user and status
CREATE INDEX IF NOT EXISTS idx_bots_user_status ON public.bots(user_id, status);

-- Orders by user, bot, and status
CREATE INDEX IF NOT EXISTS idx_orders_user_bot_status ON public.orders(user_id, bot_id, status);
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON public.orders(created_at DESC);

-- Positions by user and status  
CREATE INDEX IF NOT EXISTS idx_positions_user_status ON public.positions(user_id, status);

-- Bot events for activity timeline
CREATE INDEX IF NOT EXISTS idx_bot_events_bot_created ON public.bot_events(bot_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_bot_events_user_created ON public.bot_events(user_id, created_at DESC);

-- Historical candles for market data queries
CREATE INDEX IF NOT EXISTS idx_candles_symbol_interval_ts ON public.historical_candles(symbol, interval, timestamp DESC);

-- Backtest runs for analytics
CREATE INDEX IF NOT EXISTS idx_backtest_runs_user_created ON public.backtest_runs(user_id, created_at DESC);

-- Arbitrage opportunities by status and expiry
CREATE INDEX IF NOT EXISTS idx_arb_opps_user_status ON public.arbitrage_opportunities(user_id, status);
CREATE INDEX IF NOT EXISTS idx_arb_opps_expires ON public.arbitrage_opportunities(expires_at) WHERE status = 'detected';

-- Bot runs for session tracking
CREATE INDEX IF NOT EXISTS idx_bot_runs_bot_started ON public.bot_runs(bot_id, started_at DESC);

-- 6. Add constraint for audit log immutability (if trigger doesn't exist)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'prevent_audit_log_modification'
  ) THEN
    CREATE TRIGGER prevent_audit_log_updates
    BEFORE UPDATE OR DELETE ON public.audit_log
    FOR EACH ROW
    EXECUTE FUNCTION public.prevent_audit_log_modification();
  END IF;
END $$;