// NexArt Canonical World System
// The 2D layout from NexArt is the ONLY source of world truth
// 3D rendering is a projection of this layout, never independent generation

import { WORLD_LAYOUT_SOURCE, WorldParams } from './worldGenerator';

// ============================================
// RGBA CHANNEL ENCODING (from NexArt pixels)
// Red   = Elevation (0-255)
// Green = Moisture/Vegetation (0-255)  
// Blue  = Biome/Material classification
// Alpha = Feature mask (landmarks, rivers, objects)
// ============================================

export enum TileType {
  WATER = 0,
  GROUND = 1,
  FOREST = 2,
  MOUNTAIN = 3,
  PATH = 4,
  BRIDGE = 5,
  VOID = 6
}

// Blue channel ranges for biome classification
const BIOME_RANGES = {
  WATER: { min: 0, max: 50 },
  GROUND: { min: 51, max: 100 },
  FOREST: { min: 101, max: 150 },
  MOUNTAIN: { min: 151, max: 200 },
  PATH: { min: 201, max: 230 },
  BRIDGE: { min: 231, max: 255 }
};

// ============================================
// WORLD GRID - Extracted from NexArt pixels
// ============================================

export interface GridCell {
  x: number;
  y: number;
  tileType: TileType;
  elevation: number;        // From Red channel (0-1)
  moisture: number;         // From Green channel (0-1)
  biomeValue: number;       // From Blue channel (0-255)
  hasLandmark: boolean;     // From Alpha (250-254)
  landmarkType: number;     // Landmark variant (0-4)
  hasRiver: boolean;        // From Alpha (245-249)
  isPlantedObject: boolean; // From Alpha (1)
  isPath: boolean;
  isBridge: boolean;
}

export interface NexArtWorldGrid {
  seed: number;
  vars: number[];
  gridSize: number;
  cells: GridCell[][];
  plantedObjectX: number;
  plantedObjectY: number;
  plantedObjectType: number;
  spawnX: number;
  spawnY: number;
  pixelHash: string;
  isValid: boolean;
  errorMessage?: string;
}

// ============================================
// NEXART INPUT NORMALIZATION
// ============================================

export interface NormalizedNexArtInput {
  seed: number;
  vars: number[];
  mode: 'static' | 'loop';
}

export function normalizeNexArtInput(params: {
  seed?: unknown;
  vars?: unknown;
  mode?: unknown;
}): NormalizedNexArtInput {
  return {
    seed: Number(params.seed) || 0,
    vars: Array.isArray(params.vars)
      ? params.vars.map(v => Number(v) || 0).slice(0, 10)
      : new Array(10).fill(0),
    mode: params.mode === 'loop' ? 'loop' : 'static'
  };
}

// ============================================
// NEXART EXECUTION & EXTRACTION
// ============================================

const NEXART_TIMEOUT_MS = 15000;

export async function generateNexArtWorld(params: WorldParams): Promise<NexArtWorldGrid> {
  const GRID_SIZE = 64;
  
  const input = normalizeNexArtInput({
    seed: params.seed,
    vars: params.vars,
    mode: 'static'
  });
  
  try {
    const { executeCodeMode } = await import('@nexart/codemode-sdk');
    
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error('NexArt execution timeout')), NEXART_TIMEOUT_MS);
    });
    
    const executionPromise = executeCodeMode({
      source: WORLD_LAYOUT_SOURCE,
      width: GRID_SIZE,
      height: GRID_SIZE,
      seed: input.seed,
      vars: input.vars,
      mode: input.mode,
    });
    
    const result = await Promise.race([executionPromise, timeoutPromise]);
    
    if (!result.image) {
      return createFailedWorld(input.seed, input.vars, 'No image returned from NexArt');
    }
    
    const imageData = await extractPixelData(result.image, GRID_SIZE);
    const pixelHash = computePixelHash(imageData);
    const grid = parseRGBAPixels(imageData, GRID_SIZE, input.seed, input.vars);
    
    return {
      ...grid,
      pixelHash,
      isValid: true
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[NexArt] Generation failed:', message);
    return createFailedWorld(input.seed, input.vars, message);
  }
}

async function extractPixelData(blob: Blob, size: number): Promise<Uint8ClampedArray> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob);
    const img = new Image();
    
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext('2d');
      
      if (!ctx) {
        URL.revokeObjectURL(url);
        reject(new Error('Failed to create canvas context'));
        return;
      }
      
      ctx.drawImage(img, 0, 0, size, size);
      const imageData = ctx.getImageData(0, 0, size, size);
      URL.revokeObjectURL(url);
      resolve(imageData.data);
    };
    
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Failed to load NexArt image'));
    };
    
    img.src = url;
  });
}

function computePixelHash(pixels: Uint8ClampedArray): string {
  let hash = 5381;
  for (let i = 0; i < pixels.length; i += 4) {
    hash = ((hash << 5) + hash) ^ pixels[i];
    hash = ((hash << 5) + hash) ^ pixels[i + 1];
    hash = ((hash << 5) + hash) ^ pixels[i + 2];
    hash = ((hash << 5) + hash) ^ pixels[i + 3];
    hash = hash >>> 0;
  }
  return hash.toString(16).padStart(8, '0').toUpperCase();
}

// ============================================
// RGBA PIXEL PARSING - Derives ALL world data
// ============================================

