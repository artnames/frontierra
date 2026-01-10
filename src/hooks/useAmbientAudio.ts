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

// Audio URLs - using free ambient sounds (placeholders for actual assets)
const AUDIO_SOURCES = {
  forest: 'https://assets.mixkit.co/active_storage/sfx/212/212-preview.mp3',
  water: 'https://assets.mixkit.co/active_storage/sfx/2515/2515-preview.mp3', 
  wind: 'https://assets.mixkit.co/active_storage/sfx/2432/2432-preview.mp3',
  night: 'https://assets.mixkit.co/active_storage/sfx/2403/2403-preview.mp3'
};

// Calculate terrain composition around player
function getTerrainComposition(world: WorldData, x: number, z: number, radius: number = 8) {
  const composition = {
    forest: 0,
    water: 0,
    mountain: 0,
    ground: 0,
    total: 0
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
  masterVolume = 0.3
}: AmbientAudioOptions) {
  const audioLayersRef = useRef<Map<string, AudioLayer>>(new Map());
  const fadeIntervalRef = useRef<number | null>(null);
  const hasUserInteracted = useRef(false);
  
  // Get time of day
  const timeContext = useMemo<TimeOfDayContext>(() => ({
    worldId: WORLD_A_ID,
    worldX,
    worldY
  }), [worldX, worldY]);
  
  const night = useMemo(() => isNight(getTimeOfDay(timeContext)), [timeContext]);
  
  // Handle user interaction to enable audio (browser policy)
  useEffect(() => {
    const handleInteraction = () => {
      hasUserInteracted.current = true;
      // Try to resume audio contexts
      audioLayersRef.current.forEach(layer => {
        if (layer.audio) {
          layer.audio.play().catch(() => {});
        }
      });
    };
    
    window.addEventListener('click', handleInteraction, { once: true });
    window.addEventListener('keydown', handleInteraction, { once: true });
    
    return () => {
      window.removeEventListener('click', handleInteraction);
      window.removeEventListener('keydown', handleInteraction);
    };
  }, []);
  
  // Initialize audio layers
  const initializeLayer = useCallback((id: string, src: string) => {
    if (audioLayersRef.current.has(id)) return;
    
    const audio = new Audio(src);
    audio.loop = true;
    audio.volume = 0;
    audio.preload = 'auto';
    
    audioLayersRef.current.set(id, {
      id,
      audio,
      targetVolume: 0,
      currentVolume: 0
    });
    
    if (hasUserInteracted.current) {
      audio.play().catch(() => {});
    }
  }, []);
  
  // Initialize all layers on mount
  useEffect(() => {
    Object.entries(AUDIO_SOURCES).forEach(([id, src]) => {
      initializeLayer(id, src);
    });
    
    // Fade loop for smooth transitions
    fadeIntervalRef.current = window.setInterval(() => {
      audioLayersRef.current.forEach(layer => {
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
      audioLayersRef.current.forEach(layer => {
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
      audioLayersRef.current.forEach(layer => {
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
    
    // Wind (mountains)
    const windLayer = audioLayersRef.current.get('wind');
    if (windLayer) {
      windLayer.targetVolume = composition.mountain * masterVolume * 0.8;
    }
    
    // Night insects/ambient
    const nightLayer = audioLayersRef.current.get('night');
    if (nightLayer) {
      nightLayer.targetVolume = night ? masterVolume * 0.6 : 0;
    }
  }, [world, playerPosition, night, enabled, masterVolume]);
  
  // Cleanup on unmount
  useEffect(() => {
    return () => {
      audioLayersRef.current.forEach(layer => {
        if (layer.audio) {
          layer.audio.pause();
        }
      });
    };
  }, []);
}
