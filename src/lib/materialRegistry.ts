// Material Registry - Deterministic Texture Generation Pipeline
// Uses @nexart/ui-renderer to generate procedural textures from deterministic inputs.
// CRITICAL: No Math.random(), no Date, no network calls. All textures reproducible.

export type MaterialKind = 
  | 'ground' 
  | 'forest' 
  | 'mountain' 
  | 'snow' 
  | 'water' 
  | 'path'
  | 'rock'
  | 'sand';

export interface MaterialContext {
  worldId: string;
  worldX: number;
  worldY: number;
  seed: number;
  vars: number[];
  tileType: string;
  elevation: number;
  moisture: number;
}

export interface TextureSet {
  diffuse: HTMLCanvasElement;
  kind: MaterialKind;
  context: MaterialContext;
}

// Default texture size - small enough for performance, large enough for detail
export const TEXTURE_SIZE = 256;

// Compute deterministic hash for caching
export function computeTextureHash(kind: MaterialKind, ctx: MaterialContext): string {
  const varsHash = ctx.vars.slice(0, 10).map(v => Math.floor(v)).join('-');
  return `${kind}_${ctx.worldId}_${ctx.worldX}_${ctx.worldY}_${ctx.seed}_${varsHash}`;
}

// Get appropriate material kind from tile type and properties
export function getMaterialKind(
  tileType: string, 
  elevation: number, 
  moisture: number
): MaterialKind {
  // Snow at high elevations
  if (elevation > 0.7) {
    return 'snow';
  }
  
  // Rock at mid-high elevations on mountains
  if (tileType === 'mountain' && elevation > 0.5) {
    return 'rock';
  }
  
  switch (tileType) {
    case 'water':
      return 'water';
    case 'forest':
      return 'forest';
    case 'mountain':
      return 'mountain';
    case 'path':
    case 'bridge':
      return 'path';
    case 'ground':
    default:
      // Sandy ground at low elevations with low moisture
      if (elevation < 0.25 && moisture < 0.3) {
        return 'sand';
      }
      return 'ground';
  }
}

// Color palettes for each material kind (deterministic)
export const MATERIAL_PALETTES: Record<MaterialKind, { base: string; accent: string; dark: string; light: string }> = {
  ground: {
    base: '#6b5c44',
    accent: '#8b7355',
    dark: '#4a3d2a',
    light: '#a89070'
  },
  forest: {
    base: '#2d4a28',
    accent: '#3d6a38',
    dark: '#1a2d18',
    light: '#4d8a48'
  },
  mountain: {
    base: '#5a5a5a',
    accent: '#7a7a7a',
    dark: '#3a3a3a',
    light: '#9a9a9a'
  },
  snow: {
    base: '#e8e8f0',
    accent: '#f0f0ff',
    dark: '#c8c8d8',
    light: '#ffffff'
  },
  water: {
    base: '#2a5a6a',
    accent: '#3a7a8a',
    dark: '#1a3a4a',
    light: '#4a9aaa'
  },
  path: {
    base: '#7a6a50',
    accent: '#9a8a70',
    dark: '#5a4a30',
    light: '#baaa90'
  },
  rock: {
    base: '#6a6a6a',
    accent: '#8a8a8a',
    dark: '#4a4a4a',
    light: '#aaaaaa'
  },
  sand: {
    base: '#c4a060',
    accent: '#d4b070',
    dark: '#a48040',
    light: '#e4c080'
  }
};

// Texture cache - prevents regeneration
const textureCache = new Map<string, TextureSet>();

export function getCachedTexture(hash: string): TextureSet | undefined {
  return textureCache.get(hash);
}

export function setCachedTexture(hash: string, texture: TextureSet): void {
  // Limit cache size to prevent memory issues
  if (textureCache.size > 50) {
    const firstKey = textureCache.keys().next().value;
    if (firstKey) textureCache.delete(firstKey);
  }
  textureCache.set(hash, texture);
}

export function clearTextureCache(): void {
  textureCache.clear();
}
