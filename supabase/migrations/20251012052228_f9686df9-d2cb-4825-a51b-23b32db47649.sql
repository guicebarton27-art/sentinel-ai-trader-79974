-- Add ML metrics to backtest_runs
ALTER TABLE backtest_runs 
ADD COLUMN IF NOT EXISTS calmar_ratio numeric,
ADD COLUMN IF NOT EXISTS omega_ratio numeric,
ADD COLUMN IF NOT EXISTS expectancy numeric,
ADD COLUMN IF NOT EXISTS walk_forward_analysis jsonb;

-- Create ml_models table for storing trained model versions
CREATE TABLE IF NOT EXISTS ml_models (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  model_type text NOT NULL, -- 'tft', 'nbeats', 'finbert', 'ppo', 'dqn', etc.
  model_name text NOT NULL,
  version text NOT NULL,
  framework text NOT NULL, -- 'pytorch', 'tensorflow', 'sklearn', etc.
  parameters jsonb NOT NULL,
  metrics jsonb, -- training metrics like accuracy, loss, etc.
  file_path text, -- S3 or storage location
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  status text DEFAULT 'active', -- 'active', 'deprecated', 'testing'
  UNIQUE(model_type, model_name, version)
);

-- Create ml_predictions table
CREATE TABLE IF NOT EXISTS ml_predictions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  model_id uuid REFERENCES ml_models(id) ON DELETE CASCADE,
  symbol text NOT NULL,
  prediction_type text NOT NULL, -- 'price', 'sentiment', 'volatility', 'risk', etc.
  timestamp bigint NOT NULL,
  horizon text, -- '1h', '4h', '24h', etc.
  prediction_value jsonb NOT NULL, -- actual prediction data
  confidence numeric,
  actual_value jsonb, -- for validation later
  error numeric, -- prediction error when actual is known
  created_at timestamp with time zone DEFAULT now()
);

-- Create sentiment_data table
CREATE TABLE IF NOT EXISTS sentiment_data (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  symbol text NOT NULL,
  source text NOT NULL, -- 'twitter', 'reddit', 'news', etc.
  model_used text NOT NULL, -- 'finbert', 'gpt4', 'claude', etc.
  sentiment_score numeric NOT NULL, -- -1 to 1
  confidence numeric,
  volume integer, -- discussion volume
  trend text, -- 'bullish', 'bearish', 'neutral'
  raw_data jsonb, -- original text or metadata
  timestamp bigint NOT NULL,
  created_at timestamp with time zone DEFAULT now()
);

-- Create rl_agent_state table for reinforcement learning
CREATE TABLE IF NOT EXISTS rl_agent_state (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_type text NOT NULL, -- 'ppo', 'dqn', 'ddpg', 'a2c'
  agent_name text NOT NULL,
  episode integer NOT NULL,
  state_snapshot jsonb NOT NULL,
  action_taken jsonb,
  reward numeric,
  cumulative_reward numeric,
  portfolio_value numeric,
  timestamp bigint NOT NULL,
  created_at timestamp with time zone DEFAULT now()
);

-- Enable RLS on all new tables
ALTER TABLE ml_models ENABLE ROW LEVEL SECURITY;
ALTER TABLE ml_predictions ENABLE ROW LEVEL SECURITY;
ALTER TABLE sentiment_data ENABLE ROW LEVEL SECURITY;
ALTER TABLE rl_agent_state ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "ML models viewable by everyone" ON ml_models FOR SELECT USING (true);
CREATE POLICY "ML predictions viewable by everyone" ON ml_predictions FOR SELECT USING (true);
CREATE POLICY "Sentiment data viewable by everyone" ON sentiment_data FOR SELECT USING (true);
CREATE POLICY "RL state viewable by everyone" ON rl_agent_state FOR SELECT USING (true);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_ml_predictions_symbol_timestamp ON ml_predictions(symbol, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_ml_predictions_model_id ON ml_predictions(model_id);
CREATE INDEX IF NOT EXISTS idx_sentiment_symbol_timestamp ON sentiment_data(symbol, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_sentiment_source ON sentiment_data(source);
CREATE INDEX IF NOT EXISTS idx_rl_agent_timestamp ON rl_agent_state(agent_name, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_ml_models_type_status ON ml_models(model_type, status);