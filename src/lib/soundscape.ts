// Soundscape Configuration - Deterministic Ambient + Cinematic Audio
// Client-only, no syncing, no gameplay impact, royalty-free only
// Uses public-domain CDN sources directly (Pixabay license)

// ============================================
// AUDIO SOURCES - CDN (Pixabay / Public Domain)
// All sources are royalty-free, no attribution required
// ============================================

// Ambient SFX layers (looping environmental sounds)
export const AMBIENT_SOURCES = {
  // Base wind layer (always present at low volume)
  wind: 'https://cdn.pixabay.com/audio/2022/03/10/audio_c8c8a73467.mp3',
  // Forest birds/leaves
  forest: 'https://cdn.pixabay.com/audio/2022/02/07/audio_5f5d6687f1.mp3',
  // Water/stream sounds  
  water: 'https://cdn.pixabay.com/audio/2021/08/09/audio_dc39bba3b8.mp3',
  // Night insects/crickets
  night: 'https://cdn.pixabay.com/audio/2022/08/02/audio_54ca0ffa52.mp3',
  // Mountain wind rumble (reuse wind with different mix)
  mountain: 'https://cdn.pixabay.com/audio/2024/04/16/audio_c38a62a4ae.mp3',
} as const;

// Cinematic music tracks (sparse, emotional, non-looping by default)
export const MUSIC_TRACKS = {
  // Slow evolving ambient pads
  exploration: 'https://cdn.pixabay.com/audio/2022/10/25/audio_52d3d90ffc.mp3',
  // Calm cinematic underscore
  discovery: 'https://cdn.pixabay.com/audio/2023/09/04/audio_9f8e251f1d.mp3',
  // Peaceful travel music
  journey: 'https://cdn.pixabay.com/audio/2024/04/09/audio_fa4b04a4a8.mp3',
} as const;

// Volume presets
export const VOLUME_PRESETS = {
  // Ambient SFX volumes (relative to master)
  ambient: {
    wind: 0.15,       // Always present baseline
    forest: 0.40,     // Bird songs when in forest
    water: 0.50,      // Water when near rivers
    night: 0.35,      // Night insects
    mountain: 0.20,   // Mountain wind rumble
  },
  // Music volumes (relative to master)
  music: {
    base: 0.20,       // Very low background
    peak: 0.35,       // Peak during entry
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
