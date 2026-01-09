// Social Registry - CRUD for social features
// Trails, Notes, Features, and Presence

import { supabase } from '@/integrations/supabase/client';

// ============= Types =============

export interface LandTrail {
  id: string;
  from_world_x: number;
  from_world_y: number;
  to_world_x: number;
  to_world_y: number;
  player_id: string | null;
  created_at: string;
}

export interface LandNote {
  id: string;
  world_x: number;
  world_y: number;
  author_id: string | null;
  message: string;
  created_at: string;
}

export interface WorldFeature {
  id: string;
  world_x: number;
  world_y: number;
  feature_type: string;
  name: string;
  named_by: string | null;
  created_at: string;
}

export interface LandPresence {
  display_name: string | null;
  presence_ping_at: string | null;
}

// ============= Presence =============

// Update presence ping when entering a land
export async function pingPresence(playerId: string): Promise<void> {
  const { error } = await supabase
    .from('player_lands')
    .update({ presence_ping_at: new Date().toISOString() })
    .eq('player_id', playerId);
  
  if (error) {
    console.error('[SocialRegistry] Error pinging presence:', error);
  }
}

// Update display name
export async function updateDisplayName(playerId: string, displayName: string): Promise<boolean> {
  const { error } = await supabase
    .from('player_lands')
    .update({ display_name: displayName.slice(0, 50) })
    .eq('player_id', playerId);
  
  if (error) {
    console.error('[SocialRegistry] Error updating display name:', error);
    return false;
  }
  return true;
}

// Get presence info for a land
export async function getLandPresence(x: number, y: number): Promise<LandPresence | null> {
  const { data, error } = await supabase
    .from('player_lands')
    .select('display_name, presence_ping_at')
    .eq('pos_x', x)
    .eq('pos_y', y)
    .maybeSingle();
  
  if (error) {
    console.error('[SocialRegistry] Error fetching presence:', error);
    return null;
  }
  
  return data;
}

// ============= Trails =============

// Record an edge crossing (with rate limiting)
let lastTrailTime = 0;
const TRAIL_COOLDOWN_MS = 60000; // 1 minute between same-edge trails

export async function recordTrail(
  playerId: string,
  fromX: number,
  fromY: number,
  toX: number,
  toY: number
): Promise<boolean> {
  const now = Date.now();
  if (now - lastTrailTime < TRAIL_COOLDOWN_MS) {
    return false; // Rate limited
  }
  
  const { error } = await supabase
    .from('land_trails')
    .insert({
      from_world_x: fromX,
      from_world_y: fromY,
      to_world_x: toX,
      to_world_y: toY,
      player_id: playerId
    });
  
  if (error) {
    console.error('[SocialRegistry] Error recording trail:', error);
    return false;
  }
  
  lastTrailTime = now;
  return true;
}

// Get trails at edges of a land (both directions)
export async function getTrailsForLand(x: number, y: number): Promise<LandTrail[]> {
  const { data, error } = await supabase
    .from('land_trails')
    .select('*')
    .or(`and(from_world_x.eq.${x},from_world_y.eq.${y}),and(to_world_x.eq.${x},to_world_y.eq.${y})`)
    .order('created_at', { ascending: false })
    .limit(50);
  
  if (error) {
    console.error('[SocialRegistry] Error fetching trails:', error);
    return [];
  }
  
  return data ?? [];
}

// Get trail counts per edge direction for a land
export async function getTrailCounts(x: number, y: number): Promise<{
  north: number;
  south: number;
  east: number;
  west: number;
}> {
  const trails = await getTrailsForLand(x, y);
  
  const counts = { north: 0, south: 0, east: 0, west: 0 };
  
  for (const trail of trails) {
    // Determine direction relative to this land
    if (trail.from_world_x === x && trail.from_world_y === y) {
      // Outgoing trails
      if (trail.to_world_y < y) counts.north++;
      else if (trail.to_world_y > y) counts.south++;
      else if (trail.to_world_x > x) counts.east++;
      else if (trail.to_world_x < x) counts.west++;
    } else {
      // Incoming trails
      if (trail.from_world_y < y) counts.north++;
      else if (trail.from_world_y > y) counts.south++;
      else if (trail.from_world_x > x) counts.east++;
      else if (trail.from_world_x < x) counts.west++;
    }
  }
  
  return counts;
}

