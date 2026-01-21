// Discovery Game Hook
// Manages discovery minigame state and actions
// FIX #5: Properly resets state when land changes
// FIX #12: Auto-updates cooldown UI every second

import { useState, useEffect, useCallback, useRef } from 'react';
import { PlayerLand } from '@/lib/multiplayer/types';
import {
  recordDiscovery,
  getDiscoveryPoints,
  canDiscoverLand,
  DiscoveryResult
} from '@/lib/multiplayer/discoveryRegistry';

interface UseDiscoveryGameOptions {
  playerId: string | null;
  currentLand: PlayerLand | null;
  enabled?: boolean;
}

export function useDiscoveryGame({
  playerId,
  currentLand,
  enabled = true
}: UseDiscoveryGameOptions) {
  const [discoveryPoints, setDiscoveryPoints] = useState(0);
  const [canDiscoverCurrent, setCanDiscoverCurrent] = useState(false);
  const [cooldownEndsAt, setCooldownEndsAt] = useState<Date | null>(null);
  const [lastDiscoveryResult, setLastDiscoveryResult] = useState<DiscoveryResult | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  
  // Track which land we've already checked
  const checkedLandRef = useRef<string | null>(null);

  // Fetch player's discovery points on mount
  useEffect(() => {
    if (!playerId || !enabled) return;
    
    getDiscoveryPoints(playerId).then(setDiscoveryPoints);
  }, [playerId, enabled]);

  // FIX #5: Reset checkedLandRef when land changes to avoid stale state
  useEffect(() => {
    if (!currentLand) {
      checkedLandRef.current = null;
      return;
    }
    
    const landKey = `${currentLand.pos_x},${currentLand.pos_y}`;
    if (checkedLandRef.current !== landKey) {
      checkedLandRef.current = null; // Reset when land changes
    }
  }, [currentLand?.pos_x, currentLand?.pos_y]);

  // Check if we can discover the current land
  useEffect(() => {
    if (!playerId || !currentLand || !enabled) {
      setCanDiscoverCurrent(false);
      setCooldownEndsAt(null);
      return;
    }

    // Don't check if it's your own land
    if (currentLand.player_id === playerId) {
      setCanDiscoverCurrent(false);
      setCooldownEndsAt(null);
      return;
    }

    const landKey = `${currentLand.pos_x},${currentLand.pos_y}`;
    if (checkedLandRef.current === landKey) {
      return; // Already checked this land
    }

    checkedLandRef.current = landKey;

    canDiscoverLand(playerId, currentLand.pos_x, currentLand.pos_y).then(result => {
      setCanDiscoverCurrent(result.canDiscover);
      setCooldownEndsAt(result.cooldownEndsAt || null);
    });
  }, [playerId, currentLand?.pos_x, currentLand?.pos_y, currentLand?.player_id, enabled]);

  // Handle object discovery
  const handleDiscovery = useCallback(async (): Promise<DiscoveryResult | null> => {
    if (!playerId || !currentLand || !enabled || isProcessing) {
      return null;
    }

    // Can't discover your own land
    if (currentLand.player_id === playerId) {
      return null;
    }

    setIsProcessing(true);

    try {
      const result = await recordDiscovery(
        playerId,
        currentLand.pos_x,
        currentLand.pos_y,
        currentLand.player_id
      );

      setLastDiscoveryResult(result);

      if (result.success) {
        // Update local points
        setDiscoveryPoints(prev => prev + result.pointsAwarded);
        // Mark as discovered for this session
        setCanDiscoverCurrent(false);
        setCooldownEndsAt(result.cooldownEndsAt || null);
      } else if (result.isOnCooldown) {
        setCanDiscoverCurrent(false);
        setCooldownEndsAt(result.cooldownEndsAt || null);
      }

      return result;
    } finally {
      setIsProcessing(false);
    }
  }, [playerId, currentLand, enabled, isProcessing]);

  // Reset result after showing
  const clearLastResult = useCallback(() => {
    setLastDiscoveryResult(null);
  }, []);

  // FIX #12: Cooldown time remaining with auto-update
  const [cooldownTimeRemaining, setCooldownTimeRemaining] = useState<string | null>(null);
  
  // Update cooldown time remaining every second when cooldown is active
  useEffect(() => {
    if (!cooldownEndsAt) {
      setCooldownTimeRemaining(null);
      return;
    }
    
    const updateCooldown = () => {
      const now = new Date();
      const diff = cooldownEndsAt.getTime() - now.getTime();
      
      if (diff <= 0) {
        setCooldownTimeRemaining(null);
        setCanDiscoverCurrent(true); // Cooldown expired, can discover again
        return;
      }
      
      const hours = Math.floor(diff / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((diff % (1000 * 60)) / 1000);
      
      if (hours > 0) {
        setCooldownTimeRemaining(`${hours}h ${minutes}m`);
      } else if (minutes > 0) {
        setCooldownTimeRemaining(`${minutes}m ${seconds}s`);
      } else {
        setCooldownTimeRemaining(`${seconds}s`);
      }
    };
    
    // Update immediately
    updateCooldown();
    
    // Update every second
    const interval = setInterval(updateCooldown, 1000);
    return () => clearInterval(interval);
  }, [cooldownEndsAt]);

  return {
    discoveryPoints,
    canDiscoverCurrent,
    cooldownEndsAt,
    cooldownTimeRemaining,
    lastDiscoveryResult,
    isProcessing,
    handleDiscovery,
    clearLastResult
  };
}
