// Debounced NexArt World Generation Hook
// Handles async execution, debouncing during slider changes, and atomic world swap

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { WorldData, generateWorldDataAsync, cacheWorldData, isWorldValid } from '@/lib/worldData';
import { normalizeNexArtInput } from '@/lib/nexartWorld';

interface UseNexArtWorldOptions {
  seed: number;
  vars: number[];
  debounceMs?: number;
  // World A context - enables shared macro geography
  worldContext?: {
    worldX: number;
    worldY: number;
  };
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
  worldContext
}: UseNexArtWorldOptions): UseNexArtWorldResult {
  const [world, setWorld] = useState<WorldData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isVerifying, setIsVerifying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const generationIdRef = useRef(0);
  const lastGeneratedKeyRef = useRef<string>('');
  const isGeneratingRef = useRef(false);
  const abortControllerRef = useRef<AbortController | null>(null);
  
  // Normalize inputs once
  const input = useMemo(() => normalizeNexArtInput({
    seed,
    vars,
    mode: 'static'
  }), [seed, vars]);
  
  // Build full WorldContext for World A mode
  const fullWorldContext = useMemo(() => {
    if (!worldContext) return undefined;
    return { worldX: worldContext.worldX, worldY: worldContext.worldY };
  }, [worldContext?.worldX, worldContext?.worldY]);
  
  // Stable key for dependency tracking
  const paramsKey = useMemo(
    () => `${input.seed}:${input.vars.join(',')}:${fullWorldContext?.worldX ?? 'solo'}:${fullWorldContext?.worldY ?? ''}`,
    [input.seed, input.vars, fullWorldContext?.worldX, fullWorldContext?.worldY]
  );
  
  const generateWorld = useCallback(async (
    targetSeed: number, 
    targetVars: number[], 
    key: string
  ) => {
    if (isGeneratingRef.current && lastGeneratedKeyRef.current === key) {
      return;
    }
    
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    
    const controller = new AbortController();
    abortControllerRef.current = controller;
    
    const currentGenId = ++generationIdRef.current;
    isGeneratingRef.current = true;
    
    setIsVerifying(true);
    setError(null);
    
    try {
      console.log(`[NexArt] Generating world, genId=${currentGenId}`);
      const worldData = await generateWorldDataAsync(targetSeed, targetVars, fullWorldContext);
      
      if (currentGenId !== generationIdRef.current) {
        return;
      }
      
      if (controller.signal.aborted) {
        return;
      }
      
      if (!isWorldValid(worldData)) {
        setError(worldData.nexartError || 'NexArt generation failed');
        setWorld(null);
      } else {
        cacheWorldData(worldData);
        setWorld(worldData);
        setError(null);
        lastGeneratedKeyRef.current = key;
      }
    } catch (err) {
      if (currentGenId !== generationIdRef.current || controller.signal.aborted) {
        return;
      }
      const message = err instanceof Error ? err.message : String(err);
      setError(`World cannot be verified — ${message}`);
      setWorld(null);
    } finally {
      if (currentGenId === generationIdRef.current && !controller.signal.aborted) {
        setIsLoading(false);
        setIsVerifying(false);
        isGeneratingRef.current = false;
      }
    }
  }, [fullWorldContext]);
  
  useEffect(() => {
    if (lastGeneratedKeyRef.current === paramsKey && world) {
      return;
    }
    
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
    
    if (!world) {
      setIsLoading(true);
      generateWorld(input.seed, input.vars, paramsKey);
      return;
    }
    
    setIsVerifying(true);
    
    debounceTimerRef.current = setTimeout(() => {
      generateWorld(input.seed, input.vars, paramsKey);
    }, debounceMs);
    
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [paramsKey, debounceMs, generateWorld, input.seed, input.vars]);
  
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, []);
  
  const forceRegenerate = useCallback(() => {
    lastGeneratedKeyRef.current = '';
    setIsLoading(true);
    generateWorld(input.seed, input.vars, paramsKey);
  }, [generateWorld, input.seed, input.vars, paramsKey]);
  
  return {
    world,
    isLoading,
    isVerifying,
    error,
    forceRegenerate
  };
}
