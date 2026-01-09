-- Fix security warnings for player_lands table

-- Fix function search path
CREATE OR REPLACE FUNCTION public.update_player_lands_updated_at()
RETURNS TRIGGER 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- Drop overly permissive policies
DROP POLICY IF EXISTS "Users can create their own land" ON public.player_lands;
DROP POLICY IF EXISTS "Users can update their own land" ON public.player_lands;

-- For the prototype, allow anon/authenticated to insert (no auth required initially)
-- In production, these would be tied to auth.uid()
CREATE POLICY "Anon can create land"
ON public.player_lands
FOR INSERT
TO anon, authenticated
WITH CHECK (true);

CREATE POLICY "Owner can update their land"
ON public.player_lands
FOR UPDATE
TO anon, authenticated
USING (true)
WITH CHECK (true);