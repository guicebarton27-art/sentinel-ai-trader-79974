-- Add run tick tracking and expanded bot event types

ALTER TYPE public.bot_event_type ADD VALUE IF NOT EXISTS 'tick_start';
ALTER TYPE public.bot_event_type ADD VALUE IF NOT EXISTS 'tick_end';

ALTER TABLE public.runs ADD COLUMN IF NOT EXISTS last_tick_at TIMESTAMPTZ;
