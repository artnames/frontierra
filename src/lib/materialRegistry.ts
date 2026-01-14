// Material Registry - Deterministic Texture Generation Pipeline
// CRITICAL: Ensure all types and constants are EXPORTED to resolve TS2305

export type MaterialKind = "ground" | "forest" | "mountain" | "snow" | "water" | "path" | "rock" | "sand" | "riverbed"; // Added riverbed to satisfy terrain requirements

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

export const TEXTURE_SIZE = 256;

/**
 * Deterministic hash for caching textures
 */
export function computeTextureHash(kind: MaterialKind, ctx: MaterialContext): string {
  const varsHash = ctx.vars
    .slice(0, 10)
    .map((v) => Math.floor(v))
    .join("-");
  return `${kind}_${ctx.worldId}_${ctx.worldX}_${ctx.worldY}_${ctx.seed}_${varsHash}`;
}

/**
 * Core logic to determine material based on world data
 */
export function getMaterialKind(tileType: string, elevation: number, moisture: number): MaterialKind {
  // Priority: High-altitude snow
  if (elevation > 0.7) return "snow";

  // High-altitude mountain rock
  if (tileType === "mountain" && elevation > 0.5) return "rock";

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
      // Sandy ground at low elevations/moisture
      if (elevation < 0.25 && moisture < 0.3) return "sand";
      return "ground";
  }
}

/**
 * High-contrast palettes for UI and 3D rendering
 */
export const MATERIAL_PALETTES: Record<MaterialKind, { base: string; accent: string; dark: string; light: string }> = {
  ground: { base: "#8b7355", accent: "#a08060", dark: "#5a4a35", light: "#c4a882" },
  forest: { base: "#2d5a28", accent: "#3d7a38", dark: "#152814", light: "#5dad48" },
  mountain: { base: "#6a6872", accent: "#8a8895", dark: "#3a3842", light: "#a5a3b0" },
  snow: { base: "#e8eaf0", accent: "#f5f7ff", dark: "#b8c0d5", light: "#ffffff" },
  water: { base: "#2a5a7a", accent: "#3a7a9a", dark: "#183448", light: "#5aadca" },
  path: { base: "#9a8a70", accent: "#b5a590", dark: "#6a5a40", light: "#d5c5a5" },
  rock: { base: "#7a7a7a", accent: "#9a9a9a", dark: "#4a4a4a", light: "#bababa" },
  sand: { base: "#d4b870", accent: "#e4c890", dark: "#a48850", light: "#f4e0a0" },
  riverbed: { base: "#484232", accent: "#3a3528", dark: "#2a261a", light: "#5a5342" },
};

// --- Cache Management ---
const textureCache = new Map<string, TextureSet>();

export function getCachedTexture(hash: string): TextureSet | undefined {
  return textureCache.get(hash);
}

export function setCachedTexture(hash: string, texture: TextureSet): void {
  if (textureCache.size > 50) {
    const firstKey = textureCache.keys().next().value;
    if (firstKey) textureCache.delete(firstKey);
  }
  textureCache.set(hash, texture);
}

export function clearTextureCache(): void {
  textureCache.clear();
}
