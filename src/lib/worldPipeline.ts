// World Pipeline - Canonical entry point for world generation
// SINGLE SOURCE OF TRUTH: Both 2D map and 3D explorer MUST use this
// Returns: { rgba, worldData, pixelHash, counts }

import { generateNexArtWorld, NexArtWorldGrid, normalizeNexArtInput, TileType } from './nexartWorld';
import { WorldData, TerrainCell } from './worldData';
import { getCanonicalWorldLayoutSource, GeneratorMode } from './generatorCanonical';
import { 
  WORLD_HEIGHT_SCALE,
  getWaterLevelRaw,
  applyElevationCurve,
  PATH_HEIGHT_LIFT,
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
// PIPELINE RESULT
// ============================================
export interface WorldPipelineResult {
  worldData: WorldData;
  pixelHash: string;
  counts: TileCounts;
  mode: GeneratorMode;
  sourceHash: string;
  buildId: string;
  isValid: boolean;
  error?: string;
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
// (Same logic as worldData.ts but here for single pipeline)
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
// MAIN PIPELINE FUNCTION
// This is the SINGLE ENTRY POINT for world generation
// ============================================
export async function generateWorldPipeline(
  seed: number,
  vars: number[],
  worldContext?: { worldX: number; worldY: number }
): Promise<WorldPipelineResult> {
  // Get canonical source info
  const isMultiplayer = !!worldContext;
  const canonicalResult = getCanonicalWorldLayoutSource({
    isMultiplayer,
    seed,
    vars,
    worldX: worldContext?.worldX,
    worldY: worldContext?.worldY,
  });
  
  try {
    // Generate via NexArt (same as before)
    const grid = await generateNexArtWorld({ seed, vars, worldContext });
    
    if (!grid.isValid) {
      return {
        worldData: createEmptyWorldData(seed, vars, grid.errorMessage),
        pixelHash: '00000000',
        counts: { water: 0, river: 0, path: 0, forest: 0, mountain: 0, ground: 0, object: 0, total: 0 },
        mode: canonicalResult.mode,
        sourceHash: canonicalResult.sourceHash,
        buildId: BUILD_ID,
        isValid: false,
        error: grid.errorMessage,
      };
    }
    
    // Convert to WorldData
    const worldData = nexartGridToWorldData(grid);
    
    // Count tiles
    const counts = countTiles(grid);
    
    return {
      worldData,
      pixelHash: grid.pixelHash,
      counts,
      mode: canonicalResult.mode,
      sourceHash: canonicalResult.sourceHash,
      buildId: BUILD_ID,
      isValid: true,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      worldData: createEmptyWorldData(seed, vars, message),
      pixelHash: '00000000',
      counts: { water: 0, river: 0, path: 0, forest: 0, mountain: 0, ground: 0, object: 0, total: 0 },
      mode: canonicalResult.mode,
      sourceHash: canonicalResult.sourceHash,
      buildId: BUILD_ID,
      isValid: false,
      error: message,
    };
  }
}

function createEmptyWorldData(seed: number, vars: number[], error?: string): WorldData {
  return {
    seed,
    vars,
    gridSize: 0,
    terrain: [],
    plantedObject: { x: 0, y: 0, z: 0, type: 0 },
    spawnPoint: { x: 0, y: 0, z: 0, rotationY: 0 },
    nexartHash: '00000000',
    isNexArtVerified: false,
    nexartError: error || 'World not generated',
  };
}

// ============================================
// COORDINATE HELPERS - SHARED ACROSS ALL GEOMETRY
// ============================================

/**
 * Convert render Z coordinate to terrain array row index
 * Terrain mesh uses: position Z = y (loop variable)
 * Terrain array uses: terrain[size - 1 - y][x]
 */
export function toRow(z: number, size: number): number {
  return size - 1 - z;
}

/**
 * Get cell from terrain array using render coordinates (x, z)
 * This is the CANONICAL way to access terrain cells from 3D positions
 */
export function cellAt<T>(
  terrain: T[][],
  x: number,
  z: number,
  size: number
): T | undefined {
  const row = toRow(z, size);
  if (row < 0 || row >= terrain.length) return undefined;
  const cells = terrain[row];
  if (!cells || x < 0 || x >= cells.length) return undefined;
  return cells[x];
}

/**
 * Safe cell access with bounds checking and floor
 */
export function cellAtSafe<T>(
  terrain: T[][],
  worldX: number,
  worldZ: number,
  size: number
): T | undefined {
  const x = Math.floor(worldX);
  const z = Math.floor(worldZ);
  if (x < 0 || x >= size || z < 0 || z >= size) return undefined;
  return cellAt(terrain, x, z, size);
}
