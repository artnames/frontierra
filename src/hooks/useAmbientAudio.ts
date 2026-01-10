// Ambient Audio System - Terrain-based soundscape
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
  masterVolume?: number;
}

interface AudioLayer {
  id: string;
  audio: HTMLAudioElement | null;
  targetVolume: number;
  currentVolume: number;
}

// Audio URLs - using reliable public domain ambient loops
// These are actual nature ambient sounds for immersive experience
const AUDIO_SOURCES = {
  // Gentle wind through grass/trees
  wind: 'https://upload.wikimedia.org/wikipedia/commons/4/4f/Wind_noise_sound_effect.ogg',
  // Forest birds chirping  
  forest: 'https://upload.wikimedia.org/wikipedia/commons/7/7d/Bird_singing.ogg',
  // Flowing stream/brook
  water: 'https://upload.wikimedia.org/wikipedia/commons/4/4f/Stream_in_the_woods.ogg',
  // Night crickets/insects
  night: 'https://upload.wikimedia.org/wikipedia/commons/0/03/Crickets_at_night.ogg',
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
  masterVolume = 0.3,
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
        a.play().catch(() => {
          // Intentionally ignored (autoplay policies / network blockers)
        });
      });
    };

    // Be generous: different browsers treat different events as "user gesture".
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

  // Initialize audio layers
  const initializeLayer = useCallback((id: string, src: string) => {
    if (audioLayersRef.current.has(id)) return;

    const audio = new Audio();
    audio.loop = true;
    audio.volume = 0;
    audio.preload = 'auto';
    
    // Error handling for audio load failures
    audio.onerror = () => {
      console.warn(`[AmbientAudio] Failed to load: ${id}`);
    };
    
    audio.oncanplaythrough = () => {
      console.log(`[AmbientAudio] Ready: ${id}`);
      if (hasUserInteracted.current) {
        audio.play().catch(() => {});
      }
    };
    
    // Set source after event handlers
    audio.src = src;

    audioLayersRef.current.set(id, {
      id,
      audio,
      targetVolume: 0,
      currentVolume: 0,
    });
  }, []);

  // Initialize all layers on mount
  useEffect(() => {
    Object.entries(AUDIO_SOURCES).forEach(([id, src]) => {
      initializeLayer(id, src);
    });

    // Fade loop for smooth transitions
    fadeIntervalRef.current = window.setInterval(() => {
      audioLayersRef.current.forEach((layer) => {
        if (!layer.audio) return;

        const diff = layer.targetVolume - layer.currentVolume;
        const step = diff * 0.05; // Smooth fade

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

  // Update volumes based on terrain and time
  useEffect(() => {
    if (!enabled || !world || !world.gridSize) {
      audioLayersRef.current.forEach((layer) => {
        layer.targetVolume = 0;
      });
      return;
    }

    const composition = getTerrainComposition(world, playerPosition.x, playerPosition.y);

    // Forest sounds
    const forestLayer = audioLayersRef.current.get('forest');
    if (forestLayer) {
      forestLayer.targetVolume = composition.forest * masterVolume * (night ? 0.5 : 1.0);
    }

    // Water sounds
    const waterLayer = audioLayersRef.current.get('water');
    if (waterLayer) {
      waterLayer.targetVolume = composition.water * masterVolume * 1.2;
    }

    // Wind (mountains) + a tiny baseline so the world is never totally silent
    const windLayer = audioLayersRef.current.get('wind');
    if (windLayer) {
      const baseline = 0.08; // subtle bed layer
      windLayer.targetVolume = (baseline + composition.mountain * 0.8) * masterVolume;
    }

    // Night insects/ambient
    const nightLayer = audioLayersRef.current.get('night');
    if (nightLayer) {
      nightLayer.targetVolume = night ? masterVolume * 0.6 : 0;
    }

    // If user already interacted, keep trying to start any layer that has audible target volume.
    if (hasUserInteracted.current) {
      audioLayersRef.current.forEach((layer) => {
        const a = layer.audio;
        if (!a) return;
        if (layer.targetVolume > 0.001 && a.paused) {
          a.play().catch(() => {});
        }
      });
    }
  }, [world, playerPosition, night, enabled, masterVolume]);

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

