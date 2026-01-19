// Land Registry - CRUD for player lands
// This is the ONLY server-side state for multiplayer
// All terrain is derived at runtime via NexArt from (seed, vars)

import { supabase } from '@/integrations/supabase/client';
import { PlayerLand, WorldTopology } from './types';
import { Json } from '@/integrations/supabase/types';

// Convert database row to typed PlayerLand
function toPlayerLand(row: {
  player_id: string;
  seed: number;
  vars: number[];
  pos_x: number;
  pos_y: number;
  mapping_version: string;
  micro_overrides: Json | null;
  created_at: string;
  updated_at: string;
  display_name: string | null;
  presence_ping_at: string | null;
}): PlayerLand {
  return {
    player_id: row.player_id,
    seed: row.seed,
    vars: row.vars,
    pos_x: row.pos_x,
    pos_y: row.pos_y,
    mapping_version: (row.mapping_version === 'v2' ? 'v2' : 'v1') as 'v1' | 'v2',
    micro_overrides: row.micro_overrides as Record<string, number> | null,
    created_at: row.created_at,
    updated_at: row.updated_at
  };
}

// Fetch a single land by player ID
export async function getLandByPlayerId(playerId: string): Promise<PlayerLand | null> {
  const { data, error } = await supabase
    .from('player_lands')
    .select('*')
    .eq('player_id', playerId)
    .maybeSingle();
  
  if (error) {
    console.error('[LandRegistry] Error fetching land:', error);
    return null;
  }
  
  return data ? toPlayerLand(data) : null;
}

// Fetch a land by grid position
export async function getLandAtPosition(x: number, y: number): Promise<PlayerLand | null> {
  const { data, error } = await supabase
    .from('player_lands')
    .select('*')
    .eq('pos_x', x)
    .eq('pos_y', y)
    .maybeSingle();
  
  if (error) {
    console.error('[LandRegistry] Error fetching land at position:', error);
    return null;
  }
  
  return data ? toPlayerLand(data) : null;
}

// Fetch all lands in a bounding box (for loading neighbors)
export async function getLandsInArea(
  minX: number, 
  minY: number, 
  maxX: number, 
  maxY: number
): Promise<PlayerLand[]> {
  const { data, error } = await supabase
    .from('player_lands')
    .select('*')
    .gte('pos_x', minX)
    .lte('pos_x', maxX)
    .gte('pos_y', minY)
    .lte('pos_y', maxY);
  
  if (error) {
    console.error('[LandRegistry] Error fetching lands in area:', error);
    return [];
  }
  
  return data?.map(toPlayerLand) ?? [];
}

// Build world topology from fetched lands
export function buildTopology(lands: PlayerLand[]): WorldTopology {
  const landMap = new Map<string, PlayerLand>();
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  
  for (const land of lands) {
    const key = `${land.pos_x},${land.pos_y}`;
    landMap.set(key, land);
    minX = Math.min(minX, land.pos_x);
    minY = Math.min(minY, land.pos_y);
    maxX = Math.max(maxX, land.pos_x);
    maxY = Math.max(maxY, land.pos_y);
  }
  
  return {
    lands: landMap,
    gridWidth: lands.length > 0 ? maxX - minX + 1 : 0,
    gridHeight: lands.length > 0 ? maxY - minY + 1 : 0
  };
}

// Create a new land for a player
// Default to v2 for new lands to enable enhanced generation
export async function createLand(
  playerId: string,
  seed: number,
  vars: number[],
  posX: number = 0,
  posY: number = 0,
  mappingVersion: 'v1' | 'v2' = 'v2',
  microOverrides?: Record<string, number>
): Promise<PlayerLand | null> {
  // Ensure vars is exactly 10 elements, clamped 0-100
  const normalizedVars = Array(10).fill(0).map((_, i) => 
    Math.max(0, Math.min(100, Math.round(vars[i] ?? 50)))
  );
  
  const { data, error } = await supabase
    .from('player_lands')
    .insert({
      player_id: playerId,
      seed: Math.floor(seed),
      vars: normalizedVars,
      pos_x: posX,
      pos_y: posY,
      mapping_version: mappingVersion,
      micro_overrides: microOverrides ?? null
    })
    .select()
    .single();
  
  if (error) {
    console.error('[LandRegistry] Error creating land:', error);
    return null;
  }
  
  return data ? toPlayerLand(data) : null;
}

