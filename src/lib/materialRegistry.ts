// Material Registry - BRIGHT & VIBRANT Version
// Optimized for Zelda: Breath of the Wild / Genshin Impact visual style
// Colors are deliberately LIGHTER and more SATURATED for a sunny, cheerful feel
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

export const TEXTURE_SIZE = 256;

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

// ============================================
// BRIGHT & VIBRANT COLOR PALETTES
// ============================================
// Designed for sunny, cheerful Zelda/Genshin look
// All colors are LIGHTER than typical realistic palettes

export const MATERIAL_PALETTES: Record<MaterialKind, { base: string; accent: string; dark: string; light: string }> = {
  // GROUND - Warm, sunlit earth (like Hyrule Field in daylight)
  ground: {
    base: "#a89070", // Light warm brown
    accent: "#c4a888", // Sunlit highlights
    dark: "#7a6850", // Gentle shadow (not too dark!)
    light: "#e0d0b8", // Bright sun-bleached areas
  },

  // FOREST - Vibrant, lush green (Genshin's Mondstadt fields)
  forest: {
    base: "#5a9848", // Vibrant green (not dark!)
    accent: "#78b860", // Bright leaf highlights
    dark: "#3d7030", // Shaded areas (still visible)
    light: "#98d878", // Sun-dappled bright green
  },

  // MOUNTAIN - Light grey-blue (airy mountain feel)
  mountain: {
    base: "#8890a0", // Light blue-grey
    accent: "#a0a8b8", // Lighter highlights
    dark: "#606878", // Soft shadow
    light: "#c8d0e0", // Bright exposed rock
  },

  // RIVERBED - Visible underwater stones
  riverbed: {
    base: "#6a6050", // Warm brown-grey
    accent: "#807060", // Lighter stones
    dark: "#4a4038", // Shadow (still visible underwater)
    light: "#a09080", // Bright wet stones
  },

  // SNOW - Bright, clean white (Dragonspine/Hebra)
  snow: {
    base: "#f0f4ff", // Bright blue-white
    accent: "#ffffff", // Pure white highlights
    dark: "#d0d8f0", // Very light shadow (blue tint)
    light: "#ffffff", // Maximum brightness
  },

  // WATER - Clear, inviting blue (tropical feel)
  water: {
    base: "#50a0c8", // Bright cyan-blue
    accent: "#70c0e8", // Surface highlights
    dark: "#3080a8", // Deeper areas (still bright)
    light: "#90e0ff", // Sparkling surface
  },

  // PATH - Light dusty trail
  path: {
    base: "#c0a880", // Light tan
    accent: "#d8c8a0", // Dusty highlights
    dark: "#988860", // Worn areas
    light: "#f0e8d0", // Sun-bleached path
  },

  // ROCK - Light neutral stone
  rock: {
    base: "#989898", // Light grey
    accent: "#b8b8b8", // Highlights
    dark: "#707070", // Crevices (not black!)
    light: "#d8d8d8", // Bright surfaces
  },

  // SAND - Golden, bright beaches
  sand: {
    base: "#e8d090", // Bright golden sand
    accent: "#f8e8b0", // Highlights
    dark: "#c8a860", // Ripple shadows
    light: "#fff8d8", // Sun-bleached crests
  },
};

// ============================================
// BASE COLORS FOR TERRAIN SHADING
// ============================================
// These are used by TexturedTerrain.tsx for vertex colors
// Made BRIGHTER to prevent dark terrain

export const BASE_COLORS: Record<string, { r: number; g: number; b: number }> = {
  ground: { r: 0.66, g: 0.56, b: 0.44 }, // Warm light brown
  forest: { r: 0.35, g: 0.6, b: 0.28 }, // Vibrant green
  mountain: { r: 0.53, g: 0.56, b: 0.63 }, // Light blue-grey
  snow: { r: 0.94, g: 0.96, b: 1.0 }, // Bright white
  water: { r: 0.31, g: 0.63, b: 0.78 }, // Bright blue
  path: { r: 0.75, g: 0.66, b: 0.5 }, // Light tan
  rock: { r: 0.6, g: 0.6, b: 0.6 }, // Light grey
  sand: { r: 0.91, g: 0.82, b: 0.56 }, // Bright sand
  riverbed: { r: 0.42, g: 0.38, b: 0.31 }, // Visible brown
};

// ============================================
// PBR MATERIAL PROPERTIES
// ============================================
// Adjusted for brighter appearance

export const PBR_PROPS: Record<
  MaterialKind,
  {
    roughness: number;
    metalness: number;
    transparent?: boolean;
    opacity?: number;
    detailScale: number;
    albedoVar: number;
    roughVar: number;
    slopeAO: number; // Reduced for less darkening
  }
