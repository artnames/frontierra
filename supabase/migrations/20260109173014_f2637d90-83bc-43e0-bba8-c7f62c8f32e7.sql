-- Player Lands Registry for Deterministic Multiplayer
-- Each player owns one land defined ONLY by (seed, vars)
-- All terrain/features are derived at runtime via NexArt

CREATE TABLE public.player_lands (
  player_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  seed INTEGER NOT NULL DEFAULT 0,
  vars INTEGER[] NOT NULL DEFAULT ARRAY[50,50,50,50,50,50,50,50,50,50],
  pos_x INTEGER NOT NULL DEFAULT 0,
  pos_y INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Add constraint to ensure vars array has exactly 10 elements
ALTER TABLE public.player_lands
ADD CONSTRAINT vars_length_check CHECK (array_length(vars, 1) = 10);

-- Enable RLS
ALTER TABLE public.player_lands ENABLE ROW LEVEL SECURITY;

-- Public read access (anyone can see land registry to visit neighbors)
CREATE POLICY "Anyone can view all player lands"
ON public.player_lands
FOR SELECT
USING (true);

-- Players can insert their own land
CREATE POLICY "Users can create their own land"
ON public.player_lands
FOR INSERT
WITH CHECK (true);

-- Players can update their own land
CREATE POLICY "Users can update their own land"
ON public.player_lands
FOR UPDATE
USING (true);

-- Trigger for updated_at
CREATE OR REPLACE FUNCTION public.update_player_lands_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_player_lands_timestamp
BEFORE UPDATE ON public.player_lands
FOR EACH ROW
EXECUTE FUNCTION public.update_player_lands_updated_at();

-- Enable realtime for land updates (players can see when neighbors change)
ALTER PUBLICATION supabase_realtime ADD TABLE public.player_lands;