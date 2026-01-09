-- Fix land-claiming permissions + enforce single-land ownership
--
-- Goals:
-- 1) Only authenticated users can INSERT a land, and only for themselves
-- 2) Users can UPDATE only their own land
-- 3) Anyone can SELECT all lands (public map)
-- 4) Enforce: one land per player, and one owner per grid cell

-- Ensure RLS is enabled
ALTER TABLE public.player_lands ENABLE ROW LEVEL SECURITY;

-- Drop old policies (these were accidentally created as RESTRICTIVE and can block access)
DROP POLICY IF EXISTS "Anon can create land" ON public.player_lands;
DROP POLICY IF EXISTS "Owner can update their land" ON public.player_lands;
DROP POLICY IF EXISTS "Anyone can view all player lands" ON public.player_lands;

-- Public read: allow both anon + authenticated to view all lands
CREATE POLICY "Anyone can view all player lands"
ON public.player_lands
FOR SELECT
TO anon, authenticated
USING (true);

-- Claiming: authenticated users may insert exactly their own row (auth.uid must match player_id)
CREATE POLICY "Authenticated can claim their land"
ON public.player_lands
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = player_id);

-- Updating: only the owner may update their row, and cannot change ownership
CREATE POLICY "Owner can update their land"
ON public.player_lands
FOR UPDATE
TO authenticated
USING (auth.uid() = player_id)
WITH CHECK (auth.uid() = player_id);

-- Enforce constraints at DB level
-- One land per player
CREATE UNIQUE INDEX IF NOT EXISTS player_lands_player_id_unique
ON public.player_lands (player_id);

-- One owner per grid cell
CREATE UNIQUE INDEX IF NOT EXISTS player_lands_position_unique
ON public.player_lands (pos_x, pos_y);
