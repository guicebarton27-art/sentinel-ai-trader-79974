-- Create test_runs table to store self-test results
CREATE TABLE public.test_runs (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  run_id uuid NOT NULL DEFAULT gen_random_uuid(),
  results_json jsonb NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.test_runs ENABLE ROW LEVEL SECURITY;

-- Users can only view their own test runs
CREATE POLICY "Users can view their own test runs"
ON public.test_runs
FOR SELECT
USING (auth.uid() = user_id);

-- Users can insert their own test runs
CREATE POLICY "Users can insert their own test runs"
ON public.test_runs
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Users can delete their own test runs
CREATE POLICY "Users can delete their own test runs"
ON public.test_runs
FOR DELETE
USING (auth.uid() = user_id);

-- Create index for faster queries
CREATE INDEX idx_test_runs_user_id ON public.test_runs(user_id);
CREATE INDEX idx_test_runs_created_at ON public.test_runs(created_at DESC);