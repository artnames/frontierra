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
  elevation: number;    // From NexArt Alpha channel
  moisture: number;     // Derived from NexArt Green channel
  type: 'water' | 'ground' | 'forest' | 'mountain' | 'path' | 'bridge';
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

// ============================================
// PERCEPTUAL ELEVATION CURVE
// Transforms linear Alpha (0-1) into perceptually-shaped elevation
// Deterministic, preserves ordering, no external data
// ============================================

function applyElevationCurve(rawElevation: number): number {
  // Non-linear curve that:
  // - Compresses low elevations (wide flat plains)
  // - Smooth ramps at mid elevations (rolling hills)
  // - Amplifies high elevations (dramatic peaks)
  
  // Use a piecewise curve for natural geological feel
  const e = rawElevation;
  
  if (e < 0.3) {
    // Low elevation: compress significantly for flat plains
    // Maps 0-0.3 → 0-0.15 (half the range)
    return e * 0.5;
  } else if (e < 0.6) {
    // Mid elevation: gentle rolling hills
    // Maps 0.3-0.6 → 0.15-0.35 (smooth transition)
    const t = (e - 0.3) / 0.3;
    return 0.15 + t * t * 0.2;
  } else {
    // High elevation: exponential amplification for dramatic peaks
    // Maps 0.6-1.0 → 0.35-1.0 (expanded range)
    const t = (e - 0.6) / 0.4;
    // Smooth exponential curve for mountain slopes
    return 0.35 + Math.pow(t, 1.5) * 0.65;
  }
}

function nexartGridToWorldData(grid: NexArtWorldGrid): WorldData {
  // Water level mapping: VAR[4] 0=0.15, 50=0.40, 100=0.65
  const waterLevel = (grid.vars[4] ?? 50) / 100 * 0.50 + 0.15;
  // Increased height scale - safe because low elevations are compressed
  const heightScale = 35;
  
  // Convert cells to terrain - ALL data comes from NexArt pixels
  // RGB = Tile Type (categorical), Alpha = Elevation (continuous 0-1)
  const terrain: TerrainCell[][] = grid.cells.map(row =>
    row.map((cell: GridCell) => {
      // Direct elevation from Alpha channel (continuous 0-1)
      const rawElevation = cell.elevation;
      
      // Apply perceptual curve for more natural terrain feel
      const shapedElevation = applyElevationCurve(rawElevation);
      
      // Determine type from RGB classification first, then elevation
      let type: TerrainCell['type'];
      
      // Check for path/bridge from RGB
      if (cell.isBridge) {
        type = 'bridge';
      } else if (cell.isPath) {
        type = 'path';
      } else if (cell.tileType === 0 || rawElevation < waterLevel) { // WATER
        type = 'water';
      } else {
        // Use tile type from RGB classification
        const tileType = cell.tileType;
        if (tileType === 3) { // MOUNTAIN
          type = 'mountain';
        } else if (tileType === 2) { // FOREST
          type = 'forest';
        } else {
          type = 'ground';
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
        isBridge: cell.isBridge
      };
    })
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
  
  // Match the increased height scale from nexartGridToWorldData
  const heightScale = 35;
  const gridX = Math.floor(worldX);
  const gridY = Math.floor(worldY);
  
  if (gridX < 0 || gridX >= world.gridSize - 1 || gridY < 0 || gridY >= world.gridSize - 1) {
    return 0;
  }
  
  const cell = world.terrain[gridY]?.[gridX];
  if (cell?.type === 'bridge') {
    // Water level mapping: VAR[4] 0=0.15, 50=0.40, 100=0.65
    const waterLevel = (world.vars[4] ?? 50) / 100 * 0.50 + 0.15;
    return waterLevel * heightScale + 0.5;
  }
  
  // Bilinear interpolation of ALREADY CURVED elevation
  // (terrain cells store the shaped elevation from nexartGridToWorldData)
  const fx = worldX - gridX;
  const fy = worldY - gridY;
  
  const e00 = world.terrain[gridY][gridX].elevation;
  const e10 = world.terrain[gridY][gridX + 1].elevation;
  const e01 = world.terrain[gridY + 1][gridX].elevation;
  const e11 = world.terrain[gridY + 1][gridX + 1].elevation;
  
  const e0 = e00 * (1 - fx) + e10 * fx;
  const e1 = e01 * (1 - fx) + e11 * fx;
  
  return (e0 * (1 - fy) + e1 * fy) * heightScale;
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
