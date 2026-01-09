// World Constants - Shared across worldData.ts and WorldRenderer.tsx
// This ensures deterministic, synchronized scales for 3D projection

// Height scale for converting NexArt elevation (0-1) to 3D world units
// Increased to 35 for dramatic mountains
export const WORLD_HEIGHT_SCALE = 35;

// Water level calculation from VAR[4]
// VAR[4] 0=0.10, 50=0.325, 100=0.55 (matches worldGenerator.ts)
export function getWaterLevel(vars: number[]): number {
  return (vars[4] ?? 50) / 100 * 0.45 + 0.10;
}

// River depth below water level
export const RIVER_DEPTH_OFFSET = 1.5;

// Path max height above water
export const PATH_HEIGHT_OFFSET = 0.8;

// Bridge height above water (match path height for seamless crossings)
export const BRIDGE_HEIGHT_OFFSET = PATH_HEIGHT_OFFSET;