function parseRGBAPixels(
  pixels: Uint8ClampedArray,
  gridSize: number,
  seed: number,
  vars: number[]
): Omit<NexArtWorldGrid, 'pixelHash' | 'isValid' | 'errorMessage'> {
  const cells: GridCell[][] = [];
  let plantedObjectX = Math.floor(gridSize / 2);
  let plantedObjectY = Math.floor(gridSize / 2);
  
  const objType = Math.floor((vars[0] ?? 50) / 100 * 5);
  const waterThreshold = (vars[4] ?? 30) / 100 * 0.20 + 0.28;
  
  for (let y = 0; y < gridSize; y++) {
    cells[y] = [];
    for (let x = 0; x < gridSize; x++) {
      const i = (y * gridSize + x) * 4;
      const r = pixels[i];     // Elevation (continuous)
      const g = pixels[i + 1]; // Moisture (continuous)
      const b = pixels[i + 2]; // Biome hint (continuous)
      const a = pixels[i + 3]; // Feature mask
      
      // Derive CONTINUOUS elevation from red channel
      const elevation = r / 255;
      
      // Derive CONTINUOUS moisture from green channel
      const moisture = g / 255;
      
      // Parse Alpha channel for features (new encoding)
      // 255: No feature
      // 250-254: Landmark types (0-4)
      // 245-249: River
      // 230-239: Path
      // 220-229: Bridge
      // 1: Planted object
      const hasLandmark = a >= 250 && a <= 254;
      const landmarkType = hasLandmark ? (a - 250) : 0;
      const hasRiver = a >= 245 && a <= 249;
      const isPath = a >= 230 && a <= 239;
      const isBridge = a >= 220 && a <= 229;
      const isPlantedObject = a === 1;
      
      if (isPlantedObject) {
        plantedObjectX = x;
        plantedObjectY = y;
      }
      
      // Determine tile type from Alpha features + elevation threshold
      let tileType: TileType;
      if (isBridge) {
        tileType = TileType.BRIDGE;
      } else if (isPath) {
        tileType = TileType.PATH;
      } else if (elevation < waterThreshold) {
        tileType = TileType.WATER;
      } else {
        // Soft classification based on elevation + moisture
        const landFraction = (elevation - waterThreshold) / (1 - waterThreshold);
        if (landFraction > 0.6) {
          tileType = TileType.MOUNTAIN;
        } else if (moisture > 0.5 && landFraction < 0.4) {
          tileType = TileType.FOREST;
        } else {
          tileType = TileType.GROUND;
        }
      }
      
      cells[y][x] = {
        x,
        y,
        tileType,
        elevation,
        moisture,
        biomeValue: b,
        hasLandmark,
        landmarkType,
        hasRiver,
        isPlantedObject,
        isPath,
        isBridge
      };
    }
  }
  
  // Calculate spawn position deterministically from seed
  const spawnOffsetX = ((seed % 100) / 100 - 0.5) * 20;
  const spawnOffsetY = (((seed >> 8) % 100) / 100 - 0.5) * 20;
  let spawnX = Math.floor(gridSize / 2 + spawnOffsetX);
  let spawnY = Math.floor(gridSize / 2 + spawnOffsetY);
  spawnX = Math.max(2, Math.min(gridSize - 3, spawnX));
  spawnY = Math.max(2, Math.min(gridSize - 3, spawnY));
  
  // Ensure spawn is not on water (using elevation threshold)
  let attempts = 0;
  while (cells[spawnY]?.[spawnX]?.elevation < waterThreshold && attempts < 100) {
    spawnX = (spawnX + 1) % gridSize;
    if (spawnX === 0) spawnY = (spawnY + 1) % gridSize;
    attempts++;
  }
  
  return {
    seed,
    vars,
    gridSize,
    cells,
    plantedObjectX,
    plantedObjectY,
    plantedObjectType: objType,
    spawnX,
    spawnY
  };
}

function classifyBiomeFromBlue(blue: number): TileType {
  if (blue <= BIOME_RANGES.WATER.max) return TileType.WATER;
  if (blue <= BIOME_RANGES.GROUND.max) return TileType.GROUND;
  if (blue <= BIOME_RANGES.FOREST.max) return TileType.FOREST;
  if (blue <= BIOME_RANGES.MOUNTAIN.max) return TileType.MOUNTAIN;
  if (blue <= BIOME_RANGES.PATH.max) return TileType.PATH;
  return TileType.BRIDGE;
}

function createFailedWorld(seed: number, vars: number[], errorMessage: string): NexArtWorldGrid {
  return {
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
    errorMessage
  };
}

// ============================================
// VERIFICATION
// ============================================

export interface NexArtVerification {
  isVerified: boolean;
  seed: number;
  vars: number[];
  pixelHash: string;
  errorMessage?: string;
}

export function verifyNexArtWorld(world: NexArtWorldGrid): NexArtVerification {
  if (!world.isValid) {
    return {
      isVerified: false,
      seed: world.seed,
      vars: world.vars,
      pixelHash: world.pixelHash,
      errorMessage: world.errorMessage || 'World generation failed'
    };
  }
  
  if (world.cells.length === 0) {
    return {
      isVerified: false,
      seed: world.seed,
      vars: world.vars,
      pixelHash: world.pixelHash,
      errorMessage: 'Empty world grid'
    };
  }
  
  return {
    isVerified: true,
    seed: world.seed,
    vars: world.vars,
    pixelHash: world.pixelHash
  };
}