// ============= Notes =============

// Create or update a note on a land
export async function setLandNote(
  playerId: string,
  x: number,
  y: number,
  message: string
): Promise<LandNote | null> {
  // Upsert - create if doesn't exist, update if does
  const { data, error } = await supabase
    .from('land_notes')
    .upsert({
      world_x: x,
      world_y: y,
      author_id: playerId,
      message: message.slice(0, 140)
    }, {
      onConflict: 'world_x,world_y,author_id'
    })
    .select()
    .single();
  
  if (error) {
    console.error('[SocialRegistry] Error setting note:', error);
    return null;
  }
  
  return data;
}

// Get all notes for a land
export async function getNotesForLand(x: number, y: number): Promise<LandNote[]> {
  const { data, error } = await supabase
    .from('land_notes')
    .select('*')
    .eq('world_x', x)
    .eq('world_y', y)
    .order('created_at', { ascending: false });
  
  if (error) {
    console.error('[SocialRegistry] Error fetching notes:', error);
    return [];
  }
  
  return data ?? [];
}

// Delete a note
export async function deleteNote(playerId: string, noteId: string): Promise<boolean> {
  const { error } = await supabase
    .from('land_notes')
    .delete()
    .eq('id', noteId)
    .eq('author_id', playerId);
  
  if (error) {
    console.error('[SocialRegistry] Error deleting note:', error);
    return false;
  }
  
  return true;
}

// ============= World Features (Naming) =============

// Name a world feature (one-time only)
export async function nameFeature(
  playerId: string,
  x: number,
  y: number,
  featureType: string,
  name: string
): Promise<WorldFeature | null> {
  const { data, error } = await supabase
    .from('world_features')
    .insert({
      world_x: x,
      world_y: y,
      feature_type: featureType,
      name: name.slice(0, 50),
      named_by: playerId
    })
    .select()
    .single();
  
  if (error) {
    // Likely already named (unique constraint)
    console.error('[SocialRegistry] Error naming feature:', error);
    return null;
  }
  
  return data;
}

// Get features for a land
export async function getFeaturesForLand(x: number, y: number): Promise<WorldFeature[]> {
  const { data, error } = await supabase
    .from('world_features')
    .select('*')
    .eq('world_x', x)
    .eq('world_y', y);
  
  if (error) {
    console.error('[SocialRegistry] Error fetching features:', error);
    return [];
  }
  
  return data ?? [];
}

// Get all named features in World A
export async function getAllFeatures(): Promise<WorldFeature[]> {
  const { data, error } = await supabase
    .from('world_features')
    .select('*')
    .gte('world_x', 0)
    .lte('world_x', 9)
    .gte('world_y', 0)
    .lte('world_y', 9);
  
  if (error) {
    console.error('[SocialRegistry] Error fetching all features:', error);
    return [];
  }
  
  return data ?? [];
}

// ============= Real-time Subscriptions =============

export function subscribeToTrails(
  onTrail: (trail: LandTrail) => void
): () => void {
  const channel = supabase
    .channel('trail-changes')
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'land_trails'
      },
      (payload) => {
        if (payload.new) {
          onTrail(payload.new as LandTrail);
        }
      }
    )
    .subscribe();
  
  return () => {
    supabase.removeChannel(channel);
  };
}

export function subscribeToNotes(
  onNote: (note: LandNote, event: 'INSERT' | 'UPDATE' | 'DELETE') => void
): () => void {
  const channel = supabase
    .channel('note-changes')
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'land_notes'
      },
      (payload) => {
        const event = payload.eventType.toUpperCase() as 'INSERT' | 'UPDATE' | 'DELETE';
        const note = (payload.new || payload.old) as LandNote;
        if (note) {
          onNote(note, event);
        }
      }
    )
    .subscribe();
  
  return () => {
    supabase.removeChannel(channel);
  };
}
