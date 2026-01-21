import { useState, useEffect, useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { WorldParams, DEFAULT_PARAMS } from '@/lib/worldGenerator';
import { buildParamsV2, deriveMicroVars, selectArchetype, type MappingVersion, type ResolvedWorldParams } from '@/world';
import { shouldUseV2Unified } from '@/lib/worldGeneratorUnified';

// Simple V1 params builder (just passes through)
function buildParamsV1(seed: number, vars: number[]) {
  return {
    seed,
    vars: vars.slice(0, 10).map(v => Math.max(0, Math.min(100, v ?? 50))),
    mappingVersion: 'v1' as const
  };
}

export interface ExtendedWorldParams extends WorldParams {
  mappingVersion: MappingVersion;
  archetype?: string;
  microOverrides?: Map<number, number>; // Manual micro var overrides (index 10-23 -> value)
}

// Parse params from URLSearchParams (pure function, no hooks)
function parseParamsFromSearch(searchParams: URLSearchParams): ExtendedWorldParams {
  const seedParam = searchParams.get('seed');
  const varsParam = searchParams.get('vars');
  const versionParam = searchParams.get('v');
  const microParam = searchParams.get('micro'); // micro var overrides
  
  let seed = DEFAULT_PARAMS.seed;
  let vars = [...DEFAULT_PARAMS.vars];
  let microOverrides: Map<number, number> | undefined;
  
  // Determine mapping version using unified logic:
  // - Explicit v=1 → V1
  // - Explicit v=2 → V2
  // - Legacy shared links (vars but no v) → V1 for backwards compat
  // - Fresh sessions → V2 (default)
  let mappingVersion: MappingVersion = shouldUseV2Unified(searchParams) ? 'v2' : 'v1';
  
  if (seedParam) {
    const parsed = parseInt(seedParam, 10);
    if (!isNaN(parsed)) seed = parsed;
  }
  
  if (varsParam) {
    const parsed = varsParam.split(',').map(v => {
      const n = parseInt(v, 10);
      return isNaN(n) ? 50 : Math.max(0, Math.min(100, n));
    });
    if (parsed.length === 10) {
      vars = parsed;
    }
  }
  
  // Parse micro overrides (format: "10:45,12:80,...")
  if (microParam && mappingVersion === 'v2') {
    microOverrides = new Map();
    const pairs = microParam.split(',');
    for (const pair of pairs) {
      const [idx, val] = pair.split(':').map(Number);
      if (!isNaN(idx) && !isNaN(val) && idx >= 10 && idx < 24) {
        microOverrides.set(idx, Math.max(0, Math.min(100, val)));
      }
    }
  }
  
  return { seed, vars, mappingVersion, microOverrides };
}

export function useWorldParams() {
  const [searchParams, setSearchParams] = useSearchParams();
  
  // Memoize parsed params based on searchParams
  const parsedParams = useMemo(
    () => parseParamsFromSearch(searchParams),
    [searchParams]
  );
  
  const [params, setParams] = useState<ExtendedWorldParams>(parsedParams);
  
  // Sync state when URL changes
  useEffect(() => {
    setParams(parsedParams);
  }, [parsedParams]);
  
  // Build full params using the appropriate mapping version
  const builtParams = useMemo(() => {
    if (params.mappingVersion === 'v2') {
      return buildParamsV2(params.seed, params.vars, params.microOverrides);
    }
    return buildParamsV1(params.seed, params.vars);
  }, [params.seed, params.vars, params.mappingVersion, params.microOverrides]);
  
  // Get derived micro vars (before overrides) for comparison
  const derivedMicroVars = useMemo(() => {
    if (params.mappingVersion === 'v2') {
      const archetype = selectArchetype(params.seed, params.vars);
      return deriveMicroVars(params.seed, params.vars, archetype);
    }
    return [];
  }, [params.seed, params.vars, params.mappingVersion]);
  
  const updateParams = useCallback((newParams: Partial<ExtendedWorldParams>) => {
    setParams(prev => {
      const updated = { ...prev, ...newParams };
      return updated;
    });
  }, []);
  
  const setSeed = useCallback((seed: number) => {
    updateParams({ seed });
  }, [updateParams]);
  
  const setVar = useCallback((index: number, value: number) => {
    setParams(prev => {
      const newVars = [...prev.vars];
      newVars[index] = Math.max(0, Math.min(100, value));
      return { ...prev, vars: newVars };
    });
  }, []);
  
  // Set a micro var override (index 10-23)
  const setMicroVar = useCallback((index: number, value: number) => {
    if (index < 10 || index >= 24) return;
    
    setParams(prev => {
      const newOverrides = new Map(prev.microOverrides || []);
      newOverrides.set(index, Math.max(0, Math.min(100, value)));
      return { ...prev, microOverrides: newOverrides };
    });
  }, []);
  
  // Reset a micro var to its derived value
  const resetMicroVar = useCallback((index: number) => {
    setParams(prev => {
      if (!prev.microOverrides?.has(index)) return prev;
      const newOverrides = new Map(prev.microOverrides);
      newOverrides.delete(index);
      return { ...prev, microOverrides: newOverrides.size > 0 ? newOverrides : undefined };
    });
  }, []);
  
  // Reset all micro var overrides
  const resetAllMicroVars = useCallback(() => {
    setParams(prev => ({ ...prev, microOverrides: undefined }));
  }, []);
  
  const setMappingVersion = useCallback((version: MappingVersion) => {
    updateParams({ mappingVersion: version });
  }, [updateParams]);
  
  const getShareUrl = useCallback(() => {
    const base = window.location.origin + window.location.pathname;
    const varsStr = params.vars.join(',');
    const versionStr = params.mappingVersion === 'v2' ? '&v=v2' : '';
    
    // Include micro overrides in URL
    let microStr = '';
    if (params.microOverrides && params.microOverrides.size > 0) {
      const pairs: string[] = [];
      params.microOverrides.forEach((val, idx) => {
        pairs.push(`${idx}:${val}`);
      });
      microStr = `&micro=${pairs.join(',')}`;
    }
    
    return `${base}?seed=${params.seed}&vars=${varsStr}${versionStr}${microStr}`;
  }, [params]);
  
  const applyToUrl = useCallback(() => {
    const varsStr = params.vars.join(',');
    const urlParams: Record<string, string> = { 
      seed: params.seed.toString(), 
      vars: varsStr 
    };
    if (params.mappingVersion === 'v2') {
      urlParams.v = 'v2';
    }
    if (params.microOverrides && params.microOverrides.size > 0) {
      const pairs: string[] = [];
      params.microOverrides.forEach((val, idx) => {
        pairs.push(`${idx}:${val}`);
      });
      urlParams.micro = pairs.join(',');
    }
    setSearchParams(urlParams);
  }, [params, setSearchParams]);
  
  const randomizeSeed = useCallback(() => {
    // Use a simple deterministic approach based on current seed
    const newSeed = Math.floor(Math.abs(Math.sin(params.seed * 9999) * 999999));
    setSeed(newSeed);
  }, [params.seed, setSeed]);
  
  return {
    params,
    builtParams,
    derivedMicroVars,
    setSeed,
    setVar,
    setMicroVar,
    resetMicroVar,
    resetAllMicroVars,
    setMappingVersion,
    updateParams,
    getShareUrl,
    applyToUrl,
    randomizeSeed
  };
}
