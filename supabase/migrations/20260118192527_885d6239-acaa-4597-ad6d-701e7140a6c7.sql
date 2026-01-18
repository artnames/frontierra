-- 1. Create discovery_log table to track who discovered what and when
CREATE TABLE public.discovery_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  discoverer_id UUID NOT NULL,
  land_x INTEGER NOT NULL,
  land_y INTEGER NOT NULL,
  discovered_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(discoverer_id, land_x, land_y)
);

-- Enable RLS
ALTER TABLE public.discovery_log ENABLE ROW LEVEL SECURITY;

-- Anyone can view discoveries
CREATE POLICY "Anyone can view discoveries"
ON public.discovery_log
FOR SELECT
USING (true);

-- Authenticated users can create their own discoveries
CREATE POLICY "Authenticated can create discoveries"
ON public.discovery_log
FOR INSERT
WITH CHECK (auth.uid() = discoverer_id);

-- Users can update their own discoveries (for resetting the timestamp)
CREATE POLICY "Users can update their own discoveries"
ON public.discovery_log
FOR UPDATE
USING (auth.uid() = discoverer_id)
WITH CHECK (auth.uid() = discoverer_id);

-- 2. Add discovery_points column to player_lands
ALTER TABLE public.player_lands
ADD COLUMN IF NOT EXISTS discovery_points INTEGER NOT NULL DEFAULT 0;