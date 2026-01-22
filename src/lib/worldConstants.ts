// World Constants - Shared across worldData.ts, SmoothTerrainMesh, EnhancedWaterPlane
// This ensures deterministic, synchronized scales for 3D projection
// SINGLE SOURCE OF TRUTH for all height calculations

// Height scale for converting NexArt elevation (0-1) to 3D world units
export const WORLD_HEIGHT_SCALE = 35;

// ============================================
// PERCEPTUAL ELEVATION CURVE
// Transforms linear Alpha (0-1) into perceptually-shaped elevation
// Applied ONCE during worldData generation - cells store curved values
// ============================================
export function applyElevationCurve(rawElevation: number): number {
  const e = rawElevation;

  if (e < 0.3) {
    return e * 0.33;
  } else if (e < 0.5) {
    const t = (e - 0.3) / 0.2;
    return 0.1 + t * 0.15;
  } else if (e < 0.7) {
    const t = (e - 0.5) / 0.2;
    return 0.25 + Math.pow(t, 1.2) * 0.25;
  } else {
    const t = (e - 0.7) / 0.3;
    return 0.5 + Math.pow(t, 1.5) * 0.5;
  }
}

// ============================================
// WATER LEVEL FUNCTIONS
// ============================================

// Maximum water level ratio (0-1) to prevent flooding entire terrain
// At 100% VAR[4], water should cover ~55% of elevation range max
const WATER_LEVEL_MAX_RATIO = 0.55;

// Raw water level from VAR[4] (uncurved, 0-1 range)
// Clamped to prevent water flooding above reasonable terrain
export function getWaterLevelRaw(vars: number[]): number {
  const rawVar = Math.min(100, Math.max(0, vars[4] ?? 50)); // Clamp VAR to 0-100
  // Map 0-100 to 0.1-0.55 range (was 0.1-0.55 but could exceed if miscalculated)
  return (rawVar / 100) * (WATER_LEVEL_MAX_RATIO - 0.1) + 0.1;
}

// Water level in CURVED terrain space (0-1 range, curved)
export function getWaterLevel(vars: number[]): number {
  const raw = getWaterLevelRaw(vars);
  return applyElevationCurve(raw);
}

// Water height in world units (curved and scaled)
export function getWaterHeight(vars: number[]): number {
  return getWaterLevel(vars) * WORLD_HEIGHT_SCALE;
}

// Path lift above terrain (in world units) - small offset for visual layering
// V2 FIX: Paths use terrain height + small lift, NOT a capped max
export const PATH_HEIGHT_LIFT = 0.05;

// Legacy constant for backwards compatibility - DEPRECATED
// V2 removes the cap behavior that caused z=2 bug
export const PATH_HEIGHT_OFFSET = 0.8;

// NOTE: Bridge constants removed - bridges no longer exist in V2

// ============================================
// RIVER CARVING CONSTANTS - SINGLE SOURCE OF TRUTH
// Used by: SmoothTerrainMesh, worldData.ts getElevationAt, EnhancedWaterPlane
// ============================================

// Bank carve (tiles adjacent to river)
export const RIVER_BANK_CARVE = 1.0;

// Bed carve range (center of river)
export const RIVER_BED_MIN = 1.2;
export const RIVER_BED_MAX = 2.0;

// Clamping for river center cells
export const RIVER_CARVE_CLAMP_MIN = 0.8;
export const RIVER_CARVE_CLAMP_MAX = 1.6;

// Clamping for bank cells
export const RIVER_BANK_CLAMP_MIN = 0.2;
export const RIVER_BANK_CLAMP_MAX = 0.8;

// Water surface sits this far above the carved riverbed
export const RIVER_WATER_ABOVE_BED = 0.25;

// Legacy constant (deprecated, use RIVER_BED_MIN/MAX instead)
export const RIVER_DEPTH_OFFSET = 1.5;

// ============================================
// SHARED RIVER CARVE COMPUTATION
// This MUST be used by all systems: visual mesh, collision, water surface
// ============================================

/**
 * Compute river mask (0-1) based on distance to nearest river cell
 * 1 = river center, 0.6 = adjacent, 0.25 = 2 tiles away, 0 = outside
 */
export function computeRiverMask(
  terrain: { hasRiver?: boolean }[][],
  x: number,
  flippedY: number
): number {
  let best = 0;

  for (let dy = -2; dy <= 2; dy++) {
    const row = terrain[flippedY + dy];
    if (!row) continue;

    for (let dx = -2; dx <= 2; dx++) {
      const c = row[x + dx];
      if (!c?.hasRiver) continue;

      const d = Math.max(Math.abs(dx), Math.abs(dy));
      const w = d === 0 ? 1 : d === 1 ? 0.6 : 0.25;
      if (w > best) best = w;
    }
  }

  return best;
}

/**
 * Deterministic micro-variation for natural-looking riverbed
 */