> = {
  ground: { roughness: 0.88, metalness: 0.02, detailScale: 0.9, albedoVar: 0.1, roughVar: 0.15, slopeAO: 0.06 },
  forest: { roughness: 0.9, metalness: 0.02, detailScale: 0.95, albedoVar: 0.12, roughVar: 0.14, slopeAO: 0.05 },
  mountain: { roughness: 0.78, metalness: 0.04, detailScale: 1.1, albedoVar: 0.08, roughVar: 0.18, slopeAO: 0.08 },
  snow: { roughness: 0.55, metalness: 0.01, detailScale: 0.7, albedoVar: 0.04, roughVar: 0.08, slopeAO: 0.02 },
  water: {
    roughness: 0.15,
    metalness: 0.1,
    transparent: true,
    opacity: 0.8,
    detailScale: 0.6,
    albedoVar: 0.03,
    roughVar: 0.06,
    slopeAO: 0.0,
  },
  path: { roughness: 0.85, metalness: 0.02, detailScale: 1.2, albedoVar: 0.1, roughVar: 0.16, slopeAO: 0.05 },
  rock: { roughness: 0.75, metalness: 0.04, detailScale: 1.3, albedoVar: 0.08, roughVar: 0.2, slopeAO: 0.08 },
  sand: { roughness: 0.9, metalness: 0.01, detailScale: 0.85, albedoVar: 0.06, roughVar: 0.1, slopeAO: 0.03 },
  riverbed: { roughness: 0.65, metalness: 0.08, detailScale: 1.0, albedoVar: 0.06, roughVar: 0.12, slopeAO: 0.1 },
};

// ============================================
// UV SCALES PER MATERIAL
// ============================================

export const UV_SCALES: Record<MaterialKind, number> = {
  ground: 0.08,
  forest: 0.1,
  mountain: 0.12,
  snow: 0.06,
  water: 0.04,
  path: 0.15,
  rock: 0.14,
  sand: 0.07,
  riverbed: 0.12,
};

// ============================================
// BRIGHTNESS MULTIPLIERS
// ============================================
// Apply these to make terrain brighter based on type

export const BRIGHTNESS_MULTIPLIERS: Record<MaterialKind, number> = {
  ground: 1.15,
  forest: 1.1,
  mountain: 1.12,
  snow: 1.05, // Already bright
  water: 1.08,
  path: 1.18,
  rock: 1.1,
  sand: 1.12,
  riverbed: 1.2, // Boost underwater visibility
};

// ============================================
// AMBIENT OCCLUSION SETTINGS (REDUCED)
// ============================================
// Lower values = less darkening in crevices

export const AO_INTENSITY: Record<MaterialKind, number> = {
  ground: 0.3,
  forest: 0.35,
  mountain: 0.4,
  snow: 0.15,
  water: 0.1,
  path: 0.25,
  rock: 0.4,
  sand: 0.2,
  riverbed: 0.35,
};

// ============================================
// TEXTURE CACHE
// ============================================

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

// ============================================
// HELPER: Get brightened color for terrain
// ============================================

export function getBrightenedColor(
  kind: MaterialKind,
  baseR: number,
  baseG: number,
  baseB: number,
  elevation: number,
): { r: number; g: number; b: number } {
  const multiplier = BRIGHTNESS_MULTIPLIERS[kind] || 1.0;

  // Elevation boost - higher areas catch more light
  const elevationBoost = 0.85 + elevation * 0.25;

  // Combine multipliers
  const totalBoost = multiplier * elevationBoost;

  return {
    r: Math.min(1.0, baseR * totalBoost),
    g: Math.min(1.0, baseG * totalBoost),
    b: Math.min(1.0, baseB * totalBoost),
  };
}

// ============================================
// HELPER: Get tile color (brighter version)
// ============================================

export function getTileColorBright(
  type: string,
  elevation: number,
  moisture: number,
  hasRiver: boolean,
  isPath: boolean,
  x: number,
  y: number,
  seed: number,
): { r: number; g: number; b: number } {
  // Deterministic micro-variation
  const n = Math.sin(x * 12.9898 + y * 78.233 + seed * 0.1) * 43758.5453;
  const microVar = (n - Math.floor(n)) * 0.12 - 0.06; // Reduced variation

  // Brighter base calculation
  const baseBrightness = 0.75 + microVar; // Start brighter
  const elevationLight = Math.pow(elevation, 0.6) * 0.35; // Gentler curve
  const brightness = baseBrightness + elevationLight;

  // Reduced ambient occlusion
  const ao = 0.95 + elevation * 0.05; // Much less darkening

  if (hasRiver) {
    const rc = BASE_COLORS.riverbed;
    const boost = BRIGHTNESS_MULTIPLIERS.riverbed;
    return {
      r: Math.min(1, rc.r * brightness * boost),
      g: Math.min(1, rc.g * brightness * boost),
      b: Math.min(1, rc.b * brightness * boost),
    };
  }

  if (isPath && type !== "bridge") {
    const pc = BASE_COLORS.path;
    const boost = BRIGHTNESS_MULTIPLIERS.path;
    return {
      r: Math.min(1, (pc.r + microVar) * brightness * ao * boost),
      g: Math.min(1, (pc.g + microVar) * brightness * ao * boost),
      b: Math.min(1, (pc.b + microVar * 0.5) * brightness * ao * boost),
    };
  }

  const kind = getMaterialKind(type, elevation, moisture);
  const baseColor = BASE_COLORS[kind] || BASE_COLORS.ground;
  const boost = BRIGHTNESS_MULTIPLIERS[kind] || 1.0;

  return {
    r: Math.min(1, (baseColor.r + microVar) * brightness * ao * boost),
    g: Math.min(1, (baseColor.g + microVar) * brightness * ao * boost),
    b: Math.min(1, (baseColor.b + microVar * 0.5) * brightness * ao * boost),
  };
}
