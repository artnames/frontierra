// Ambient Audio System - Cinematic music + environmental SFX
// Client-only, no syncing, no gameplay impact

import { useEffect, useRef, useMemo, useCallback } from 'react';
import { WorldData } from '@/lib/worldData';
import { getTimeOfDay, isNight, TimeOfDayContext } from '@/lib/timeOfDay';
import { WORLD_A_ID } from '@/lib/worldContext';

interface AmbientAudioOptions {
  world: WorldData;
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
  audio: HTMLAudioElement | null;
  targetVolume: number;
  currentVolume: number;
  category: 'music' | 'sfx';
}

// Cinematic ambient music - royalty-free atmospheric tracks
const MUSIC_SOURCES = {
  // Atmospheric ambient exploration music
  ambient: 'https://cdn.pixabay.com/audio/2022/10/25/audio_52d3d90ffc.mp3',
  // Calm cinematic underscore
  cinematic: 'https://cdn.pixabay.com/audio/2023/09/04/audio_9f8e251f1d.mp3',
};

// Environmental SFX - nature sounds
const SFX_SOURCES = {
  // Wind ambience
  wind: 'https://cdn.pixabay.com/audio/2022/03/10/audio_c8c8a73467.mp3',
  // Water/stream sounds
  water: 'https://cdn.pixabay.com/audio/2021/08/09/audio_dc39bba3b8.mp3',
  // Forest birds
  forest: 'https://cdn.pixabay.com/audio/2022/02/07/audio_5f5d6687f1.mp3',
  // Night crickets
  night: 'https://cdn.pixabay.com/audio/2021/04/06/audio_844c5c7d2b.mp3',
};

