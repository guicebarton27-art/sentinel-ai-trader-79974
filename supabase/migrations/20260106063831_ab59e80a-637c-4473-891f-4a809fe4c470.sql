-- Create bot status enum
CREATE TYPE public.bot_status AS ENUM ('stopped', 'running', 'paused', 'error');

-- Create bot mode enum  
CREATE TYPE public.bot_mode AS ENUM ('paper', 'live');

-- Create order status enum
CREATE TYPE public.order_status AS ENUM ('pending', 'submitted', 'partial', 'filled', 'canceled', 'rejected', 'expired');

-- Create order side enum
CREATE TYPE public.order_side AS ENUM ('buy', 'sell');

-- Create order type enum
CREATE TYPE public.order_type AS ENUM ('market', 'limit', 'stop_loss', 'take_profit', 'stop_limit');

-- Create position status enum
CREATE TYPE public.position_status AS ENUM ('open', 'closed', 'liquidated');

-- Create event type enum
CREATE TYPE public.bot_event_type AS ENUM ('start', 'stop', 'pause', 'resume', 'tick', 'order', 'fill', 'error', 'heartbeat', 'config_change', 'risk_alert');

-- ============================================
-- BOTS TABLE - Single source of truth for bot state
-- ============================================
CREATE TABLE public.bots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL DEFAULT 'My Trading Bot',
    status bot_status NOT NULL DEFAULT 'stopped',
    mode bot_mode NOT NULL DEFAULT 'paper',
    symbol TEXT NOT NULL DEFAULT 'BTC/USD',
    
    -- Strategy configuration
    strategy_id TEXT NOT NULL DEFAULT 'trend_following',
    strategy_config JSONB NOT NULL DEFAULT '{}'::jsonb,
    
    -- Risk parameters
    max_position_size DECIMAL(20, 8) NOT NULL DEFAULT 0.1,
    max_daily_loss DECIMAL(20, 8) NOT NULL DEFAULT 100,
    stop_loss_pct DECIMAL(5, 2) NOT NULL DEFAULT 2.0,
    take_profit_pct DECIMAL(5, 2) NOT NULL DEFAULT 5.0,
    max_leverage DECIMAL(5, 2) NOT NULL DEFAULT 1.0,
    
    -- Performance tracking
    starting_capital DECIMAL(20, 8) NOT NULL DEFAULT 10000,
    current_capital DECIMAL(20, 8) NOT NULL DEFAULT 10000,
    total_pnl DECIMAL(20, 8) NOT NULL DEFAULT 0,
    daily_pnl DECIMAL(20, 8) NOT NULL DEFAULT 0,
    total_trades INTEGER NOT NULL DEFAULT 0,
    winning_trades INTEGER NOT NULL DEFAULT 0,
    
    -- Heartbeat and state
    last_heartbeat_at TIMESTAMPTZ,
    last_tick_at TIMESTAMPTZ,
    last_error TEXT,
    error_count INTEGER NOT NULL DEFAULT 0,
    
    -- API key reference (encrypted key in api_keys table)
    api_key_id UUID REFERENCES public.api_keys(id) ON DELETE SET NULL,
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    CONSTRAINT bots_user_single_active UNIQUE (user_id, name)
);

