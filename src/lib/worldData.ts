// World Data - Derived ENTIRELY from NexArt Canonical Layout
// This module provides the 3D projection interface for NexArt-generated worlds
// CRITICAL: No noise/random functions allowed. All data comes from NexArt pixels.
// CRITICAL: Uses shared constants from worldConstants.ts for height/collision alignment

import { NexArtWorldGrid, TileType, GridCell, generateNexArtWorld, verifyNexArtWorld } from "./nexartWorld";
import { WorldParams } from "./worldGenerator";
import {
  WORLD_HEIGHT_SCALE,
  getWaterLevel,
  getWaterLevelRaw,
  getWaterHeight,
  PATH_HEIGHT_OFFSET,
  BRIDGE_FIXED_HEIGHT,
  getSurfaceHeightAt,
} from "./worldConstants";

// ============================================
// WORLD DATA INTERFACES (3D Projection of NexArt)
// ============================================

export interface TerrainCell {
  x: number;
  y: number;
  elevation: number; // From NexArt Alpha channel (CURVED - applied once)
  moisture: number; // Derived from NexArt Green channel
  type: "water" | "ground" | "forest" | "mountain" | "path" | "bridge";
  hasRiver: boolean;
  isPath: boolean;
  isBridge: boolean;
}

export interface WorldObject {
  x: number;
  y: number;
  z: number;
  type: number;
}

export interface SpawnPoint {
  x: number;
  y: number;
  z: number;
  rotationY: number;
}

export interface WorldData {
  seed: number;
  vars: number[];
  gridSize: number;
  terrain: TerrainCell[][];
  plantedObject: WorldObject;
  spawnPoint: SpawnPoint;
  // NexArt verification
  nexartHash: string;
  isNexArtVerified: boolean;
  nexartError?: string;
}

// ============================================
// CONVERT NEXART GRID TO WORLD DATA
// No generation here - pure transformation
// ============================================

function tileTypeToString(type: TileType): TerrainCell["type"] {
  switch (type) {
    case TileType.WATER:
      return "water";
    case TileType.GROUND:
      return "ground";
    case TileType.FOREST:
      return "forest";
    case TileType.MOUNTAIN:
      return "mountain";
    case TileType.PATH:
      return "path";
    case TileType.BRIDGE:
      return "bridge";
    default:
      return "ground";
  }
}

// ============================================
// PERCEPTUAL ELEVATION CURVE
// Transforms linear Alpha (0-1) into perceptually-shaped elevation
// Deterministic, preserves ordering, no external data
// Tuned for WORLD_HEIGHT_SCALE = 35
// ============================================

