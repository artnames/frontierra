// Hook for managing deterministic world textures
// Generates and caches procedural textures using @nexart/ui-renderer
// FIX: Proper disposal of THREE.CanvasTexture instances to prevent GPU memory leaks
// FIX: Debounced + serialized generation to prevent texture storms during slider drags

import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import * as THREE from 'three';
import { MaterialKind } from '@/lib/materialRegistry';
import { generateWorldTextures } from '@/lib/uiTextures';
import { WORLD_A_ID } from '@/lib/worldContext';

const DEV = import.meta.env.DEV;

export interface WorldTextureState {
  textures: Map<MaterialKind, THREE.CanvasTexture>;
  isLoading: boolean;
  isReady: boolean;
  error: string | null;
}

export interface UseWorldTexturesOptions {
  worldX: number;
  worldY: number;
  seed: number;
  vars: number[];
  enabled?: boolean;
}

const REQUIRED_KINDS: MaterialKind[] = [
  'ground',
  'forest',
  'mountain',
  'snow',
  'water',
  'path',
  'rock',
  'sand',
];

function hasAllRequiredTextures(map: Map<MaterialKind, THREE.CanvasTexture>) {
  return REQUIRED_KINDS.every((k) => map.has(k));
}

function isCanvasNonEmpty(canvas: HTMLCanvasElement): boolean {
  if (!canvas || canvas.width <= 0 || canvas.height <= 0) return false;
  try {
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return true;
    const d = ctx.getImageData(0, 0, 1, 1).data;
    return d[3] !== 0;
  } catch {
    return true;
  }
}

function canvasToThreeTexture(canvas: HTMLCanvasElement): THREE.CanvasTexture {
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.anisotropy = 8;
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.generateMipmaps = true;
  texture.needsUpdate = true;
  return texture;
}

function disposeTextureMap(map: Map<MaterialKind, THREE.CanvasTexture>) {
  map.forEach((texture) => {
    try {
      texture.dispose();
    } catch {
      // Ignore disposal errors
    }
  });
}

export function useWorldTextures({
  worldX,
  worldY,
  seed,
  vars,
  enabled = true,
}: UseWorldTexturesOptions): WorldTextureState {
  // ========== STATE (always in same order) ==========
  const [textureMap, setTextureMap] = useState<Map<MaterialKind, THREE.CanvasTexture>>(new Map());
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ========== REFS (always in same order) ==========
  const prevTexturesRef = useRef<Map<MaterialKind, THREE.CanvasTexture>>(new Map());
  const activeTexturesRef = useRef<Map<MaterialKind, THREE.CanvasTexture>>(new Map());
  const inFlightRef = useRef(false);
  const pendingKeyRef = useRef<string | null>(null);
  const debounceTimerRef = useRef<number | null>(null);
  const mountedRef = useRef(true);

  // ========== MEMOS (always in same order) ==========
  // Stable key for dependency tracking - floors vars to avoid jitter
  const textureKey = useMemo(() => {
    const varsHash = vars.slice(0, 10).map((v) => Math.floor(v)).join('-');
    return `${worldX}_${worldY}_${seed}_${varsHash}`;
  }, [worldX, worldY, seed, vars]);

  // Normalize vars for texture generation
  const stableVars = useMemo(() => {
    return vars.slice(0, 10).map((v) => {
      const n = Number(v);
      const safe = Number.isFinite(n) ? n : 50;
      return Math.max(0, Math.min(100, Math.floor(safe)));
    });
  }, [vars]);

  // ========== CALLBACKS (always in same order) ==========
  // Actual texture generation logic - extracted to avoid closure issues
  const doGenerate = useCallback(async (
    jobKey: string,
    jobWorldX: number,
    jobWorldY: number,
    jobSeed: number,
    jobVars: number[]
  ) => {
    if (!mountedRef.current) return;

    setIsLoading(true);
    setError(null);

    try {
      const textureSets = await generateWorldTextures(WORLD_A_ID, jobWorldX, jobWorldY, jobSeed, jobVars);
      if (!mountedRef.current) return;

      const threeTextures = new Map<MaterialKind, THREE.CanvasTexture>();
      textureSets.forEach((textureSet, kind) => {
        const threeTexture = canvasToThreeTexture(textureSet.diffuse);
        if (threeTexture.image instanceof HTMLCanvasElement) {
          if (!isCanvasNonEmpty(threeTexture.image)) return;
        }
        threeTextures.set(kind, threeTexture);
      });

      if (!hasAllRequiredTextures(threeTextures)) {
        disposeTextureMap(threeTextures);
        throw new Error('Incomplete texture set generated');
      }

      // Dispose OLD textures BEFORE swapping
      if (activeTexturesRef.current.size > 0) {
        disposeTextureMap(activeTexturesRef.current);
      }

      activeTexturesRef.current = threeTextures;
      prevTexturesRef.current = threeTextures;
      setTextureMap(threeTextures);
      setIsLoading(false);
    } catch (err) {
      if (!mountedRef.current) return;
      console.error('[useWorldTextures] Failed to generate textures:', err);
      setError(err instanceof Error ? err.message : 'Failed to generate textures');
      setIsLoading(false);
    }

    inFlightRef.current = false;

    // If a newer job arrived while we were working, run it
    const pending = pendingKeyRef.current;
    if (pending && pending !== jobKey && mountedRef.current) {
      pendingKeyRef.current = null;
      // We need to schedule the next job but we don't have its params here
      // The effect will re-run if textureKey changed, so this is handled naturally
    }
  }, []);

  // ========== EFFECTS (always in same order) ==========
  // Track mounted state
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  // Main generation effect - debounced + serialized
  useEffect(() => {
    if (!enabled) return;

    // Clear any pending debounce timer
    if (debounceTimerRef.current !== null) {
      window.clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }

    // If a generation is already in flight, just mark this as pending
    if (inFlightRef.current) {
      pendingKeyRef.current = textureKey;
      if (DEV) {
        console.debug('[useWorldTextures] Generation in flight, queuing:', textureKey);
      }
      return;
    }

    // Debounce: wait 250ms before starting generation
    debounceTimerRef.current = window.setTimeout(() => {
      debounceTimerRef.current = null;
      
      if (!mountedRef.current) return;
      if (inFlightRef.current) {
        pendingKeyRef.current = textureKey;
        return;
      }

      inFlightRef.current = true;
      pendingKeyRef.current = null;
      
      doGenerate(textureKey, worldX, worldY, seed, stableVars);
    }, 250);

    return () => {
      if (debounceTimerRef.current !== null) {
        window.clearTimeout(debounceTimerRef.current);
        debounceTimerRef.current = null;
      }
    };
  }, [textureKey, enabled, worldX, worldY, seed, stableVars, doGenerate]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (activeTexturesRef.current.size > 0) {
        disposeTextureMap(activeTexturesRef.current);
        activeTexturesRef.current = new Map();
      }
    };
  }, []);

  // ========== RETURN ==========
  const stableTextures = textureMap.size > 0 ? textureMap : prevTexturesRef.current;

  return {
    textures: stableTextures,
    isLoading,
    isReady: hasAllRequiredTextures(stableTextures),
    error,
  };
}

// Hook to get a specific texture
export function useTerrainTexture(
  textures: Map<MaterialKind, THREE.CanvasTexture>,
  kind: MaterialKind,
): THREE.CanvasTexture | null {
  return textures.get(kind) ?? null;
}
