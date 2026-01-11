// Soundscape Configuration - Deterministic Ambient + Cinematic Audio
// Client-only, no syncing, no gameplay impact
// LOCAL AUDIO FILES ONLY - no external URLs, no CDN, no fallbacks

// Ambient SFX layers (looping environmental sounds)
export const AMBIENT_SOURCES = {
  wind: '/audio/ambient/wind.mp3',
  forest: '/audio/ambient/forest.mp3',
  water: '/audio/ambient/water.mp3',
  night: '/audio/ambient/night.mp3',
} as const;

// Cinematic music tracks (non-looping, rare triggers)
export const MUSIC_TRACKS = {
  travel_01: '/audio/music/travel_01.mp3',
  travel_02: '/audio/music/travel_02.mp3',
  cradle_of_winter: '/audio/music/cradle_of_winter.mp3',
  discovering_asia: '/audio/music/discovering_asia.mp3',
  ancient_world: '/audio/music/ancient_world.mp3',
  ethereal_world: '/audio/music/ethereal_world.mp3',
} as const;

// Volume presets
export const VOLUME_PRESETS = {
  // Ambient SFX volumes (relative to master)
  ambient: {
    wind: 0.15,       // Always present baseline
    forest: 0.40,     // Bird songs when in forest
    water: 0.50,      // Water when near rivers
    night: 0.35,      // Night insects
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
export type TerrainAmbient = keyof typeof AMBIENT_SOURCES;

export function getTerrainAmbients(
  terrainComposition: { forest: number; water: number; mountain: number; ground: number },
  isNight: boolean
): Record<TerrainAmbient, number> {
  const { forest, water, mountain } = terrainComposition;

  return {
    // Wind is always present as baseline, boosted in mountains/open areas
    wind: 0.25 + mountain * 0.5 + (1 - forest) * 0.2,
    // Forest sounds during day, reduced at night
    forest: forest * (isNight ? 0.15 : 1.0),
    // Water near rivers/lakes
    water: water,
    // Night ambience only at night
    night: isNight ? 0.7 : 0,
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