function applyElevationCurve(rawElevation: number): number {
  // Non-linear curve optimized for heightScale=35:
  // - Compresses low elevations (wide flat plains)
  // - Smooth ramps at mid elevations (rolling hills)
  // - Amplifies high elevations (dramatic peaks)

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

function nexartGridToWorldData(grid: NexArtWorldGrid): WorldData {
  // Use shared constants for synchronized scales
  // Use RAW water level for tile classification (matches NexArt generator logic)
  const rawWaterLevel = getWaterLevelRaw(grid.vars);
  const heightScale = WORLD_HEIGHT_SCALE;

  // Convert cells to terrain - ALL data comes from NexArt pixels
  // RGB = Tile Type (categorical), Alpha = Elevation (continuous 0-1)
  const terrain: TerrainCell[][] = grid.cells.map((row) =>
    row.map((cell: GridCell) => {
      // Direct elevation from Alpha channel (continuous 0-1)
      const rawElevation = cell.elevation;

      // Apply perceptual curve for more natural terrain feel
      const shapedElevation = applyElevationCurve(rawElevation);

      // Determine type from RGB classification first, then elevation
      let type: TerrainCell["type"];

      // Check for path/bridge from RGB
      if (cell.isBridge) {
        type = "bridge";
      } else if (cell.isPath) {
        type = "path";
      } else if (cell.tileType === 0 || rawElevation < rawWaterLevel) {
        // WATER - compare raw elevations (before curve)
        type = "water";
      } else {
        // Use tile type from RGB classification
        const tileType = cell.tileType;
        if (tileType === 3) {
          // MOUNTAIN
          type = "mountain";
        } else if (tileType === 2) {
          // FOREST
          type = "forest";
        } else {
          type = "ground";
        }
      }

      return {
        x: cell.x,
        y: cell.y,
        elevation: shapedElevation, // Use curved elevation
        moisture: cell.g / 255, // Derive from green channel
        type,
        hasRiver: cell.isRiver,
        isPath: cell.isPath,
        isBridge: cell.isBridge,
      };
    }),
  );

  // Calculate object elevation from curved terrain
  const objCell = grid.cells[grid.plantedObjectY]?.[grid.plantedObjectX];
  const objRawElev = objCell?.elevation ?? 0.3;
  const objElevation = applyElevationCurve(objRawElev) * heightScale;

  // Calculate spawn rotation
  const toCenterX = grid.gridSize / 2 - grid.spawnX;
  const toCenterY = grid.gridSize / 2 - grid.spawnY;
  const rotationY = Math.atan2(toCenterX, toCenterY);

  const spawnCell = grid.cells[grid.spawnY]?.[grid.spawnX];
  const spawnRawElev = spawnCell?.elevation ?? 0.3;
  const spawnElevation = applyElevationCurve(spawnRawElev) * heightScale;

  const verification = verifyNexArtWorld(grid);

  return {
    seed: grid.seed,
    vars: grid.vars,
    gridSize: grid.gridSize,
    terrain,
    plantedObject: {
      x: grid.plantedObjectX,
      y: grid.plantedObjectY,
      z: objElevation + 2,
      type: grid.plantedObjectType,
    },
    spawnPoint: {
      x: grid.spawnX,
      y: grid.spawnY,
      z: spawnElevation + 2,
      rotationY,
    },
    nexartHash: grid.pixelHash,
    isNexArtVerified: verification.isVerified,
    nexartError: verification.errorMessage,
  };
}

// ============================================
// PUBLIC API - Async NexArt-based generation
// ============================================

export async function generateWorldDataAsync(
  seed: number,
  vars: number[],
  worldContext?: { worldX: number; worldY: number },
  mappingVersion?: "v1" | "v2",
  microOverrides?: Map<number, number>,
): Promise<WorldData> {
  const grid = await generateNexArtWorld({ seed, vars, worldContext, mappingVersion, microOverrides });

  if (!grid.isValid) {
    return {
      seed,
      vars,
      gridSize: 0,
      terrain: [],
      plantedObject: { x: 0, y: 0, z: 0, type: 0 },
      spawnPoint: { x: 0, y: 0, z: 0, rotationY: 0 },
      nexartHash: "00000000",
      isNexArtVerified: false,
      nexartError: grid.errorMessage || "NexArt generation failed",
    };
  }

  return nexartGridToWorldData(grid);
}

// Synchronous version for legacy compatibility
export function generateWorldData(seed: number, vars: number[]): WorldData {
  const cacheKey = `nexart_${seed}_${vars.join(",")}`;
  const cached = (window as any).__nexartCache?.[cacheKey];

  if (cached) {
    return cached;
  }

  console.warn("generateWorldData called without cached NexArt data. Use generateWorldDataAsync.");
  return {
    seed,
    vars,
    gridSize: 0,
    terrain: [],
    plantedObject: { x: 0, y: 0, z: 0, type: 0 },
    spawnPoint: { x: 0, y: 0, z: 0, rotationY: 0 },
    nexartHash: "00000000",
    isNexArtVerified: false,
    nexartError: "World not yet generated. Call generateWorldDataAsync first.",
  };
}

export function cacheWorldData(world: WorldData): void {
  const cacheKey = `nexart_${world.seed}_${world.vars.join(",")}`;
  if (!(window as any).__nexartCache) {
    (window as any).__nexartCache = {};
  }
  (window as any).__nexartCache[cacheKey] = world;
}

// ============================================
// WORLD QUERY FUNCTIONS - Derived from NexArt
// Height calculation uses unified getSurfaceHeightAt from worldConstants.ts
// ============================================

export function getElevationAt(world: WorldData, worldX: number, worldY: number): number {
  // FIX #6: Guard against incomplete world data
  if (!world || !world.terrain || world.terrain.length === 0 || !world.gridSize) {
    return 0;
  }

  if (!world.isNexArtVerified) {
    return 0;
  }

  const gridX = Math.floor(worldX);
  const gridY = Math.floor(worldY);

  // FIX #6: Explicit bounds checks with safe fallback
  if (gridX < 0 || gridX >= world.gridSize || gridY < 0 || gridY >= world.gridSize) {
    // Return safe height (0) for out-of-bounds positions
    return 0;
  }

  // COORDINATE FIX: Flip Y-axis to match P5.js [y][x] grid with Three.js PlaneGeometry
  // P5.js draws from top-left, Three.js PlaneGeometry maps from bottom-left
  const flippedY = world.gridSize - 1 - gridY;

  // FIX #6: Additional bounds check for flipped coordinate
  if (flippedY < 0 || flippedY >= world.terrain.length) {
    return 0;
  }

  const row = world.terrain[flippedY];
  if (!row || gridX >= row.length) {
    return 0;
  }

  const cell = row[gridX];
  if (!cell) return 0;

  // Use the unified getSurfaceHeightAt function from worldConstants
  // This handles terrain, river carving, path capping, AND bridge deck height
  const height = getSurfaceHeightAt(
    world.terrain,
    gridX,
    gridY,
    flippedY,
    cell,
    world.vars,
    world.seed
  );

  // FIX #6: Guard against NaN/Infinity in height calculation
  if (!Number.isFinite(height)) {
    return 0;
  }

  return height;
}

export function isWalkable(world: WorldData, worldX: number, worldY: number): boolean {
  // FIX #6: Guard against incomplete world data - safely return false
  if (!world || !world.terrain || world.terrain.length === 0 || !world.gridSize) {
    return false;
  }

  if (!world.isNexArtVerified) {
    return false;
  }

  const gridX = Math.floor(worldX);
  const gridY = Math.floor(worldY);

  // FIX #6: Explicit bounds check
  if (gridX < 0 || gridX >= world.gridSize || gridY < 0 || gridY >= world.gridSize) {
    return false;
  }

  // COORDINATE FIX: Flip Y-axis to match P5.js [y][x] grid with Three.js
  const flippedY = world.gridSize - 1 - gridY;

  // FIX #6: Additional bounds check for flipped coordinate
  if (flippedY < 0 || flippedY >= world.terrain.length) {
    return false;
  }

  const row = world.terrain[flippedY];
  if (!row || gridX >= row.length) {
    return false;
  }

  const cell = row[gridX];
  if (!cell) return false;

  // Bridges are walkable over water
  if (cell.isBridge || cell.type === "bridge") {
    return true;
  }

  // Water and rivers are not walkable
  if (cell.type === "water" || cell.hasRiver) {
    return false;
  }

  return true;
}

export function distanceToObject(world: WorldData, worldX: number, worldY: number): number {
  // Guard against incomplete world data
  if (!world || !world.terrain || world.terrain.length === 0 || !world.gridSize || !world.plantedObject) {
    return Infinity;
  }

  // COORDINATE FIX: The player moves in Three.js space where:
  // - Y is flipped (grid Y -> gridSize - 1 - Y)
  // - Terrain is at origin (no gridSize/2 offset since TexturedTerrainMesh is at 0,0,0)
  const objectFlippedY = world.gridSize - 1 - world.plantedObject.y;

  // Object world position matches player coordinate system (no offset)
  const objectWorldX = world.plantedObject.x;
  const objectWorldZ = objectFlippedY;

  const dx = worldX - objectWorldX;
  const dy = worldY - objectWorldZ;
  return Math.sqrt(dx * dx + dy * dy);
}

export function isWorldValid(world: WorldData): boolean {
  return !!(world && world.terrain && world.terrain.length > 0 && world.gridSize > 0 && world.isNexArtVerified);
}

// ============================================
// WATER QUERY FUNCTIONS - Canonical water detection
// ============================================

/**
 * Determines if a position is in water (ocean, river, or any water body).
 * This is the CANONICAL helper for water detection.
 * Returns true if the cell is water or a river (but NOT a bridge).
 */
export function isWaterAt(world: WorldData, worldX: number, worldY: number): boolean {
  // FIX #6: Guard against incomplete world data - safely return false
  if (!world || !world.terrain || world.terrain.length === 0 || !world.gridSize) {
    return false;
  }

  const gridX = Math.floor(worldX);
  const gridY = Math.floor(worldY);

  // FIX #6: Explicit bounds check
  if (gridX < 0 || gridX >= world.gridSize || gridY < 0 || gridY >= world.gridSize) {
    return false;
  }

  // COORDINATE FIX: Flip Y-axis to match P5.js [y][x] grid with Three.js
  const flippedY = world.gridSize - 1 - gridY;

  // FIX #6: Additional bounds check for flipped coordinate
  if (flippedY < 0 || flippedY >= world.terrain.length) {
    return false;
  }

  const row = world.terrain[flippedY];
  if (!row || gridX >= row.length) {
    return false;
  }

  const cell = row[gridX];
  if (!cell) return false;

  // Bridges are walkable over water
  if (cell.isBridge || cell.type === "bridge") {
    return false;
  }

  // Water type or river = water
  return cell.type === "water" || cell.hasRiver;
}

/**
 * Returns the surface height at a position - either terrain or water surface.
 * For water cells, returns the water surface height.
 * For land cells, returns terrain height.
 */
export function getSurfaceZ(world: WorldData, worldX: number, worldY: number): number {
  // Guard against incomplete world data
  if (!world || !world.terrain || world.terrain.length === 0 || !world.gridSize) {
    return 0;
  }

  const isWater = isWaterAt(world, worldX, worldY);
  
  if (isWater) {
    // Return water surface height
    const waterLevel = getWaterLevel(world.vars);
    return waterLevel * WORLD_HEIGHT_SCALE;
  }

  // Return terrain height
  return getElevationAt(world, worldX, worldY);
}

/**
 * Check if a position is near water (within buffer distance).
 * Useful for vegetation placement to avoid shorelines.
 */
export function isNearWater(world: WorldData, worldX: number, worldY: number, bufferDistance: number = 1.0): boolean {
  // Guard against incomplete world data
  if (!world || !world.terrain || world.terrain.length === 0 || !world.gridSize) {
    return false;
  }

  // Check center
  if (isWaterAt(world, worldX, worldY)) {
    return true;
  }

  // Check surrounding cells at buffer distance
  const offsets = [
    [bufferDistance, 0],
    [-bufferDistance, 0],
    [0, bufferDistance],
    [0, -bufferDistance],
    [bufferDistance * 0.7, bufferDistance * 0.7],
    [-bufferDistance * 0.7, bufferDistance * 0.7],
    [bufferDistance * 0.7, -bufferDistance * 0.7],
    [-bufferDistance * 0.7, -bufferDistance * 0.7],
  ];

  for (const [dx, dy] of offsets) {
    if (isWaterAt(world, worldX + dx, worldY + dy)) {
      return true;
    }
  }

  return false;
}
