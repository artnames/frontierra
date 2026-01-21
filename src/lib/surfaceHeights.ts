// Surface Heights API - Canonical height calculations for collision and rendering
// SINGLE SOURCE OF TRUTH for all height queries
// No randomness - fully deterministic from NexArt data

import { WorldData, TerrainCell } from "@/lib/worldData";
import {
  WORLD_HEIGHT_SCALE,
  getWaterHeight,
  getWaterLevel,
  RIVER_WATER_ABOVE_BED,
  BRIDGE_DECK_CLEARANCE,
  BRIDGE_MIN_HEIGHT,
  PATH_HEIGHT_OFFSET,
  computeRiverCarveDepth,
} from "@/lib/worldConstants";

// ===========================================
// COORDINATE HELPERS
// ===========================================

/**
 * Convert world coordinates to grid cell with bounds checking
 * Returns null if out of bounds
 */
export function getTerrainCell(
  world: WorldData,
  worldX: number,
  worldZ: number
): { cell: TerrainCell; gridX: number; gridY: number; flippedY: number } | null {
  if (!world?.terrain || world.terrain.length === 0 || !world.gridSize) {
    return null;
  }

  const gridX = Math.floor(worldX);
  const gridY = Math.floor(worldZ);

  if (gridX < 0 || gridX >= world.gridSize || gridY < 0 || gridY >= world.gridSize) {
    return null;
  }

  // COORDINATE FIX: Flip Y-axis to match P5.js [y][x] grid with Three.js
  const flippedY = world.gridSize - 1 - gridY;

  if (flippedY < 0 || flippedY >= world.terrain.length) {
    return null;
  }

  const row = world.terrain[flippedY];
  if (!row || gridX >= row.length) {
    return null;
  }

  const cell = row[gridX];
  if (!cell) {
    return null;
  }

  return { cell, gridX, gridY, flippedY };
}

// ===========================================
// TERRAIN HEIGHT
// ===========================================

/**
 * Get raw terrain height at a position (without river carving or bridges)
 * @param world - World data
 * @param worldX - X position in world space
 * @param worldZ - Z position in world space (note: Z in Three.js = Y in 2D grid)
 * @returns Height in world units, or 0 if position is invalid
 */
export function getTerrainHeightAt(
  world: WorldData,
  worldX: number,
  worldZ: number
): number {
  const result = getTerrainCell(world, worldX, worldZ);
  if (!result) return 0;

  const { cell, gridX, gridY, flippedY } = result;
  const baseH = (cell.elevation ?? 0) * WORLD_HEIGHT_SCALE;

  // Apply river carving if on/near river
  const isRiver = !!cell.hasRiver;
  const carve = computeRiverCarveDepth(
    world.terrain,
    gridX,
    gridY,
    flippedY,
    isRiver,
    world.seed
  );

  // Apply path height capping
  let height = baseH - carve;
  if (cell.type === "path" && !cell.isBridge) {
    const waterHeight = getWaterHeight(world.vars);
    const pathMaxHeight = waterHeight + PATH_HEIGHT_OFFSET;
    height = Math.min(height, pathMaxHeight);
  }

  // Guard against NaN/Infinity
  if (!Number.isFinite(height)) {
    return 0;
  }

  return height;
}

// ===========================================
// WATER SURFACE HEIGHT
// ===========================================

/**
 * Get water surface height at a position
 * For ocean/lakes: uses global water level from vars
 * For rivers: uses riverbed height + offset
 * @returns Water surface height in world units, or null if not water
 */
export function getWaterSurfaceHeightAt(
  world: WorldData,
  worldX: number,
  worldZ: number
): number | null {
  const result = getTerrainCell(world, worldX, worldZ);
  if (!result) return null;

  const { cell, gridX, gridY, flippedY } = result;

  // Not water
  if (cell.type !== "water" && !cell.hasRiver) {
    return null;
  }

  // Bridges are over water but not "in" water
  if (cell.isBridge || cell.type === "bridge") {
    return null;
  }

  // River water surface = carved riverbed + offset
  if (cell.hasRiver && cell.type !== "water") {
    const baseH = (cell.elevation ?? 0) * WORLD_HEIGHT_SCALE;
    const carve = computeRiverCarveDepth(
      world.terrain,
      gridX,
      gridY,
      flippedY,
      true,
      world.seed
    );
    const riverbedHeight = baseH - carve;
    return riverbedHeight + RIVER_WATER_ABOVE_BED;
  }

  // Ocean/lake water surface = global water level
  return getWaterHeight(world.vars);
}

/**
 * Get water surface height, defaulting to global water level if not at water
 * Useful for rendering when you need a water height regardless of position
 */
