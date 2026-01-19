// Material Registry - Enhanced Deterministic Texture Generation Pipeline
// Optimized for Zelda: Breath of the Wild / Genshin Impact visual style
// CRITICAL: No Math.random(), no Date, no network calls. All textures reproducible.

export type MaterialKind =
  | "ground"
  | "forest"
  | "mountain"
  | "snow"
  | "water"
  | "path"
  | "rock"
  | "riverbed"
  | "sand"
  | "grass" // New: Lush meadow grass
  | "cliff" // New: Steep rocky surfaces
  | "wetland"; // New: Marshy/swamp areas

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
// Enhanced with more nuanced terrain classification
export function getMaterialKind(tileType: string, elevation: number, moisture: number): MaterialKind {
  // Snow at high elevations (pristine white peaks)
  if (elevation > 0.75) {
    return "snow";
  }

  // Rocky cliff faces at steep high elevations
  if (elevation > 0.6 && tileType === "mountain") {
    return "cliff";
  }

  // Rock at mid-high elevations on mountains
  if (tileType === "mountain" && elevation > 0.45) {
    return "rock";
  }

  // Wetland in low moisture-rich areas
  if (elevation < 0.2 && moisture > 0.7 && tileType !== "water") {
    return "wetland";
  }

  switch (tileType) {
    case "water":
      return "water";
    case "forest":
      // Dense forest vs lighter grass based on moisture
      return moisture > 0.5 ? "forest" : "grass";
    case "mountain":
      return "mountain";
    case "path":
    case "bridge":
      return "path";
    case "ground":
    default:
      // Sandy ground at low elevations with low moisture (beaches/deserts)
      if (elevation < 0.2 && moisture < 0.25) {
        return "sand";
      }
      // Lush grass in moderate conditions
      if (moisture > 0.4 && elevation < 0.5) {
        return "grass";
      }
      return "ground";
  }
}

// ============================================
// ENHANCED COLOR PALETTES - Zelda/Genshin Style
// ============================================
// These palettes are designed for:
// - Vibrant but natural colors
// - Strong ambient occlusion contrast
// - Warm highlights, cool shadows
// - Painterly, stylized feel

export interface MaterialPalette {
  base: string; // Primary color
  accent: string; // Secondary highlight
  dark: string; // Deep shadows/crevices
  light: string; // Bright highlights
  ao: string; // Ambient occlusion tint
  rim: string; // Rim light color (Zelda-style glow)
}

export const MATERIAL_PALETTES: Record<MaterialKind, MaterialPalette> = {
  // GROUND - Rich warm earth tones (like Hyrule Field)
  ground: {
    base: "#7a6b4e", // Warm earth brown
    accent: "#9a8a68", // Sunlit soil
    dark: "#4a3d2a", // Deep shadow
    light: "#c4b090", // Bright highlights
    ao: "#3d3020", // Warm shadow tint
    rim: "#e8d8b0", // Golden rim light
  },

  // GRASS - Vibrant Genshin-style meadow green
  grass: {
    base: "#5a9a45", // Vibrant grass green
    accent: "#7dbd60", // Bright blade tips
    dark: "#2d5a28", // Shaded grass
    light: "#a8e088", // Sunlit highlights
    ao: "#1a3815", // Deep green shadow
    rim: "#d4f0a0", // Yellow-green rim
  },

  // FOREST - Deep rich woodland (Korok Forest vibes)
  forest: {
    base: "#3d6a35", // Deep forest green
    accent: "#5a8a4a", // Canopy midtone
    dark: "#1a3518", // Understory shadow
    light: "#7ab868", // Dappled sunlight
    ao: "#0f2010", // Very dark undergrowth
    rim: "#a8d888", // Leaf rim light
  },

  // MOUNTAIN - Cool grey-blue stone (Dueling Peaks style)
  mountain: {
    base: "#6a7078", // Cool blue-grey
    accent: "#8a9098", // Lighter stone
    dark: "#3a3d42", // Deep crevice
    light: "#a8b0b8", // Sunlit rock face
    ao: "#282a2e", // Cold shadow
    rim: "#c0c8d0", // Cool rim highlight
  },

  // CLIFF - Dramatic steep rock faces
  cliff: {
    base: "#5a5860", // Dark blue-grey
    accent: "#7a7880", // Mid cliff
    dark: "#2a2830", // Deep crack
    light: "#9a98a0", // Exposed face
    ao: "#1a1820", // Very deep shadow
    rim: "#b0aeb8", // Sharp rim light
  },

  // ROCK - Neutral versatile stone
  rock: {
    base: "#787878", // Neutral grey
    accent: "#989898", // Light grey
    dark: "#484848", // Shadow grey
    light: "#b8b8b8", // Highlight
    ao: "#303030", // Deep shadow
    rim: "#d0d0d0", // Bright rim
  },

  // SNOW - Pristine blue-white (Hebra Mountains)
  snow: {
    base: "#e0e8f0", // Blue-tinted white
    accent: "#f0f4ff", // Pure snow
    dark: "#a8b8d0", // Shadow blue
    light: "#ffffff", // Bright white
    ao: "#90a0c0", // Cool shadow
    rim: "#fffff8", // Warm sun rim
  },

  // WATER - Deep vibrant blue (Zelda lakes)
  water: {
    base: "#3080a8", // Vibrant blue
    accent: "#48a0c8", // Lighter surface
    dark: "#184060", // Deep water
    light: "#70c8e8", // Surface shimmer
    ao: "#102840", // Depths
    rim: "#90e0ff", // Bright caustics
  },

  // RIVERBED - Wet stones and sediment
  riverbed: {
    base: "#4a4238", // Wet brown
    accent: "#5a5248", // Damp stone
    dark: "#2a2420", // Submerged dark
    light: "#7a7060", // Wet highlight
    ao: "#1a1815", // Deep wet shadow
    rim: "#8a8070", // Moist rim
  },

  // PATH - Well-worn dirt trails
  path: {
    base: "#a08a68", // Dusty tan
    accent: "#c0a880", // Lighter dust
    dark: "#6a5a40", // Compacted shadow
    light: "#e0d0a8", // Bright dust
    ao: "#4a4030", // Worn shadow
    rim: "#f0e0c0", // Sunlit dust
  },

  // SAND - Golden beaches and dunes (Gerudo style)
  sand: {
    base: "#d8c080", // Golden sand
    accent: "#e8d8a0", // Bright crest
    dark: "#a89050", // Shadow dune
    light: "#f8f0c0", // Sun-bleached
    ao: "#887040", // Deep ripple shadow
    rim: "#fff8d8", // Hot highlight
  },

  // WETLAND - Marshy swamp areas
  wetland: {
    base: "#4a5a40", // Murky green
    accent: "#5a6a50", // Moss
    dark: "#2a3428", // Deep mud
    light: "#7a8a68", // Wet highlight
    ao: "#1a2018", // Swamp shadow
    rim: "#90a078", // Damp rim
  },
};

