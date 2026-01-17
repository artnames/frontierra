// Time of Day System - Deterministic Day/Night Cycle
// CRITICAL: No simulation, no ticking, no persistence
// All values are derived from world position

import { WORLD_A_ID } from './worldContext';

// ============================================
// TYPES
// ============================================

export interface TimeOfDayContext {
  worldId: string;
  worldX: number;
  worldY: number;
  sessionOffset?: number; // Client-only visual offset (non-canonical)
}

export interface SkyColors {
  zenith: string;    // Color at top of sky
  horizon: string;   // Color at horizon
  sunMoon: string;   // Sun or moon color
  ambient: string;   // Ambient light color
}

export interface LightingParams {
  sunIntensity: number;      // 0-1.5
  ambientIntensity: number;  // 0.1-0.5
  sunAngle: number;          // Radians (position on arc)
  sunColor: { r: number; g: number; b: number };
  ambientColor: { r: number; g: number; b: number };
  fogColor: { r: number; g: number; b: number };
  fogNear: number;
  fogFar: number;
}

// ============================================
// DETERMINISTIC HASH (djb2)
// ============================================

function djb2Hash(str: string): number {
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) + hash) ^ str.charCodeAt(i);
    hash = hash >>> 0;
  }
  return hash;
}

function fract(n: number): number {
  return n - Math.floor(n);
}

// ============================================
// CORE TIME CALCULATION - UTC-BASED GLOBAL CYCLE
// ============================================

// Day/night cycle duration in milliseconds (20 minutes = 1200000ms)
const CYCLE_DURATION_MS = 20 * 60 * 1000;

/**
 * Compute time of day from real-world UTC time.
 * Returns a value in [0, 1) representing:
 * - 0.0 = midnight
 * - 0.25 = dawn
 * - 0.5 = noon
 * - 0.75 = dusk
 * 
 * All players worldwide see the same time.
 * One full cycle = 20 minutes.
 * sessionOffset can be used for local visual adjustments.
 */
export function getTimeOfDay(ctx: TimeOfDayContext): number {
  // Use real-world UTC time for global synchronization
  const now = Date.now();
  
  // Calculate position in the 20-minute cycle
  const cyclePosition = (now % CYCLE_DURATION_MS) / CYCLE_DURATION_MS;
  
  // Apply optional session offset (visual only, non-canonical)
  const timeValue = fract(cyclePosition + (ctx.sessionOffset ?? 0));
  
  return timeValue;
}

/**
 * Check if it's night (roughly 0.8-1.0 and 0.0-0.2)
 */
export function isNight(timeOfDay: number): boolean {
  return timeOfDay < 0.2 || timeOfDay > 0.8;
}

/**
 * Check if it's twilight (dawn or dusk)
 */
export function isTwilight(timeOfDay: number): boolean {
  return (timeOfDay >= 0.2 && timeOfDay <= 0.35) || 
         (timeOfDay >= 0.65 && timeOfDay <= 0.8);
}

/**
 * Check if it's day
 */
export function isDay(timeOfDay: number): boolean {
  return timeOfDay >= 0.35 && timeOfDay <= 0.65;
}

// ============================================
// SUN/MOON POSITION
// ============================================

/**
 * Get sun intensity based on time of day.
 * Peaks at noon (0.5), zero at night.
 */
export function sunIntensity(timeOfDay: number): number {
  // Convert to sun angle where 0.5 = highest
  const sunPhase = Math.abs(timeOfDay - 0.5) * 2; // 0 at noon, 1 at midnight
  
  // Smooth falloff using cosine
  const intensity = Math.max(0, Math.cos(sunPhase * Math.PI * 0.6));
  
  return intensity;
}

/**
 * Get sun/moon angle on the sky arc.
 * Returns angle in radians where:
 * - 0 = eastern horizon
 * - π/2 = zenith
 * - π = western horizon
 */
