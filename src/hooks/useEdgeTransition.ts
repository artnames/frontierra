// Edge Transition System
// Detects when player crosses land boundaries and triggers world swap
// Records trails for social presence

import { useState, useCallback, useRef } from 'react';
import { 
  PlayerLand, 
  EdgeDirection, 
  EdgeCrossing,
  LAND_GRID_SIZE,
  getNeighborPosition,
  calculateEntryPosition
} from '@/lib/multiplayer/types';
import { getLandAtPosition } from '@/lib/multiplayer/landRegistry';
import { recordTrail } from '@/lib/multiplayer/socialRegistry';
interface EdgeTransitionState {
  isTransitioning: boolean;
  currentLand: PlayerLand | null;
  pendingCrossing: EdgeCrossing | null;
}

interface UseEdgeTransitionOptions {
  playerId?: string | null;
  onTransitionStart?: (crossing: EdgeCrossing) => void;
  onTransitionComplete?: (
    newLand: PlayerLand | null, 
    entryPosition: { x: number; z: number },
    crossing?: EdgeCrossing
  ) => void;
  onTransitionFailed?: (error: string) => void;
}

export function useEdgeTransition(options: UseEdgeTransitionOptions = {}) {
  const [state, setState] = useState<EdgeTransitionState>({
    isTransitioning: false,
    currentLand: null,
    pendingCrossing: null
  });
  
  const transitionLockRef = useRef(false);
  
  // Set the current land context
  const setCurrentLand = useCallback((land: PlayerLand | null) => {
    setState(prev => ({ ...prev, currentLand: land }));
  }, []);
  
  // Check if position is at edge of land
  // Note: We check ALL edges, not just one direction
  const checkEdgeCrossing = useCallback((
    playerX: number,
    playerZ: number,
    landSize: number = LAND_GRID_SIZE
  ): EdgeDirection | null => {
    const margin = 1.0; // Detection margin for crossing
    
    // Check all four edges
    if (playerZ <= margin) return 'north';  // z=0 is north edge
    if (playerZ >= landSize - margin) return 'south';  // z=max is south edge
    if (playerX >= landSize - margin) return 'east';  // x=max is east edge
    if (playerX <= margin) return 'west';  // x=0 is west edge
    
    return null;
  }, []);
  
  // Handle edge crossing detection and trigger transition
  const handlePositionUpdate = useCallback(async (
    playerX: number,
    playerZ: number
  ) => {
    // Skip if already transitioning or no current land
    if (transitionLockRef.current || !state.currentLand) {
      return;
    }
    
    const edgeDirection = checkEdgeCrossing(playerX, playerZ);
    if (!edgeDirection) {
      return;
    }
    
    // Lock to prevent multiple transitions
    transitionLockRef.current = true;
    setState(prev => ({ ...prev, isTransitioning: true }));
    
    try {
      // Get neighbor grid position
      const neighborPos = getNeighborPosition(
        state.currentLand.pos_x,
        state.currentLand.pos_y,
        edgeDirection
      );
      
      // Fetch neighbor land from registry
      const neighborLand = await getLandAtPosition(neighborPos.x, neighborPos.y);
      
      // Calculate entry position on new land
      const entryPosition = calculateEntryPosition(
        { x: playerX, z: playerZ },
        edgeDirection
      );
      
      const crossing: EdgeCrossing = {
        direction: edgeDirection,
        fromLand: state.currentLand,
        toLand: neighborLand,
        entryPosition
      };
      
      setState(prev => ({ ...prev, pendingCrossing: crossing }));
      options.onTransitionStart?.(crossing);
      
      // Record trail for social presence
      if (options.playerId) {
        recordTrail(
          options.playerId,
          state.currentLand.pos_x,
          state.currentLand.pos_y,
          neighborPos.x,
          neighborPos.y
        );
      }
      
      if (neighborLand) {
        // Neighbor exists - transition to their land
        setState(prev => ({
          ...prev,
          currentLand: neighborLand,
          isTransitioning: false,
          pendingCrossing: null
        }));
        options.onTransitionComplete?.(neighborLand, entryPosition, crossing);
      } else {
        // No neighbor - stay at edge or show boundary
        setState(prev => ({
          ...prev,
          isTransitioning: false,
          pendingCrossing: null
        }));
        options.onTransitionComplete?.(null, entryPosition, crossing);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Transition failed';
      console.error('[EdgeTransition] Error:', message);
      options.onTransitionFailed?.(message);
      setState(prev => ({ ...prev, isTransitioning: false, pendingCrossing: null }));
    } finally {
      // Short delay before allowing another transition
      setTimeout(() => {
        transitionLockRef.current = false;
      }, 500);
    }
  }, [state.currentLand, checkEdgeCrossing, options]);
  
  // Force transition to a specific land (for teleportation, etc.)
  const transitionToLand = useCallback(async (
    targetLand: PlayerLand,
    entryPosition?: { x: number; z: number }
  ) => {
    const position = entryPosition ?? { x: LAND_GRID_SIZE / 2, z: LAND_GRID_SIZE / 2 };
    
    setState(prev => ({
      ...prev,
      currentLand: targetLand,
      isTransitioning: false,
      pendingCrossing: null
    }));
    
    options.onTransitionComplete?.(targetLand, position);
  }, [options]);
  
  return {
    currentLand: state.currentLand,
    isTransitioning: state.isTransitioning,
    pendingCrossing: state.pendingCrossing,
    setCurrentLand,
    handlePositionUpdate,
    transitionToLand,
    checkEdgeCrossing
  };
}