-- ============================================
-- ORDERS TABLE - Complete order lifecycle
-- ============================================
CREATE TABLE public.orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    bot_id UUID NOT NULL REFERENCES public.bots(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    
    -- Order identification
    client_order_id TEXT NOT NULL,
    exchange_order_id TEXT,
    
    -- Order details
    symbol TEXT NOT NULL,
    side order_side NOT NULL,
    order_type order_type NOT NULL,
    status order_status NOT NULL DEFAULT 'pending',
    
    -- Quantities and prices
    quantity DECIMAL(20, 8) NOT NULL,
    filled_quantity DECIMAL(20, 8) NOT NULL DEFAULT 0,
    price DECIMAL(20, 8),  -- For limit orders
    stop_price DECIMAL(20, 8),  -- For stop orders
    average_fill_price DECIMAL(20, 8),
    
    -- Fees and execution
    fee DECIMAL(20, 8) DEFAULT 0,
    fee_currency TEXT DEFAULT 'USD',
    slippage DECIMAL(20, 8),
    
    -- Context
    signal_strength DECIMAL(5, 4),  -- -1 to 1
    strategy_id TEXT,
    reason TEXT,  -- Why this order was placed
    
    -- Risk validation
    risk_checked BOOLEAN NOT NULL DEFAULT FALSE,
    risk_score DECIMAL(5, 2),
    risk_flags JSONB DEFAULT '[]'::jsonb,
    
    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    submitted_at TIMESTAMPTZ,
    filled_at TIMESTAMPTZ,
    canceled_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================
-- POSITIONS TABLE - Current and historical positions
-- ============================================
CREATE TABLE public.positions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    bot_id UUID NOT NULL REFERENCES public.bots(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    
    -- Position details
    symbol TEXT NOT NULL,
    side order_side NOT NULL,
    status position_status NOT NULL DEFAULT 'open',
    
    -- Size and pricing
    quantity DECIMAL(20, 8) NOT NULL,
    entry_price DECIMAL(20, 8) NOT NULL,
    current_price DECIMAL(20, 8),
    exit_price DECIMAL(20, 8),
    
    -- P&L tracking
    unrealized_pnl DECIMAL(20, 8) DEFAULT 0,
    realized_pnl DECIMAL(20, 8) DEFAULT 0,
    total_fees DECIMAL(20, 8) DEFAULT 0,
    
    -- Risk tracking
    stop_loss_price DECIMAL(20, 8),
    take_profit_price DECIMAL(20, 8),
    liquidation_price DECIMAL(20, 8),
    max_drawdown DECIMAL(20, 8) DEFAULT 0,
    
    -- Order references
    entry_order_id UUID REFERENCES public.orders(id),
    exit_order_id UUID REFERENCES public.orders(id),
    
    -- Timestamps
    opened_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    closed_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================
-- BOT EVENTS TABLE - Complete audit trail
-- ============================================
CREATE TABLE public.bot_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    bot_id UUID NOT NULL REFERENCES public.bots(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    
    -- Event details
    event_type bot_event_type NOT NULL,
    severity TEXT NOT NULL DEFAULT 'info',  -- info, warn, error, critical
    message TEXT NOT NULL,
    
    -- Context data
    payload JSONB DEFAULT '{}'::jsonb,
    
    -- For orders/trades
    order_id UUID REFERENCES public.orders(id),
    position_id UUID REFERENCES public.positions(id),
    
    -- Metrics at event time
    bot_capital DECIMAL(20, 8),
    bot_pnl DECIMAL(20, 8),
    market_price DECIMAL(20, 8),
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================
-- INDEXES for performance
-- ============================================
CREATE INDEX idx_bots_user_status ON public.bots(user_id, status);
CREATE INDEX idx_bots_last_heartbeat ON public.bots(last_heartbeat_at) WHERE status = 'running';
CREATE INDEX idx_orders_bot_status ON public.orders(bot_id, status);
CREATE INDEX idx_orders_user_created ON public.orders(user_id, created_at DESC);
CREATE INDEX idx_positions_bot_status ON public.positions(bot_id, status);
CREATE INDEX idx_positions_user_open ON public.positions(user_id) WHERE status = 'open';
CREATE INDEX idx_bot_events_bot_created ON public.bot_events(bot_id, created_at DESC);
CREATE INDEX idx_bot_events_type ON public.bot_events(event_type, created_at DESC);

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================
ALTER TABLE public.bots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.positions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bot_events ENABLE ROW LEVEL SECURITY;

-- Bots policies
CREATE POLICY "Users can view their own bots" ON public.bots
    FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create their own bots" ON public.bots
    FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own bots" ON public.bots
    FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own bots" ON public.bots
    FOR DELETE USING (auth.uid() = user_id);

-- Orders policies
CREATE POLICY "Users can view their own orders" ON public.orders
    FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create their own orders" ON public.orders
    FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own orders" ON public.orders
    FOR UPDATE USING (auth.uid() = user_id);

-- Positions policies
CREATE POLICY "Users can view their own positions" ON public.positions
    FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create their own positions" ON public.positions
    FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own positions" ON public.positions
    FOR UPDATE USING (auth.uid() = user_id);

-- Bot events policies
CREATE POLICY "Users can view their own bot events" ON public.bot_events
    FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create their own bot events" ON public.bot_events
    FOR INSERT WITH CHECK (auth.uid() = user_id);

-- ============================================
-- TRIGGERS for updated_at
-- ============================================
CREATE TRIGGER update_bots_updated_at
    BEFORE UPDATE ON public.bots
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_orders_updated_at
    BEFORE UPDATE ON public.orders
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_positions_updated_at
    BEFORE UPDATE ON public.positions
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================
-- Enable realtime for bot state changes
-- ============================================
ALTER PUBLICATION supabase_realtime ADD TABLE public.bots;
ALTER PUBLICATION supabase_realtime ADD TABLE public.orders;
ALTER PUBLICATION supabase_realtime ADD TABLE public.positions;
ALTER PUBLICATION supabase_realtime ADD TABLE public.bot_events;