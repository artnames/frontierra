-- Add V2 parameter support to player_lands for deterministic world generation
-- mapping_version: 'v1' (default) or 'v2' for enhanced generation
-- micro_overrides: JSONB storing manual micro var overrides (index -> value)

ALTER TABLE public.player_lands 
ADD COLUMN IF NOT EXISTS mapping_version TEXT NOT NULL DEFAULT 'v1';

ALTER TABLE public.player_lands 
ADD COLUMN IF NOT EXISTS micro_overrides JSONB DEFAULT NULL;

-- Add a check constraint to ensure valid mapping versions
ALTER TABLE public.player_lands 
ADD CONSTRAINT player_lands_mapping_version_check 
CHECK (mapping_version IN ('v1', 'v2'));