// ============================================
// PBR MATERIAL PROPERTIES
// ============================================
// Physical properties for each material type

export interface PBRProperties {
  roughness: number; // 0 = mirror, 1 = matte
  metalness: number; // 0 = dielectric, 1 = metal
  normalScale: number; // Bump intensity
  aoIntensity: number; // Ambient occlusion strength
  emissive: number; // Self-illumination (for snow, water highlights)
}

export const PBR_PROPERTIES: Record<MaterialKind, PBRProperties> = {
  ground: { roughness: 0.9, metalness: 0.02, normalScale: 0.8, aoIntensity: 0.6, emissive: 0.0 },
  grass: { roughness: 0.85, metalness: 0.01, normalScale: 0.6, aoIntensity: 0.5, emissive: 0.0 },
  forest: { roughness: 0.92, metalness: 0.02, normalScale: 0.9, aoIntensity: 0.7, emissive: 0.0 },
  mountain: { roughness: 0.78, metalness: 0.04, normalScale: 1.2, aoIntensity: 0.8, emissive: 0.0 },
  cliff: { roughness: 0.75, metalness: 0.05, normalScale: 1.4, aoIntensity: 0.9, emissive: 0.0 },
  rock: { roughness: 0.8, metalness: 0.03, normalScale: 1.0, aoIntensity: 0.7, emissive: 0.0 },
  snow: { roughness: 0.6, metalness: 0.01, normalScale: 0.3, aoIntensity: 0.3, emissive: 0.05 },
  water: { roughness: 0.15, metalness: 0.1, normalScale: 0.5, aoIntensity: 0.2, emissive: 0.02 },
  riverbed: { roughness: 0.7, metalness: 0.08, normalScale: 0.7, aoIntensity: 0.6, emissive: 0.0 },
  path: { roughness: 0.88, metalness: 0.02, normalScale: 0.5, aoIntensity: 0.5, emissive: 0.0 },
  sand: { roughness: 0.92, metalness: 0.01, normalScale: 0.4, aoIntensity: 0.4, emissive: 0.0 },
  wetland: { roughness: 0.82, metalness: 0.06, normalScale: 0.6, aoIntensity: 0.7, emissive: 0.0 },
};

// ============================================
// MICRO-DETAIL VARIATION SETTINGS
// ============================================
// Controls procedural detail variation per material

export interface MicroDetailSettings {
  scale: number; // Pattern scale (higher = finer detail)
  albedoVariation: number; // Color variation amount
  roughnessVariation: number; // Surface variation
  heightVariation: number; // Micro-height displacement
}

