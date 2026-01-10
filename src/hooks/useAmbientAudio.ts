// Ambient Audio System - Cinematic music + environmental SFX
// Client-only, no syncing, no gameplay impact
// Uses local Pixabay-licensed audio with CDN fallbacks

import { useEffect, useRef, useMemo, useCallback } from 'react';
import { WorldData } from '@/lib/worldData';
import { getTimeOfDay, isNight, TimeOfDayContext } from '@/lib/timeOfDay';
import { WORLD_A_ID } from '@/lib/worldContext';
import {
  AMBIENT_SOURCES,
  MUSIC_TRACKS,
  FALLBACK_AMBIENT,
  FALLBACK_MUSIC,
  VOLUME_PRESETS,
  getTerrainAmbients,
  shouldTriggerExplorationMusic,
  TerrainAmbient,
} from '@/lib/soundscape';

interface AmbientAudioOptions {
  world: WorldData | null;
  playerPosition: { x: number; y: number };
  worldX?: number;
  worldY?: number;
  enabled?: boolean;
  musicEnabled?: boolean;
  sfxEnabled?: boolean;
  masterVolume?: number;
}

interface AudioLayer {
  id: string;
  audio: HTMLAudioElement;
  targetVolume: number;
  currentVolume: number;
  category: 'music' | 'ambient';
  fadeSpeed: number; // Volume change per frame
}

// Calculate terrain composition around player
function getTerrainComposition(world: WorldData, x: number, z: number, radius: number = 10) {
  const composition = {
    forest: 0,
    water: 0,
    mountain: 0,
    ground: 0,
    total: 0,
  };

  const gridX = Math.floor(x);
  const gridZ = Math.floor(z);
  const flippedY = world.gridSize - 1 - gridZ;

  for (let dy = -radius; dy <= radius; dy++) {
    for (let dx = -radius; dx <= radius; dx++) {
      const checkX = gridX + dx;
      const checkY = flippedY + dy;

      if (checkX < 0 || checkX >= world.gridSize || checkY < 0 || checkY >= world.gridSize) continue;

      const cell = world.terrain[checkY]?.[checkX];
      if (!cell) continue;

      const distance = Math.sqrt(dx * dx + dy * dy);
      const weight = Math.max(0, 1 - distance / radius);

      composition.total += weight;

      switch (cell.type) {
        case 'forest':
          composition.forest += weight;
          break;
        case 'water':
          composition.water += weight;
          break;
        case 'mountain':
          composition.mountain += weight;
          break;
        default:
          composition.ground += weight;
      }

      // Rivers also count as water
      if (cell.hasRiver) {
        composition.water += weight * 0.5;
      }
    }
  }

  // Normalize
  if (composition.total > 0) {
    composition.forest /= composition.total;
    composition.water /= composition.total;
    composition.mountain /= composition.total;
    composition.ground /= composition.total;
  }

  return composition;
}

