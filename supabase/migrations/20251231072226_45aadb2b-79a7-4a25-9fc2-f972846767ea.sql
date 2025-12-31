-- Create deployed strategies table
CREATE TABLE public.deployed_strategies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    name TEXT NOT NULL,
    symbol TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'paper',
    strategy_config JSONB NOT NULL,
    performance_metrics JSONB,
    deployed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    last_signal_at TIMESTAMP WITH TIME ZONE,
    total_signals INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.deployed_strategies ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users can view their own deployed strategies"
ON public.deployed_strategies FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own deployed strategies"
ON public.deployed_strategies FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own deployed strategies"
ON public.deployed_strategies FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own deployed strategies"
ON public.deployed_strategies FOR DELETE
USING (auth.uid() = user_id);

-- Trigger for updated_at
CREATE TRIGGER update_deployed_strategies_updated_at
BEFORE UPDATE ON public.deployed_strategies
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();