export const MICRO_DETAIL: Record<MaterialKind, MicroDetailSettings> = {
  ground: { scale: 0.08, albedoVariation: 0.12, roughnessVariation: 0.15, heightVariation: 0.08 },
  grass: { scale: 0.12, albedoVariation: 0.15, roughnessVariation: 0.1, heightVariation: 0.05 },
  forest: { scale: 0.1, albedoVariation: 0.1, roughnessVariation: 0.12, heightVariation: 0.1 },
  mountain: { scale: 0.06, albedoVariation: 0.08, roughnessVariation: 0.2, heightVariation: 0.15 },
  cliff: { scale: 0.05, albedoVariation: 0.1, roughnessVariation: 0.25, heightVariation: 0.2 },
  rock: { scale: 0.07, albedoVariation: 0.08, roughnessVariation: 0.18, heightVariation: 0.12 },
  snow: { scale: 0.15, albedoVariation: 0.05, roughnessVariation: 0.08, heightVariation: 0.03 },
  water: { scale: 0.04, albedoVariation: 0.03, roughnessVariation: 0.05, heightVariation: 0.02 },
  riverbed: { scale: 0.09, albedoVariation: 0.08, roughnessVariation: 0.12, heightVariation: 0.1 },
  path: { scale: 0.1, albedoVariation: 0.1, roughnessVariation: 0.15, heightVariation: 0.06 },
  sand: { scale: 0.14, albedoVariation: 0.08, roughnessVariation: 0.1, heightVariation: 0.04 },
  wetland: { scale: 0.08, albedoVariation: 0.1, roughnessVariation: 0.14, heightVariation: 0.08 },
};

// ============================================
// ELEVATION-BASED COLOR BLENDING
// ============================================
// Smoothly blend materials based on elevation for natural transitions

export function getElevationBlendFactor(elevation: number, materialKind: MaterialKind): number {
  switch (materialKind) {
    case "snow":
      // Snow fades in at high elevations
      return Math.max(0, Math.min(1, (elevation - 0.65) / 0.15));
    case "rock":
    case "cliff":
      // Rock shows at mid-high elevations
      if (elevation > 0.7) return 1 - (elevation - 0.7) / 0.1; // Fade under snow
      if (elevation < 0.4) return (elevation - 0.3) / 0.1; // Fade into lower terrain
      return 1;
    case "grass":
      // Grass fades at higher elevations
      return Math.max(0, Math.min(1, 1 - (elevation - 0.4) / 0.2));
    default:
      return 1;
  }
}

// ============================================
// MOISTURE-BASED COLOR ADJUSTMENTS
// ============================================
// Adjust colors based on moisture for more natural appearance

export function getMoistureColorAdjustment(moisture: number): { saturation: number; brightness: number } {
  // Wetter areas are more saturated and slightly darker
  // Drier areas are less saturated and brighter
  return {
    saturation: 0.9 + moisture * 0.2, // 0.9 to 1.1
    brightness: 1.05 - moisture * 0.1, // 0.95 to 1.05
  };
}

// ============================================
// TEXTURE CACHE
// ============================================

const textureCache = new Map<string, TextureSet>();

export function getCachedTexture(hash: string): TextureSet | undefined {
  return textureCache.get(hash);
}

export function setCachedTexture(hash: string, texture: TextureSet): void {
  // Limit cache size to prevent memory issues
  if (textureCache.size > 100) {
    // Remove oldest entries
    const keysToDelete = Array.from(textureCache.keys()).slice(0, 20);
    keysToDelete.forEach((key) => textureCache.delete(key));
  }
  textureCache.set(hash, texture);
}

export function clearTextureCache(): void {
  textureCache.clear();
}

// ============================================
// HELPER: Convert hex to RGB
// ============================================

export function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result
    ? {
        r: parseInt(result[1], 16) / 255,
        g: parseInt(result[2], 16) / 255,
        b: parseInt(result[3], 16) / 255,
      }
    : { r: 0.5, g: 0.5, b: 0.5 };
}

// ============================================
// HELPER: Blend two colors
// ============================================

export function blendColors(color1: string, color2: string, factor: number): string {
  const c1 = hexToRgb(color1);
  const c2 = hexToRgb(color2);

  const r = Math.round((c1.r * (1 - factor) + c2.r * factor) * 255);
  const g = Math.round((c1.g * (1 - factor) + c2.g * factor) * 255);
  const b = Math.round((c1.b * (1 - factor) + c2.b * factor) * 255);

  return `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`;
}

// ============================================
// Get material palette with elevation/moisture adjustments
// ============================================

export function getAdjustedPalette(kind: MaterialKind, elevation: number, moisture: number): MaterialPalette {
  const basePalette = MATERIAL_PALETTES[kind];
  const moistureAdj = getMoistureColorAdjustment(moisture);
  const elevationFactor = getElevationBlendFactor(elevation, kind);

  // For now, return base palette
  // In a full implementation, you'd adjust the colors based on elevation/moisture
  return {
    ...basePalette,
    // Could add: adjusted colors based on moistureAdj and elevationFactor
  };
}
