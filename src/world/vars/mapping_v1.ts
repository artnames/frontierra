// V1 Mapping - Legacy compatibility layer
// Reproduces the exact behavior of the original 10-variable system
// MUST NOT change - existing worlds depend on this

import { mapVar, normalizeVar } from './mixer';

// ============================================
// V1 WORLD PARAMS (Legacy)
// ============================================

export interface WorldParamsV1 {
  seed: number;
  vars: number[]; // Always exactly 10 values
}

export const DEFAULT_PARAMS_V1: WorldParamsV1 = {
  seed: 12345,
  vars: [50, 50, 50, 50, 50, 50, 50, 50, 50, 50]
};

export const VAR_LABELS_V1: string[] = [
  'Landmark Archetype',      // VAR[0] - Structure/object type
  'Landmark X Bias',         // VAR[1] - Micro offset for placement
  'Landmark Y Bias',         // VAR[2] - Micro offset for placement
  'Terrain Detail',          // VAR[3] - Local noise frequency (micro-bumps)
  'Biome Richness',          // VAR[4] - Color & vegetation variation
  'Forest Density',          // VAR[5] - Tree clustering within fixed forest regions
  'Mountain Steepness',      // VAR[6] - Slope curves, snow caps (NOT placement)
  'Path Wear',               // VAR[7] - Width, erosion, smoothing (NOT routing)
  'Surface Roughness',       // VAR[8] - Normal variation texture
  'Visual Style'             // VAR[9] - Tone / saturation / contrast
];

// ============================================
// V1 MAPPED VALUES
// These are the exact ranges used in worldGenerator.ts
// ============================================

export interface MappedValuesV1 {
  // Solo mode mappings
  continentScale: number;      // 0.02 - 0.10
  waterLevel: number;          // 0.10 - 0.55
  forestDensity: number;       // 0.10 - 0.85
  mountainPeakHeight: number;  // 0.20 - 1.00
  pathDensityVal: number;      // 0.0 - 1.0
  terrainRoughness: number;    // 0.05 - 1.50
  mountainDensity: number;     // 0.02 - 1.00
  
  // Object placement
  objX: number;
  objY: number;
  
  // World A mode mappings (expression-only)
  landmarkType: number;
  landmarkXBias: number;
  landmarkYBias: number;
  terrainDetail: number;
  biomeRichness: number;
  mountainSteepness: number;
  pathWear: number;
  surfaceRoughness: number;
  visualStyle: number;
}

/**
 * Map V1 vars to internal values - EXACT legacy behavior
 */
export function mapV1Vars(vars: number[], gridSize: number = 64): MappedValuesV1 {
  const v = vars.map(v => Math.max(0, Math.min(100, v ?? 50)));
  
  return {
    // Solo mode
    continentScale: mapVar(v[3], 0.02, 0.10),
    waterLevel: mapVar(v[4], 0.10, 0.55),
    forestDensity: mapVar(v[5], 0.10, 0.85),
    mountainPeakHeight: mapVar(v[6], 0.20, 1.00),
    pathDensityVal: mapVar(v[7], 0.0, 1.0),
    terrainRoughness: mapVar(v[8], 0.05, 1.50),
    mountainDensity: mapVar(v[9], 0.02, 1.00),
    
    // Object position
    objX: Math.floor(mapVar(v[1], 4, gridSize - 4)),
    objY: Math.floor(mapVar(v[2], 4, gridSize - 4)),
    
    // World A expression-only
    landmarkType: Math.floor(mapVar(v[0], 0, 5)),
    landmarkXBias: mapVar(v[1], -8, 8),
    landmarkYBias: mapVar(v[2], -8, 8),
    terrainDetail: mapVar(v[3], 0.02, 0.15),
    biomeRichness: mapVar(v[4], 0.3, 1.0),
    mountainSteepness: mapVar(v[6], 0.3, 1.5),
    pathWear: mapVar(v[7], 0.5, 2.0),
    surfaceRoughness: mapVar(v[8], 0.02, 0.12),
    visualStyle: mapVar(v[9], 0.7, 1.3)
  };
}

/**
 * Validate V1 params - ensure exactly 10 vars
 */
export function validateV1Params(params: Partial<WorldParamsV1>): WorldParamsV1 {
  const seed = typeof params.seed === 'number' ? params.seed : DEFAULT_PARAMS_V1.seed;
  
  let vars: number[];
  if (Array.isArray(params.vars) && params.vars.length === 10) {
    vars = params.vars.map(v => normalizeVar(v ?? 50));
  } else if (Array.isArray(params.vars)) {
    // Pad or truncate to 10
    vars = Array(10).fill(50).map((d, i) => 
      normalizeVar(params.vars![i] ?? d)
    );
  } else {
    vars = [...DEFAULT_PARAMS_V1.vars];
  }
  
  return { seed, vars };
}

/**
 * Generate a V1 share URL
 */
export function getV1ShareUrl(params: WorldParamsV1): string {
  const base = typeof window !== 'undefined' 
    ? window.location.origin + window.location.pathname 
    : '';
  const varsStr = params.vars.join(',');
  return `${base}?seed=${params.seed}&vars=${varsStr}`;
}

/**
 * Parse V1 params from URL search params
 */
export function parseV1ParamsFromUrl(searchParams: URLSearchParams): WorldParamsV1 {
  const seedParam = searchParams.get('seed');
  const varsParam = searchParams.get('vars');
  
  let seed = DEFAULT_PARAMS_V1.seed;
  let vars = [...DEFAULT_PARAMS_V1.vars];
  
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
}

/**
 * Deterministic randomize for V1 - uses sin-based pseudo-random
 * MUST match the original randomizeSeed behavior
 */
export function randomizeV1Seed(currentSeed: number): number {
  return Math.floor(Math.abs(Math.sin(currentSeed * 9999) * 999999));
}

/**
 * Check if params match V1 format (exactly 10 vars)
 */
export function isV1Params(params: { vars?: number[] }): boolean {
  return Array.isArray(params.vars) && params.vars.length === 10;
}
