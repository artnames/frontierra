// Hook for managing deterministic world textures
// Generates and caches procedural textures using @nexart/ui-renderer
// FIX: Proper disposal of THREE.CanvasTexture instances to prevent GPU memory leaks

import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import * as THREE from 'three';
import { MaterialKind } from '@/lib/materialRegistry';
import { generateWorldTextures } from '@/lib/uiTextures';
import { WORLD_A_ID } from '@/lib/worldContext';

const DEV = import.meta.env.DEV;

declare global {
  interface Window {
    __editorResourceStats?: {
      textureGenActive: number;
      textureGenStarted: number;
      textureGenCompleted: number;
      textureGenSkipped: number;
    };
  }
}

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
  // A fully transparent canvas will effectively turn the material black.
  // Use a tiny sample to detect that common failure mode.
  try {
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return true;
    const d = ctx.getImageData(0, 0, 1, 1).data;
    // If alpha is 0 it's almost certainly an unrendered canvas.
    return d[3] !== 0;
  } catch {
    // If sampling fails (tainted canvas shouldn't happen here), assume ok.
    return true;
  }
}

// Convert canvas textures to Three.js textures
function canvasToThreeTexture(canvas: HTMLCanvasElement): THREE.CanvasTexture {
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  // Use linear filtering for smooth, non-pixelated terrain
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.anisotropy = 8; // Higher anisotropy for smoother distant terrain
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.generateMipmaps = true;
  texture.needsUpdate = true;
  return texture;
}

// FIX: Dispose old THREE.CanvasTexture instances to prevent GPU memory leak
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
  const [textureMap, setTextureMap] = useState<Map<MaterialKind, THREE.CanvasTexture>>(new Map());
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Keep track of previous textures to avoid flickering during reload
  const prevTexturesRef = useRef<Map<MaterialKind, THREE.CanvasTexture>>(new Map());
  
  // FIX: Track the currently active textures for disposal
  const activeTexturesRef = useRef<Map<MaterialKind, THREE.CanvasTexture>>(new Map());

  // Stable key for dependency tracking
  const textureKey = useMemo(() => {
    const varsHash = vars.slice(0, 10).map((v) => Math.floor(v)).join('-');
    return `${worldX}_${worldY}_${seed}_${varsHash}`;
  }, [worldX, worldY, seed, vars]);

  // IMPORTANT: normalize vars for texture generation to avoid storms from tiny slider jitter.
  // This matches the hashing strategy used across the texture pipeline.
  const stableVars = useMemo(() => {
    return vars.slice(0, 10).map((v) => {
      const n = Number(v);
      const safe = Number.isFinite(n) ? n : 50;
      return Math.max(0, Math.min(100, Math.floor(safe)));
    });
  }, [vars]);

  // Prevent parallel texture generations (storms) while the user drags sliders.
  // We debounce + ensure only one in-flight job runs at a time, then run the latest pending job.
  const inFlightRef = useRef(false);
  const pendingJobRef = useRef<null | {
    key: string;
    worldX: number;
    worldY: number;
    seed: number;
    vars: number[];
  }>(null);
  const debounceTimerRef = useRef<number | null>(null);
  const mountedRef = useRef(true);

  const bumpStat = useCallback((field: keyof NonNullable<Window['__editorResourceStats']>, delta: number) => {
    if (!DEV || typeof window === 'undefined') return;
    const s = (window.__editorResourceStats ??= {
      textureGenActive: 0,
      textureGenStarted: 0,
      textureGenCompleted: 0,
      textureGenSkipped: 0,
    });
    // @ts-expect-error - dynamic access
    s[field] = (s[field] ?? 0) + delta;
  }, []);

  const runJob = useCallback(async (job: NonNullable<typeof pendingJobRef.current>) => {
    if (!enabled) return;
    if (!mountedRef.current) return;

    // If another job is already running, just remember the latest and exit.
    if (inFlightRef.current) {
      pendingJobRef.current = job;
      bumpStat('textureGenSkipped', 1);
      return;
    }

    inFlightRef.current = true;
    pendingJobRef.current = null;
    bumpStat('textureGenActive', 1);
    bumpStat('textureGenStarted', 1);

    setIsLoading(true);
    setError(null);

    try {
      const textureSets = await generateWorldTextures(WORLD_A_ID, job.worldX, job.worldY, job.seed, job.vars);
      if (!mountedRef.current) return;

      const threeTextures = new Map<MaterialKind, THREE.CanvasTexture>();
      textureSets.forEach((textureSet, kind) => {
        const threeTexture = canvasToThreeTexture(textureSet.diffuse);
        // Guard against "blank" canvases that would render as black.
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
    } catch (err) {
      if (!mountedRef.current) return;
      console.error('[useWorldTextures] Failed to generate textures:', err);
      setError(err instanceof Error ? err.message : 'Failed to generate textures');
    } finally {
      if (mountedRef.current) {
        setIsLoading(false);
      }
      bumpStat('textureGenCompleted', 1);
      bumpStat('textureGenActive', -1);
      inFlightRef.current = false;

      // If a newer job arrived while we were working, run it next (no parallelism).
      const pending = pendingJobRef.current;
      if (pending && pending.key !== job.key && enabled) {
        pendingJobRef.current = null;
        // Fire-and-forget; this function already serializes.
        runJob(pending);
      }
    }
  }, [enabled, bumpStat]);

  // Generate textures when inputs change (debounced + serialized)
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (!enabled) return;

    // Debounce: collapse fast slider changes into a single texture build.
    if (debounceTimerRef.current !== null) {
      window.clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }

    const job = {
      key: textureKey,
      worldX,
      worldY,
      seed,
      vars: stableVars,
    };

    pendingJobRef.current = job;

    debounceTimerRef.current = window.setTimeout(() => {
      if (!pendingJobRef.current) return;
      // Run the latest job we have.
      runJob(pendingJobRef.current);
    }, 250);

    return () => {
      if (debounceTimerRef.current !== null) {
        window.clearTimeout(debounceTimerRef.current);
        debounceTimerRef.current = null;
      }
      // NOTE: We intentionally do NOT attempt to abort in-flight generation because
      // the renderer work is not abortable. We instead serialize and only apply
      // the latest result.
    };
    // Depend on textureKey (floored vars) instead of raw vars array to avoid jitter storms.
  }, [textureKey, enabled, worldX, worldY, seed, stableVars, runJob]);

  // FIX: Cleanup on unmount - dispose all textures
  useEffect(() => {
    return () => {
      if (activeTexturesRef.current.size > 0) {
        disposeTextureMap(activeTexturesRef.current);
        activeTexturesRef.current = new Map();
      }
    };
  }, []);

  // Prefer current textures; fall back to previous stable textures if we have them.
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
