// World Preloader Hook - Deterministic Neighbor Preloading
// Ensures seamless transitions by pre-generating adjacent lands

import { useCallback, useEffect, useRef } from 'react';
import { PlayerLand } from '@/lib/multiplayer/types';
import {
  preloadNeighbors,
  cacheWorld,
  getCachedWorld,
  ensureWorldReady,
  clearWorldCache,
  getCacheStats,
  getPreloadStatus
} from '@/lib/worldCache';
import { WorldData, generateWorldDataAsync, isWorldValid } from '@/lib/worldData';
import { getLandAtPosition } from '@/lib/multiplayer/landRegistry';

interface UseWorldPreloaderOptions {
  // Current land coordinates
  currentWorldX: number;
  currentWorldY: number;
  // Current land parameters
  currentSeed: number;
  currentVars: number[];
  // Whether preloading is enabled
  enabled?: boolean;
  // Callback when current world is ready
  onCurrentWorldReady?: (world: WorldData) => void;
}

export function useWorldPreloader({
  currentWorldX,
  currentWorldY,
  currentSeed,
  currentVars,
  enabled = true,
  onCurrentWorldReady
}: UseWorldPreloaderOptions) {
  const lastPreloadKey = useRef<string>('');
  const neighborParamsCache = useRef<Map<string, { seed: number; vars: number[] } | null>>(new Map());
  
  // Fetch neighbor land parameters from registry
  const fetchNeighborParams = useCallback(async (nx: number, ny: number): Promise<{ seed: number; vars: number[] } | null> => {
    const key = `${nx}:${ny}`;
    
    // Check local cache first
    if (neighborParamsCache.current.has(key)) {
      return neighborParamsCache.current.get(key)!;
    }
    
    try {
      const land = await getLandAtPosition(nx, ny);
      if (land) {
        const params = { seed: land.seed, vars: land.vars };
        neighborParamsCache.current.set(key, params);
        return params;
      }
      neighborParamsCache.current.set(key, null);
      return null;
    } catch {
      neighborParamsCache.current.set(key, null);
      return null;
    }
  }, []);
  
  // Synchronous getter for neighbor params (uses cached results)
  const getNeighborParamsSync = useCallback((nx: number, ny: number): { seed: number; vars: number[] } | null => {
    const key = `${nx}:${ny}`;
    return neighborParamsCache.current.get(key) ?? null;
  }, []);
  
  // Pre-fetch neighbor params
  const prefetchNeighborParams = useCallback(async () => {
    const neighbors = [
      { x: currentWorldX, y: currentWorldY - 1 }, // north
      { x: currentWorldX, y: currentWorldY + 1 }, // south
      { x: currentWorldX + 1, y: currentWorldY }, // east
      { x: currentWorldX - 1, y: currentWorldY }  // west
    ];
    
    await Promise.all(neighbors.map(n => fetchNeighborParams(n.x, n.y)));
  }, [currentWorldX, currentWorldY, fetchNeighborParams]);
  
  // Main preload effect - runs when current position changes
  useEffect(() => {
    if (!enabled) return;
    
    const preloadKey = `${currentWorldX}:${currentWorldY}`;
    if (preloadKey === lastPreloadKey.current) return;
    lastPreloadKey.current = preloadKey;
    
    // Clear stale neighbor params cache
    neighborParamsCache.current.clear();
    
    const runPreload = async () => {
      // First, ensure current world is cached
      const currentCached = getCachedWorld(currentWorldX, currentWorldY, currentSeed, currentVars);
      
      if (!currentCached) {
        // Generate and cache current world
        const world = await generateWorldDataAsync(currentSeed, currentVars, { 
          worldX: currentWorldX, 
          worldY: currentWorldY 
        });
        
        if (isWorldValid(world)) {
          cacheWorld(currentWorldX, currentWorldY, world, currentSeed, currentVars);
          onCurrentWorldReady?.(world);
        }
      }
      
      // Pre-fetch neighbor parameters from registry
      await prefetchNeighborParams();
      
      // Start preloading neighbors (fire-and-forget)
      preloadNeighbors(currentWorldX, currentWorldY, getNeighborParamsSync);
    };
    
    runPreload();
  }, [currentWorldX, currentWorldY, currentSeed, currentVars, enabled, prefetchNeighborParams, getNeighborParamsSync, onCurrentWorldReady]);
  
  // Get a cached neighbor world instantly (for seamless transitions)
  const getNeighborWorld = useCallback(async (
    neighborX: number,
    neighborY: number
  ): Promise<WorldData | null> => {
    // Get params for this neighbor
    const params = await fetchNeighborParams(neighborX, neighborY);
    if (!params) return null;
    
    // Try cached first
    const cached = getCachedWorld(neighborX, neighborY, params.seed, params.vars);
    if (cached) return cached;
    
    // Wait for preload to complete
    return ensureWorldReady(neighborX, neighborY, params.seed, params.vars);
  }, [fetchNeighborParams]);
  
  // Check if a neighbor is ready for instant transition
  const isNeighborReady = useCallback((neighborX: number, neighborY: number): boolean => {
    return getPreloadStatus(neighborX, neighborY) === 'cached';
  }, []);
  
  // Force preload a specific neighbor
  const forcePreloadNeighbor = useCallback(async (neighborX: number, neighborY: number) => {
    const params = await fetchNeighborParams(neighborX, neighborY);
    if (!params) return;
    
    await ensureWorldReady(neighborX, neighborY, params.seed, params.vars);
  }, [fetchNeighborParams]);
  
  return {
    getNeighborWorld,
    isNeighborReady,
    forcePreloadNeighbor,
    getCacheStats,
    clearCache: clearWorldCache
  };
}
