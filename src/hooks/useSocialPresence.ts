// Social Presence Hook
// Manages presence pings, trails recording, and social signals

import { useState, useEffect, useCallback, useRef } from 'react';
import { PlayerLand } from '@/lib/multiplayer/types';
import {
  pingPresence,
  recordTrail,
  getTrailCounts,
  getLandPresence,
  LandPresence,
  subscribeToTrails,
  LandTrail
} from '@/lib/multiplayer/socialRegistry';

interface UseSocialPresenceOptions {
  playerId: string | null;
  currentLand: PlayerLand | null;
  enabled?: boolean;
}

export function useSocialPresence({
  playerId,
  currentLand,
  enabled = true
}: UseSocialPresenceOptions) {
  const [landPresence, setLandPresence] = useState<LandPresence | null>(null);
  const [trailCounts, setTrailCounts] = useState<{
    north: number;
    south: number;
    east: number;
    west: number;
  }>({ north: 0, south: 0, east: 0, west: 0 });
  const [recentTrails, setRecentTrails] = useState<LandTrail[]>([]);
  
  const lastPingRef = useRef<number>(0);
  const lastLandRef = useRef<{ x: number; y: number } | null>(null);
  const PING_COOLDOWN = 10000; // 10 seconds

  // Ping presence when entering a land
  const doPing = useCallback(async () => {
    if (!playerId || !enabled) return;
    
    const now = Date.now();
    if (now - lastPingRef.current < PING_COOLDOWN) return;
    
    lastPingRef.current = now;
    await pingPresence(playerId);
  }, [playerId, enabled]);

  // Record trail when crossing between lands
  const handleEdgeCrossing = useCallback(async (
    fromX: number,
    fromY: number,
    toX: number,
    toY: number
  ) => {
    if (!playerId || !enabled) return;
    await recordTrail(playerId, fromX, fromY, toX, toY);
  }, [playerId, enabled]);

  // Fetch land presence and trails when land changes
  useEffect(() => {
    if (!currentLand || !enabled) return;

    const prevLand = lastLandRef.current;
    const newLand = { x: currentLand.pos_x, y: currentLand.pos_y };
    
    // Record trail if we crossed from another land
    if (prevLand && (prevLand.x !== newLand.x || prevLand.y !== newLand.y)) {
      handleEdgeCrossing(prevLand.x, prevLand.y, newLand.x, newLand.y);
    }
    
    lastLandRef.current = newLand;
    
    // Fetch presence info
    getLandPresence(currentLand.pos_x, currentLand.pos_y).then(setLandPresence);
    
    // Fetch trail counts
    getTrailCounts(currentLand.pos_x, currentLand.pos_y).then(setTrailCounts);
    
    // Ping presence
    doPing();
  }, [currentLand?.pos_x, currentLand?.pos_y, enabled, doPing, handleEdgeCrossing]);

  // Subscribe to real-time trail updates
  useEffect(() => {
    if (!enabled) return;
    
    const unsubscribe = subscribeToTrails((trail) => {
      // Add to recent trails if it involves current land
      if (currentLand) {
        const isRelevant = (
          (trail.from_world_x === currentLand.pos_x && trail.from_world_y === currentLand.pos_y) ||
          (trail.to_world_x === currentLand.pos_x && trail.to_world_y === currentLand.pos_y)
        );
        
        if (isRelevant) {
          setRecentTrails(prev => [trail, ...prev.slice(0, 9)]);
          // Refresh trail counts
          getTrailCounts(currentLand.pos_x, currentLand.pos_y).then(setTrailCounts);
        }
      }
    });
    
    return unsubscribe;
  }, [enabled, currentLand?.pos_x, currentLand?.pos_y]);

  // Generate presence message
  const presenceMessage = useCallback((): string | null => {
    if (!landPresence) return null;
    
    const { display_name, presence_ping_at } = landPresence;
    
    if (!presence_ping_at) return null;
    
    const pingTime = new Date(presence_ping_at);
    const now = new Date();
    const diffMs = now.getTime() - pingTime.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    
    if (display_name) {
      if (diffMins < 1) {
        return `This land is shaped by ${display_name}.`;
      } else if (diffMins < 60) {
        return `${display_name} passed through ${diffMins} minute${diffMins === 1 ? '' : 's'} ago.`;
      } else {
        return `This land belongs to ${display_name}.`;
      }
    } else {
      if (diffMins < 5) {
        return 'Someone passed through here recently.';
      } else if (diffMins < 60) {
        return `Last presence: ${diffMins} minutes ago.`;
      }
    }
    
    return null;
  }, [landPresence]);

  return {
    landPresence,
    trailCounts,
    recentTrails,
    presenceMessage: presenceMessage(),
    handleEdgeCrossing,
    refreshPresence: doPing
  };
}
