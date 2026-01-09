// NexArt Canonical World System
// The 2D layout from NexArt is the ONLY source of world truth
// 3D rendering is a projection of this layout, never independent generation

import { WORLD_LAYOUT_SOURCE, WorldParams } from './worldGenerator';

// ============================================
// TILE TYPE ENCODING (via pixel color)
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

// Color encoding for tile types (RGB values)
// NexArt sketch outputs specific colors for each tile type
const TILE_COLOR_MAP: Record<string, TileType> = {
  // Water - blue shades
  '0,0,180': TileType.WATER,
  '0,50,200': TileType.WATER,
  
  // Ground - tan/brown
  '180,140,100': TileType.GROUND,
  '160,120,80': TileType.GROUND,
  
  // Forest - green
  '40,120,40': TileType.FOREST,
  '60,140,60': TileType.FOREST,
  
  // Mountain - gray
  '120,120,140': TileType.MOUNTAIN,
  '140,140,160': TileType.MOUNTAIN,
  
  // Path - light brown
  '200,180,140': TileType.PATH,
  '180,160,120': TileType.PATH,
  
  // Bridge - dark brown
  '100,70,40': TileType.BRIDGE,
  '80,50,30': TileType.BRIDGE
};

// ============================================
// WORLD GRID - Extracted from NexArt pixels
// ============================================

export interface GridCell {
  x: number;
  y: number;
  tileType: TileType;
  elevation: number;      // Derived from brightness
  hasLandmark: boolean;   // Encoded in alpha or specific marker
  landmarkType: number;
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
  pixelHash: string;       // Hash of raw pixel data
  isValid: boolean;        // True if NexArt execution succeeded
  errorMessage?: string;
}

// ============================================
// NEXART EXECUTION & EXTRACTION
// ============================================

/**
 * Execute NexArt and extract the canonical world grid.
 * This is the ONLY way to generate valid world data.
 * 
 * @throws Error if NexArt execution fails (no fallback)
 */
export async function generateNexArtWorld(params: WorldParams): Promise<NexArtWorldGrid> {
  const { seed, vars } = params;
  const GRID_SIZE = 64; // Must match WORLD_LAYOUT_SOURCE
  
  try {
    const { executeCodeMode } = await import('@nexart/codemode-sdk');
    
    // Execute NexArt with layout source
    const result = await executeCodeMode({
      source: WORLD_LAYOUT_SOURCE,
      width: GRID_SIZE,
      height: GRID_SIZE,
      seed,
      vars,
      mode: 'static',
    });
    
    if (!result.image) {
      return createFailedWorld(seed, vars, 'NexArt did not return an image');
    }
    
    // Extract pixels from the blob
    const imageData = await extractPixelData(result.image, GRID_SIZE);
    
    // Compute pixel hash for verification
    const pixelHash = computePixelHash(imageData);
    
    // Parse pixels into grid
    const grid = parsePixelsToGrid(imageData, GRID_SIZE, seed, vars);
    
    return {
      ...grid,
      pixelHash,
      isValid: true
    };
    
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown NexArt error';
    console.error('NexArt execution failed:', message);
    return createFailedWorld(seed, vars, message);
  }
}

/**
 * Extract pixel data from a Blob image
 */
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

/**
 * Compute a deterministic hash of raw pixel data
 */
function computePixelHash(pixels: Uint8ClampedArray): string {
  // Use djb2 hash on pixel data
  let hash = 5381;
  
  // Sample every 4th pixel for performance (still deterministic)
  for (let i = 0; i < pixels.length; i += 16) {
    hash = ((hash << 5) + hash) ^ pixels[i];
    hash = hash >>> 0;
  }
  
  return hash.toString(16).padStart(8, '0').toUpperCase();
}

/**
 * Parse raw pixels into structured grid
 */