export function getRiverMicroVariation(x: number, y: number, seed: number): number {
  const n = Math.sin(x * 12.9898 + y * 78.233 + seed * 0.1) * 43758.5453;
  return (n - Math.floor(n)) * 0.15 - 0.075;
}

/**
 * Compute river carve depth at a cell position
 * Returns the amount to subtract from base terrain height
 * MUST be used consistently across visual mesh and collision
 */
export function computeRiverCarveDepth(
  terrain: { hasRiver?: boolean }[][],
  x: number,
  y: number,
  flippedY: number,
  isRiverCell: boolean,
  seed: number
): number {
  const mask = computeRiverMask(terrain, x, flippedY);
  if (mask <= 0) return 0;

  const centerFactor = isRiverCell ? 1 : mask;
  const bedNoise = getRiverMicroVariation(x * 3.1, y * 3.1, seed) * 0.6;

  const bedCarve = RIVER_BED_MIN + (RIVER_BED_MAX - RIVER_BED_MIN) * centerFactor;
  const rawCarve = (isRiverCell ? bedCarve + bedNoise : RIVER_BANK_CARVE) * mask;

  // Apply clamping based on cell type
  const MIN_CLAMP = isRiverCell ? RIVER_CARVE_CLAMP_MIN : RIVER_BANK_CLAMP_MIN;
  const MAX_CLAMP = isRiverCell ? RIVER_CARVE_CLAMP_MAX : RIVER_BANK_CLAMP_MAX;

  return Math.min(MAX_CLAMP, Math.max(MIN_CLAMP, rawCarve));
}

/**
 * Get terrain height at a cell (already curved elevation * scale)
 */
export function getTerrainHeightAtCell(cellElevation: number): number {
  return cellElevation * WORLD_HEIGHT_SCALE;
}

/**
 * Get riverbed height at a position (terrain height minus carve)
 */
export function getRiverbedHeight(
  terrain: { hasRiver?: boolean; elevation?: number }[][],
  x: number,
  y: number,
  flippedY: number,
  cellElevation: number,
  isRiverCell: boolean,
  seed: number
): number {
  const baseH = getTerrainHeightAtCell(cellElevation);
  const carve = computeRiverCarveDepth(terrain, x, y, flippedY, isRiverCell, seed);
  return baseH - carve;
}

/**
 * Get water surface height at a river position
 * Uses the carved riverbed height + water offset
 */
export function getRiverWaterSurfaceHeight(
  terrain: { hasRiver?: boolean; elevation?: number }[][],
  x: number,
  y: number,
  flippedY: number,
  cellElevation: number,
  seed: number
): number {
  // River water sits just above the carved riverbed
  const bedHeight = getRiverbedHeight(terrain, x, y, flippedY, cellElevation, true, seed);
  return bedHeight + RIVER_WATER_ABOVE_BED;
}

// ============================================
// COORDINATE HELPERS - SHARED ACROSS ALL GEOMETRY
// ============================================

/**
 * Convert render Z coordinate to terrain array row index
 * Terrain mesh uses: position Z = y (loop variable)
 * Terrain array uses: terrain[size - 1 - y][x]
 */
export function toRow(z: number, size: number): number {
  return size - 1 - z;
}

/**
 * Get cell from terrain array using render coordinates (x, z)
 * This is the CANONICAL way to access terrain cells from 3D positions
 */
export function cellAt<T>(
  terrain: T[][],
  x: number,
  z: number,
  size: number
): T | undefined {
  const row = toRow(z, size);
  if (row < 0 || row >= terrain.length) return undefined;
  const cells = terrain[row];
  if (!cells || x < 0 || x >= cells.length) return undefined;
  return cells[x];
}

// ============================================
// SURFACE HEIGHT (No bridges - V2)
// ============================================

/**
 * Get surface height at a position - THE canonical function for collision/movement
 * Returns terrain height (with river carving) + path lift if applicable.
 * NOTE: Bridges removed - paths simply stop at water.
 * FIX: Path height is ALWAYS terrain + lift, never capped below terrain.
 */
export function getSurfaceHeightAt(
  terrain: { hasRiver?: boolean; elevation?: number; type?: string }[][],
  x: number,
  y: number,
  flippedY: number,
  cell: { elevation?: number; hasRiver?: boolean; type?: string },
  vars: number[],
  seed: number
): number {
  if (!cell) return 0;
  
  const cellElevation = cell.elevation ?? 0;
  
  // Compute terrain height with river carving
  const baseH = getTerrainHeightAtCell(cellElevation);
  const isRiver = !!cell.hasRiver;
  const carve = computeRiverCarveDepth(terrain, x, y, flippedY, isRiver, seed);
  let terrainHeight = baseH - carve;
  
  // FIX: Paths use terrain height + small lift for visual layering
  // Path height is ALWAYS above terrain, never capped to a maximum
  if (cell.type === 'path') {
    terrainHeight = terrainHeight + PATH_HEIGHT_LIFT;
  }
  
  return terrainHeight;
}
