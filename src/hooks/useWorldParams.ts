import { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { WorldParams, DEFAULT_PARAMS } from '@/lib/worldGenerator';

export function useWorldParams() {
  const [searchParams, setSearchParams] = useSearchParams();
  
  const parseParams = useCallback((): WorldParams => {
    const seedParam = searchParams.get('seed');
    const varsParam = searchParams.get('vars');
    
    let seed = DEFAULT_PARAMS.seed;
    let vars = [...DEFAULT_PARAMS.vars];
    
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
    
    return { seed, vars };
  }, [searchParams]);
  
  const [params, setParams] = useState<WorldParams>(parseParams);
  
  useEffect(() => {
    setParams(parseParams());
  }, [parseParams]);
  
  const updateParams = useCallback((newParams: Partial<WorldParams>) => {
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
  
  const getShareUrl = useCallback(() => {
    const base = window.location.origin + window.location.pathname;
    const varsStr = params.vars.join(',');
    return `${base}?seed=${params.seed}&vars=${varsStr}`;
  }, [params]);
  
  const applyToUrl = useCallback(() => {
    const varsStr = params.vars.join(',');
    setSearchParams({ seed: params.seed.toString(), vars: varsStr });
  }, [params, setSearchParams]);
  
  const randomizeSeed = useCallback(() => {
    // Use a simple deterministic approach based on current seed
    const newSeed = Math.floor(Math.abs(Math.sin(params.seed * 9999) * 999999));
    setSeed(newSeed);
  }, [params.seed, setSeed]);
  
  return {
    params,
    setSeed,
    setVar,
    updateParams,
    getShareUrl,
    applyToUrl,
    randomizeSeed
  };
}
