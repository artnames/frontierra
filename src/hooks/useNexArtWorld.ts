// Debounced NexArt World Generation Hook
// Handles async execution, debouncing during slider changes, and atomic world swap

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { WorldData, generateWorldDataAsync, cacheWorldData, isWorldValid } from '@/lib/worldData';
import { normalizeNexArtInput } from '@/lib/nexartWorld';

interface UseNexArtWorldOptions {
  seed: number;
  vars: number[];
  debounceMs?: number;
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
  debounceMs = DEFAULT_DEBOUNCE_MS
}: UseNexArtWorldOptions): UseNexArtWorldResult {
  const [world, setWorld] = useState<WorldData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isVerifying, setIsVerifying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const pendingParamsRef = useRef<{ seed: number; vars: number[] } | null>(null);
  const generationIdRef = useRef(0);
  
  // Normalize inputs once
  const input = useMemo(() => normalizeNexArtInput({
    seed,
    vars,
    mode: 'static'
  }), [seed, vars]);
  
  // Stable key for dependency tracking
  const paramsKey = useMemo(
    () => `${input.seed}:${input.vars.join(',')}`,
    [input.seed, input.vars]
  );
  
  const generateWorld = useCallback(async (targetSeed: number, targetVars: number[]) => {
    const currentGenId = ++generationIdRef.current;
    
    setIsVerifying(true);
    setError(null);
    
    try {
      const worldData = await generateWorldDataAsync(targetSeed, targetVars);
      
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
      }
    }
  }, []);
  
  // Debounced generation effect
  useEffect(() => {
    // Store pending params
    pendingParamsRef.current = { seed: input.seed, vars: input.vars };
    
    // If no world yet, generate immediately
    if (!world) {
      setIsLoading(true);
      generateWorld(input.seed, input.vars);
      return;
    }
    
    // Otherwise debounce
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
    
    setIsVerifying(true);
    
    debounceTimerRef.current = setTimeout(() => {
      const params = pendingParamsRef.current;
      if (params) {
        generateWorld(params.seed, params.vars);
      }
    }, debounceMs);
    
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [paramsKey, debounceMs, generateWorld, world, input.seed, input.vars]);
  
  const forceRegenerate = useCallback(() => {
    setIsLoading(true);
    generateWorld(input.seed, input.vars);
  }, [generateWorld, input.seed, input.vars]);
  
  return {
    world,
    isLoading,
    isVerifying,
    error,
    forceRegenerate
  };
}
