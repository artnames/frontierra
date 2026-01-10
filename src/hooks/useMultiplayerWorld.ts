// Multiplayer World Hook
// Manages the deterministic world loading and edge transitions
// Integrates with World A shared macro geography via worldContext
// Uses deterministic neighbor preloading for seamless transitions

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { PlayerLand, LAND_GRID_SIZE, WORLD_A_GRID_WIDTH, WORLD_A_GRID_HEIGHT, EdgeCrossing, getNeighborPosition } from '@/lib/multiplayer/types';
import { 
  getLandByPlayerId, 
  getLandAtPosition,
  getLandsInArea,
  createLand, 
  findAvailablePosition,
  subscribeLandChanges,
  updateLand
} from '@/lib/multiplayer/landRegistry';
import { useNexArtWorld } from './useNexArtWorld';
import { useEdgeTransition } from './useEdgeTransition';
import { createWorldContext, WorldContext } from '@/lib/worldContext';
import { 
  getCachedWorld, 
  cacheWorld, 
  ensureWorldReady
} from '@/lib/worldCache';
import { WorldData, isWorldValid } from '@/lib/worldData';

interface MultiplayerWorldState {
  playerId: string | null;
  currentLand: PlayerLand | null;
  neighborLands: PlayerLand[];
  playerPosition: { x: number; z: number };
  isLoading: boolean;
  error: string | null;
  isVisitingOtherLand: boolean;
  unclaimedAttempt: {
    direction: string;
    gridPosition: { x: number; y: number };
  } | null;
  // Cached world for instant transitions
  cachedWorld: WorldData | null;
}

interface UseMultiplayerWorldOptions {
  initialPlayerId?: string;
  autoCreate?: boolean;
  onLandTransition?: (entryPosition: { x: number; z: number }) => void;
}

// Neighbor params cache for preloading
const neighborParamsCache = new Map<string, { seed: number; vars: number[] } | null>();

