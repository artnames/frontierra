// World Preloader Hook - On-Demand Loading (No Background Preloading)
// IMPORTANT: Background preloading disabled to reduce memory usage.
// Neighbors are loaded on-demand during edge transitions only.

import { useCallback, useEffect, useRef } from 'react';
import {
  getCachedWorld,
  ensureWorldReady,
  clearWorldCache,
  getCacheStats,
  getPreloadStatus
} from '@/lib/worldCache';
import { WorldData } from '@/lib/worldData';
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
  
  // DISABLED: Background neighbor preloading removed to reduce memory pressure
  // Worlds are now loaded on-demand during edge transitions only
  // This saves ~1.2GB per preloaded neighbor (was preloading 2-4 neighbors)
  useEffect(() => {
    if (!enabled) return;
    
    const preloadKey = `${currentWorldX}:${currentWorldY}`;
    if (preloadKey === lastPreloadKey.current) return;
    lastPreloadKey.current = preloadKey;
    
    // Clear stale neighbor params cache on land change
    neighborParamsCache.current.clear();
    
    // Pre-fetch neighbor parameters only (metadata, not world data)
    // This allows quick lookup during edge transitions
    prefetchNeighborParams();
  }, [currentWorldX, currentWorldY, enabled, prefetchNeighborParams]);
  
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
