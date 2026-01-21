// Surface Heights API - Canonical height calculations for collision and rendering
// SINGLE SOURCE OF TRUTH for all height queries
// No randomness - fully deterministic from NexArt data
// BUG-001: Uses safeNumber to eliminate NaN sources at the source

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
  
  // BUG-001: Use safeNumber at the source of potential NaN
  const elevation = safeNumber(cell.elevation, 0, 'getTerrainHeightAt.elevation');
  const baseH = elevation * WORLD_HEIGHT_SCALE;

  // Apply river carving if on/near river
  const isRiver = !!cell.hasRiver;
  const carve = safeNumber(
    computeRiverCarveDepth(world.terrain, gridX, gridY, flippedY, isRiver, world.seed),
    0,
    'getTerrainHeightAt.carve'
  );

  // Apply path height capping
  let height = baseH - carve;
  if (cell.type === "path" && !cell.isBridge) {
    const waterHeight = safeNumber(getWaterHeight(world.vars), 0, 'getTerrainHeightAt.waterHeight');
    const pathMaxHeight = waterHeight + PATH_HEIGHT_OFFSET;
    height = Math.min(height, pathMaxHeight);
  }

  // Final safety guard (should never trigger if safeNumber is used correctly)
  return safeNumber(height, 0, 'getTerrainHeightAt.final');
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
    // BUG-001: Use safeNumber at the source
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
 * BUG-012: Fixed to sample along bridge orientation, not just 3x3 neighborhood
 * @returns Bridge deck height in world units, or null if not on a bridge
 */
export function getBridgeDeckHeightAt(
  world: WorldData,
  worldX: number,
  worldZ: number
): number | null {
  const result = getTerrainCell(world, worldX, worldZ);
  if (!result) return null;

  const { cell, gridX, gridY, flippedY } = result;

  // Not a bridge
  if (!cell.isBridge && cell.type !== "bridge") {
    return null;
  }

  // BUG-001: Use safeNumber at the source
  const cellElevation = safeNumber(cell.elevation, 0, 'getBridgeDeckHeightAt.elevation');
  const waterHeight = safeNumber(getWaterHeight(world.vars), 0, 'getBridgeDeckHeightAt.waterHeight');
  const baseTerrainH = cellElevation * WORLD_HEIGHT_SCALE;

  // BUG-012: Detect bridge orientation by checking neighbors
  // Look for path/ground cells in cardinal directions to determine endpoints
  const directions: Array<{ dx: number; dy: number; axis: 'NS' | 'EW' }> = [
    { dx: 0, dy: -1, axis: 'NS' }, // North
    { dx: 0, dy: 1, axis: 'NS' },  // South
    { dx: -1, dy: 0, axis: 'EW' }, // West
    { dx: 1, dy: 0, axis: 'EW' },  // East
  ];

  let bridgeAxis: 'NS' | 'EW' | null = null;
  
  // Find the bridge axis by looking for non-bridge endpoints
  for (const dir of directions) {
    const row = world.terrain[flippedY + dir.dy];
    if (!row) continue;
    const neighbor = row[gridX + dir.dx];
    if (!neighbor) continue;
    
    // If neighbor is path or ground (bridge endpoint), this is our axis
    if ((neighbor.type === 'path' || neighbor.type === 'ground') && !neighbor.isBridge) {
      bridgeAxis = dir.axis;
      break;
    }
  }

  // Sample along the bridge axis to find endpoint heights
  let maxEndpointHeight = waterHeight;
  
  // If we found an axis, sample along it; otherwise fall back to 3x3
  if (bridgeAxis === 'NS') {
    // Sample North and South
    for (const dy of [-1, -2, 1, 2]) {
      const row = world.terrain[flippedY + dy];
      if (!row) continue;
      const neighbor = row[gridX];
      if (!neighbor || neighbor.isBridge) continue;
      
      if (neighbor.type === 'water' || neighbor.hasRiver) {
        maxEndpointHeight = Math.max(maxEndpointHeight, waterHeight);
      } else {
        const neighborH = safeNumber(neighbor.elevation, 0, 'getBridgeDeckHeightAt.neighbor') * WORLD_HEIGHT_SCALE;
        maxEndpointHeight = Math.max(maxEndpointHeight, neighborH);
      }
    }
  } else if (bridgeAxis === 'EW') {
    // Sample East and West
    const row = world.terrain[flippedY];
    if (row) {
      for (const dx of [-1, -2, 1, 2]) {
        const neighbor = row[gridX + dx];
        if (!neighbor || neighbor.isBridge) continue;
        
        if (neighbor.type === 'water' || neighbor.hasRiver) {
          maxEndpointHeight = Math.max(maxEndpointHeight, waterHeight);
        } else {
          const neighborH = safeNumber(neighbor.elevation, 0, 'getBridgeDeckHeightAt.neighbor') * WORLD_HEIGHT_SCALE;
          maxEndpointHeight = Math.max(maxEndpointHeight, neighborH);
        }
      }
    }
  } else {
    // Fallback: 3x3 sampling (original behavior)
    for (let dy = -1; dy <= 1; dy++) {
      const row = world.terrain[flippedY + dy];
      if (!row) continue;

      for (let dx = -1; dx <= 1; dx++) {
        const neighbor = row[gridX + dx];
        if (!neighbor) continue;

        if (neighbor.type === "water" || neighbor.hasRiver) {
          maxEndpointHeight = Math.max(maxEndpointHeight, waterHeight);
        } else if (!neighbor.isBridge) {
          const neighborH = safeNumber(neighbor.elevation, 0, 'getBridgeDeckHeightAt.neighbor') * WORLD_HEIGHT_SCALE;
          maxEndpointHeight = Math.max(maxEndpointHeight, neighborH);
        }
      }
    }
  }

  // Bridge deck = max endpoint height + clearance, but at least minimum height
  // Also ensure it's above water
  const deckHeight = Math.max(maxEndpointHeight, waterHeight) + BRIDGE_DECK_CLEARANCE;
  return safeNumber(Math.max(deckHeight, BRIDGE_MIN_HEIGHT), BRIDGE_MIN_HEIGHT, 'getBridgeDeckHeightAt.final');
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

  // BUG-001: Use safeNumber at the source
  const elevation = safeNumber(cell.elevation, 0, 'getRiverbedHeightAt.elevation');
  const baseH = elevation * WORLD_HEIGHT_SCALE;
  const carve = safeNumber(
    computeRiverCarveDepth(world.terrain, gridX, gridY, flippedY, true, world.seed),
    0,
    'getRiverbedHeightAt.carve'
  );

  return safeNumber(baseH - carve, 0, 'getRiverbedHeightAt.final');
}
