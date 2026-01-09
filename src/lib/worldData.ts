// World Data - Derived ENTIRELY from NexArt Canonical Layout
// This module provides the 3D projection interface for NexArt-generated worlds
// CRITICAL: No noise/random functions allowed. All data comes from NexArt pixels.

import { NexArtWorldGrid, TileType, GridCell, generateNexArtWorld, verifyNexArtWorld } from './nexartWorld';
import { WorldParams } from './worldGenerator';

// ============================================
// WORLD DATA INTERFACES (3D Projection of NexArt)
// ============================================

export interface TerrainCell {
  x: number;
  y: number;
  elevation: number;    // From NexArt Red channel
  moisture: number;     // From NexArt Green channel
  type: 'water' | 'ground' | 'forest' | 'mountain' | 'path' | 'bridge';
  hasLandmark: boolean;
  landmarkType: number;
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
  // Reduced height multiplier for more natural mountains (was 0.5-2.0, now 0.3-0.8)
  const heightMult = (grid.vars[6] ?? 50) / 100 * 0.5 + 0.3;
  
  // Convert cells to terrain - ALL data comes from NexArt pixels
  const terrain: TerrainCell[][] = grid.cells.map(row =>
    row.map((cell: GridCell) => ({
      x: cell.x,
      y: cell.y,
      elevation: computeWorldElevation(cell, waterLevel, heightMult),
      moisture: cell.moisture,
      type: tileTypeToString(cell.tileType),
      hasLandmark: cell.hasLandmark,
      landmarkType: cell.landmarkType,
      hasRiver: cell.hasRiver,
      isPath: cell.isPath,
      isBridge: cell.isBridge
    }))
  );
  
  // Calculate object elevation from NexArt-derived terrain
  const objCell = grid.cells[grid.plantedObjectY]?.[grid.plantedObjectX];
  const objTerrainCell = terrain[grid.plantedObjectY]?.[grid.plantedObjectX];
  const objElevation = objCell?.tileType === TileType.WATER 
    ? waterLevel * 20 
    : (objTerrainCell?.elevation ?? 0.3) * 20;
  
  // Calculate spawn rotation
  const toCenterX = grid.gridSize / 2 - grid.spawnX;
  const toCenterY = grid.gridSize / 2 - grid.spawnY;
  const rotationY = Math.atan2(toCenterX, toCenterY);
  
  const spawnTerrainCell = terrain[grid.spawnY]?.[grid.spawnX];
  const spawnElevation = (spawnTerrainCell?.elevation ?? 0.3) * 20;
  
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
      type: grid.plantedObjectType
    },
    spawnPoint: {
      x: grid.spawnX,
      y: grid.spawnY,
      z: spawnElevation + 2,
      rotationY
    },
    nexartHash: grid.pixelHash,
    isNexArtVerified: verification.isVerified,
    nexartError: verification.errorMessage
  };
}

// Compute world elevation from NexArt pixel data (no noise!)
function computeWorldElevation(cell: GridCell, waterLevel: number, heightMult: number): number {
  // Elevation comes directly from NexArt Red channel
  const baseElevation = cell.elevation;
  
  // Apply gentler exponential scaling for mountains - less cliff-like
  if (cell.tileType === TileType.MOUNTAIN) {
    // Smoother curve with lower exponent
    return waterLevel + Math.pow(baseElevation, 1.15) * heightMult * 0.8;
  }
  
  // Bridges sit just above water
  if (cell.tileType === TileType.BRIDGE) {
    return waterLevel * 0.3 + 0.08;
  }
  
  // Water is at water level
  if (cell.tileType === TileType.WATER) {
    return waterLevel * 0.3;
  }
  
  // Ground/forest/path use gentler linear scaling for smoother transitions
  return waterLevel + (baseElevation - waterLevel) * heightMult * 0.5;
}

// ============================================
// PUBLIC API - Async NexArt-based generation
// ============================================

export async function generateWorldDataAsync(seed: number, vars: number[]): Promise<WorldData> {
  const grid = await generateNexArtWorld({ seed, vars });
  
  if (!grid.isValid) {
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

// Synchronous version for legacy compatibility
export function generateWorldData(seed: number, vars: number[]): WorldData {
  const cacheKey = `nexart_${seed}_${vars.join(',')}`;
  const cached = (window as any).__nexartCache?.[cacheKey];
  
  if (cached) {
    return cached;
  }
  
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

export function cacheWorldData(world: WorldData): void {
  const cacheKey = `nexart_${world.seed}_${world.vars.join(',')}`;
  if (!(window as any).__nexartCache) {
    (window as any).__nexartCache = {};
  }
  (window as any).__nexartCache[cacheKey] = world;
}

// ============================================
// WORLD QUERY FUNCTIONS - Derived from NexArt
// ============================================

export function getElevationAt(world: WorldData, worldX: number, worldY: number): number {
  if (!world.isNexArtVerified || world.terrain.length === 0) {
    return 0;
  }
  
  const gridX = Math.floor(worldX);
  const gridY = Math.floor(worldY);
  
  if (gridX < 0 || gridX >= world.gridSize - 1 || gridY < 0 || gridY >= world.gridSize - 1) {
    return 0;
  }
  
  const cell = world.terrain[gridY]?.[gridX];
  if (cell?.type === 'bridge') {
    const waterLevel = (world.vars[4] ?? 30) / 100 * 0.35 + 0.15;
    return waterLevel * 20 + 0.3 * 20;
  }
  
  // Bilinear interpolation of elevation
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

export function distanceToObject(world: WorldData, worldX: number, worldY: number): number {
  const dx = worldX - world.plantedObject.x;
  const dy = worldY - world.plantedObject.y;
  return Math.sqrt(dx * dx + dy * dy);
}

export function isWorldValid(world: WorldData): boolean {
  return world.isNexArtVerified && world.terrain.length > 0;
}
