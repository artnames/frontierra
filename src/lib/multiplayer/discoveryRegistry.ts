// Discovery Registry
// Handles discovery minigame logic: tracking discoveries, awarding points, daily cooldowns

import { supabase } from '@/integrations/supabase/client';

export interface DiscoveryLog {
  id: string;
  discoverer_id: string;
  land_x: number;
  land_y: number;
  discovered_at: string;
}

export interface DiscoveryResult {
  success: boolean;
  pointsAwarded: number;
  message: string;
  isOnCooldown: boolean;
  cooldownEndsAt?: Date;
}

// Check if a discovery is on cooldown (same calendar day in UTC)
function isSameDay(date1: Date, date2: Date): boolean {
  return (
    date1.getUTCFullYear() === date2.getUTCFullYear() &&
    date1.getUTCMonth() === date2.getUTCMonth() &&
    date1.getUTCDate() === date2.getUTCDate()
  );
}

// Get start of next UTC day
function getNextDayStart(date: Date): Date {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + 1);
  next.setUTCHours(0, 0, 0, 0);
  return next;
}

// Check if player can discover a land (not on cooldown)
export async function canDiscoverLand(
  playerId: string,
  landX: number,
  landY: number
): Promise<{ canDiscover: boolean; cooldownEndsAt?: Date }> {
  const { data, error } = await supabase
    .from('discovery_log')
    .select('discovered_at')
    .eq('discoverer_id', playerId)
    .eq('land_x', landX)
    .eq('land_y', landY)
    .maybeSingle();

  if (error) {
    console.error('Error checking discovery cooldown:', error);
    return { canDiscover: true }; // Allow discovery on error
  }

  if (!data) {
    // Never discovered this land
    return { canDiscover: true };
  }

  const discoveredAt = new Date(data.discovered_at);
  const now = new Date();

  if (isSameDay(discoveredAt, now)) {
    // Same day - on cooldown
    return {
      canDiscover: false,
      cooldownEndsAt: getNextDayStart(now)
    };
  }

  // Different day - can discover again
  return { canDiscover: true };
}

// Record a discovery and award points
export async function recordDiscovery(
  playerId: string,
  landX: number,
  landY: number,
  landOwnerId: string
): Promise<DiscoveryResult> {
  // Don't allow discovering your own land
  if (playerId === landOwnerId) {
    return {
      success: false,
      pointsAwarded: 0,
      message: "Can't discover your own land",
      isOnCooldown: false
    };
  }

  // Check cooldown
  const { canDiscover, cooldownEndsAt } = await canDiscoverLand(playerId, landX, landY);
  
  if (!canDiscover) {
    return {
      success: false,
      pointsAwarded: 0,
      message: 'Already discovered today',
      isOnCooldown: true,
      cooldownEndsAt
    };
  }

  // Upsert discovery log (update timestamp if exists, insert if not)
  const { error: logError } = await supabase
    .from('discovery_log')
    .upsert(
      {
        discoverer_id: playerId,
        land_x: landX,
        land_y: landY,
        discovered_at: new Date().toISOString()
      },
      {
        onConflict: 'discoverer_id,land_x,land_y'
      }
    );

  if (logError) {
    console.error('Error recording discovery:', logError);
    return {
      success: false,
      pointsAwarded: 0,
      message: 'Failed to record discovery',
      isOnCooldown: false
    };
  }

  // Award point to discoverer - direct increment
  {
    // Fallback: direct increment
    const { data: currentLand } = await supabase
      .from('player_lands')
      .select('discovery_points')
      .eq('player_id', playerId)
      .single();

    if (currentLand) {
      await supabase
        .from('player_lands')
        .update({ discovery_points: (currentLand.discovery_points || 0) + 1 })
        .eq('player_id', playerId);
    }
  }

  return {
    success: true,
    pointsAwarded: 1,
    message: 'Discovery! +1 point',
    isOnCooldown: false
  };
}

// Get player's discovery points
export async function getDiscoveryPoints(playerId: string): Promise<number> {
  const { data, error } = await supabase
    .from('player_lands')
    .select('discovery_points')
    .eq('player_id', playerId)
    .single();

  if (error || !data) {
    return 0;
  }

  return data.discovery_points || 0;
}

// Get discovery leaderboard
export async function getDiscoveryLeaderboard(limit: number = 10): Promise<Array<{
  player_id: string;
  display_name: string | null;
  discovery_points: number;
  pos_x: number;
  pos_y: number;
}>> {
  const { data, error } = await supabase
    .from('player_lands')
    .select('player_id, display_name, discovery_points, pos_x, pos_y')
    .order('discovery_points', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('Error fetching leaderboard:', error);
    return [];
  }

  return data || [];
}

// Get all discoveries made by a player
export async function getPlayerDiscoveries(playerId: string): Promise<DiscoveryLog[]> {
  const { data, error } = await supabase
    .from('discovery_log')
    .select('*')
    .eq('discoverer_id', playerId)
    .order('discovered_at', { ascending: false });

  if (error) {
    console.error('Error fetching player discoveries:', error);
    return [];
  }

  return data || [];
}

// Check which lands the player can still discover today
export async function getDiscoverableLands(
  playerId: string,
  lands: Array<{ x: number; y: number; ownerId: string }>
): Promise<Array<{ x: number; y: number; canDiscover: boolean }>> {
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);

  const { data: todayDiscoveries, error } = await supabase
    .from('discovery_log')
    .select('land_x, land_y')
    .eq('discoverer_id', playerId)
    .gte('discovered_at', today.toISOString());

  if (error) {
    console.error('Error fetching today discoveries:', error);
    return lands.map(l => ({ x: l.x, y: l.y, canDiscover: l.ownerId !== playerId }));
  }

  const discoveredToday = new Set(
    (todayDiscoveries || []).map(d => `${d.land_x},${d.land_y}`)
  );

  return lands.map(land => ({
    x: land.x,
    y: land.y,
    canDiscover: land.ownerId !== playerId && !discoveredToday.has(`${land.x},${land.y}`)
  }));
}
