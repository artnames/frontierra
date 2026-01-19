// World Constants - Shared across worldData.ts and WorldRenderer.tsx
// This ensures deterministic, synchronized scales for 3D projection

// Height scale for converting NexArt elevation (0-1) to 3D world units
// Increased to 35 for dramatic mountains
export const WORLD_HEIGHT_SCALE = 35;

// ============================================
// PERCEPTUAL ELEVATION CURVE
// Must match the curve in worldData.ts exactly
// Transforms linear Alpha (0-1) into perceptually-shaped elevation
// ============================================
function applyElevationCurve(rawElevation: number): number {
  const e = rawElevation;

  if (e < 0.3) {
    // Low elevation: flatten for walkable plains
    // Maps 0-0.30 → 0-0.10
    return e * 0.33;
  } else if (e < 0.5) {
    // Mid elevation: gentle rolling hills
    // Maps 0.30-0.50 → 0.10-0.25
    const t = (e - 0.3) / 0.2;
    return 0.1 + t * 0.15;
  } else if (e < 0.7) {
    // Upper-mid: steeper hills transitioning to mountains
    // Maps 0.50-0.70 → 0.25-0.50
    const t = (e - 0.5) / 0.2;
    return 0.25 + Math.pow(t, 1.2) * 0.25;
  } else {
    // High elevation: exponential amplification for dramatic peaks
    // Maps 0.70-1.0 → 0.50-1.0
    const t = (e - 0.7) / 0.3;
    return 0.5 + Math.pow(t, 1.5) * 0.5;
  }
}

// Raw water level from VAR[4] (uncurved, 0-1 range)
// VAR[4] 0=0.10, 50=0.325, 100=0.55 (matches worldGenerator.ts)
export function getWaterLevelRaw(vars: number[]): number {
  return ((vars[4] ?? 50) / 100) * 0.45 + 0.1;
}

// Water level in CURVED terrain space (0-1 range, curved)
// This is where the flat water plane should sit to match curved terrain
export function getWaterLevel(vars: number[]): number {
  const raw = getWaterLevelRaw(vars);
  return applyElevationCurve(raw);
}

// Water height in world units (curved and scaled)
export function getWaterHeight(vars: number[]): number {
  return getWaterLevel(vars) * WORLD_HEIGHT_SCALE;
}

// River depth below water level (in world units, not scaled)
export const RIVER_DEPTH_OFFSET = 1.5;

// Path max height above water (in world units, not scaled)
export const PATH_HEIGHT_OFFSET = 0.8;

// Fixed bridge height - bridges sit just above the water surface
// This is an absolute height, not relative to scaled water level
export const BRIDGE_FIXED_HEIGHT = 2.5;

// ============================================
// RIVER CARVING CONSTANTS
// Must be identical in worldData.ts and SmoothTerrainMesh.tsx
// ============================================

// Carve amounts for river geometry (world units)
export const RIVER_BANK_CARVE = 1.0;      // Shallow carve for banks
export const RIVER_BED_MIN = 2.4;          // Minimum bed carve at center
export const RIVER_BED_MAX = 20;           // Maximum bed carve at center
export const RIVER_CARVE_CLAMP_MIN = 0.5;  // Min visible carve for river cells
export const RIVER_CARVE_CLAMP_MAX = 1.8;  // Max carve for visual mesh
export const RIVER_BANK_CLAMP_MIN = 0.18;  // Min visible carve for bank cells
export const RIVER_BANK_CLAMP_MAX = 0.9;   // Max carve for bank cells

// Water above carved riverbed (for EnhancedWaterPlane)
export const RIVER_WATER_ABOVE_BED = 0.3;
