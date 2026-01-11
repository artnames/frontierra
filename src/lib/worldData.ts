// World Data - Derived ENTIRELY from NexArt Canonical Layout
// This module provides the 3D projection interface for NexArt-generated worlds
// CRITICAL: No noise/random functions allowed. All data comes from NexArt pixels.

import { NexArtWorldGrid, TileType, GridCell, generateNexArtWorld, verifyNexArtWorld } from './nexartWorld';
import { WorldParams } from './worldGenerator';
import { WORLD_HEIGHT_SCALE, getWaterLevel, RIVER_DEPTH_OFFSET, PATH_HEIGHT_OFFSET, BRIDGE_FIXED_HEIGHT } from './worldConstants';

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
// Tuned for WORLD_HEIGHT_SCALE = 35
// ============================================

function applyElevationCurve(rawElevation: number): number {
  // Non-linear curve optimized for heightScale=35:
  // - Compresses low elevations (wide flat plains)
  // - Smooth ramps at mid elevations (rolling hills)  
  // - Amplifies high elevations (dramatic peaks)
  
  const e = rawElevation;
  
  if (e < 0.30) {
    // Low elevation: flatten for walkable plains
    // Maps 0-0.30 → 0-0.10
    return e * 0.33;
  } else if (e < 0.50) {
    // Mid elevation: gentle rolling hills
    // Maps 0.30-0.50 → 0.10-0.25
    const t = (e - 0.30) / 0.20;
    return 0.10 + t * 0.15;
  } else if (e < 0.70) {
    // Upper-mid: steeper hills transitioning to mountains
    // Maps 0.50-0.70 → 0.25-0.50
    const t = (e - 0.50) / 0.20;
    return 0.25 + Math.pow(t, 1.2) * 0.25;
  } else {
    // High elevation: exponential amplification for dramatic peaks
    // Maps 0.70-1.0 → 0.50-1.0
    const t = (e - 0.70) / 0.30;
    return 0.50 + Math.pow(t, 1.5) * 0.50;
  }
}

function nexartGridToWorldData(grid: NexArtWorldGrid): WorldData {
  // Use shared constants for synchronized scales
  const waterLevel = getWaterLevel(grid.vars);
  const heightScale = WORLD_HEIGHT_SCALE;
  
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

export async function generateWorldDataAsync(
  seed: number, 
  vars: number[],
  worldContext?: { worldX: number; worldY: number },
  mappingVersion?: 'v1' | 'v2'
): Promise<WorldData> {
  const grid = await generateNexArtWorld({ seed, vars, worldContext, mappingVersion });
  
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

  // Use shared height scale constant
  const heightScale = WORLD_HEIGHT_SCALE;

  // Match renderer modifiers so movement/collision lines up with what you see.
  const waterLevel = getWaterLevel(world.vars);
  const waterHeight = waterLevel * heightScale;
  const riverDepth = waterHeight - RIVER_DEPTH_OFFSET;
  const pathMaxHeight = waterHeight + PATH_HEIGHT_OFFSET;
  // Bridge uses fixed height - just above water surface
  const bridgeHeight = BRIDGE_FIXED_HEIGHT;

  const gridX = Math.floor(worldX);
  const gridY = Math.floor(worldY);

  if (gridX < 0 || gridX >= world.gridSize - 1 || gridY < 0 || gridY >= world.gridSize - 1) {
    return 0;
  }

  // COORDINATE FIX: Flip Y-axis to match P5.js [y][x] grid with Three.js PlaneGeometry
  // P5.js draws from top-left, Three.js PlaneGeometry maps from bottom-left
  const flippedY = world.gridSize - 1 - gridY;

  const cell = world.terrain[flippedY]?.[gridX];
  if (cell?.isBridge || cell?.type === 'bridge') {
    return bridgeHeight;
  }

  // Bilinear interpolation of ALREADY CURVED elevation
  // (terrain cells store the shaped elevation from nexartGridToWorldData)
  const fx = worldX - gridX;
  const fy = worldY - gridY;
  
  // Since Y is flipped, the interpolation direction needs to be inverted
  // flippedY corresponds to gridY=0, flippedY-1 corresponds to gridY=1
  // So when fy increases (moving +Y in world), we move toward flippedY-1
  const flippedY1 = Math.max(0, flippedY - 1);

  const e00 = world.terrain[flippedY]?.[gridX]?.elevation ?? 0;
  const e10 = world.terrain[flippedY]?.[gridX + 1]?.elevation ?? 0;
  const e01 = world.terrain[flippedY1]?.[gridX]?.elevation ?? 0;
  const e11 = world.terrain[flippedY1]?.[gridX + 1]?.elevation ?? 0;

  // Interpolate in X direction first
  const e0 = e00 * (1 - fx) + e10 * fx;
  const e1 = e01 * (1 - fx) + e11 * fx;
  
  // Interpolate in Y direction - fy=0 uses flippedY (e0), fy=1 uses flippedY-1 (e1)
  let height = (e0 * (1 - fy) + e1 * fy) * heightScale;

  if (cell?.hasRiver) {
    height = Math.min(height, riverDepth);
  }

  if (cell?.isPath && !cell?.isBridge) {
    height = Math.min(height, pathMaxHeight);
  }

  return height;
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
  
  // COORDINATE FIX: Flip Y-axis to match P5.js [y][x] grid with Three.js
  const flippedY = world.gridSize - 1 - gridY;
  
  const cell = world.terrain[flippedY]?.[gridX];
  // Water is not walkable, but bridges are
  return cell?.type !== 'water';
}

export function distanceToObject(world: WorldData, worldX: number, worldY: number): number {
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
  return world.isNexArtVerified && world.terrain.length > 0;
}
