// NexArt Canonical World System
// The 2D layout from NexArt is the ONLY source of world truth
// 3D rendering is a projection of this layout, never independent generation

import { WORLD_LAYOUT_SOURCE, WorldParams } from './worldGenerator';

// ============================================
// NEW RGBA CHANNEL ENCODING (from NexArt pixels)
// RGB   = Tile Type (categorical color)
// Alpha = Elevation (0-255, continuous)
//
// Tile Colors for classification:
//   Water:    R<50, B>100
//   Ground:   R>130, G>110, B<110
//   Forest:   R<80, G>80, B<70
//   Mountain: R>100, G>90, B>85 (and high alpha)
//   Path:     R>160, G>130, B<120
//   Bridge:   R~120, G~80, B~50
//   Landmark: R>200, G<100
//   River:    R<90, G>140, B>160
//   Object:   R=255, G>200
// ============================================

export enum TileType {
  WATER = 0,
  GROUND = 1,
  FOREST = 2,
  MOUNTAIN = 3,
  PATH = 4,
  BRIDGE = 5,
  RIVER = 6,
  OBJECT = 7,
  VOID = 8
}

// ============================================
// WORLD GRID - Extracted from NexArt pixels
// ============================================

export interface GridCell {
  x: number;
  y: number;
  tileType: TileType;
  elevation: number;        // From Alpha channel (0-1)
  r: number;                // Raw R value
  g: number;                // Raw G value  
  b: number;                // Raw B value
  isPath: boolean;
  isBridge: boolean;
  isRiver: boolean;
  isObject: boolean;
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
// NEW: RGB = Tile Type, Alpha = Elevation
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
  
  for (let y = 0; y < gridSize; y++) {
    cells[y] = [];
    for (let x = 0; x < gridSize; x++) {
      const i = (y * gridSize + x) * 4;
      const r = pixels[i];
      const g = pixels[i + 1];
      const b = pixels[i + 2];
      const a = pixels[i + 3]; // Elevation (0-255)
      
      // Elevation from Alpha channel (continuous)
      const elevation = a / 255;
      
      // Classify tile type from RGB color
      const tileType = classifyTileFromRGB(r, g, b);
      
      const isObject = tileType === TileType.OBJECT;
      const isPath = tileType === TileType.PATH;
      const isBridge = tileType === TileType.BRIDGE;
      const isRiver = tileType === TileType.RIVER;
      
      if (isObject) {
        plantedObjectX = x;
        plantedObjectY = y;
      }
      
      cells[y][x] = {
        x,
        y,
        tileType,
        elevation,
        r,
        g,
        b,
        isPath,
        isBridge,
        isRiver,
        isObject
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
  
  // Ensure spawn is not on water
  let attempts = 0;
  while (cells[spawnY]?.[spawnX]?.tileType === TileType.WATER && attempts < 100) {
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

// Classify tile type from RGB values
function classifyTileFromRGB(r: number, g: number, b: number): TileType {
  // Object: bright yellow (255, 220, 60)
  if (r > 240 && g > 200 && b < 100) {
    return TileType.OBJECT;
  }
  
  // Bridge: dark brown (120, 80, 50)
  if (r > 100 && r < 140 && g > 60 && g < 100 && b > 30 && b < 70) {
    return TileType.BRIDGE;
  }
  
  // Path: light brown (180, 150, 100)
  if (r > 160 && r < 200 && g > 130 && g < 170 && b > 80 && b < 120) {
    return TileType.PATH;
  }
  
  // River: cyan-ish (70, 160, 180)
  if (r < 100 && g > 130 && b > 150) {
    return TileType.RIVER;
  }
  
  // Water: blue tones (low R, high B)
  if (r < 60 && b > 100) {
    return TileType.WATER;
  }
  
  // Forest: green tones (low R, high G, low B)
  if (r < 90 && g > 80 && b < 80) {
    return TileType.FOREST;
  }
  
  // Mountain: gray tones (R~G~B, all > 100)
  if (r > 100 && g > 90 && b > 85 && Math.abs(r - g) < 30 && Math.abs(g - b) < 30) {
    return TileType.MOUNTAIN;
  }
  
  // Ground: tan/earthy (high R, medium G, low B)
  if (r > 120 && g > 100 && b < 130) {
    return TileType.GROUND;
  }
  
  // Default to ground
  return TileType.GROUND;
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
