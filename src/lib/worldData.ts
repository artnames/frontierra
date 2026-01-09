// World Data - Derived from NexArt Canonical Layout
// This module provides the 3D projection interface for NexArt-generated worlds
// IMPORTANT: World generation MUST go through NexArt - no independent generation

import { NexArtWorldGrid, TileType, GridCell, generateNexArtWorld, verifyNexArtWorld } from './nexartWorld';
import { WorldParams } from './worldGenerator';

// ============================================
// WORLD DATA INTERFACES (3D Projection)
// ============================================

export interface TerrainCell {
  x: number;
  y: number;
  elevation: number;
  type: 'water' | 'ground' | 'forest' | 'mountain' | 'path' | 'bridge';
  hasLandmark: boolean;
  landmarkType: number;
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
// ============================================

function tileTypeToString(type: TileType): TerrainCell['type'] {
  switch (type) {
    case TileType.WATER: return 'water';
    case TileType.GROUND: return 'ground';
    case TileType.FOREST: return 'forest';
    case TileType.MOUNTAIN: return 'mountain';
    case TileType.PATH: return 'path';
    case TileType.BRIDGE: return 'bridge';
    default: return 'ground';
  }
}

function nexartGridToWorldData(grid: NexArtWorldGrid): WorldData {
  const waterLevel = (grid.vars[4] ?? 30) / 100 * 0.35 + 0.15;
  
  // Convert cells to terrain
  const terrain: TerrainCell[][] = grid.cells.map(row =>
    row.map((cell: GridCell) => ({
      x: cell.x,
      y: cell.y,
      elevation: cell.elevation,
      type: tileTypeToString(cell.tileType),
      hasLandmark: cell.hasLandmark,
      landmarkType: cell.landmarkType,
      isPath: cell.isPath,
      isBridge: cell.isBridge
    }))
  );
  
  // Calculate object elevation
  const objCell = grid.cells[grid.plantedObjectY]?.[grid.plantedObjectX];
  const objElevation = objCell?.tileType === TileType.WATER ? waterLevel : (objCell?.elevation ?? 0.3);
  
  // Calculate spawn rotation
  const toCenterX = grid.gridSize / 2 - grid.spawnX;
  const toCenterY = grid.gridSize / 2 - grid.spawnY;
  const rotationY = Math.atan2(toCenterX, toCenterY);
  
  const spawnCell = grid.cells[grid.spawnY]?.[grid.spawnX];
  const spawnElevation = spawnCell?.elevation ?? 0.3;
  
  const verification = verifyNexArtWorld(grid);
  
  return {
    seed: grid.seed,
    vars: grid.vars,
    gridSize: grid.gridSize,
    terrain,
    plantedObject: {
      x: grid.plantedObjectX,
      y: grid.plantedObjectY,
      z: objElevation * 20 + 2,
      type: grid.plantedObjectType
    },
    spawnPoint: {
      x: grid.spawnX,
      y: grid.spawnY,
      z: spawnElevation * 20 + 2,
      rotationY
    },
    nexartHash: grid.pixelHash,
    isNexArtVerified: verification.isVerified,
    nexartError: verification.errorMessage
  };
}

// ============================================
// PUBLIC API - Async NexArt-based generation
// ============================================

/**
 * Generate world data from NexArt (ASYNC)
 * This is the ONLY valid way to generate world data
 * 
 * @throws Never - returns invalid world state on failure
 */
export async function generateWorldDataAsync(seed: number, vars: number[]): Promise<WorldData> {
  const grid = await generateNexArtWorld({ seed, vars });
  
  if (!grid.isValid) {
    // Return an invalid world state - NO FALLBACK
    return {
      seed,
      vars,
      gridSize: 0,
      terrain: [],
      plantedObject: { x: 0, y: 0, z: 0, type: 0 },
      spawnPoint: { x: 0, y: 0, z: 0, rotationY: 0 },
      nexartHash: '00000000',
      isNexArtVerified: false,
      nexartError: grid.errorMessage || 'NexArt generation failed'
    };
  }
  
  return nexartGridToWorldData(grid);
}

/**
 * Synchronous world generation - FOR LEGACY COMPATIBILITY ONLY
 * Uses cached NexArt result or returns invalid state
 * 
 * @deprecated Use generateWorldDataAsync instead
 */
export function generateWorldData(seed: number, vars: number[]): WorldData {
  // Check if we have a cached result
  const cacheKey = `nexart_${seed}_${vars.join(',')}`;
  const cached = (window as any).__nexartCache?.[cacheKey];
  
  if (cached) {
    return cached;
  }
  
  // Return invalid state - must use async version
  console.warn('generateWorldData called without cached NexArt data. Use generateWorldDataAsync.');
  return {
    seed,
    vars,
    gridSize: 0,
    terrain: [],
    plantedObject: { x: 0, y: 0, z: 0, type: 0 },
    spawnPoint: { x: 0, y: 0, z: 0, rotationY: 0 },
    nexartHash: '00000000',
    isNexArtVerified: false,
    nexartError: 'World not yet generated. Call generateWorldDataAsync first.'
  };
}

/**
 * Cache world data for synchronous access
 */
export function cacheWorldData(world: WorldData): void {
  const cacheKey = `nexart_${world.seed}_${world.vars.join(',')}`;
  if (!(window as any).__nexartCache) {
    (window as any).__nexartCache = {};
  }
  (window as any).__nexartCache[cacheKey] = world;
}

// ============================================
// WORLD QUERY FUNCTIONS
// ============================================

/**
 * Get elevation at any world position (with interpolation)
 */
export function getElevationAt(world: WorldData, worldX: number, worldY: number): number {
  if (!world.isNexArtVerified || world.terrain.length === 0) {
    return 0;
  }
  
  const gridX = Math.floor(worldX);
  const gridY = Math.floor(worldY);
  
  if (gridX < 0 || gridX >= world.gridSize - 1 || gridY < 0 || gridY >= world.gridSize - 1) {
    return 0;
  }
  
  // Check if we're on a bridge - return bridge height
  const cell = world.terrain[gridY]?.[gridX];
  if (cell?.type === 'bridge') {
    const waterLevel = (world.vars[4] ?? 30) / 100 * 0.35 + 0.15;
    return waterLevel * 20 + 0.3 * 20;
  }
  
  const fx = worldX - gridX;
  const fy = worldY - gridY;
  
  const e00 = world.terrain[gridY][gridX].elevation;
  const e10 = world.terrain[gridY][gridX + 1].elevation;
  const e01 = world.terrain[gridY + 1][gridX].elevation;
  const e11 = world.terrain[gridY + 1][gridX + 1].elevation;
  
  const e0 = e00 * (1 - fx) + e10 * fx;
  const e1 = e01 * (1 - fx) + e11 * fx;
  
  return (e0 * (1 - fy) + e1 * fy) * 20;
}

/**
 * Check if position is walkable
 */
export function isWalkable(world: WorldData, worldX: number, worldY: number): boolean {
  if (!world.isNexArtVerified || world.terrain.length === 0) {
    return false;
  }
  
  const gridX = Math.floor(worldX);
  const gridY = Math.floor(worldY);
  
  if (gridX < 0 || gridX >= world.gridSize || gridY < 0 || gridY >= world.gridSize) {
    return false;
  }
  
  const cell = world.terrain[gridY]?.[gridX];
  return cell?.type !== 'water';
}

/**
 * Calculate distance to planted object
 */
export function distanceToObject(world: WorldData, worldX: number, worldY: number): number {
  const dx = worldX - world.plantedObject.x;
  const dy = worldY - world.plantedObject.y;
  return Math.sqrt(dx * dx + dy * dy);
}

/**
 * Check if world is valid (NexArt verified)
 */
export function isWorldValid(world: WorldData): boolean {
  return world.isNexArtVerified && world.terrain.length > 0;
}
