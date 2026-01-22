// Multiplayer World Hook
// Manages land transitions and multiplayer state
// DOES NOT generate worlds internally - Index.tsx owns canonical generation
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
import { useEdgeTransition } from './useEdgeTransition';
import { createWorldContext } from '@/lib/worldContext';
import { 
  getCachedWorld, 
  cacheWorld, 
  ensureWorldReady
} from '@/lib/worldCache';
import { WorldData, isWorldValid } from '@/lib/worldData';
import { LRUCache } from '@/lib/lruCache';

// FIX B: World generation state for race condition prevention
type WorldGenState = 'idle' | 'loading' | 'ready' | 'error';

// Valid micro override index range
const MICRO_OVERRIDE_MIN_INDEX = 10;
const MICRO_OVERRIDE_MAX_INDEX = 23;
const MICRO_OVERRIDE_MIN_VALUE = 0;
const MICRO_OVERRIDE_MAX_VALUE = 100;

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
  // FIX B: Track world generation state explicitly
  worldGenState: WorldGenState;
}

interface UseMultiplayerWorldOptions {
  initialPlayerId?: string;
  autoCreate?: boolean;
  onLandTransition?: (entryPosition: { x: number; z: number }) => void;
  // Callback to trigger regeneration in parent (Index.tsx owns generation)
  onRequestRegenerate?: () => void;
}

// FIX D: Bounded LRU cache for neighbor params (max 100 entries, 10 min TTL)
const neighborParamsCache = new LRUCache<{ seed: number; vars: number[] } | null>(100, 10 * 60 * 1000);

// FIX C: Validate micro_overrides from DB
function validateMicroOverrides(raw: unknown): Map<number, number> | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  
  const result = new Map<number, number>();
  let invalidCount = 0;
  
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    const idx = parseInt(key, 10);
    
    // Validate index range [10..23]
    if (isNaN(idx) || idx < MICRO_OVERRIDE_MIN_INDEX || idx > MICRO_OVERRIDE_MAX_INDEX) {
      invalidCount++;
      continue;
    }
    
    // Validate value is number in range [0..100]
    if (typeof value !== 'number' || value < MICRO_OVERRIDE_MIN_VALUE || value > MICRO_OVERRIDE_MAX_VALUE) {
      invalidCount++;
      continue;
    }
    
    result.set(idx, value);
  }
  
  // Log warning once if there were invalid entries
  if (invalidCount > 0) {
    console.warn(`[MultiplayerWorld] Dropped ${invalidCount} invalid micro_overrides entries (must be index 10-23, value 0-100)`);
  }
  
  return result.size > 0 ? result : undefined;
}

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
    cachedWorld: null,
    worldGenState: 'idle'
  });

  // FIX B: Request versioning to prevent stale world data
  const requestIdRef = useRef(0);
  // FIX B: Track current land key for race detection
  const currentLandKeyRef = useRef<string>('');

  const latestPositionRef = useRef<{ x: number; z: number }>({
    x: LAND_GRID_SIZE / 2,
    z: LAND_GRID_SIZE / 2
  });
  
  // Update player ID when it changes
  useEffect(() => {
    if (options.initialPlayerId && options.initialPlayerId !== state.playerId) {
      setState(prev => ({ ...prev, playerId: options.initialPlayerId! }));
    }
    // Clear cache on sign-out (null playerId)
    if (!options.initialPlayerId && state.playerId) {
      neighborParamsCache.clear();
    }
  }, [options.initialPlayerId, state.playerId]);
  
  // FIX D: Proactive cache pruning every 60 seconds + cleanup on unmount
  useEffect(() => {
    const pruneInterval = setInterval(() => {
      const pruned = neighborParamsCache.prune();
      if (pruned > 0) {
        console.debug(`[MultiplayerWorld] Pruned ${pruned} expired cache entries`);
      }
    }, 60 * 1000);
    
    return () => {
      clearInterval(pruneInterval);
      neighborParamsCache.clear();
    };
  }, []);
  
  const worldContext = useMemo<{ worldX: number; worldY: number } | undefined>(() => {
    if (!state.currentLand) return undefined;
    const ctx = createWorldContext(state.currentLand.pos_x, state.currentLand.pos_y);
    return { worldX: ctx.worldX, worldY: ctx.worldY };
  }, [state.currentLand?.pos_x, state.currentLand?.pos_y]);
  
  // Extract world params including V2 settings from land
  // FIX C: Use validated micro_overrides
  const worldParams = useMemo(() => {
    const land = state.currentLand;
    if (!land) {
      return {
        seed: 0,
        vars: [50, 50, 50, 50, 50, 50, 50, 50, 50, 50],
        mappingVersion: 'v1' as const,
        microOverrides: undefined as Map<number, number> | undefined
      };
    }
    
    // FIX C: Validate micro_overrides from DB
    const microOverrides = validateMicroOverrides(land.micro_overrides);
    
    return {
      seed: land.seed,
      vars: land.vars,
      mappingVersion: land.mapping_version ?? 'v1',
      microOverrides
    };
  }, [state.currentLand]);
  
  // REMOVED: useNexArtWorld hook - world generation is now owned by Index.tsx
  // This hook only manages land transitions and multiplayer state
  // The canonical artifact is passed down to components from Index.tsx
  
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
      // FIX B: Increment request ID for new transition
      requestIdRef.current++;
      const newLandKey = `${newLand.pos_x}:${newLand.pos_y}:${newLand.seed}`;
      currentLandKeyRef.current = newLandKey;
      
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
        isVisitingOtherLand: prev.playerId ? newLand.player_id !== prev.playerId : false,
        worldGenState: 'loading' // Loading until authoritative world ready
      }));
      
      // Clear neighbor params cache for new location
      neighborParamsCache.clear();
      
      // Signal parent to regenerate (Index.tsx owns canonical generation)
      options.onRequestRegenerate?.();
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
  }, [options.onLandTransition, options.onRequestRegenerate, state.currentLand]);
  
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
        // FIX B: Set land key for race detection
        currentLandKeyRef.current = `${land.pos_x}:${land.pos_y}:${land.seed}`;
        
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
      // FIX B: Update request ID and land key
      requestIdRef.current++;
      currentLandKeyRef.current = `${land.pos_x}:${land.pos_y}:${land.seed}`;
      
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
        cachedWorld: cached ?? null,
        worldGenState: 'loading'
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
  
  const updateLandParams = useCallback(async (updates: { 
    seed?: number; 
    vars?: number[];
    mapping_version?: 'v1' | 'v2';
    micro_overrides?: Record<string, number> | null;
  }) => {
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
    
    const updatedLand = await updateLand(playerId, {
      seed: updates.seed,
      vars: updates.vars,
      mapping_version: updates.mapping_version,
      micro_overrides: updates.micro_overrides ?? undefined
    });
    if (updatedLand) {
      setState(prev => ({ ...prev, currentLand: updatedLand }));
      // Signal parent to regenerate
      options.onRequestRegenerate?.();
    }
  }, [state.playerId, state.currentLand, options.initialPlayerId, options.onRequestRegenerate]);
  
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
    worldParams, // Expose full V2 params
    // REMOVED: world, isVerifying, forceRegenerate - Index.tsx owns canonical generation
    isLoading: state.isLoading,
    isTransitioning: edgeTransition.isTransitioning,
    error: state.error,
    initializePlayerLand,
    visitLand,
    updatePlayerPosition,
    updateLandParams,
    dismissUnclaimedAttempt
  };
}
