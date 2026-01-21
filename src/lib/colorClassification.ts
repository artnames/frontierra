// Color Classification Helpers
// SINGLE SOURCE OF TRUTH for RGB → tile type classification
// Used by both 2D map and 3D world parsing to ensure consistent tile detection
// CRITICAL: All RGB classification must go through this module

// Canonical tile colors from NexArt generators
// NOTE: Bridge has been REMOVED - paths skip water, no bridge tiles
export const TILE_COLORS = {
  OBJECT:   { r: 255, g: 220, b: 60 },
  PATH:     { r: 180, g: 150, b: 100 },
  RIVER:    { r: 70,  g: 160, b: 180 },
  WATER:    { r: 30,  g: 80,  b: 140 },
  FOREST:   { r: 60,  g: 120, b: 50 },
  MOUNTAIN: { r: 130, g: 125, b: 120 },
  GROUND:   { r: 160, g: 140, b: 100 }
} as const;

// Color distance tolerance for classification
const COLOR_TOLERANCE = 50;

/**
 * Check if color is near a target within tolerance
 * Uses Euclidean distance in RGB space
 */
export function isNearColor(
  r: number, g: number, b: number,
  targetR: number, targetG: number, targetB: number,
  tol: number = COLOR_TOLERANCE
): boolean {
  const dist = Math.sqrt(
    (r - targetR) ** 2 +
    (g - targetG) ** 2 +
    (b - targetB) ** 2
  );
  return dist < tol;
}

/**
 * Euclidean color distance squared
 */
function colorDistanceSq(r1: number, g1: number, b1: number, r2: number, g2: number, b2: number): number {
  return (r1 - r2) ** 2 + (g1 - g2) ** 2 + (b1 - b2) ** 2;
}

/**
 * Check if RGB matches river color within tolerance
 * SHARED HELPER: Used by both 2D visualization and 3D world parsing
 */
export function isRiverRGB(r: number, g: number, b: number): boolean {
  return isNearColor(r, g, b, TILE_COLORS.RIVER.r, TILE_COLORS.RIVER.g, TILE_COLORS.RIVER.b);
}

/**
 * Check if RGB matches water (ocean/lake) color within tolerance
 */
export function isWaterRGB(r: number, g: number, b: number): boolean {
  return isNearColor(r, g, b, TILE_COLORS.WATER.r, TILE_COLORS.WATER.g, TILE_COLORS.WATER.b);
}

/**
 * Check if RGB matches path color within tolerance
 */
export function isPathRGB(r: number, g: number, b: number): boolean {
  return isNearColor(r, g, b, TILE_COLORS.PATH.r, TILE_COLORS.PATH.g, TILE_COLORS.PATH.b);
}

/**
 * Check if RGB matches object/landmark color within tolerance
 */
export function isObjectRGB(r: number, g: number, b: number): boolean {
  return isNearColor(r, g, b, TILE_COLORS.OBJECT.r, TILE_COLORS.OBJECT.g, TILE_COLORS.OBJECT.b);
}

/**
 * Check if RGB matches forest color within tolerance
 */
export function isForestRGB(r: number, g: number, b: number): boolean {
  return isNearColor(r, g, b, TILE_COLORS.FOREST.r, TILE_COLORS.FOREST.g, TILE_COLORS.FOREST.b);
}

/**
 * Check if RGB matches mountain color within tolerance
 */
export function isMountainRGB(r: number, g: number, b: number): boolean {
  return isNearColor(r, g, b, TILE_COLORS.MOUNTAIN.r, TILE_COLORS.MOUNTAIN.g, TILE_COLORS.MOUNTAIN.b);
}

/**
 * Check if RGB matches ground color within tolerance
 */
export function isGroundRGB(r: number, g: number, b: number): boolean {
  return isNearColor(r, g, b, TILE_COLORS.GROUND.r, TILE_COLORS.GROUND.g, TILE_COLORS.GROUND.b);
}

// NOTE: Bridge type has been REMOVED from the system
export type TileTypeName = 'object' | 'path' | 'river' | 'water' | 'forest' | 'mountain' | 'ground';

/**
 * Classify tile type from RGB using Euclidean distance matching
 * Returns the closest matching tile type
 * NOTE: Bridge has been REMOVED - no bridge classification
 */
export function classifyTileRGB(r: number, g: number, b: number): TileTypeName {
  const candidates: { type: TileTypeName; dist: number }[] = [
    { type: 'object', dist: colorDistanceSq(r, g, b, TILE_COLORS.OBJECT.r, TILE_COLORS.OBJECT.g, TILE_COLORS.OBJECT.b) },
    { type: 'path', dist: colorDistanceSq(r, g, b, TILE_COLORS.PATH.r, TILE_COLORS.PATH.g, TILE_COLORS.PATH.b) },
    { type: 'river', dist: colorDistanceSq(r, g, b, TILE_COLORS.RIVER.r, TILE_COLORS.RIVER.g, TILE_COLORS.RIVER.b) },
    { type: 'water', dist: colorDistanceSq(r, g, b, TILE_COLORS.WATER.r, TILE_COLORS.WATER.g, TILE_COLORS.WATER.b) },
    { type: 'forest', dist: colorDistanceSq(r, g, b, TILE_COLORS.FOREST.r, TILE_COLORS.FOREST.g, TILE_COLORS.FOREST.b) },
    { type: 'mountain', dist: colorDistanceSq(r, g, b, TILE_COLORS.MOUNTAIN.r, TILE_COLORS.MOUNTAIN.g, TILE_COLORS.MOUNTAIN.b) },
    { type: 'ground', dist: colorDistanceSq(r, g, b, TILE_COLORS.GROUND.r, TILE_COLORS.GROUND.g, TILE_COLORS.GROUND.b) },
  ];
  
  candidates.sort((a, b) => a.dist - b.dist);
  return candidates[0].type;
}