export function useMultiplayerWorld(options: UseMultiplayerWorldOptions = {}) {
  const [state, setState] = useState<MultiplayerWorldState>({
    playerId: options.initialPlayerId ?? null,
    currentLand: null,
    neighborLands: [],
    playerPosition: { x: LAND_GRID_SIZE / 2, z: LAND_GRID_SIZE / 2 },
    isLoading: true,
    error: null,
    isVisitingOtherLand: false,
    unclaimedAttempt: null,
    cachedWorld: null
  });

  const latestPositionRef = useRef<{ x: number; z: number }>({
    x: LAND_GRID_SIZE / 2,
    z: LAND_GRID_SIZE / 2
  });
  
  useEffect(() => {
    if (options.initialPlayerId && options.initialPlayerId !== state.playerId) {
      setState(prev => ({ ...prev, playerId: options.initialPlayerId! }));
    }
  }, [options.initialPlayerId, state.playerId]);
  
  const worldContext = useMemo<{ worldX: number; worldY: number } | undefined>(() => {
    if (!state.currentLand) return undefined;
    const ctx = createWorldContext(state.currentLand.pos_x, state.currentLand.pos_y);
    return { worldX: ctx.worldX, worldY: ctx.worldY };
  }, [state.currentLand?.pos_x, state.currentLand?.pos_y]);
  
  const worldParams = useMemo(() => ({
    seed: state.currentLand?.seed ?? 0,
    vars: state.currentLand?.vars ?? [50, 50, 50, 50, 50, 50, 50, 50, 50, 50]
  }), [state.currentLand?.seed, state.currentLand?.vars]);
  
  const { 
    world: generatedWorld, 
    isLoading: isWorldLoading, 
    isVerifying,
    error: worldError,
    forceRegenerate 
  } = useNexArtWorld({
    ...worldParams,
    worldContext
  });
  
  // Use cached world if available for instant transitions, otherwise use generated
  const world = state.cachedWorld ?? generatedWorld;
  
  // Cache the generated world when ready
  useEffect(() => {
    if (generatedWorld && isWorldValid(generatedWorld) && state.currentLand) {
      cacheWorld(
        state.currentLand.pos_x, 
        state.currentLand.pos_y, 
        generatedWorld, 
        state.currentLand.seed, 
        state.currentLand.vars
      );
      // Clear cachedWorld once authoritative generated world is ready
      if (state.cachedWorld) {
        setState(prev => ({ ...prev, cachedWorld: null }));
      }
    }
  }, [generatedWorld, state.currentLand, state.cachedWorld]);
  
  // Preload neighbors when current land changes
  useEffect(() => {
    if (!state.currentLand) return;
    
    const { pos_x, pos_y } = state.currentLand;
    
    const prefetchNeighbors = async () => {
      const directions = [
        { dx: 0, dy: -1 }, // north
        { dx: 0, dy: 1 },  // south
        { dx: 1, dy: 0 },  // east
        { dx: -1, dy: 0 }  // west
      ];
      
      for (const dir of directions) {
        const nx = pos_x + dir.dx;
        const ny = pos_y + dir.dy;
        const key = `${nx}:${ny}`;
        
        if (!neighborParamsCache.has(key)) {
          const land = await getLandAtPosition(nx, ny);
          if (land) {
            neighborParamsCache.set(key, { seed: land.seed, vars: land.vars });
            // Start preloading this neighbor in background
            ensureWorldReady(nx, ny, land.seed, land.vars).catch(() => {});
          } else {
            neighborParamsCache.set(key, null);
          }
        }
      }
    };
    
    prefetchNeighbors();
  }, [state.currentLand?.pos_x, state.currentLand?.pos_y]);
  
  // Edge transition handling - uses cached worlds for instant transitions
  const handleTransitionComplete = useCallback((
    newLand: PlayerLand | null,
    entryPosition: { x: number; z: number },
    crossing?: EdgeCrossing
  ) => {
    if (newLand) {
      // Try to get cached world for INSTANT transition (no loading pause)
      const cachedWorld = getCachedWorld(
        newLand.pos_x, 
        newLand.pos_y, 
        newLand.seed, 
        newLand.vars
      );
      
      setState(prev => ({
        ...prev,
        currentLand: newLand,
        playerPosition: entryPosition,
        unclaimedAttempt: null,
        // Use cached world for instant display while regeneration happens
        cachedWorld: cachedWorld ?? null,
        isVisitingOtherLand: prev.playerId ? newLand.player_id !== prev.playerId : false
      }));
      
      // Clear neighbor params cache for new location
      neighborParamsCache.clear();
      
      // Force regenerate to get the authoritative world (will update cache)
      forceRegenerate();
      // Notify parent to reposition camera
      options.onLandTransition?.(entryPosition);
    } else {
      // No land at edge (unclaimed or out of bounds)
      const pushed = {
        x: Math.max(2, Math.min(LAND_GRID_SIZE - 2, latestPositionRef.current.x)),
        z: Math.max(2, Math.min(LAND_GRID_SIZE - 2, latestPositionRef.current.z))
      };

      let unclaimedInfo: MultiplayerWorldState['unclaimedAttempt'] = null;
      if (crossing && state.currentLand) {
        const neighborPos = getNeighborPosition(
          state.currentLand.pos_x,
          state.currentLand.pos_y,
          crossing.direction
        );
        unclaimedInfo = {
          direction: crossing.direction,
          gridPosition: neighborPos
        };
      }

      setState(prev => ({ 
        ...prev, 
        playerPosition: pushed,
        unclaimedAttempt: unclaimedInfo
      }));
      options.onLandTransition?.(pushed);
    }
  }, [forceRegenerate, options.onLandTransition, state.currentLand]);
  
  const edgeTransition = useEdgeTransition({
    playerId: state.playerId,
    onTransitionComplete: handleTransitionComplete,
    onTransitionFailed: (error) => {
      console.error('[MultiplayerWorld] Transition failed:', error);
    }
  });
  
  useEffect(() => {
    edgeTransition.setCurrentLand(state.currentLand);
  }, [state.currentLand, edgeTransition.setCurrentLand]);
  
  const initializePlayerLand = useCallback(async (playerId?: string) => {
    if (!playerId) {
      setState(prev => ({ ...prev, isLoading: false, error: 'No player ID provided' }));
      return;
    }
    
    setState(prev => ({ ...prev, isLoading: true, error: null }));
    
    try {
      let land: PlayerLand | null = null;
      land = await getLandByPlayerId(playerId);
      
      if (!land && options.autoCreate) {
        const position = await findAvailablePosition();
        const randomSeed = Math.floor(Math.random() * 100000);
        const randomVars = Array(10).fill(0).map(() => Math.floor(Math.random() * 100));
        land = await createLand(playerId, randomSeed, randomVars, position.x, position.y);
      }
      
      if (land) {
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
          isLoading: false,
          isVisitingOtherLand: false
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
  
  const visitLand = useCallback(async (landX: number, landY: number) => {
    setState(prev => ({ ...prev, isLoading: true }));
    
    const land = await getLandAtPosition(landX, landY);
    if (land) {
      // Try to get cached world for instant transition
      const cached = getCachedWorld(landX, landY, land.seed, land.vars);
      
      await edgeTransition.transitionToLand(land);
      
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
        isVisitingOtherLand: land.player_id !== prev.playerId,
        cachedWorld: cached ?? null
      }));
    } else {
      setState(prev => ({ ...prev, isLoading: false, error: 'Land not found' }));
    }
  }, [edgeTransition]);
  
  const updatePlayerPosition = useCallback((x: number, z: number) => {
    latestPositionRef.current = { x, z };
    setState(prev => ({ ...prev, playerPosition: { x, z } }));
    edgeTransition.handlePositionUpdate(x, z);
  }, [edgeTransition]);
  
  const updateLandParams = useCallback(async (updates: { seed?: number; vars?: number[] }) => {
    const playerId = state.playerId || options.initialPlayerId;
    
    if (!playerId || !state.currentLand) {
      console.warn('[MultiplayerWorld] Cannot update: no playerId or currentLand');
      return;
    }
    
    const isOwner = state.currentLand.player_id === playerId;
    if (!isOwner) {
      console.warn('[MultiplayerWorld] Cannot update parameters on someone else\'s land');
      return;
    }
    
    const updatedLand = await updateLand(playerId, updates);
    if (updatedLand) {
      setState(prev => ({ ...prev, currentLand: updatedLand }));
      forceRegenerate();
    }
  }, [state.playerId, state.currentLand, options.initialPlayerId, forceRegenerate]);
  
  useEffect(() => {
    const unsubscribe = subscribeLandChanges((updatedLand) => {
      setState(prev => {
        if (prev.currentLand?.player_id === updatedLand.player_id) {
          return { ...prev, currentLand: updatedLand };
        }
        const updatedNeighbors = prev.neighborLands.map(n =>
          n.player_id === updatedLand.player_id ? updatedLand : n
        );
        return { ...prev, neighborLands: updatedNeighbors };
      });
    });
    
    return unsubscribe;
  }, []);
  
  const dismissUnclaimedAttempt = useCallback(() => {
    setState(prev => ({ ...prev, unclaimedAttempt: null }));
  }, []);

  return {
    playerId: state.playerId,
    currentLand: state.currentLand,
    neighborLands: state.neighborLands,
    playerPosition: state.playerPosition,
    isVisitingOtherLand: state.isVisitingOtherLand,
    unclaimedAttempt: state.unclaimedAttempt,
    worldContext,
    world,
    isLoading: state.isLoading || isWorldLoading,
    isVerifying,
    isTransitioning: edgeTransition.isTransitioning,
    error: state.error || worldError,
    initializePlayerLand,
    visitLand,
    updatePlayerPosition,
    updateLandParams,
    forceRegenerate,
    dismissUnclaimedAttempt
  };
}
