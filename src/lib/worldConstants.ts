// World Constants - Shared across worldData.ts and WorldRenderer.tsx
// This ensures deterministic, synchronized scales for 3D projection

// Height scale for converting NexArt elevation (0-1) to 3D world units
// User-requested standardized value: 15
export const WORLD_HEIGHT_SCALE = 15;

// Water level calculation from VAR[4]
// VAR[4] 0=0.15, 50=0.40, 100=0.65
export function getWaterLevel(vars: number[]): number {
  return (vars[4] ?? 50) / 100 * 0.50 + 0.15;
}

// River depth below water level
export const RIVER_DEPTH_OFFSET = 0.8;

// Path max height above water
export const PATH_HEIGHT_OFFSET = 0.4;

// Bridge height above water
export const BRIDGE_HEIGHT_OFFSET = 0.3;