// Update an existing land's parameters
export async function updateLand(
  playerId: string,
  updates: Partial<Pick<PlayerLand, 'seed' | 'vars' | 'pos_x' | 'pos_y' | 'mapping_version' | 'micro_overrides'>>
): Promise<PlayerLand | null> {
  const updateData: Record<string, unknown> = {};
  
  if (updates.seed !== undefined) {
    updateData.seed = Math.floor(updates.seed);
  }
  if (updates.vars !== undefined) {
    updateData.vars = Array(10).fill(0).map((_, i) => 
      Math.max(0, Math.min(100, Math.round(updates.vars![i] ?? 50)))
    );
  }
  if (updates.pos_x !== undefined) {
    updateData.pos_x = updates.pos_x;
  }
  if (updates.pos_y !== undefined) {
    updateData.pos_y = updates.pos_y;
  }
  if (updates.mapping_version !== undefined) {
    updateData.mapping_version = updates.mapping_version;
  }
  if (updates.micro_overrides !== undefined) {
    updateData.micro_overrides = updates.micro_overrides;
  }
  
  const { data, error } = await supabase
    .from('player_lands')
    .update(updateData)
    .eq('player_id', playerId)
    .select()
    .single();
  
  if (error) {
    console.error('[LandRegistry] Error updating land:', error);
    return null;
  }
  
  return data ? toPlayerLand(data) : null;
}

// World A bounds (10×10 grid)
const WORLD_A_MIN = 0;
const WORLD_A_MAX = 9;

// Clamp position to World A bounds
export function clampToWorldA(x: number, y: number): { x: number; y: number } {
  return {
    x: Math.max(WORLD_A_MIN, Math.min(WORLD_A_MAX, Math.floor(x))),
    y: Math.max(WORLD_A_MIN, Math.min(WORLD_A_MAX, Math.floor(y)))
  };
}

// Check if position is within World A bounds
export function isWithinWorldA(x: number, y: number): boolean {
  return x >= WORLD_A_MIN && x <= WORLD_A_MAX && y >= WORLD_A_MIN && y <= WORLD_A_MAX;
}

// Find an unoccupied grid position for a new land (constrained to World A: 0-9)
export async function findAvailablePosition(): Promise<{ x: number; y: number }> {
  // Fetch all existing lands within World A bounds
  const { data: lands } = await supabase
    .from('player_lands')
    .select('pos_x, pos_y')
    .gte('pos_x', WORLD_A_MIN)
    .lte('pos_x', WORLD_A_MAX)
    .gte('pos_y', WORLD_A_MIN)
    .lte('pos_y', WORLD_A_MAX);
  
  if (!lands || lands.length === 0) {
    return { x: 5, y: 5 };  // Start near center of World A
  }
  
  const occupied = new Set(lands.map(l => `${l.pos_x},${l.pos_y}`));
  
  // Spiral outward from center (5,5) to find first available slot within bounds
  const centerX = 5, centerY = 5;
  let x = centerX, y = centerY;
  let dx = 1, dy = 0;
  let segmentLength = 1, segmentPassed = 0;
  
  // Check all 100 positions in World A
  for (let i = 0; i < 100; i++) {
    // Only consider positions within World A bounds
    if (isWithinWorldA(x, y) && !occupied.has(`${x},${y}`)) {
      return { x, y };
    }
    
    x += dx;
    y += dy;
    segmentPassed++;
    
    if (segmentPassed === segmentLength) {
      segmentPassed = 0;
      const temp = dx;
      dx = -dy;
      dy = temp;
      
      if (dy === 0) {
        segmentLength++;
      }
    }
  }
  
  // Fallback: linear scan for any available position
  for (let fy = WORLD_A_MIN; fy <= WORLD_A_MAX; fy++) {
    for (let fx = WORLD_A_MIN; fx <= WORLD_A_MAX; fx++) {
      if (!occupied.has(`${fx},${fy}`)) {
        return { x: fx, y: fy };
      }
    }
  }
  
  // World A is full - return center anyway (will fail on insert)
  console.warn('[LandRegistry] World A is full (100/100 lands claimed)');
  return { x: centerX, y: centerY };
}

// Subscribe to land changes (for real-time multiplayer)
export function subscribeLandChanges(
  onLandUpdated: (land: PlayerLand) => void
): () => void {
  const channel = supabase
    .channel('land-changes')
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'player_lands'
      },
      (payload) => {
        if (payload.new) {
          onLandUpdated(payload.new as PlayerLand);
        }
      }
    )
    .subscribe();
  
  return () => {
    supabase.removeChannel(channel);
  };
}