export function getSunAngle(timeOfDay: number): number {
  // Map time 0.2-0.8 to sun arc 0-π
  if (timeOfDay < 0.2) {
    // Pre-dawn: sun below horizon
    return -0.3;
  } else if (timeOfDay > 0.8) {
    // Post-dusk: sun below horizon
    return Math.PI + 0.3;
  } else {
    // Day cycle: map 0.2-0.8 to 0-π
    const dayProgress = (timeOfDay - 0.2) / 0.6;
    return dayProgress * Math.PI;
  }
}

// ============================================
// SKY GRADIENT COLORS
// ============================================

function lerpColor(a: { r: number; g: number; b: number }, b: { r: number; g: number; b: number }, t: number) {
  return {
    r: a.r + (b.r - a.r) * t,
    g: a.g + (b.g - a.g) * t,
    b: a.b + (b.b - a.b) * t
  };
}

function colorToHex(c: { r: number; g: number; b: number }): string {
  const toHex = (v: number) => Math.round(Math.max(0, Math.min(255, v * 255))).toString(16).padStart(2, '0');
  return `#${toHex(c.r)}${toHex(c.g)}${toHex(c.b)}`;
}

// Sky color presets - brighter nights for playability (Zelda-style)
const SKY_COLORS = {
  midnight: {
    zenith: { r: 0.10, g: 0.10, b: 0.22 },    // Brighter deep blue
    horizon: { r: 0.14, g: 0.14, b: 0.26 }
  },
  dawn: {
    zenith: { r: 0.18, g: 0.14, b: 0.28 },
    horizon: { r: 0.95, g: 0.58, b: 0.38 }
  },
  morning: {
    zenith: { r: 0.42, g: 0.58, b: 0.88 },
    horizon: { r: 0.78, g: 0.88, b: 0.96 }
  },
  noon: {
    zenith: { r: 0.38, g: 0.58, b: 0.92 },
    horizon: { r: 0.68, g: 0.82, b: 0.96 }
  },
  afternoon: {
    zenith: { r: 0.42, g: 0.58, b: 0.88 },
    horizon: { r: 0.78, g: 0.88, b: 0.96 }
  },
  dusk: {
    zenith: { r: 0.28, g: 0.18, b: 0.38 },
    horizon: { r: 0.95, g: 0.48, b: 0.28 }
  },
  night: {
    zenith: { r: 0.12, g: 0.12, b: 0.24 },    // Brighter purple-blue
    horizon: { r: 0.16, g: 0.16, b: 0.30 }
  }
};

/**
 * Get sky gradient colors for given time of day.
 */