export function useAmbientAudio({
  world,
  playerPosition,
  worldX = 0,
  worldY = 0,
  enabled = true,
  musicEnabled = true,
  sfxEnabled = true,
  masterVolume = 0.25,
}: AmbientAudioOptions) {
  const layersRef = useRef<Map<string, AudioLayer>>(new Map());
  const fadeRafRef = useRef<number | null>(null);
  const hasInteractedRef = useRef(false);
  const lastMusicTimeRef = useRef(0);
  const lastLandRef = useRef<string | null>(null);
  const musicActiveRef = useRef(false);
  const musicFadeTimeoutRef = useRef<number | null>(null);

  // Time of day context
  const timeContext = useMemo<TimeOfDayContext>(
    () => ({ worldId: WORLD_A_ID, worldX, worldY }),
    [worldX, worldY]
  );
  const nightTime = useMemo(() => isNight(getTimeOfDay(timeContext)), [timeContext]);

  // Current land key for detecting transitions
  const currentLandKey = `${worldX}_${worldY}`;

  // Create audio element with fallback
  const createAudio = useCallback((primarySrc: string, fallbackSrc: string, loop: boolean): HTMLAudioElement => {
    const audio = new Audio();
    audio.loop = loop;
    audio.volume = 0;
    audio.preload = 'auto';
    audio.crossOrigin = 'anonymous';

    // Try primary source, fall back on error
    audio.onerror = () => {
      if (audio.src !== fallbackSrc) {
        console.warn(`[Soundscape] Local file failed, using CDN fallback: ${primarySrc}`);
        audio.src = fallbackSrc;
      }
    };

    audio.src = primarySrc;
    return audio;
  }, []);

  // Initialize all audio layers
  useEffect(() => {
    // Ambient layers (looping)
    const ambientKeys = Object.keys(AMBIENT_SOURCES) as TerrainAmbient[];
    ambientKeys.forEach((key) => {
      const audio = createAudio(
        AMBIENT_SOURCES[key],
        FALLBACK_AMBIENT[key],
        true
      );
      layersRef.current.set(`ambient_${key}`, {
        id: `ambient_${key}`,
        audio,
        targetVolume: 0,
        currentVolume: 0,
        category: 'ambient',
        fadeSpeed: 0.015, // ~3s fade at 60fps
      });
    });

    // Music layers (non-looping for sparse playback)
    const musicKeys = Object.keys(MUSIC_TRACKS) as (keyof typeof MUSIC_TRACKS)[];
    musicKeys.forEach((key) => {
      const audio = createAudio(
        MUSIC_TRACKS[key],
        FALLBACK_MUSIC[key],
        false // Music doesn't loop - plays once then fades
      );
      
      // When music ends, mark as inactive
      audio.onended = () => {
        musicActiveRef.current = false;
        const layer = layersRef.current.get(`music_${key}`);
        if (layer) layer.targetVolume = 0;
      };

      layersRef.current.set(`music_${key}`, {
        id: `music_${key}`,
        audio,
        targetVolume: 0,
        currentVolume: 0,
        category: 'music',
        fadeSpeed: 0.008, // ~4s fade at 60fps
      });
    });

    // Smooth fade animation loop
    const runFadeLoop = () => {
      layersRef.current.forEach((layer) => {
        const diff = layer.targetVolume - layer.currentVolume;
        
        if (Math.abs(diff) > 0.001) {
          const step = diff > 0 
            ? Math.min(layer.fadeSpeed, diff)
            : Math.max(-layer.fadeSpeed, diff);
          
          layer.currentVolume = Math.max(0, Math.min(1, layer.currentVolume + step));
          layer.audio.volume = layer.currentVolume;
        }

        // Pause audio when fully faded out
        if (layer.currentVolume < 0.001 && !layer.audio.paused && layer.targetVolume < 0.001) {
          layer.audio.pause();
        }
      });

      fadeRafRef.current = requestAnimationFrame(runFadeLoop);
    };

    fadeRafRef.current = requestAnimationFrame(runFadeLoop);

    return () => {
      if (fadeRafRef.current) cancelAnimationFrame(fadeRafRef.current);
      if (musicFadeTimeoutRef.current) clearTimeout(musicFadeTimeoutRef.current);
      
      layersRef.current.forEach((layer) => {
        layer.audio.pause();
        layer.audio.src = '';
      });
      layersRef.current.clear();
    };
  }, [createAudio]);

  // Handle user interaction to unlock audio
  useEffect(() => {
    const unlock = () => {
      if (hasInteractedRef.current) return;
      hasInteractedRef.current = true;

      // Start all ambient layers (music triggers separately)
      layersRef.current.forEach((layer) => {
        if (layer.category === 'ambient') {
          layer.audio.play().catch(() => {});
        }
      });
    };

    const events = ['pointerdown', 'click', 'keydown', 'touchstart'];
    events.forEach((e) => window.addEventListener(e, unlock, { once: true, capture: true }));

    return () => {
      events.forEach((e) => window.removeEventListener(e, unlock, { capture: true } as EventListenerOptions));
    };
  }, []);

  // Trigger music on land entry
  useEffect(() => {
    if (!musicEnabled || !hasInteractedRef.current) return;
    
    // Detect land transition
    if (lastLandRef.current !== null && lastLandRef.current !== currentLandKey) {
      // Entering new land - trigger music
      triggerMusic();
    }
    lastLandRef.current = currentLandKey;
  }, [currentLandKey, musicEnabled]);

  // Trigger music function
  const triggerMusic = useCallback(() => {
    if (musicActiveRef.current) return;
    
    const now = Date.now();
    const timeSinceLast = now - lastMusicTimeRef.current;
    
    // Don't re-trigger too quickly
    if (timeSinceLast < 60000) return; // 1 minute cooldown
    
    lastMusicTimeRef.current = now;
    musicActiveRef.current = true;

    // Pick a random music track
    const tracks = Object.keys(MUSIC_TRACKS) as (keyof typeof MUSIC_TRACKS)[];
    const track = tracks[Math.floor(Math.random() * tracks.length)];
    const layer = layersRef.current.get(`music_${track}`);

    if (!layer) return;

    // Reset and play
    layer.audio.currentTime = 0;
    layer.targetVolume = VOLUME_PRESETS.music.peak * masterVolume;
    layer.audio.play().catch(() => {});

    // Fade out after track plays for a while
    if (musicFadeTimeoutRef.current) clearTimeout(musicFadeTimeoutRef.current);
    
    // Let it play for ~2 minutes then start fading
    musicFadeTimeoutRef.current = window.setTimeout(() => {
      layer.targetVolume = 0;
      musicActiveRef.current = false;
    }, 120000);
  }, [masterVolume]);

  // Random exploration music trigger
  useEffect(() => {
    if (!musicEnabled || !enabled) return;

    const checkInterval = setInterval(() => {
      const timeSinceLast = Date.now() - lastMusicTimeRef.current;
      if (shouldTriggerExplorationMusic(timeSinceLast, 180000)) {
        triggerMusic();
      }
    }, 30000); // Check every 30 seconds

    return () => clearInterval(checkInterval);
  }, [musicEnabled, enabled, triggerMusic]);

  // Update ambient volumes based on terrain and time
  useEffect(() => {
    if (!enabled || !world) {
      // Fade out everything
      layersRef.current.forEach((layer) => {
        layer.targetVolume = 0;
      });
      return;
    }

    const composition = getTerrainComposition(world, playerPosition.x, playerPosition.y);
    const ambientMix = getTerrainAmbients(composition, nightTime);

    // Update ambient layer volumes
    Object.entries(ambientMix).forEach(([key, intensity]) => {
      const layer = layersRef.current.get(`ambient_${key}`);
      if (!layer) return;

      const baseVolume = VOLUME_PRESETS.ambient[key as TerrainAmbient] || 0.2;
      const targetVol = sfxEnabled ? intensity * baseVolume * masterVolume : 0;
      layer.targetVolume = targetVol;

      // Start playing if needed
      if (hasInteractedRef.current && targetVol > 0.01 && layer.audio.paused) {
        layer.audio.play().catch(() => {});
      }
    });

    // Update active music volume with master
    layersRef.current.forEach((layer) => {
      if (layer.category === 'music' && layer.targetVolume > 0) {
        // Scale with master volume but keep relative level
        const baseTarget = musicEnabled ? VOLUME_PRESETS.music.base * masterVolume : 0;
        if (musicActiveRef.current) {
          layer.targetVolume = Math.max(baseTarget, layer.targetVolume);
        }
      }
    });

  }, [world, playerPosition, nightTime, enabled, sfxEnabled, musicEnabled, masterVolume]);

  return {
    triggerMusic,
    isPlaying: hasInteractedRef.current,
  };
}
