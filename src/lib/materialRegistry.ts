// Material Registry - Deterministic Texture Generation Pipeline
// Uses @nexart/ui-renderer to generate procedural textures from deterministic inputs.
// CRITICAL: No Math.random(), no Date, no network calls. All textures reproducible.

export type MaterialKind = "ground" | "forest" | "mountain" | "snow" | "water" | "path" | "rock" | "riverbed" | "sand";

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
  const varsHash = ctx.vars
    .slice(0, 10)
    .map((v) => Math.floor(v))
    .join("-");
  return `${kind}_${ctx.worldId}_${ctx.worldX}_${ctx.worldY}_${ctx.seed}_${varsHash}`;
}

// Get appropriate material kind from tile type and properties
export function getMaterialKind(tileType: string, elevation: number, moisture: number): MaterialKind {
  // Snow at high elevations
  if (elevation > 0.7) {
    return "snow";
  }

  // Rock at mid-high elevations on mountains
  if (tileType === "mountain" && elevation > 0.5) {
    return "rock";
  }

  switch (tileType) {
    case "water":
      return "water";
    case "forest":
      return "forest";
    case "mountain":
      return "mountain";
    case "path":
    case "bridge":
      return "path";
    case "ground":
    default:
      // Sandy ground at low elevations with low moisture
      if (elevation < 0.25 && moisture < 0.3) {
        return "sand";
      }
      return "ground";
  }
}

// HIGH-CONTRAST Color palettes for each material kind (deterministic)
// These palettes are designed for MAXIMUM visual distinction between materials
export const MATERIAL_PALETTES: Record<MaterialKind, { base: string; accent: string; dark: string; light: string }> = {
  ground: {
    base: "#8b7355", // Warm earth brown
    accent: "#a08060",
    dark: "#5a4a35", // Deep shadow
    light: "#c4a882", // Sunlit soil
  },
  forest: {
    base: "#2d5a28", // Rich forest green
    accent: "#3d7a38",
    dark: "#152814", // Deep shadow green
    light: "#5dad48", // Bright canopy
  },
  mountain: {
    base: "#6a6872", // Cool blue-grey rock
    accent: "#8a8895",
    dark: "#3a3842", // Deep crevice
    light: "#a5a3b0", // Sunlit stone
  },
  snow: {
    base: "#e8eaf0", // Blue-white snow
    accent: "#f5f7ff",
    dark: "#b8c0d5", // Shadow blue
    light: "#ffffff", // Pure white
  },
  water: {
    base: "#2a5a7a", // Deep ocean blue
    accent: "#3a7a9a",
    dark: "#183448", // Depths
    light: "#5aadca", // Surface shimmer
  },
  path: {
    base: "#9a8a70", // Worn earth tan
    accent: "#b5a590",
    dark: "#6a5a40", // Compacted shadow
    light: "#d5c5a5", // Dusty surface
  },
  rock: {
    base: "#7a7a7a", // Neutral grey
    accent: "#9a9a9a",
    dark: "#4a4a4a", // Deep crack
    light: "#bababa", // Lit surface
  },
  sand: {
    base: "#d4b870", // Golden sand
    accent: "#e4c890",
    dark: "#a48850", // Shadow dune
    light: "#f4e0a0", // Bright crest
  },
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
