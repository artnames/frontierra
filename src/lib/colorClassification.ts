// Color Classification Helpers
// Shared RGB classification used by both 2D map and 3D world parsing
// Ensures consistent tile type detection across the entire pipeline

// Canonical tile colors from NexArt generators
export const TILE_COLORS = {
  OBJECT:   { r: 255, g: 220, b: 60 },
  BRIDGE:   { r: 120, g: 80,  b: 50 },
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
  const dist = colorDistanceSq(r, g, b, TILE_COLORS.RIVER.r, TILE_COLORS.RIVER.g, TILE_COLORS.RIVER.b);
  return dist < COLOR_TOLERANCE * COLOR_TOLERANCE;
}

/**
 * Check if RGB matches water (ocean/lake) color within tolerance
 */
export function isWaterRGB(r: number, g: number, b: number): boolean {
  const dist = colorDistanceSq(r, g, b, TILE_COLORS.WATER.r, TILE_COLORS.WATER.g, TILE_COLORS.WATER.b);
  return dist < COLOR_TOLERANCE * COLOR_TOLERANCE;
}

/**
 * Check if RGB matches path color within tolerance
 */
export function isPathRGB(r: number, g: number, b: number): boolean {
  const dist = colorDistanceSq(r, g, b, TILE_COLORS.PATH.r, TILE_COLORS.PATH.g, TILE_COLORS.PATH.b);
  return dist < COLOR_TOLERANCE * COLOR_TOLERANCE;
}

/**
 * Check if RGB matches bridge color within tolerance
 */
export function isBridgeRGB(r: number, g: number, b: number): boolean {
  const dist = colorDistanceSq(r, g, b, TILE_COLORS.BRIDGE.r, TILE_COLORS.BRIDGE.g, TILE_COLORS.BRIDGE.b);
  return dist < COLOR_TOLERANCE * COLOR_TOLERANCE;
}

/**
 * Check if RGB matches object/landmark color within tolerance
 */
export function isObjectRGB(r: number, g: number, b: number): boolean {
  const dist = colorDistanceSq(r, g, b, TILE_COLORS.OBJECT.r, TILE_COLORS.OBJECT.g, TILE_COLORS.OBJECT.b);
  return dist < COLOR_TOLERANCE * COLOR_TOLERANCE;
}

/**
 * Check if RGB matches forest color within tolerance
 */
export function isForestRGB(r: number, g: number, b: number): boolean {
  const dist = colorDistanceSq(r, g, b, TILE_COLORS.FOREST.r, TILE_COLORS.FOREST.g, TILE_COLORS.FOREST.b);
  return dist < COLOR_TOLERANCE * COLOR_TOLERANCE;
}

/**
 * Check if RGB matches mountain color within tolerance
 */
export function isMountainRGB(r: number, g: number, b: number): boolean {
  const dist = colorDistanceSq(r, g, b, TILE_COLORS.MOUNTAIN.r, TILE_COLORS.MOUNTAIN.g, TILE_COLORS.MOUNTAIN.b);
  return dist < COLOR_TOLERANCE * COLOR_TOLERANCE;
}

export type TileTypeName = 'object' | 'bridge' | 'path' | 'river' | 'water' | 'forest' | 'mountain' | 'ground';

/**
 * Classify tile type from RGB using Euclidean distance matching
 * Returns the closest matching tile type
 */
export function classifyTileRGB(r: number, g: number, b: number): TileTypeName {
  const candidates: { type: TileTypeName; dist: number }[] = [
    { type: 'object', dist: colorDistanceSq(r, g, b, TILE_COLORS.OBJECT.r, TILE_COLORS.OBJECT.g, TILE_COLORS.OBJECT.b) },
    { type: 'bridge', dist: colorDistanceSq(r, g, b, TILE_COLORS.BRIDGE.r, TILE_COLORS.BRIDGE.g, TILE_COLORS.BRIDGE.b) },
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
