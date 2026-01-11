// NexArt Canonical World System
// The 2D layout from NexArt is the ONLY source of world truth
// 3D rendering is a projection of this layout, never independent generation

import { WORLD_LAYOUT_SOURCE, WORLD_A_LAYOUT_SOURCE, WorldParams } from './worldGenerator';
import { WORLD_LAYOUT_SOURCE_V2 } from './worldGeneratorV2';
import { 
  WorldContext, 
  getWorldSeed, 
  WORLD_A_ID,
  WORLD_GRID_WIDTH
} from './worldContext';
import { buildParamsV2, ARCHETYPES, type ResolvedWorldParams } from '@/world';

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
  // World A context (if generated with world coordinates)
  worldContext?: WorldContext;
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
  worldContext?: WorldContext;
}): NormalizedNexArtInput & { worldContext?: WorldContext } {
  return {
    seed: Number(params.seed) || 0,
    vars: Array.isArray(params.vars)
      ? params.vars.map(v => Number(v) || 0).slice(0, 10)
      : new Array(10).fill(0),
    mode: params.mode === 'loop' ? 'loop' : 'static',
    worldContext: params.worldContext
  };
}

// ============================================
// NEXART EXECUTION & EXTRACTION
// ============================================

const NEXART_TIMEOUT_MS = 15000;

export interface ExtendedWorldParams extends WorldParams {
  mappingVersion?: 'v1' | 'v2';
}

export async function generateNexArtWorld(params: ExtendedWorldParams): Promise<NexArtWorldGrid> {
  const GRID_SIZE = 64;
  
  // Build world context if provided
  const worldContext: WorldContext | undefined = params.worldContext ? {
    worldId: WORLD_A_ID,
    worldX: params.worldContext.worldX,
    worldY: params.worldContext.worldY
  } : undefined;
  
  const input = normalizeNexArtInput({
    seed: params.seed,
    vars: params.vars,
    mode: 'static',
    worldContext
  });
  
  // Check for V2 mapping mode
  const isV2Mode = params.mappingVersion === 'v2';
  
  // Determine which source to use
  const isWorldA = !!input.worldContext;
  let source: string;
  
  if (isWorldA) {
    // World A mode always uses its own source (shared macro geography)
    source = WORLD_A_LAYOUT_SOURCE;
  } else if (isV2Mode) {
    // V2 mode uses archetype-aware generation
    source = WORLD_LAYOUT_SOURCE_V2;
  } else {
    // V1 legacy mode
    source = WORLD_LAYOUT_SOURCE;
  }
  
  // Compute the combined seed for World A (includes world position)
  let executionSeed = input.seed;
  if (input.worldContext) {
    executionSeed = getWorldSeed(input.worldContext, input.seed);
  }
  
  try {
    // Check if we're in a browser environment with canvas support
    if (typeof window === 'undefined' || typeof document === 'undefined') {
      return createFailedWorld(input.seed, input.vars, 'NexArt requires browser environment');
    }
    
    const { executeCodeMode } = await import('@nexart/codemode-sdk');
    
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error('NexArt execution timeout')), NEXART_TIMEOUT_MS);
    });
    
    // Build execution options
    const execOptions: Parameters<typeof executeCodeMode>[0] = {
      source,
      width: GRID_SIZE,
      height: GRID_SIZE,
      seed: executionSeed,
      vars: input.vars,
      mode: input.mode,
    };
    
    let finalSource = source;
    
    // Inject V2-specific parameters (archetype and micro vars)
    if (isV2Mode && !isWorldA) {
      const v2Params = buildParamsV2(input.seed, input.vars);
      const archetypeIndex = ARCHETYPES.indexOf(v2Params.archetype);
      
      // Build micro vars array from the derived values (indices 10-23 in full vars)
      const microVars = v2Params.vars.slice(10, 24);
      
      // Inject ARCHETYPE_ID and MV array at the start of setup()
      const v2Injection = `var ARCHETYPE_ID = ${archetypeIndex}; var MV = [${microVars.join(',')}];`;
      finalSource = source.replace(
        'function setup() {',
        `function setup() { ${v2Injection}`
      );
      execOptions.source = finalSource;
      
      console.log(`[NexArt V2] Archetype: ${v2Params.archetype} (${archetypeIndex})`);
    }
    
    // Inject World A coordinates
    if (input.worldContext) {
      const injection = `var WORLD_X = ${input.worldContext.worldX}; var WORLD_Y = ${input.worldContext.worldY};`;
      finalSource = finalSource.replace(
        'function setup() {',
        `function setup() { ${injection}`
      );
      execOptions.source = finalSource;
    }
    
    const executionPromise = executeCodeMode(execOptions);
    
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
      isValid: true,
      worldContext: input.worldContext
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
      // IMPORTANT: keep the 64×64 pixel output crisp so categorical RGB tiles
      // (path/bridge/river/etc.) are not blurred by interpolation.
      ctx.imageSmoothingEnabled = false;
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

// Classify tile type from RGB values using Euclidean Color Distance
// This is robust against P5.js anti-aliasing shifts
function classifyTileFromRGB(r: number, g: number, b: number): TileType {
  // Define Canonical Target Colors from the P5.js Source
  const targets = [
    { type: TileType.OBJECT,   r: 255, g: 220, b: 60  },
    { type: TileType.BRIDGE,   r: 120, g: 80,  b: 50  },
    { type: TileType.PATH,     r: 180, g: 150, b: 100 },
    { type: TileType.RIVER,    r: 70,  g: 160, b: 180 },
    { type: TileType.WATER,    r: 30,  g: 80,  b: 140 },
    { type: TileType.FOREST,   r: 60,  g: 120, b: 50  },
    { type: TileType.MOUNTAIN, r: 130, g: 125, b: 120 },
    { type: TileType.GROUND,   r: 160, g: 140, b: 100 }
  ];

  let bestMatch = TileType.GROUND;
  let minDistance = Infinity;

  // Calculate Euclidean distance in 3D Color Space
  for (const target of targets) {
    const distance = Math.sqrt(
      Math.pow(r - target.r, 2) +
      Math.pow(g - target.g, 2) +
      Math.pow(b - target.b, 2)
    );

    if (distance < minDistance) {
      minDistance = distance;
      bestMatch = target.type;
    }
  }

  // Threshold: If color is too far from all targets, default to ground
  return minDistance < 60 ? bestMatch : TileType.GROUND;
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
