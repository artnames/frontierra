import { useState, useEffect, useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { WorldParams, DEFAULT_PARAMS } from '@/lib/worldGenerator';
import { buildParamsV2, type MappingVersion, type ResolvedWorldParams } from '@/world';

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
}

// Parse params from URLSearchParams (pure function, no hooks)
function parseParamsFromSearch(searchParams: URLSearchParams): ExtendedWorldParams {
  const seedParam = searchParams.get('seed');
  const varsParam = searchParams.get('vars');
  const versionParam = searchParams.get('v');
  
  let seed = DEFAULT_PARAMS.seed;
  let vars = [...DEFAULT_PARAMS.vars];
  let mappingVersion: MappingVersion = 'v1';
  
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
  
  if (versionParam === 'v2') {
    mappingVersion = 'v2';
  }
  
  return { seed, vars, mappingVersion };
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
      return buildParamsV2(params.seed, params.vars);
    }
    return buildParamsV1(params.seed, params.vars);
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
  
  const setMappingVersion = useCallback((version: MappingVersion) => {
    updateParams({ mappingVersion: version });
  }, [updateParams]);
  
  const getShareUrl = useCallback(() => {
    const base = window.location.origin + window.location.pathname;
    const varsStr = params.vars.join(',');
    const versionStr = params.mappingVersion === 'v2' ? '&v=v2' : '';
    return `${base}?seed=${params.seed}&vars=${varsStr}${versionStr}`;
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
    setSeed,
    setVar,
    setMappingVersion,
    updateParams,
    getShareUrl,
    applyToUrl,
    randomizeSeed
  };
}
