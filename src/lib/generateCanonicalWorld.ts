// Canonical World Generator - SINGLE SOURCE OF TRUTH
// This is the ONLY entry point for world generation.
// Both 2D and 3D views MUST consume the same artifact produced here.

import { generateNexArtWorld, NexArtWorldGrid, TileType } from './nexartWorld';
import { WorldData, TerrainCell } from './worldData';
import { getCanonicalWorldLayoutSource, GeneratorMode } from './generatorCanonical';
import {
  WORLD_HEIGHT_SCALE,
  getWaterLevelRaw,
  applyElevationCurve,
} from './worldConstants';
import { verifyNexArtWorld } from './nexartWorld';

// ============================================
// BUILD_ID - Generated at build time for cache busting
// ============================================
export const BUILD_ID = `${new Date().toISOString().slice(0, 16).replace(/[-:T]/g, '')}`;

// ============================================
// TILE COUNTS INTERFACE
// ============================================
export interface TileCounts {
  water: number;
  river: number;
  path: number;
  forest: number;
  mountain: number;
  ground: number;
  object: number;
  total: number;
}

// ============================================
// INPUTS USED - For debug overlay verification
// ============================================
export interface InputsUsed {
  seed: number;
  vars: number[];
  worldX: number;
  worldY: number;
  mappingVersion: string;
}

// ============================================
// CANONICAL WORLD ARTIFACT
// This is the shared artifact consumed by both 2D and 3D views
// ============================================
export interface CanonicalWorldArtifact {
  pixelHash: string;
  worldData: WorldData;
  grid: NexArtWorldGrid;
  counts: TileCounts;
  inputsUsed: InputsUsed;
  mode: GeneratorMode;
  sourceHash: string;
  buildId: string;
  isValid: boolean;
  error?: string;
  // Raw RGBA data for 2D visualization (64x64x4 = 16384 bytes)
  rgbaBuffer?: Uint8ClampedArray;
}

// ============================================
// TILE TYPE CONVERSION
// ============================================
function tileTypeToString(type: TileType): TerrainCell['type'] {
  switch (type) {
    case TileType.WATER: return 'water';
    case TileType.GROUND: return 'ground';
    case TileType.FOREST: return 'forest';
    case TileType.MOUNTAIN: return 'mountain';
    case TileType.PATH: return 'path';
    default: return 'ground';
  }
}

// ============================================
// COUNT TILES FROM GRID
// ============================================
function countTiles(grid: NexArtWorldGrid): TileCounts {
  const counts: TileCounts = {
    water: 0,
    river: 0,
    path: 0,
    forest: 0,
    mountain: 0,
    ground: 0,
    object: 0,
    total: 0,
  };
  
  for (const row of grid.cells) {
    for (const cell of row) {
      counts.total++;
      
      if (cell.isObject) counts.object++;
      else if (cell.isRiver) counts.river++;
      else if (cell.isPath) counts.path++;
      else {
        switch (cell.tileType) {
          case TileType.WATER: counts.water++; break;
          case TileType.FOREST: counts.forest++; break;
          case TileType.MOUNTAIN: counts.mountain++; break;
          default: counts.ground++; break;
        }
      }
    }
  }
  
  return counts;
}