// Calculate terrain composition around player
function getTerrainComposition(world: WorldData, x: number, z: number, radius: number = 8) {
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
  masterVolume = 0.4,
}: AmbientAudioOptions) {
  const audioLayersRef = useRef<Map<string, AudioLayer>>(new Map());
  const fadeIntervalRef = useRef<number | null>(null);
  const hasUserInteracted = useRef(false);

  // Get time of day
  const timeContext = useMemo<TimeOfDayContext>(
    () => ({
      worldId: WORLD_A_ID,
      worldX,
      worldY,
    }),
    [worldX, worldY]
  );

  const night = useMemo(() => isNight(getTimeOfDay(timeContext)), [timeContext]);

  // Handle user interaction to enable audio (browser policy)
  useEffect(() => {
    const handleInteraction = () => {
      hasUserInteracted.current = true;
      // Try to start any layers that should be playing
      audioLayersRef.current.forEach((layer) => {
        const a = layer.audio;
        if (!a) return;
        a.muted = false;
        a.play().catch(() => {});
      });
    };

    window.addEventListener('pointerdown', handleInteraction, { once: true, capture: true });
    window.addEventListener('click', handleInteraction, { once: true, capture: true });
    window.addEventListener('keydown', handleInteraction, { once: true, capture: true });
    window.addEventListener('touchstart', handleInteraction, { once: true, capture: true });

    return () => {
      window.removeEventListener('pointerdown', handleInteraction, { capture: true } as any);
      window.removeEventListener('click', handleInteraction, { capture: true } as any);
      window.removeEventListener('keydown', handleInteraction, { capture: true } as any);
      window.removeEventListener('touchstart', handleInteraction, { capture: true } as any);
    };
  }, []);

  // Initialize audio layer
  const initializeLayer = useCallback((id: string, src: string, category: 'music' | 'sfx') => {
    if (audioLayersRef.current.has(id)) return;

    const audio = new Audio();
    audio.loop = true;
    audio.volume = 0;
    audio.preload = 'auto';
    audio.crossOrigin = 'anonymous';

    audio.onerror = () => {
      console.warn(`[AmbientAudio] Failed to load: ${id}`);
    };

    audio.oncanplaythrough = () => {
      if (hasUserInteracted.current) {
        audio.play().catch(() => {});
      }
    };

    audio.src = src;

    audioLayersRef.current.set(id, {
      id,
      audio,
      targetVolume: 0,
      currentVolume: 0,
      category,
    });
  }, []);

  // Initialize all layers on mount
  useEffect(() => {
    // Music layers
    Object.entries(MUSIC_SOURCES).forEach(([id, src]) => {
      initializeLayer(`music_${id}`, src, 'music');
    });
    
    // SFX layers
    Object.entries(SFX_SOURCES).forEach(([id, src]) => {
      initializeLayer(`sfx_${id}`, src, 'sfx');
    });

    // Fade loop for smooth transitions
    fadeIntervalRef.current = window.setInterval(() => {
      audioLayersRef.current.forEach((layer) => {
        if (!layer.audio) return;

        const diff = layer.targetVolume - layer.currentVolume;
        const step = diff * 0.03; // Smooth fade

        if (Math.abs(diff) > 0.001) {
          layer.currentVolume += step;
          layer.audio.volume = Math.max(0, Math.min(1, layer.currentVolume));
        }
      });
    }, 50);

    return () => {
      if (fadeIntervalRef.current) {
        clearInterval(fadeIntervalRef.current);
      }
      audioLayersRef.current.forEach((layer) => {
        if (layer.audio) {
          layer.audio.pause();
          layer.audio.src = '';
        }
      });
      audioLayersRef.current.clear();
    };
  }, [initializeLayer]);

  // Update volumes based on terrain, time, and settings
  useEffect(() => {
    if (!enabled || !world || !world.gridSize) {
      audioLayersRef.current.forEach((layer) => {
        layer.targetVolume = 0;
      });
      return;
    }

    const composition = getTerrainComposition(world, playerPosition.x, playerPosition.y);

    // --- MUSIC LAYERS ---
    const musicVolume = musicEnabled ? masterVolume : 0;
    
    // Main ambient music - always playing at base level
    const ambientLayer = audioLayersRef.current.get('music_ambient');
    if (ambientLayer) {
      ambientLayer.targetVolume = musicVolume * 0.6;
    }
    
    // Cinematic layer - slightly lower, adds depth
    const cinematicLayer = audioLayersRef.current.get('music_cinematic');
    if (cinematicLayer) {
      cinematicLayer.targetVolume = musicVolume * 0.35;
    }

    // --- SFX LAYERS ---
    const sfxVolume = sfxEnabled ? masterVolume : 0;

    // Wind - base layer, stronger in mountains
    const windLayer = audioLayersRef.current.get('sfx_wind');
    if (windLayer) {
      const windBase = 0.15;
      const mountainBoost = composition.mountain * 0.4;
      windLayer.targetVolume = (windBase + mountainBoost) * sfxVolume;
    }

    // Water - near rivers/water
    const waterLayer = audioLayersRef.current.get('sfx_water');
    if (waterLayer) {
      waterLayer.targetVolume = composition.water * sfxVolume * 0.8;
    }

    // Forest birds - in forests, daytime
    const forestLayer = audioLayersRef.current.get('sfx_forest');
    if (forestLayer) {
      forestLayer.targetVolume = composition.forest * sfxVolume * (night ? 0.1 : 0.6);
    }

    // Night crickets - at night
    const nightLayer = audioLayersRef.current.get('sfx_night');
    if (nightLayer) {
      nightLayer.targetVolume = night ? sfxVolume * 0.5 : 0;
    }

    // Start playing any layers that should be audible
    if (hasUserInteracted.current) {
      audioLayersRef.current.forEach((layer) => {
        const a = layer.audio;
        if (!a) return;
        if (layer.targetVolume > 0.001 && a.paused) {
          a.play().catch(() => {});
        }
      });
    }
  }, [world, playerPosition, night, enabled, musicEnabled, sfxEnabled, masterVolume]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      audioLayersRef.current.forEach((layer) => {
        if (layer.audio) {
          layer.audio.pause();
        }
      });
    };
  }, []);
}
