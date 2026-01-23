// World Cache - In-Memory LRU Cache for Deterministic Neighbor Preloading
// Stores WorldData keyed by (worldId, worldX, worldY)
// Max size: 5 worlds (current + 4 cardinal neighbors)
// NEVER persisted, serialized, or synced

import { WorldData, generateWorldDataAsync, isWorldValid } from './worldData';
import { WORLD_A_ID } from './worldContext';

// Cache key format: "WORLD_A:3:5" (worldId:x:y)
type CacheKey = string;

interface CacheEntry {
  world: WorldData;
  lastAccessed: number;
  seed: number;
  vars: number[];
}

interface WorldCacheState {
  entries: Map<CacheKey, CacheEntry>;
  maxSize: number;
}

// Singleton cache instance - minimal size since preloading is disabled
const cache: WorldCacheState = {
  entries: new Map(),
  maxSize: 2 // Current world + 1 for transition overlap
};

// Generate cache key from world coordinates
export function getCacheKey(worldX: number, worldY: number, worldId: string = WORLD_A_ID): CacheKey {
  return `${worldId}:${worldX}:${worldY}`;
}

// Parse cache key back to coordinates
export function parseCacheKey(key: CacheKey): { worldId: string; worldX: number; worldY: number } {
  const [worldId, x, y] = key.split(':');
  return { worldId, worldX: parseInt(x, 10), worldY: parseInt(y, 10) };
}

// Get a cached world (updates access time)
export function getCachedWorld(worldX: number, worldY: number, seed: number, vars: number[]): WorldData | null {
  const key = getCacheKey(worldX, worldY);
  const entry = cache.entries.get(key);
  
  if (!entry) {
    return null;
  }
  
  // Verify parameters match (determinism check)
  if (entry.seed !== seed || !arraysEqual(entry.vars, vars)) {
    // Parameters changed - invalidate cache entry
    cache.entries.delete(key);
    return null;
  }
  
  // Update access time
  entry.lastAccessed = Date.now();
  return entry.world;
}

// Check if a world is cached (without updating access time)
export function isCached(worldX: number, worldY: number, seed?: number, vars?: number[]): boolean {
  const key = getCacheKey(worldX, worldY);
  const entry = cache.entries.get(key);
  
  if (!entry) return false;
  
  // If seed/vars provided, verify they match
  if (seed !== undefined && entry.seed !== seed) return false;
  if (vars !== undefined && !arraysEqual(entry.vars, vars)) return false;
  
  return true;
}

// Store a world in cache (with LRU eviction)
export function cacheWorld(
  worldX: number, 
  worldY: number, 
  world: WorldData, 
  seed: number, 
  vars: number[]
): void {
  const key = getCacheKey(worldX, worldY);
  
  // Evict LRU entries if at capacity
  while (cache.entries.size >= cache.maxSize) {
    evictLRU();
  }
  
  cache.entries.set(key, {
    world,
    lastAccessed: Date.now(),
    seed,
    vars: [...vars]
  });
}

// Evict the least recently used entry with proper cleanup
function evictLRU(): void {
  let oldestKey: CacheKey | null = null;
  let oldestTime = Infinity;
  
  for (const [key, entry] of cache.entries) {
    if (entry.lastAccessed < oldestTime) {
      oldestTime = entry.lastAccessed;
      oldestKey = key;
    }
  }
  
  if (oldestKey) {
    const entry = cache.entries.get(oldestKey);
    if (entry) {
      // Null out large terrain arrays to help GC
      if (entry.world.terrain) {
        entry.world.terrain.length = 0;
      }
      entry.world = null as unknown as WorldData;
    }
    cache.entries.delete(oldestKey);
  }
}

// Invalidate a specific cached world
export function invalidateCache(worldX: number, worldY: number): void {
  const key = getCacheKey(worldX, worldY);
  cache.entries.delete(key);
}

// Clear the entire cache (for debugging or reset)
export function clearWorldCache(): void {
  cache.entries.clear();
}

// Get cache stats (for debugging)
export function getCacheStats(): { size: number; maxSize: number; keys: string[] } {
  return {
    size: cache.entries.size,
    maxSize: cache.maxSize,
    keys: Array.from(cache.entries.keys())
  };
}

