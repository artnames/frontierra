// Debounced NexArt World Generation Hook
// Handles async execution, debouncing during slider changes, and atomic world swap

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { WorldData, generateWorldDataAsync, cacheWorldData, isWorldValid } from '@/lib/worldData';
import { normalizeNexArtInput } from '@/lib/nexartWorld';
import { createWorldContext, WORLD_A_ID } from '@/lib/worldContext';

interface UseNexArtWorldOptions {
  seed: number;
  vars: number[];
  debounceMs?: number;
  // World A context - enables shared macro geography
  worldContext?: {
    worldX: number;
    worldY: number;
  };
  // V2 mapping for archetype-aware generation
  mappingVersion?: 'v1' | 'v2';
  // V2 micro var overrides (indices 10-23)
  microOverrides?: Map<number, number>;
}

interface UseNexArtWorldResult {
  world: WorldData | null;
  isLoading: boolean;
  isVerifying: boolean;
  error: string | null;
  forceRegenerate: () => void;
}

const DEFAULT_DEBOUNCE_MS = 300;

export function useNexArtWorld({
  seed,
  vars,
  debounceMs = DEFAULT_DEBOUNCE_MS,
  worldContext,
  mappingVersion = 'v1',
  microOverrides
}: UseNexArtWorldOptions): UseNexArtWorldResult {
  const [world, setWorld] = useState<WorldData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isVerifying, setIsVerifying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const generationIdRef = useRef(0);
  const lastGeneratedKeyRef = useRef<string>('');
  const isGeneratingRef = useRef(false);
  
  // Normalize inputs once
  const input = useMemo(() => normalizeNexArtInput({
    seed,
    vars,
    mode: 'static'
  }), [seed, vars]);
  
  // Build full WorldContext for World A mode
  const fullWorldContext = useMemo(() => {
    if (!worldContext) return undefined;
    return createWorldContext(worldContext.worldX, worldContext.worldY);
  }, [worldContext?.worldX, worldContext?.worldY]);
  
  // Serialize microOverrides for key comparison
  const microOverridesKey = useMemo(() => {
    if (!microOverrides || microOverrides.size === 0) return '';
    const sorted = Array.from(microOverrides.entries()).sort((a, b) => a[0] - b[0]);
    return sorted.map(([k, v]) => `${k}:${v}`).join(',');
  }, [microOverrides]);
  
  // Stable key for dependency tracking (includes world context, mapping version, and micro overrides)
  const paramsKey = useMemo(
    () => `${input.seed}:${input.vars.join(',')}:${fullWorldContext?.worldX ?? 'solo'}:${fullWorldContext?.worldY ?? ''}:${mappingVersion}:${microOverridesKey}`,
    [input.seed, input.vars, fullWorldContext?.worldX, fullWorldContext?.worldY, mappingVersion, microOverridesKey]
  );
  
  const generateWorld = useCallback(async (
    targetSeed: number, 
    targetVars: number[], 
    key: string,
    version: 'v1' | 'v2',
    overrides: Map<number, number> | undefined
  ) => {
    // Prevent duplicate generations
    if (isGeneratingRef.current && lastGeneratedKeyRef.current === key) {
      return;
    }
    
    const currentGenId = ++generationIdRef.current;
    isGeneratingRef.current = true;
    
    setIsVerifying(true);
    setError(null);
    
    try {
      console.log(`[NexArt] Generating world with version=${version}, overrides=${overrides?.size ?? 0}`);
      const worldData = await generateWorldDataAsync(targetSeed, targetVars, fullWorldContext, version, overrides);
      
      // Check if this generation is still current
      if (currentGenId !== generationIdRef.current) {
        return; // Superseded by newer generation
      }
      
      if (!isWorldValid(worldData)) {
        setError(worldData.nexartError || 'NexArt generation failed');
        setWorld(null);
      } else {
        // Cache for synchronous access
        cacheWorldData(worldData);
        // Atomic swap
        setWorld(worldData);
        setError(null);
        lastGeneratedKeyRef.current = key;
      }
    } catch (err) {
      if (currentGenId !== generationIdRef.current) return;
      const message = err instanceof Error ? err.message : String(err);
      setError(`World cannot be verified — ${message}`);
      setWorld(null);
    } finally {
      if (currentGenId === generationIdRef.current) {
        setIsLoading(false);
        setIsVerifying(false);
        isGeneratingRef.current = false;
      }
    }
  }, [fullWorldContext]);
  
  // Debounced generation effect - runs only when paramsKey changes
  useEffect(() => {
    // Skip if already generated this exact key
    if (lastGeneratedKeyRef.current === paramsKey && world) {
      return;
    }
    
    // Clear any pending debounce
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
    
    // If no world yet, generate immediately
    if (!world) {
      setIsLoading(true);
      generateWorld(input.seed, input.vars, paramsKey, mappingVersion, microOverrides);
      return;
    }
    
    // Otherwise debounce parameter changes
    setIsVerifying(true);
    
    debounceTimerRef.current = setTimeout(() => {
      generateWorld(input.seed, input.vars, paramsKey, mappingVersion, microOverrides);
    }, debounceMs);
    
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [paramsKey, debounceMs, generateWorld, input.seed, input.vars, mappingVersion, microOverrides]);
  
  const forceRegenerate = useCallback(() => {
    // Clear the last key to force regeneration
    lastGeneratedKeyRef.current = '';
    setIsLoading(true);
    generateWorld(input.seed, input.vars, paramsKey, mappingVersion, microOverrides);
  }, [generateWorld, input.seed, input.vars, paramsKey, mappingVersion, microOverrides]);
  
  return {
    world,
    isLoading,
    isVerifying,
    error,
    forceRegenerate
  };
}
