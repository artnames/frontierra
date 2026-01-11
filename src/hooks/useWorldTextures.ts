// Hook for managing deterministic world textures
// Generates and caches procedural textures using @nexart/ui-renderer

import { useState, useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { MaterialKind } from '@/lib/materialRegistry';
import { generateWorldTextures } from '@/lib/uiTextures';
import { WORLD_A_ID } from '@/lib/worldContext';

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
    // If sampling fails (tainted canvas shouldn’t happen here), assume ok.
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

  // Stable key for dependency tracking
  const textureKey = useMemo(() => {
    const varsHash = vars.slice(0, 10).map((v) => Math.floor(v)).join('-');
    return `${worldX}_${worldY}_${seed}_${varsHash}`;
  }, [worldX, worldY, seed, vars]);

  // Generate textures when inputs change
  useEffect(() => {
    if (!enabled) {
      // Keep existing textures when disabled (don't clear them)
      return;
    }

    let cancelled = false;

    const loadTextures = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const textureSets = await generateWorldTextures(WORLD_A_ID, worldX, worldY, seed, vars);
        if (cancelled) return;

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
          // Don’t swap into a partial set (causes "good for a moment then black" artifacts)
          throw new Error('Incomplete texture set generated');
        }

        // Store in ref before updating state (stable during future reloads)
        prevTexturesRef.current = threeTextures;

        setTextureMap(threeTextures);
        setIsLoading(false);
      } catch (err) {
        if (cancelled) return;
        console.error('[useWorldTextures] Failed to generate textures:', err);
        setError(err instanceof Error ? err.message : 'Failed to generate textures');
        setIsLoading(false);
      }
    };

    loadTextures();

    return () => {
      cancelled = true;
    };
  }, [textureKey, enabled]);

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