// Helper: compare arrays
function arraysEqual(a: number[], b: number[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}

// ============================================
// NEIGHBOR PRELOAD SYSTEM
// ============================================

export type Direction = 'north' | 'south' | 'east' | 'west';

interface NeighborCoord {
  direction: Direction;
  worldX: number;
  worldY: number;
}

// Get the 4 cardinal neighbor coordinates
export function getNeighborCoords(worldX: number, worldY: number): NeighborCoord[] {
  return [
    { direction: 'north', worldX, worldY: worldY - 1 },
    { direction: 'south', worldX, worldY: worldY + 1 },
    { direction: 'east', worldX: worldX + 1, worldY },
    { direction: 'west', worldX: worldX - 1, worldY }
  ];
}

// Preload status tracking - BOUNDED to prevent memory leak
interface PreloadJob {
  key: CacheKey;
  promise: Promise<WorldData | null>;
  status: 'pending' | 'complete' | 'failed';
}

const MAX_PRELOAD_ENTRIES = 4; // Reduced from 10 to limit memory
const activePreloads: Map<CacheKey, PreloadJob> = new Map();

// Prune completed/failed preload entries to prevent unbounded growth
function pruneCompletedPreloads(): void {
  if (activePreloads.size <= MAX_PRELOAD_ENTRIES) return;
  
  // Remove oldest completed/failed entries first
  const entriesToRemove: CacheKey[] = [];
  for (const [key, job] of activePreloads) {
    if (job.status !== 'pending') {
      entriesToRemove.push(key);
      if (activePreloads.size - entriesToRemove.length <= MAX_PRELOAD_ENTRIES) break;
    }
  }
  entriesToRemove.forEach(key => activePreloads.delete(key));
}

// Clear all preload tracking (for cleanup)
export function clearPreloadTracking(): void {
  activePreloads.clear();
}

// Check if debug mode is enabled (disables preloading to avoid log confusion)
function isDebugMode(): boolean {
  if (typeof window === 'undefined') return false;
  return new URLSearchParams(window.location.search).get('debug') === '1';
}

// Preload a single world in the background
export async function preloadWorld(
  worldX: number,
  worldY: number,
  seed: number,
  vars: number[]
): Promise<WorldData | null> {
  // Disable preloading in debug mode to avoid confusing logs
  if (isDebugMode()) {
    return null;
  }
  
  const key = getCacheKey(worldX, worldY);
  
  // Already cached with matching params
  if (isCached(worldX, worldY, seed, vars)) {
    return getCachedWorld(worldX, worldY, seed, vars);
  }
  
  // Already being preloaded
  const existing = activePreloads.get(key);
  if (existing && existing.status === 'pending') {
    return existing.promise;
  }
  
  // Start new preload
  const promise = (async () => {
    try {
      // Use distinct log tag for preload generations
      console.log('PRELOAD_GEN', { worldX, worldY, seed });
      
      const worldData = await generateWorldDataAsync(seed, vars, { worldX, worldY });
      
      if (isWorldValid(worldData)) {
        cacheWorld(worldX, worldY, worldData, seed, vars);
        // Mark complete then prune old entries to prevent unbounded growth
        activePreloads.set(key, { key, promise, status: 'complete' });
        pruneCompletedPreloads();
        return worldData;
      } else {
        activePreloads.set(key, { key, promise, status: 'failed' });
        pruneCompletedPreloads();
        return null;
      }
    } catch (error) {
      console.error(`[WorldCache] Preload failed for ${key}:`, error);
      activePreloads.set(key, { key, promise, status: 'failed' });
      pruneCompletedPreloads();
      return null;
    }
  })();
  
  activePreloads.set(key, { key, promise, status: 'pending' });
  return promise;
}

// Preload only 2 neighbors (reduced from 4 to limit memory - 1.2GB per world)
// Prioritize north/south as most common movement directions
export function preloadNeighbors(
  worldX: number,
  worldY: number,
  getNeighborParams: (nx: number, ny: number) => { seed: number; vars: number[] } | null
): void {
  const neighbors = getNeighborCoords(worldX, worldY);
  
  // Only preload first 2 neighbors (north, south) to reduce memory pressure
  const limitedNeighbors = neighbors.slice(0, 2);
  
  for (const neighbor of limitedNeighbors) {
    const params = getNeighborParams(neighbor.worldX, neighbor.worldY);
    if (!params) continue; // Unclaimed/invalid neighbor
    
    // Fire-and-forget preload (low priority background task)
    preloadWorld(neighbor.worldX, neighbor.worldY, params.seed, params.vars)
      .catch(() => {/* silent fail for background preload */});
  }
}

// Get preload status for a coordinate
export function getPreloadStatus(worldX: number, worldY: number): 'cached' | 'pending' | 'none' {
  const key = getCacheKey(worldX, worldY);
  
  if (cache.entries.has(key)) return 'cached';
  
  const job = activePreloads.get(key);
  if (job?.status === 'pending') return 'pending';
  
  return 'none';
}

// Wait for a specific world to be ready (cached or preloaded)
export async function ensureWorldReady(
  worldX: number,
  worldY: number,
  seed: number,
  vars: number[]
): Promise<WorldData | null> {
  // Check cache first
  const cached = getCachedWorld(worldX, worldY, seed, vars);
  if (cached) return cached;
  
  // Check if already preloading
  const key = getCacheKey(worldX, worldY);
  const job = activePreloads.get(key);
  if (job?.status === 'pending') {
    return job.promise;
  }
  
  // Generate on demand
  return preloadWorld(worldX, worldY, seed, vars);
}
