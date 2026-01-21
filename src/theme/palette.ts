// Frontierra Canonical Palette
// All visual colors in the game derive from these 12 base hues.
// CRITICAL: No other hex values should appear outside this file.
// Updated with new sprint palette: ccd4c9, 6b746b, 232D26, 576E45, 899C6F, AAC64b, FE9402, fd5602, ed0106, 7A3427, 001c24, d17A74

import * as THREE from 'three';

// ============================================
// BASE PALETTE - The only source of truth for colors
// ============================================

export const PALETTE = {
  // Muted/neutral tones
  mist: '#CCD4C9',      // Light sage - fog, foam, highlights
  sage: '#6B746B',      // Medium grey-green - rock, shadows
  deep: '#232D26',      // Dark forest - shadows, outlines, night
  
  // Greens (terrain)
  forest: '#576E45',    // Deep forest green
  meadow: '#899C6F',    // Light green - grasslands
  lime: '#AAC64B',      // Bright accent green
  
  // Warm accents
  amber: '#FE9402',     // Primary UI accent, flowers
  flame: '#FD5602',     // Secondary accent, warnings
  crimson: '#ED0106',   // Danger, critical
  rust: '#7A3427',      // Wood, bark, earth tones
  
  // Water/sky
  abyss: '#001C24',     // Deep water, night sky zenith
  coral: '#D17A74',     // Warm highlight, sunset
} as const;

// ============================================
// SEMANTIC ROLE MAPPING
// ============================================

export const ROLES = {
  // Sky
  skyDay: PALETTE.mist,
  skyNight: PALETTE.abyss,
  skyTwilight: PALETTE.rust,
  
  // Fog
  fogDay: PALETTE.mist,
  fogNight: PALETTE.deep,
  fogTwilight: PALETTE.sage,
  
  // Terrain (elevation ramp: low → mid → high)
  terrainLow: PALETTE.meadow,    // Lowlands, grass
  terrainMid: PALETTE.forest,    // Mid elevation
  terrainHigh: PALETTE.sage,     // High elevation, rocky
  
  // Special terrain
  forestDeep: PALETTE.deep,      // Dense forest
  rock: PALETTE.sage,            // Rocks, mountains
  dirtWood: PALETTE.rust,        // Paths, bark, wood
  sand: PALETTE.coral,           // Beach, dry areas
  
  // Water
  waterDeep: PALETTE.abyss,      // Deep water, ocean
  waterShallow: PALETTE.forest,  // Rivers, shallow
  foam: PALETTE.mist,            // Water foam, edges
  
  // Accents
  accentPrimary: PALETTE.amber,     // Primary UI, flowers
  accentSecondary: PALETTE.lime,    // Secondary highlights
  accentWarm: PALETTE.flame,        // Warm accents
  danger: PALETTE.crimson,          // Danger states
  
  // UI
  uiBg: PALETTE.deep,
  uiText: PALETTE.mist,
  uiMuted: PALETTE.sage,
  
  // Vegetation
  leafDark: PALETTE.deep,
  leafMid: PALETTE.forest,
  leafLight: PALETTE.meadow,
  leafBright: PALETTE.lime,
  bark: PALETTE.rust,
} as const;

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Convert hex color to RGB 0-1 range
 */
export function hexToRgb01(hex: string): { r: number; g: number; b: number } {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!result) {
    console.warn(`Invalid hex color: ${hex}, using fallback`);
    return { r: 0.5, g: 0.5, b: 0.5 };
  }
  return {
    r: parseInt(result[1], 16) / 255,
    g: parseInt(result[2], 16) / 255,
    b: parseInt(result[3], 16) / 255,
  };
}

/**
 * Convert hex to RGB 0-255 range
 */
export function hexToRgb255(hex: string): { r: number; g: number; b: number } {
  const rgb01 = hexToRgb01(hex);
  return {
    r: Math.round(rgb01.r * 255),
    g: Math.round(rgb01.g * 255),
    b: Math.round(rgb01.b * 255),
  };
}

/**
 * Convert hex to Three.js Color
 * @param linear - If true, converts to linear color space for proper PBR lighting
 */
export function toThreeColor(hex: string, options?: { linear?: boolean }): THREE.Color {
  const color = new THREE.Color(hex);
  if (options?.linear) {
    color.convertSRGBToLinear();
  }
  return color;
}

/**
 * Linearly interpolate between two colors
 */
export function lerpColor(
  a: { r: number; g: number; b: number },
  b: { r: number; g: number; b: number },
  t: number
): { r: number; g: number; b: number } {
  const clampT = Math.max(0, Math.min(1, t));
  return {
    r: a.r + (b.r - a.r) * clampT,
    g: a.g + (b.g - a.g) * clampT,
    b: a.b + (b.b - a.b) * clampT,
  };
}

/**
 * Get color at elevation using terrain ramp
 * @param elevation 0-1 normalized elevation
 * @param moisture 0-1 moisture level (higher = more green)
 */
