// Soundscape Configuration - Deterministic Ambient + Cinematic Audio
// Client-only, no syncing, no gameplay impact, royalty-free only
// IMPORTANT: uses local Pixabay audio files in /public/audio/**
// If a file is missing, playback fails silently.

// Ambient SFX layers (looping environmental sounds)
export const AMBIENT_SOURCES = {
  // Base wind layer (always present at low volume)
  wind: '/audio/ambient/wind-soft.mp3',
  // Forest birds/leaves
  forest: '/audio/ambient/forest-birds.mp3',
  // Water/stream sounds
  water: '/audio/ambient/water-stream.mp3',
  // Night insects/crickets
  night: '/audio/ambient/night-crickets.mp3',
  // Mountain wind rumble
  mountain: '/audio/ambient/mountain-wind.mp3',
} as const;

// Cinematic music tracks (sparse, emotional, non-looping by default)
export const MUSIC_TRACKS = {
  // Slow evolving ambient pads
  exploration: '/audio/music/exploration-ambient.mp3',
  // Calm cinematic underscore
  discovery: '/audio/music/discovery-theme.mp3',
  // Peaceful travel music
  journey: '/audio/music/journey-calm.mp3',
} as const;

// Volume presets
export const VOLUME_PRESETS = {
  // Ambient SFX volumes (relative to master)
  ambient: {
    wind: 0.12,       // Always present baseline
    forest: 0.45,     // Bird songs when in forest
    water: 0.55,      // Water when near rivers
    night: 0.35,      // Night insects
    mountain: 0.25,   // Mountain wind rumble
  },
  // Music volumes (relative to master)
  music: {
    base: 0.25,       // Very low background
    peak: 0.40,       // Peak during entry
  },
  // Fade durations (ms)
  fade: {
    ambient: 3000,    // 3s crossfade for ambient
    musicIn: 4000,    // 4s fade in for music
    musicOut: 5000,   // 5s fade out for music
  },
} as const;

// Terrain type to ambient layer mapping
export type TerrainAmbient = 'wind' | 'forest' | 'water' | 'night' | 'mountain';

export function getTerrainAmbients(
  terrainComposition: { forest: number; water: number; mountain: number; ground: number },
  isNight: boolean
): Record<TerrainAmbient, number> {
  const { forest, water, mountain } = terrainComposition;

  return {
    // Wind is always present as baseline, boosted in mountains
    wind: 0.3 + mountain * 0.5,
    // Forest birds during day, reduced at night
    forest: forest * (isNight ? 0.15 : 1.0),
    // Water near rivers/lakes
    water: water,
    // Night insects only at night
    night: isNight ? 0.7 : 0,
    // Mountain rumble in highlands
    mountain: mountain * 0.8,
  };
}

// Music trigger conditions
export interface MusicTrigger {
  type: 'land_entry' | 'exploration_timer' | 'discovery';
  track: keyof typeof MUSIC_TRACKS;
}

// Random chance for music during exploration (client-only, not synced)
export function shouldTriggerExplorationMusic(
  timeSinceLastMusic: number,
  minInterval: number = 180000 // 3 minutes
): boolean {
  if (timeSinceLastMusic < minInterval) return false;
  // 15% chance per check after minimum interval
  return Math.random() < 0.15;
}

