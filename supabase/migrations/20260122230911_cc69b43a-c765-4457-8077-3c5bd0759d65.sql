-- Create table for multi-exchange arbitrage opportunities
CREATE TABLE public.arbitrage_opportunities (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  opportunity_type TEXT NOT NULL DEFAULT 'cross_exchange', -- 'cross_exchange', 'triangular', 'funding_rate'
  exchanges TEXT[] NOT NULL,
  symbol TEXT NOT NULL,
  buy_exchange TEXT NOT NULL,
  sell_exchange TEXT NOT NULL,
  buy_price NUMERIC NOT NULL,
  sell_price NUMERIC NOT NULL,
  spread_percentage NUMERIC NOT NULL,
  estimated_profit NUMERIC NOT NULL,
  volume_available NUMERIC NOT NULL,
  fees_estimate NUMERIC NOT NULL DEFAULT 0,
  net_profit NUMERIC NOT NULL,
  status TEXT NOT NULL DEFAULT 'detected', -- 'detected', 'executing', 'completed', 'expired', 'failed'
  hedge_status TEXT DEFAULT NULL, -- 'none', 'pending', 'hedged', 'closed'
  hedge_details JSONB DEFAULT '{}'::jsonb,
  funding_rate_data JSONB DEFAULT '{}'::jsonb,
  execution_details JSONB DEFAULT '{}'::jsonb,
  detected_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  executed_at TIMESTAMP WITH TIME ZONE,
  closed_at TIMESTAMP WITH TIME ZONE,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT (now() + interval '5 minutes'),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create table for funding rates across exchanges
CREATE TABLE public.funding_rates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  exchange TEXT NOT NULL,
  symbol TEXT NOT NULL,
  funding_rate NUMERIC NOT NULL,
  next_funding_time TIMESTAMP WITH TIME ZONE,
  predicted_rate NUMERIC,
  open_interest NUMERIC,
  mark_price NUMERIC,
  index_price NUMERIC,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(exchange, symbol, created_at)
);

-- Create table for hedge positions
CREATE TABLE public.hedge_positions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  arbitrage_id UUID REFERENCES public.arbitrage_opportunities(id),
  symbol TEXT NOT NULL,
  long_exchange TEXT NOT NULL,
  short_exchange TEXT NOT NULL,
  long_size NUMERIC NOT NULL,
  short_size NUMERIC NOT NULL,
  long_entry_price NUMERIC NOT NULL,
  short_entry_price NUMERIC NOT NULL,
  long_current_price NUMERIC,
  short_current_price NUMERIC,
  unrealized_pnl NUMERIC DEFAULT 0,
  realized_pnl NUMERIC DEFAULT 0,
  funding_collected NUMERIC DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'open', -- 'open', 'closing', 'closed'
  opened_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  closed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.arbitrage_opportunities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.funding_rates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hedge_positions ENABLE ROW LEVEL SECURITY;

-- RLS policies for arbitrage_opportunities
CREATE POLICY "Users can view their own arbitrage opportunities"
  ON public.arbitrage_opportunities FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own arbitrage opportunities"
  ON public.arbitrage_opportunities FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own arbitrage opportunities"
  ON public.arbitrage_opportunities FOR UPDATE
  USING (auth.uid() = user_id);

-- RLS policies for funding_rates (public read)
CREATE POLICY "Funding rates are viewable by everyone"
  ON public.funding_rates FOR SELECT
  USING (true);

-- RLS policies for hedge_positions
CREATE POLICY "Users can view their own hedge positions"
  ON public.hedge_positions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own hedge positions"
  ON public.hedge_positions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own hedge positions"
  ON public.hedge_positions FOR UPDATE
  USING (auth.uid() = user_id);

-- Add indexes for performance
CREATE INDEX idx_arbitrage_opportunities_user_status ON public.arbitrage_opportunities(user_id, status);
CREATE INDEX idx_arbitrage_opportunities_expires ON public.arbitrage_opportunities(expires_at) WHERE status = 'detected';
CREATE INDEX idx_funding_rates_exchange_symbol ON public.funding_rates(exchange, symbol);
CREATE INDEX idx_hedge_positions_user_status ON public.hedge_positions(user_id, status);

-- Trigger for updated_at on hedge_positions
CREATE TRIGGER update_hedge_positions_updated_at
  BEFORE UPDATE ON public.hedge_positions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();