export function getTerrainColor(
  elevation: number,
  moisture: number
): { r: number; g: number; b: number } {
  const low = hexToRgb01(ROLES.terrainLow);
  const mid = hexToRgb01(ROLES.terrainMid);
  const high = hexToRgb01(ROLES.terrainHigh);
  const forestDeep = hexToRgb01(ROLES.forestDeep);
  
  // Base elevation blend
  let base: { r: number; g: number; b: number };
  if (elevation < 0.4) {
    // Low to mid
    base = lerpColor(low, mid, elevation / 0.4);
  } else if (elevation < 0.7) {
    // Mid to high
    base = lerpColor(mid, high, (elevation - 0.4) / 0.3);
  } else {
    // High stays high (rocky)
    base = high;
  }
  
  // Moisture pushes toward forest deep
  if (moisture > 0.5) {
    const forestInfluence = (moisture - 0.5) * 0.6;
    base = lerpColor(base, forestDeep, forestInfluence);
  }
  
  return base;
}

/**
 * Get water color based on depth
 * @param depth 0-1 where 0 is shallow, 1 is deep
 */
export function getWaterColor(depth: number): { r: number; g: number; b: number } {
  const shallow = hexToRgb01(ROLES.waterShallow);
  const deep = hexToRgb01(ROLES.waterDeep);
  return lerpColor(shallow, deep, Math.pow(depth, 0.7));
}

// ============================================
// PRE-COMPUTED RGB VALUES FOR PERFORMANCE
// ============================================

export const TERRAIN_COLORS = {
  ground: hexToRgb01(ROLES.terrainLow),
  forest: hexToRgb01(ROLES.terrainMid),
  mountain: hexToRgb01(ROLES.rock),
  snow: { r: 0.94, g: 0.96, b: 1.0 }, // Keep snow bright white
  water: hexToRgb01(ROLES.waterDeep),
  path: hexToRgb01(ROLES.dirtWood),
  rock: hexToRgb01(ROLES.rock),
  sand: hexToRgb01(ROLES.sand),
  riverbed: hexToRgb01(ROLES.waterShallow),
} as const;

export const VEGETATION_COLORS = {
  // Foliage colors (variations around the greens)
  pineBase: hexToRgb01(ROLES.leafMid),
  deciduousBase: hexToRgb01(ROLES.leafLight),
  bushBase: hexToRgb01(ROLES.leafBright),
  
  // Bark colors
  barkDark: hexToRgb01(ROLES.bark),
  barkLight: hexToRgb01(ROLES.dirtWood),
  
  // Rock colors
  rockBase: hexToRgb01(ROLES.rock),
  
  // Flower colors (use accents)
  flowerPrimary: hexToRgb01(ROLES.accentPrimary),
  flowerSecondary: hexToRgb01(ROLES.accentSecondary),
  flowerWarm: hexToRgb01(ROLES.accentWarm),
  flowerDanger: hexToRgb01(ROLES.danger),
} as const;

// ============================================
// SKY/ATMOSPHERE COLORS
// FIX: Sky horizon was using meadow green - now uses neutral mist-sage blend
// ============================================

export const SKY_COLORS = {
  dayZenith: hexToRgb01(ROLES.skyDay),      // Mist - light sage
  dayHorizon: hexToRgb01(PALETTE.mist),      // FIX: Use mist instead of meadow (was green!)
  nightZenith: hexToRgb01(ROLES.skyNight),   // Abyss - deep dark blue
  nightHorizon: hexToRgb01(ROLES.fogNight),  // Deep forest
  twilightZenith: hexToRgb01(ROLES.skyTwilight), // Rust - warm twilight
  twilightHorizon: hexToRgb01(PALETTE.coral),    // Coral - warm horizon (not flame)
} as const;

export const FOG_COLORS = {
  day: hexToRgb01(ROLES.fogDay),      // Mist
  night: hexToRgb01(ROLES.fogNight),  // Deep
  twilight: hexToRgb01(ROLES.fogTwilight), // Sage
} as const;

// ============================================
// CSS CUSTOM PROPERTY HELPERS
// ============================================

/**
 * Convert hex to CSS HSL string for Tailwind/CSS custom properties
 */
export function hexToHsl(hex: string): { h: number; s: number; l: number } {
  const rgb = hexToRgb01(hex);
  const r = rgb.r;
  const g = rgb.g;
  const b = rgb.b;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r:
        h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
        break;
      case g:
        h = ((b - r) / d + 2) / 6;
        break;
      case b:
        h = ((r - g) / d + 4) / 6;
        break;
    }
  }

  return {
    h: Math.round(h * 360),
    s: Math.round(s * 100),
    l: Math.round(l * 100),
  };
}

/**
 * Get HSL string for CSS custom property
 */
export function paletteToHslString(key: keyof typeof PALETTE): string {
  const hsl = hexToHsl(PALETTE[key]);
  return `${hsl.h} ${hsl.s}% ${hsl.l}%`;
}
