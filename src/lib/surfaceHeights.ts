// Surface Heights API - Canonical height calculations for collision and rendering
// SINGLE SOURCE OF TRUTH for all height queries
// No randomness - fully deterministic from NexArt data
// NOTE: Bridge logic REMOVED - paths skip water

import { WorldData, TerrainCell } from "@/lib/worldData";
import {
  WORLD_HEIGHT_SCALE,
  getWaterHeight,
  RIVER_WATER_ABOVE_BED,
  PATH_HEIGHT_OFFSET,
  computeRiverCarveDepth,
} from "@/lib/worldConstants";
import { safeNumber } from "@/lib/safeNumber";

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
 * Get raw terrain height at a position (without river carving)
 */
export function getTerrainHeightAt(
  world: WorldData,
  worldX: number,
  worldZ: number
): number {
  const result = getTerrainCell(world, worldX, worldZ);
  if (!result) return 0;

  const { cell, gridX, gridY, flippedY } = result;
  
  const elevation = safeNumber(cell.elevation, 0, 'getTerrainHeightAt.elevation');
  const baseH = elevation * WORLD_HEIGHT_SCALE;

  // Apply river carving if on/near river
  const isRiver = !!cell.hasRiver;
  const carve = safeNumber(
    computeRiverCarveDepth(world.terrain, gridX, gridY, flippedY, isRiver, world.seed),
    0,
    'getTerrainHeightAt.carve'
  );

  let height = baseH - carve;
  
  // Paths: add small lift above terrain for visibility (bridge removed)
  // No max cap - paths follow terrain contours naturally
  if (cell.type === "path") {
    height = baseH + 0.05;
  }

  return safeNumber(height, 0, 'getTerrainHeightAt.final');
}

// ===========================================
// WATER SURFACE HEIGHT
// ===========================================

/**
 * Get water surface height at a position
 * For ocean/lakes: uses global water level from vars
 * For rivers: uses riverbed height + offset
 */
export function getWaterSurfaceHeightAt(
  world: WorldData,
  worldX: number,
  worldZ: number
): number | null {
  const result = getTerrainCell(world, worldX, worldZ);
  if (!result) return null;

  const { cell, gridX, gridY, flippedY } = result;

  // Not water (bridge check removed)
  if (cell.type !== "water" && !cell.hasRiver) {
    return null;
  }

  // River water surface = carved riverbed + offset
  if (cell.hasRiver && cell.type !== "water") {
    const elevation = safeNumber(cell.elevation, 0, 'getWaterSurfaceHeightAt.elevation');
    const baseH = elevation * WORLD_HEIGHT_SCALE;
    const carve = safeNumber(
      computeRiverCarveDepth(world.terrain, gridX, gridY, flippedY, true, world.seed),
      0,
      'getWaterSurfaceHeightAt.carve'
    );
    const riverbedHeight = baseH - carve;
    return safeNumber(riverbedHeight + RIVER_WATER_ABOVE_BED, 0, 'getWaterSurfaceHeightAt.river');
  }

  // Ocean/lake water surface = global water level
  return safeNumber(getWaterHeight(world.vars), 0, 'getWaterSurfaceHeightAt.ocean');
}

/**
 * Get water surface height, defaulting to global water level if not at water
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
// WALKABLE HEIGHT (UNIFIED API) - Bridge logic removed
// ===========================================

/**
 * Get the walkable surface height at a position
 * This is THE canonical function for player collision/movement
 * Returns terrain height (with river carving)
 */
export function getWalkableHeightAt(
  world: WorldData,
  worldX: number,
  worldZ: number
): number {
  // Just return terrain height (bridge logic removed)
  return getTerrainHeightAt(world, worldX, worldZ);
}

// ===========================================
// UTILITY FUNCTIONS
// ===========================================

/**
 * Check if a position is over water (ocean, river, or any water body)
 */
export function isOverWater(
  world: WorldData,
  worldX: number,
  worldZ: number
): boolean {
  const result = getTerrainCell(world, worldX, worldZ);
  if (!result) return false;

  const { cell } = result;

  return cell.type === "water" || cell.hasRiver;
}

/**
 * Get riverbed height at a position (for rendering water depth)
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

  const elevation = safeNumber(cell.elevation, 0, 'getRiverbedHeightAt.elevation');
  const baseH = elevation * WORLD_HEIGHT_SCALE;
  const carve = safeNumber(
    computeRiverCarveDepth(world.terrain, gridX, gridY, flippedY, true, world.seed),
    0,
    'getRiverbedHeightAt.carve'
  );

  return safeNumber(baseH - carve, 0, 'getRiverbedHeightAt.final');
}
