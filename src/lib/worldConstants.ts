// World Constants - Shared across worldData.ts and WorldRenderer.tsx
// This ensures deterministic, synchronized scales for 3D projection

// Height scale for converting NexArt elevation (0-1) to 3D world units
// Increased to 35 for dramatic mountains
export const WORLD_HEIGHT_SCALE = 35;

// Water level calculation from VAR[4]
// VAR[4] 0=0.10, 50=0.325, 100=0.55 (matches worldGenerator.ts)
export function getWaterLevel(vars: number[]): number {
  return ((vars[4] ?? 50) / 100) * 0.45 + 0.1;
}

// River depth below water level (in world units, not scaled)
export const RIVER_DEPTH_OFFSET = 3;

// Path max height above water (in world units, not scaled)
export const PATH_HEIGHT_OFFSET = 0.8;

// Fixed bridge height - bridges sit just above the water surface
// This is an absolute height, not relative to scaled water level
export const BRIDGE_FIXED_HEIGHT = 2.5;
