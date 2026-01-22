// World A Context - Shared Deterministic Continent
// Defines the fixed 10×10 grid world where macro geography is globally shared
// and player VARs only control local expression

// ============================================
// WORLD CONSTANTS
// ============================================

export const WORLD_A_ID = 'WORLD_A' as const;
export const WORLD_GRID_WIDTH = 10;  // 10×10 = 100 lands total
export const WORLD_GRID_HEIGHT = 10;
export const LAND_PIXEL_SIZE = 64;   // Each land is 64×64 NexArt pixels

// Total world size in NexArt pixels
export const WORLD_TOTAL_WIDTH = WORLD_GRID_WIDTH * LAND_PIXEL_SIZE;   // 640
export const WORLD_TOTAL_HEIGHT = WORLD_GRID_HEIGHT * LAND_PIXEL_SIZE; // 640

// ============================================
// WORLD CONTEXT TYPE
// ============================================

export interface WorldContext {
  worldId: typeof WORLD_A_ID;
  worldX: number;  // 0-9
  worldY: number;  // 0-9
}

// ============================================
// DETERMINISTIC HASH FUNCTION
// djb2 variant for combining multiple values into a seed
// ============================================

function djb2Hash(str: string): number {
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) + hash) ^ str.charCodeAt(i);
    hash = hash >>> 0; // Force unsigned 32-bit
  }
  return hash;
}

/**
 * Compute the combined seed for a land within World A.
 * This seed is used by NexArt and combines:
 * - World ID (WORLD_A)
 * - Land grid coordinates (worldX, worldY)
 * - Player's personal seed (for local variation)
 */
export function getWorldSeed(ctx: WorldContext, playerSeed: number): number {
  const combined = `${ctx.worldId}:${ctx.worldX}:${ctx.worldY}:${playerSeed}`;
  return djb2Hash(combined);
}

/**
 * Get the macro seed for global geography (independent of player).
 * This determines continent shape, major rivers, mountain ranges, coastlines.
 */
export function getMacroSeed(ctx: WorldContext): number {
  const combined = `${ctx.worldId}:MACRO`;
  return djb2Hash(combined);
}

/**
 * Get the position seed for a specific grid cell.
 * Used to compute position-dependent features in the macro geography.
 */
export function getPositionSeed(ctx: WorldContext): number {
  const combined = `${ctx.worldId}:${ctx.worldX}:${ctx.worldY}`;
  return djb2Hash(combined);
}

// ============================================
// COORDINATE VALIDATION
// ============================================

export function isValidWorldPosition(x: number, y: number): boolean {
  return x >= 0 && x < WORLD_GRID_WIDTH && y >= 0 && y < WORLD_GRID_HEIGHT;
}

export function clampWorldPosition(x: number, y: number): { x: number; y: number } {
  return {
    x: Math.max(0, Math.min(WORLD_GRID_WIDTH - 1, Math.floor(x))),
    y: Math.max(0, Math.min(WORLD_GRID_HEIGHT - 1, Math.floor(y)))
  };
}

// ============================================
// WORLD-SPACE COORDINATE CONVERSION
// ============================================

/**
 * Convert local land coordinates (0-63) to world-space coordinates (0-639).
 * This is used by the NexArt sketch to calculate macro geography.
 */
export function landToWorldCoords(
  ctx: WorldContext,
  localX: number,
  localY: number
): { worldGX: number; worldGY: number } {
  return {
    worldGX: ctx.worldX * LAND_PIXEL_SIZE + localX,
    worldGY: ctx.worldY * LAND_PIXEL_SIZE + localY
  };
}

/**
 * Convert world-space coordinates back to land coordinates.
 */
export function worldToLandCoords(
  worldGX: number,
  worldGY: number
): { landX: number; landY: number; localX: number; localY: number } {
  const landX = Math.floor(worldGX / LAND_PIXEL_SIZE);
  const landY = Math.floor(worldGY / LAND_PIXEL_SIZE);
  return {
    landX: Math.max(0, Math.min(WORLD_GRID_WIDTH - 1, landX)),
    landY: Math.max(0, Math.min(WORLD_GRID_HEIGHT - 1, landY)),
    localX: worldGX % LAND_PIXEL_SIZE,
    localY: worldGY % LAND_PIXEL_SIZE
  };
}

// ============================================
// EXPRESSION-ONLY VAR LABELS
// Players control local expression, NOT geography
// ============================================

export const WORLD_A_VAR_LABELS = [
  'Landmark Archetype',      // VAR[0] - Structure/object type
  'Landmark X Bias',         // VAR[1] - Micro offset for placement
  'Landmark Y Bias',         // VAR[2] - Micro offset for placement
  'Terrain Detail Scale',    // VAR[3] - Local noise frequency (micro-bumps)
  'Biome Richness',          // VAR[4] - Color & vegetation variation
  'Forest Density',          // VAR[5] - Tree clustering within fixed forest regions
  'Mountain Steepness',      // VAR[6] - Slope curves, snow caps (NOT placement)
  'Path Wear',               // VAR[7] - Width, erosion, smoothing (NOT routing)
  'Surface Roughness',       // VAR[8] - Normal variation texture
  'Visual Style'             // VAR[9] - Tone / saturation / contrast
] as const;

// ============================================
// DEFAULT WORLD CONTEXT
// ============================================

export function createWorldContext(worldX: number, worldY: number): WorldContext {
  const clamped = clampWorldPosition(worldX, worldY);
  return {
    worldId: WORLD_A_ID,
    worldX: clamped.x,
    worldY: clamped.y
  };
}

// ============================================
// SOLO MODE WORLD CONTEXT
// Derives deterministic world coordinates from seed
// Ensures solo mode uses same generator path as multiplayer
// ============================================

/**
 * Derive deterministic world coordinates from a seed.
 * This ensures solo mode produces identical terrain to multiplayer
 * when using the same seed/vars, by giving it a consistent worldContext.
 */
export function deriveSoloWorldContext(seed: number): { worldX: number; worldY: number } {
  // Use deterministic hash to derive 0-9 coordinates from seed
  const hashX = djb2Hash(`solo-x:${seed}`);
  const hashY = djb2Hash(`solo-y:${seed}`);
  
  return {
    worldX: hashX % WORLD_GRID_WIDTH,
    worldY: hashY % WORLD_GRID_HEIGHT
  };
}