export function skyGradient(timeOfDay: number): SkyColors {
  let zenith: { r: number; g: number; b: number };
  let horizon: { r: number; g: number; b: number };
  let sunMoonColor: { r: number; g: number; b: number };
  let ambientColor: { r: number; g: number; b: number };
  
  if (timeOfDay < 0.1) {
    // Deep night
    const t = timeOfDay / 0.1;
    zenith = lerpColor(SKY_COLORS.midnight.zenith, SKY_COLORS.night.zenith, t);
    horizon = lerpColor(SKY_COLORS.midnight.horizon, SKY_COLORS.night.horizon, t);
    sunMoonColor = { r: 0.9, g: 0.9, b: 0.95 }; // Moon
    ambientColor = { r: 0.15, g: 0.15, b: 0.25 };
  } else if (timeOfDay < 0.2) {
    // Pre-dawn
    const t = (timeOfDay - 0.1) / 0.1;
    zenith = lerpColor(SKY_COLORS.night.zenith, SKY_COLORS.dawn.zenith, t);
    horizon = lerpColor(SKY_COLORS.night.horizon, SKY_COLORS.dawn.horizon, t);
    sunMoonColor = { r: 1.0, g: 0.7, b: 0.4 };
    ambientColor = lerpColor({ r: 0.15, g: 0.15, b: 0.25 }, { r: 0.4, g: 0.35, b: 0.35 }, t);
  } else if (timeOfDay < 0.35) {
    // Dawn to morning
    const t = (timeOfDay - 0.2) / 0.15;
    zenith = lerpColor(SKY_COLORS.dawn.zenith, SKY_COLORS.morning.zenith, t);
    horizon = lerpColor(SKY_COLORS.dawn.horizon, SKY_COLORS.morning.horizon, t);
    sunMoonColor = lerpColor({ r: 1.0, g: 0.7, b: 0.4 }, { r: 1.0, g: 0.95, b: 0.85 }, t);
    ambientColor = lerpColor({ r: 0.4, g: 0.35, b: 0.35 }, { r: 0.5, g: 0.5, b: 0.55 }, t);
  } else if (timeOfDay < 0.5) {
    // Morning to noon
    const t = (timeOfDay - 0.35) / 0.15;
    zenith = lerpColor(SKY_COLORS.morning.zenith, SKY_COLORS.noon.zenith, t);
    horizon = lerpColor(SKY_COLORS.morning.horizon, SKY_COLORS.noon.horizon, t);
    sunMoonColor = { r: 1.0, g: 0.98, b: 0.9 };
    ambientColor = { r: 0.55, g: 0.55, b: 0.6 };
  } else if (timeOfDay < 0.65) {
    // Noon to afternoon
    const t = (timeOfDay - 0.5) / 0.15;
    zenith = lerpColor(SKY_COLORS.noon.zenith, SKY_COLORS.afternoon.zenith, t);
    horizon = lerpColor(SKY_COLORS.noon.horizon, SKY_COLORS.afternoon.horizon, t);
    sunMoonColor = { r: 1.0, g: 0.95, b: 0.85 };
    ambientColor = { r: 0.55, g: 0.55, b: 0.6 };
  } else if (timeOfDay < 0.8) {
    // Afternoon to dusk
    const t = (timeOfDay - 0.65) / 0.15;
    zenith = lerpColor(SKY_COLORS.afternoon.zenith, SKY_COLORS.dusk.zenith, t);
    horizon = lerpColor(SKY_COLORS.afternoon.horizon, SKY_COLORS.dusk.horizon, t);
    sunMoonColor = lerpColor({ r: 1.0, g: 0.95, b: 0.85 }, { r: 1.0, g: 0.5, b: 0.25 }, t);
    ambientColor = lerpColor({ r: 0.55, g: 0.55, b: 0.6 }, { r: 0.4, g: 0.3, b: 0.35 }, t);
  } else if (timeOfDay < 0.9) {
    // Dusk to night
    const t = (timeOfDay - 0.8) / 0.1;
    zenith = lerpColor(SKY_COLORS.dusk.zenith, SKY_COLORS.night.zenith, t);
    horizon = lerpColor(SKY_COLORS.dusk.horizon, SKY_COLORS.night.horizon, t);
    sunMoonColor = { r: 0.9, g: 0.9, b: 0.95 }; // Moon rising
    ambientColor = lerpColor({ r: 0.4, g: 0.3, b: 0.35 }, { r: 0.15, g: 0.15, b: 0.25 }, t);
  } else {
    // Night to midnight
    const t = (timeOfDay - 0.9) / 0.1;
    zenith = lerpColor(SKY_COLORS.night.zenith, SKY_COLORS.midnight.zenith, t);
    horizon = lerpColor(SKY_COLORS.night.horizon, SKY_COLORS.midnight.horizon, t);
    sunMoonColor = { r: 0.9, g: 0.9, b: 0.95 }; // Moon
    ambientColor = { r: 0.15, g: 0.15, b: 0.25 };
  }
  
  return {
    zenith: colorToHex(zenith),
    horizon: colorToHex(horizon),
    sunMoon: colorToHex(sunMoonColor),
    ambient: colorToHex(ambientColor)
  };
}

