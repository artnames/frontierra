// Hook for managing deterministic world textures
// Generates and caches procedural textures using @nexart/ui-renderer

import { useState, useEffect, useMemo, useCallback } from 'react';
import * as THREE from 'three';
import { 
  MaterialKind, 
  TextureSet,
  clearTextureCache 
} from '@/lib/materialRegistry';
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

// Convert canvas textures to Three.js textures
function canvasToThreeTexture(canvas: HTMLCanvasElement): THREE.CanvasTexture {
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.needsUpdate = true;
  return texture;
}

export function useWorldTextures({
  worldX,
  worldY,
  seed,
  vars,
  enabled = true
}: UseWorldTexturesOptions): WorldTextureState {
  const [textureMap, setTextureMap] = useState<Map<MaterialKind, THREE.CanvasTexture>>(new Map());
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Stable key for dependency tracking
  const textureKey = useMemo(() => {
    const varsHash = vars.slice(0, 10).map(v => Math.floor(v)).join('-');
    return `${worldX}_${worldY}_${seed}_${varsHash}`;
  }, [worldX, worldY, seed, vars]);
  
  // Generate textures when inputs change
  useEffect(() => {
    if (!enabled) {
      return;
    }
    
    let cancelled = false;
    
    const loadTextures = async () => {
      setIsLoading(true);
      setError(null);
      
      try {
        const textureSets = await generateWorldTextures(
          WORLD_A_ID,
          worldX,
          worldY,
          seed,
          vars
        );
        
        if (cancelled) return;
        
        // Convert to Three.js textures
        const threeTextures = new Map<MaterialKind, THREE.CanvasTexture>();
        
        textureSets.forEach((textureSet, kind) => {
          const threeTexture = canvasToThreeTexture(textureSet.diffuse);
          threeTextures.set(kind, threeTexture);
        });
        
        // Dispose old textures
        textureMap.forEach(texture => texture.dispose());
        
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
  
  // Cleanup on unmount
  useEffect(() => {
    return () => {
      textureMap.forEach(texture => texture.dispose());
    };
  }, []);
  
  return {
    textures: textureMap,
    isLoading,
    isReady: textureMap.size > 0 && !isLoading,
    error
  };
}

// Hook to get a specific texture
export function useTerrainTexture(
  textures: Map<MaterialKind, THREE.CanvasTexture>,
  kind: MaterialKind
): THREE.CanvasTexture | null {
  return textures.get(kind) ?? null;
}