// ============================================
// CONVERT NEXART GRID TO WORLD DATA
// ============================================
function nexartGridToWorldData(grid: NexArtWorldGrid): WorldData {
  const rawWaterLevel = getWaterLevelRaw(grid.vars);
  const heightScale = WORLD_HEIGHT_SCALE;

  const terrain: TerrainCell[][] = grid.cells.map((row) =>
    row.map((cell) => {
      const rawElevation = cell.elevation;
      const shapedElevation = applyElevationCurve(rawElevation);

      let type: TerrainCell['type'];

      if (cell.isPath) {
        type = 'path';
      } else if (cell.tileType === TileType.WATER || rawElevation < rawWaterLevel) {
        type = 'water';
      } else {
        const tileType = cell.tileType;
        if (tileType === TileType.MOUNTAIN) {
          type = 'mountain';
        } else if (tileType === TileType.FOREST) {
          type = 'forest';
        } else {
          type = 'ground';
        }
      }

      return {
        x: cell.x,
        y: cell.y,
        elevation: shapedElevation,
        moisture: cell.g / 255,
        type,
        hasRiver: cell.isRiver,
        isPath: cell.isPath,
      };
    }),
  );

  const objCell = grid.cells[grid.plantedObjectY]?.[grid.plantedObjectX];
  const objRawElev = objCell?.elevation ?? 0.3;
  const objElevation = applyElevationCurve(objRawElev) * heightScale;

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
// CREATE EMPTY ARTIFACT FOR ERROR STATES
// ============================================
function createEmptyArtifact(
  seed: number,
  vars: number[],
  worldX: number,
  worldY: number,
  mode: GeneratorMode,
  sourceHash: string,
  error: string
): CanonicalWorldArtifact {
  const emptyGrid: NexArtWorldGrid = {
    seed,
    vars,
    gridSize: 0,
    cells: [],
    plantedObjectX: 0,
    plantedObjectY: 0,
    plantedObjectType: 0,
    spawnX: 0,
    spawnY: 0,
    pixelHash: '00000000',
    isValid: false,
    errorMessage: error,
  };
  
  return {
    pixelHash: '00000000',
    worldData: {
      seed,
      vars,
      gridSize: 0,
      terrain: [],
      plantedObject: { x: 0, y: 0, z: 0, type: 0 },
      spawnPoint: { x: 0, y: 0, z: 0, rotationY: 0 },
      nexartHash: '00000000',
      isNexArtVerified: false,
      nexartError: error,
    },
    grid: emptyGrid,
    counts: { water: 0, river: 0, path: 0, forest: 0, mountain: 0, ground: 0, object: 0, total: 0 },
    inputsUsed: { seed, vars, worldX, worldY, mappingVersion: 'v1' },
    mode,
    sourceHash,
    buildId: BUILD_ID,
    isValid: false,
    error,
  };
}

// ============================================
// MAIN CANONICAL GENERATION FUNCTION
// This is the SINGLE ENTRY POINT for ALL world generation
// ============================================
export async function generateCanonicalWorld(params: {
  seed: number;
  vars: number[];
  worldX?: number;
  worldY?: number;
  isMultiplayer?: boolean;
}): Promise<CanonicalWorldArtifact> {
  const { seed, vars, isMultiplayer = false } = params;
  
  // UNIFIED: Default worldX/worldY to 0 for consistent generation
  const worldX = params.worldX ?? 0;
  const worldY = params.worldY ?? 0;
  
  // Get canonical source info
  const canonicalResult = getCanonicalWorldLayoutSource({
    isMultiplayer,
    seed,
    vars,
    worldX,
    worldY,
  });
  
  const inputsUsed: InputsUsed = {
    seed,
    vars: [...vars],
    worldX,
    worldY,
    mappingVersion: 'v1',
  };

  try {
    // Generate via NexArt - this is the SINGLE execution per refresh
    // FIX #1: ALWAYS pass explicit worldContext - never undefined
    // This ensures dedupe keys, caches, and logs are consistent between Solo and Multiplayer
    const worldContext = { worldX, worldY };
    const grid = await generateNexArtWorld({ seed, vars, worldContext });
    
    if (!grid.isValid) {
      console.error('CANONICAL_GEN failed:', grid.errorMessage);
      return createEmptyArtifact(seed, vars, worldX, worldY, canonicalResult.mode, canonicalResult.sourceHash, grid.errorMessage || 'NexArt generation failed');
    }
    
    // Convert to WorldData
    const worldData = nexartGridToWorldData(grid);
    
    // Count tiles
    const counts = countTiles(grid);
    
    // Build RGBA buffer for 2D visualization
    const rgbaBuffer = new Uint8ClampedArray(64 * 64 * 4);
    for (let row = 0; row < 64; row++) {
      for (let col = 0; col < 64; col++) {
        const cell = grid.cells[row]?.[col];
        if (cell) {
          const idx = (row * 64 + col) * 4;
          rgbaBuffer[idx] = cell.r;
          rgbaBuffer[idx + 1] = cell.g;
          rgbaBuffer[idx + 2] = cell.b;
          // Alpha = elevation (0-255)
          rgbaBuffer[idx + 3] = Math.round(cell.elevation * 255);
        }
      }
    }
    
    const artifact: CanonicalWorldArtifact = {
      pixelHash: grid.pixelHash,
      worldData,
      grid,
      counts,
      inputsUsed,
      mode: canonicalResult.mode,
      sourceHash: canonicalResult.sourceHash,
      buildId: BUILD_ID,
      isValid: true,
      rgbaBuffer,
    };
    
    // Log canonical generation - SINGLE log per refresh
    console.log('CANONICAL_ACTIVE', {
      pixelHash: grid.pixelHash,
      seed,
      worldX,
      worldY,
      counts: { water: counts.water, river: counts.river, path: counts.path }
    });
    
    return artifact;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('CANONICAL_GEN error:', message);
    return createEmptyArtifact(seed, vars, worldX, worldY, canonicalResult.mode, canonicalResult.sourceHash, message);
  }
}

// Re-export BUILD_ID for backward compatibility with worldPipeline imports
export type { TileCounts as WorldPipelineTileCounts };
