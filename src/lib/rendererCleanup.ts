// Renderer Cleanup Utilities
// Provides explicit GPU memory cleanup functions for world transitions
// MEMORY FIX: Addresses cumulative GPU memory accumulation

import * as THREE from 'three';

/**
 * Force cleanup of Three.js renderer internal caches
 * Call this after world transitions to release accumulated GPU resources
 */
export function cleanupRenderer(gl: THREE.WebGLRenderer): void {
  if (!gl) return;
  
  try {
    // Clear render lists (accumulated draw calls)
    gl.renderLists?.dispose();
    
    // Clear texture cache info
    gl.info?.reset();
    
    // Force state reset
    gl.state?.reset();
    
    if (import.meta.env.DEV) {
      console.debug('[RendererCleanup] Renderer caches cleared');
    }
  } catch (e) {
    // Suppress errors on already-disposed renderer
    console.warn('[RendererCleanup] Cleanup failed:', e);
  }
}

/**
 * Dispose a group and all its children's geometries/materials
 * More thorough than ForestTrees disposal - handles any Three.js object
 */
export function disposeObject3D(obj: THREE.Object3D): void {
  if (!obj) return;
  
  obj.traverse((child) => {
    // Dispose geometries
    if ((child as THREE.Mesh).geometry) {
      (child as THREE.Mesh).geometry.dispose();
    }
    
    // Dispose materials
    if ((child as THREE.Mesh).material) {
      const mats = Array.isArray((child as THREE.Mesh).material) 
        ? (child as THREE.Mesh).material 
        : [(child as THREE.Mesh).material];
      
      (mats as THREE.Material[]).forEach((mat) => {
        if (!mat) return;
        
        // Dispose any attached textures
        const matAny = mat as any;
        if (matAny.map) matAny.map.dispose?.();
        if (matAny.lightMap) matAny.lightMap.dispose?.();
        if (matAny.bumpMap) matAny.bumpMap.dispose?.();
        if (matAny.normalMap) matAny.normalMap.dispose?.();
        if (matAny.specularMap) matAny.specularMap.dispose?.();
        if (matAny.envMap) matAny.envMap.dispose?.();
        if (matAny.alphaMap) matAny.alphaMap.dispose?.();
        if (matAny.aoMap) matAny.aoMap.dispose?.();
        if (matAny.displacementMap) matAny.displacementMap.dispose?.();
        if (matAny.emissiveMap) matAny.emissiveMap.dispose?.();
        if (matAny.gradientMap) matAny.gradientMap.dispose?.();
        if (matAny.metalnessMap) matAny.metalnessMap.dispose?.();
        if (matAny.roughnessMap) matAny.roughnessMap.dispose?.();
        
        mat.dispose();
      });
    }
    
    // Dispose render targets
    if ((child as any).dispose) {
      try {
        (child as any).dispose();
      } catch (e) {
        // Ignore
      }
    }
  });
  
  // Clear children references
  while (obj.children.length > 0) {
    obj.remove(obj.children[0]);
  }
}

/**
 * Global geometry budget tracker
 * Evicts oldest geometries when budget is exceeded
 */
interface TrackedGeometry {
  geometry: THREE.BufferGeometry;
  createdAt: number;
  byteSize: number;
}

const geometryBudget = {
  maxBytes: 200 * 1024 * 1024, // 200MB budget
  tracked: new Map<string, TrackedGeometry>(),
  totalBytes: 0,
};

/**
 * Track a geometry for budget management
 * Returns an ID for later removal
 */
export function trackGeometry(geometry: THREE.BufferGeometry, id: string): void {
  if (!geometry || geometryBudget.tracked.has(id)) return;
  
  // Estimate byte size from attributes
  let byteSize = 0;
  for (const attr of Object.values(geometry.attributes)) {
    if (attr instanceof THREE.BufferAttribute) {
      byteSize += attr.array.byteLength;
    }
  }
  if (geometry.index) {
    byteSize += geometry.index.array.byteLength;
  }
  
  geometryBudget.tracked.set(id, {
    geometry,
    createdAt: Date.now(),
    byteSize,
  });
  geometryBudget.totalBytes += byteSize;
  
  // Evict oldest if over budget
  while (geometryBudget.totalBytes > geometryBudget.maxBytes && geometryBudget.tracked.size > 1) {
    evictOldestGeometry();
  }
}

/**
 * Untrack and optionally dispose a geometry
 */
export function untrackGeometry(id: string, dispose: boolean = true): void {
  const entry = geometryBudget.tracked.get(id);
  if (!entry) return;
  
  geometryBudget.totalBytes -= entry.byteSize;
  geometryBudget.tracked.delete(id);
  
  if (dispose) {
    try {
      entry.geometry.dispose();
    } catch (e) {
      // Already disposed
    }
  }
}

function evictOldestGeometry(): void {
  let oldestId: string | null = null;
  let oldestTime = Infinity;
  
  for (const [id, entry] of geometryBudget.tracked) {
    if (entry.createdAt < oldestTime) {
      oldestTime = entry.createdAt;
      oldestId = id;
    }
  }
  
  if (oldestId) {
    untrackGeometry(oldestId, true);
    if (import.meta.env.DEV) {
      console.debug(`[GeometryBudget] Evicted oldest geometry: ${oldestId}`);
    }
  }
}

/**
 * Get current geometry budget stats
 */
export function getGeometryBudgetStats(): { 
  usedBytes: number; 
  maxBytes: number; 
  count: number;
  usedMB: string;
} {
  return {
    usedBytes: geometryBudget.totalBytes,
    maxBytes: geometryBudget.maxBytes,
    count: geometryBudget.tracked.size,
    usedMB: (geometryBudget.totalBytes / (1024 * 1024)).toFixed(1),
  };
}

/**
 * Clear all tracked geometries (for reset/cleanup)
 */
export function clearGeometryBudget(): void {
  for (const [id] of geometryBudget.tracked) {
    untrackGeometry(id, true);
  }
  geometryBudget.totalBytes = 0;
}
