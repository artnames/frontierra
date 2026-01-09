-- 1. Extend player_lands with display_name and presence_ping_at
ALTER TABLE public.player_lands
ADD COLUMN IF NOT EXISTS display_name TEXT,
ADD COLUMN IF NOT EXISTS presence_ping_at TIMESTAMP WITH TIME ZONE DEFAULT now();

-- 2. Create land_trails table for edge crossings
CREATE TABLE public.land_trails (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  from_world_x INTEGER NOT NULL,
  from_world_y INTEGER NOT NULL,
  to_world_x INTEGER NOT NULL,
  to_world_y INTEGER NOT NULL,
  player_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS on land_trails
ALTER TABLE public.land_trails ENABLE ROW LEVEL SECURITY;

-- Public read for trails
CREATE POLICY "Anyone can view trails"
ON public.land_trails
FOR SELECT
USING (true);

-- Authenticated users can create trails
CREATE POLICY "Authenticated can create trails"
ON public.land_trails
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = player_id);

-- Index for efficient queries
CREATE INDEX idx_land_trails_from ON public.land_trails(from_world_x, from_world_y);
CREATE INDEX idx_land_trails_to ON public.land_trails(to_world_x, to_world_y);
CREATE INDEX idx_land_trails_player_time ON public.land_trails(player_id, created_at);

-- Enable realtime for trails
ALTER PUBLICATION supabase_realtime ADD TABLE public.land_trails;

-- 3. Create land_notes table for asynchronous messaging
CREATE TABLE public.land_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  world_x INTEGER NOT NULL,
  world_y INTEGER NOT NULL,
  author_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  message TEXT NOT NULL CHECK (char_length(message) <= 140),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS on land_notes
ALTER TABLE public.land_notes ENABLE ROW LEVEL SECURITY;

-- Public read for notes
CREATE POLICY "Anyone can view notes"
ON public.land_notes
FOR SELECT
USING (true);

-- Authenticated users can create notes (max 1 per land per player enforced via unique)
CREATE POLICY "Authenticated can create notes"
ON public.land_notes
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = author_id);

-- Users can update their own notes
CREATE POLICY "Authors can update their notes"
ON public.land_notes
FOR UPDATE
TO authenticated
USING (auth.uid() = author_id)
WITH CHECK (auth.uid() = author_id);

-- Users can delete their own notes
CREATE POLICY "Authors can delete their notes"
ON public.land_notes
FOR DELETE
TO authenticated
USING (auth.uid() = author_id);

-- Unique constraint: 1 note per land per player
CREATE UNIQUE INDEX idx_land_notes_unique ON public.land_notes(world_x, world_y, author_id);

-- Index for location queries
CREATE INDEX idx_land_notes_location ON public.land_notes(world_x, world_y);

-- Enable realtime for notes
ALTER PUBLICATION supabase_realtime ADD TABLE public.land_notes;

-- 4. Create world_features table for shared discovery naming
CREATE TABLE public.world_features (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  world_x INTEGER NOT NULL,
  world_y INTEGER NOT NULL,
  feature_type TEXT NOT NULL,
  name TEXT NOT NULL,
  named_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS on world_features
ALTER TABLE public.world_features ENABLE ROW LEVEL SECURITY;

-- Public read for features
CREATE POLICY "Anyone can view features"
ON public.world_features
FOR SELECT
USING (true);

-- Authenticated users can name features (one-time only, enforced by unique)
CREATE POLICY "Authenticated can name features"
ON public.world_features
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = named_by);

-- Unique constraint: each feature type at a location can only be named once
CREATE UNIQUE INDEX idx_world_features_unique ON public.world_features(world_x, world_y, feature_type);

-- Index for location queries
CREATE INDEX idx_world_features_location ON public.world_features(world_x, world_y);

-- Enable realtime for features
ALTER PUBLICATION supabase_realtime ADD TABLE public.world_features;