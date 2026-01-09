// Multiplayer World Hook
// Manages the deterministic world loading and edge transitions

import { useState, useEffect, useCallback, useMemo } from 'react';
import { PlayerLand, LAND_GRID_SIZE } from '@/lib/multiplayer/types';
import { 
  getLandByPlayerId, 
  getLandAtPosition,
  getLandsInArea,
  createLand, 
  findAvailablePosition,
  subscribeLandChanges
} from '@/lib/multiplayer/landRegistry';
import { useNexArtWorld } from './useNexArtWorld';
import { useEdgeTransition } from './useEdgeTransition';

interface MultiplayerWorldState {
  playerId: string | null;
  currentLand: PlayerLand | null;
  neighborLands: PlayerLand[];
  playerPosition: { x: number; z: number };
  isLoading: boolean;
  error: string | null;
  isVisitingOtherLand: boolean; // True when on someone else's land
}

interface UseMultiplayerWorldOptions {
  initialPlayerId?: string;
  autoCreate?: boolean;  // Auto-create land if player doesn't have one
}

export function useMultiplayerWorld(options: UseMultiplayerWorldOptions = {}) {
  const [state, setState] = useState<MultiplayerWorldState>({
    playerId: options.initialPlayerId ?? null,
    currentLand: null,
    neighborLands: [],
    playerPosition: { x: LAND_GRID_SIZE / 2, z: LAND_GRID_SIZE / 2 },
    isLoading: true,
    error: null,
    isVisitingOtherLand: false
  });
  
  // Generate world from current land's parameters
  const worldParams = useMemo(() => ({
    seed: state.currentLand?.seed ?? 0,
    vars: state.currentLand?.vars ?? [50, 50, 50, 50, 50, 50, 50, 50, 50, 50]
  }), [state.currentLand?.seed, state.currentLand?.vars]);
  
  const { 
    world, 
    isLoading: isWorldLoading, 
    isVerifying,
    error: worldError,
    forceRegenerate 
  } = useNexArtWorld(worldParams);
  
  // Edge transition handling
  const handleTransitionComplete = useCallback((
    newLand: PlayerLand | null,
    entryPosition: { x: number; z: number }
  ) => {
    if (newLand) {
      setState(prev => ({
        ...prev,
        currentLand: newLand,
        playerPosition: entryPosition
      }));
      // Force regenerate world with new land's parameters
      forceRegenerate();
    } else {
      // No land at edge - push player back
      setState(prev => ({
        ...prev,
        playerPosition: {
          x: Math.max(2, Math.min(LAND_GRID_SIZE - 2, prev.playerPosition.x)),
          z: Math.max(2, Math.min(LAND_GRID_SIZE - 2, prev.playerPosition.z))
        }
      }));
    }
  }, [forceRegenerate]);
  
  const edgeTransition = useEdgeTransition({
    onTransitionComplete: handleTransitionComplete,
    onTransitionFailed: (error) => {
      console.error('[MultiplayerWorld] Transition failed:', error);
    }
  });
  
  // Sync edge transition with current land
  useEffect(() => {
    edgeTransition.setCurrentLand(state.currentLand);
  }, [state.currentLand, edgeTransition]);
  
  // Load or create player's land
  const initializePlayerLand = useCallback(async (playerId?: string) => {
    setState(prev => ({ ...prev, isLoading: true, error: null }));
    
    try {
      let land: PlayerLand | null = null;
      
      if (playerId) {
        // Try to fetch existing land
        land = await getLandByPlayerId(playerId);
      }
      
      if (!land && options.autoCreate) {
        // Create new land with random parameters
        const position = await findAvailablePosition();
        const randomSeed = Math.floor(Math.random() * 100000);
        const randomVars = Array(10).fill(0).map(() => Math.floor(Math.random() * 100));
        
        land = await createLand(randomSeed, randomVars, position.x, position.y);
      }
      
      if (land) {
        // Load neighbor lands for edge transitions
        const neighbors = await getLandsInArea(
          land.pos_x - 1, land.pos_y - 1,
          land.pos_x + 1, land.pos_y + 1
        );
        
        setState(prev => ({
          ...prev,
          playerId: land!.player_id,
          currentLand: land,
          neighborLands: neighbors.filter(n => n.player_id !== land!.player_id),
          playerPosition: { x: LAND_GRID_SIZE / 2, z: LAND_GRID_SIZE / 2 },
          isLoading: false
        }));
      } else {
        setState(prev => ({
          ...prev,
          isLoading: false,
          error: 'No land found'
        }));
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to initialize';
      setState(prev => ({ ...prev, isLoading: false, error: message }));
    }
  }, [options.autoCreate]);
  
  // Visit another player's land
  const visitLand = useCallback(async (landX: number, landY: number) => {
    setState(prev => ({ ...prev, isLoading: true }));
    
    const land = await getLandAtPosition(landX, landY);
    if (land) {
      await edgeTransition.transitionToLand(land);
      
      // Load new neighbors
      const neighbors = await getLandsInArea(
        land.pos_x - 1, land.pos_y - 1,
        land.pos_x + 1, land.pos_y + 1
      );
      
      setState(prev => ({
        ...prev,
        currentLand: land,
        neighborLands: neighbors.filter(n => n.player_id !== land.player_id),
        playerPosition: { x: LAND_GRID_SIZE / 2, z: LAND_GRID_SIZE / 2 },
        isLoading: false,
        isVisitingOtherLand: land.player_id !== prev.playerId // Check if we're visiting someone else
      }));
    } else {
      setState(prev => ({ ...prev, isLoading: false, error: 'Land not found' }));
    }
  }, [edgeTransition]);
  
  // Update player position and check for edge crossings
  const updatePlayerPosition = useCallback((x: number, z: number) => {
    setState(prev => ({ ...prev, playerPosition: { x, z } }));
    edgeTransition.handlePositionUpdate(x, z);
  }, [edgeTransition]);
  
  // Subscribe to real-time land updates
  useEffect(() => {
    const unsubscribe = subscribeLandChanges((updatedLand) => {
      setState(prev => {
        // Update current land if it changed
        if (prev.currentLand?.player_id === updatedLand.player_id) {
          return { ...prev, currentLand: updatedLand };
        }
        // Update neighbor list if a neighbor changed
        const updatedNeighbors = prev.neighborLands.map(n =>
          n.player_id === updatedLand.player_id ? updatedLand : n
        );
        return { ...prev, neighborLands: updatedNeighbors };
      });
    });
    
    return unsubscribe;
  }, []);
  
  return {
    // State
    playerId: state.playerId,
    currentLand: state.currentLand,
    neighborLands: state.neighborLands,
    playerPosition: state.playerPosition,
    isVisitingOtherLand: state.isVisitingOtherLand,
    
    // World data (from NexArt)
    world,
    
    // Loading states
    isLoading: state.isLoading || isWorldLoading,
    isVerifying,
    isTransitioning: edgeTransition.isTransitioning,
    
    // Errors
    error: state.error || worldError,
    
    // Actions
    initializePlayerLand,
    visitLand,
    updatePlayerPosition,
    forceRegenerate
  };
}