function parsePixelsToGrid(
  pixels: Uint8ClampedArray, 
  gridSize: number, 
  seed: number, 
  vars: number[]
): Omit<NexArtWorldGrid, 'pixelHash' | 'isValid' | 'errorMessage'> {
  const cells: GridCell[][] = [];
  
  // Map variables for object/spawn positions
  const objGridX = Math.floor((vars[1] ?? 50) / 100 * (gridSize - 8)) + 4;
  const objGridY = Math.floor((vars[2] ?? 50) / 100 * (gridSize - 8)) + 4;
  const objType = Math.floor((vars[0] ?? 50) / 100 * 5);
  
  // Calculate spawn position (deterministic from seed)
  const spawnOffsetX = ((seed % 100) / 100 - 0.5) * 20;
  const spawnOffsetY = (((seed >> 8) % 100) / 100 - 0.5) * 20;
  let spawnX = Math.floor(gridSize / 2 + spawnOffsetX);
  let spawnY = Math.floor(gridSize / 2 + spawnOffsetY);
  spawnX = Math.max(2, Math.min(gridSize - 3, spawnX));
  spawnY = Math.max(2, Math.min(gridSize - 3, spawnY));
  
  // Parse each pixel
  for (let y = 0; y < gridSize; y++) {
    cells[y] = [];
    for (let x = 0; x < gridSize; x++) {
      const i = (y * gridSize + x) * 4;
      const r = pixels[i];
      const g = pixels[i + 1];
      const b = pixels[i + 2];
      const a = pixels[i + 3];
      
      // Determine tile type from color
      const tileType = classifyTileFromColor(r, g, b);
      
      // Derive elevation from brightness
      const brightness = (r + g + b) / 3 / 255;
      const elevation = computeElevationFromType(tileType, brightness, vars);
      
      // Check for landmark marker (encoded in alpha < 255)
      const hasLandmark = a < 250 && tileType !== TileType.WATER && tileType !== TileType.MOUNTAIN;
      const landmarkType = hasLandmark ? (a % 3) : 0;
      
      cells[y][x] = {
        x,
        y,
        tileType,
        elevation,
        hasLandmark,
        landmarkType,
        isPath: tileType === TileType.PATH || tileType === TileType.BRIDGE,
        isBridge: tileType === TileType.BRIDGE
      };
    }
  }
  
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
    plantedObjectX: objGridX,
    plantedObjectY: objGridY,
    plantedObjectType: objType,
    spawnX,
    spawnY
  };
}

/**
 * Classify tile type from RGB color using euclidean distance
 */
function classifyTileFromColor(r: number, g: number, b: number): TileType {
  // Primary color classification based on channel dominance
  
  // Water: Blue dominant, low red/green
  if (b > 100 && b > r && b > g * 0.8) {
    return TileType.WATER;
  }
  
  // Forest: Green dominant
  if (g > 80 && g > r && g >= b) {
    return TileType.FOREST;
  }
  
  // Mountain: Gray (all channels similar, high values)
  if (Math.abs(r - g) < 30 && Math.abs(g - b) < 30 && r > 100) {
    return TileType.MOUNTAIN;
  }
  
  // Bridge: Dark brown (low values, red > green > blue)
  if (r > g && g > b && r < 130 && g < 90) {
    return TileType.BRIDGE;
  }
  
  // Path: Light brown (warm, high values)
  if (r > g && g > b && r > 150) {
    return TileType.PATH;
  }
  
  // Ground: Default tan/brown
  if (r > 100 && g > 80) {
    return TileType.GROUND;
  }
  
  // Void: Very dark or undefined
  if (r < 30 && g < 30 && b < 30) {
    return TileType.VOID;
  }
  
  return TileType.GROUND;
}

/**
 * Compute elevation based on tile type and brightness
 */
function computeElevationFromType(tileType: TileType, brightness: number, vars: number[]): number {
  const waterLevel = (vars[4] ?? 30) / 100 * 0.35 + 0.15;
  const heightMult = (vars[6] ?? 50) / 100 * 2.0 + 0.5;
  
  switch (tileType) {
    case TileType.WATER:
      return waterLevel * 0.3;
    case TileType.BRIDGE:
      return waterLevel * 0.3 + 0.05;
    case TileType.MOUNTAIN:
      return waterLevel + brightness * heightMult;
    case TileType.GROUND:
    case TileType.FOREST:
    case TileType.PATH:
      return waterLevel + (brightness - 0.3) * heightMult * 0.5;
    default:
      return 0;
  }
}

/**
 * Create a failed world state (no fallback generation)
 */
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

/**
 * Verify that a world was generated by NexArt
 */
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
  
  // A valid world must have cells
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