// ============================================
// THREE.JS LIGHTING PARAMETERS
// ============================================

/**
 * Get complete lighting parameters for Three.js scene.
 * All values are purely visual and derived from time.
 */
export function getLightingParams(timeOfDay: number): LightingParams {
  const sun = sunIntensity(timeOfDay);
  const angle = getSunAngle(timeOfDay);
  const night = isNight(timeOfDay);
  const twilight = isTwilight(timeOfDay);
  
  // Sun color based on time
  let sunColor: { r: number; g: number; b: number };
  if (night) {
    // Moonlight - cool blue-white
    sunColor = { r: 0.7, g: 0.75, b: 0.85 };
  } else if (twilight) {
    // Warm golden hour
    sunColor = { r: 1.0, g: 0.75, b: 0.5 };
  } else {
    // Daylight - warm white
    sunColor = { r: 1.0, g: 0.98, b: 0.92 };
  }
  
  // Ambient color - significantly brighter at night for playability
  let ambientColor: { r: number; g: number; b: number };
  if (night) {
    ambientColor = { r: 0.38, g: 0.40, b: 0.55 }; // Brighter blue-tinted ambient
  } else if (twilight) {
    ambientColor = { r: 0.52, g: 0.48, b: 0.52 };
  } else {
    ambientColor = { r: 0.56, g: 0.56, b: 0.62 };
  }
  
  // Fog color and density based on time - less dense at night
  let fogColor: { r: number; g: number; b: number };
  let fogNear: number;
  let fogFar: number;
  
  if (night) {
    fogColor = { r: 0.08, g: 0.08, b: 0.14 };
    fogNear = 40;
    fogFar = 130;
  } else if (twilight) {
    fogColor = { r: 0.35, g: 0.25, b: 0.3 };
    fogNear = 35;
    fogFar = 120;
  } else {
    fogColor = { r: 0.6, g: 0.7, b: 0.8 };
    fogNear = 50;
    fogFar = 150;
  }
  
  return {
    sunIntensity: night ? 0.6 : (twilight ? 0.75 : 1.0 + sun * 0.5),
    ambientIntensity: night ? 0.38 : (twilight ? 0.35 : 0.42), // Brighter night ambient
    sunAngle: angle,
    sunColor,
    ambientColor,
    fogColor,
    fogNear,
    fogFar
  };
}

// ============================================
// STAR FIELD GENERATION (Deterministic)
// ============================================

export interface Star {
  x: number;  // Normalized 0-1
  y: number;  // Normalized 0-1
  size: number;
  brightness: number;
}

/**
 * Generate deterministic star positions for a given world.
 * Stars are only visible at night.
 */
export function generateStars(ctx: TimeOfDayContext, count: number = 150): Star[] {
  const stars: Star[] = [];
  const baseSeed = djb2Hash(`${ctx.worldId}:STARS`);
  
  // Simple seeded random
  let seed = baseSeed;
  const random = () => {
    seed = (seed * 1103515245 + 12345) >>> 0;
    return (seed % 10000) / 10000;
  };
  
  for (let i = 0; i < count; i++) {
    stars.push({
      x: random(),
      y: random() * 0.7, // Concentrate in upper sky
      size: 1 + random() * 2,
      brightness: 0.3 + random() * 0.7
    });
  }
  
  return stars;
}

/**
 * Get star visibility (0-1) based on time of day.
 */
export function getStarVisibility(timeOfDay: number): number {
  if (timeOfDay < 0.15 || timeOfDay > 0.85) {
    return 1.0; // Full visibility at night
  } else if (timeOfDay < 0.25) {
    return 1.0 - (timeOfDay - 0.15) / 0.1; // Fade out at dawn
  } else if (timeOfDay > 0.75) {
    return (timeOfDay - 0.75) / 0.1; // Fade in at dusk
  }
  return 0; // No stars during day
}