export function getWaterSurfaceHeightOrDefault(
  world: WorldData,
  worldX: number,
  worldZ: number
): number {
  const waterHeight = getWaterSurfaceHeightAt(world, worldX, worldZ);
  return waterHeight ?? getWaterHeight(world.vars);
}

// ===========================================
// BRIDGE DECK HEIGHT
// ===========================================

/**
 * Get bridge deck height at a position
 * @returns Bridge deck height in world units, or null if not on a bridge
 */
export function getBridgeDeckHeightAt(
  world: WorldData,
  worldX: number,
  worldZ: number
): number | null {
  const result = getTerrainCell(world, worldX, worldZ);
  if (!result) return null;

  const { cell, gridX, flippedY } = result;

  // Not a bridge
  if (!cell.isBridge && cell.type !== "bridge") {
    return null;
  }

  const cellElevation = cell.elevation ?? 0;
  const waterHeight = getWaterHeight(world.vars);
  const baseTerrainH = cellElevation * WORLD_HEIGHT_SCALE;

  // Sample nearby cells to find the appropriate deck height for the span
  let maxLocalHeight = Math.max(baseTerrainH, waterHeight);

  for (let dy = -1; dy <= 1; dy++) {
    const row = world.terrain[flippedY + dy];
    if (!row) continue;

    for (let dx = -1; dx <= 1; dx++) {
      const neighbor = row[gridX + dx];
      if (!neighbor) continue;

      // If neighbor is water/river, use water height
      if (neighbor.type === "water" || neighbor.hasRiver) {
        maxLocalHeight = Math.max(maxLocalHeight, waterHeight);
      } else if (!neighbor.isBridge) {
        // Use terrain height for non-bridge land cells
        const neighborH = (neighbor.elevation ?? 0) * WORLD_HEIGHT_SCALE;
        maxLocalHeight = Math.max(maxLocalHeight, neighborH);
      }
    }
  }

  // Bridge deck = local maximum height + clearance, but at least minimum height
  const deckHeight = maxLocalHeight + BRIDGE_DECK_CLEARANCE;
  return Math.max(deckHeight, BRIDGE_MIN_HEIGHT);
}

// ===========================================
// WALKABLE HEIGHT (UNIFIED API)
// ===========================================

/**
 * Get the walkable surface height at a position
 * This is THE canonical function for player collision/movement
 * Returns: bridge deck if on bridge, else terrain height (with river carving)
 */
export function getWalkableHeightAt(
  world: WorldData,
  worldX: number,
  worldZ: number
): number {
  // Try bridge first
  const bridgeHeight = getBridgeDeckHeightAt(world, worldX, worldZ);
  if (bridgeHeight !== null) {
    // Return max of bridge deck and terrain (bridges always above terrain)
    const terrainHeight = getTerrainHeightAt(world, worldX, worldZ);
    return Math.max(bridgeHeight, terrainHeight);
  }

  // Otherwise return terrain height
  return getTerrainHeightAt(world, worldX, worldZ);
}

// ===========================================
// UTILITY FUNCTIONS
// ===========================================

/**
 * Check if a position is over water (ocean, river, or any water body)
 * Excludes bridges
 */
export function isOverWater(
  world: WorldData,
  worldX: number,
  worldZ: number
): boolean {
  const result = getTerrainCell(world, worldX, worldZ);
  if (!result) return false;

  const { cell } = result;

  // Bridges are over water but player is on bridge
  if (cell.isBridge || cell.type === "bridge") {
    return false;
  }

  return cell.type === "water" || cell.hasRiver;
}

/**
 * Check if a position is on a bridge
 */
export function isOnBridge(
  world: WorldData,
  worldX: number,
  worldZ: number
): boolean {
  const result = getTerrainCell(world, worldX, worldZ);
  if (!result) return false;

  return result.cell.isBridge || result.cell.type === "bridge";
}

/**
 * Get riverbed height at a position (for rendering water depth)
 * @returns Riverbed height in world units, or null if not a river
 */
export function getRiverbedHeightAt(
  world: WorldData,
  worldX: number,
  worldZ: number
): number | null {
  const result = getTerrainCell(world, worldX, worldZ);
  if (!result) return null;

  const { cell, gridX, gridY, flippedY } = result;

  if (!cell.hasRiver) {
    return null;
  }

  const baseH = (cell.elevation ?? 0) * WORLD_HEIGHT_SCALE;
  const carve = computeRiverCarveDepth(
    world.terrain,
    gridX,
    gridY,
    flippedY,
    true,
    world.seed
  );

  return baseH - carve;
}
