// Ambient Audio System - Cinematic music + environmental SFX
import { useEffect, useRef, useMemo, useCallback } from "react";
import { WorldData } from "@/lib/worldData";
import { getTimeOfDay, isNight, TimeOfDayContext } from "@/lib/timeOfDay";
import { WORLD_A_ID } from "@/lib/worldContext";
import {
  AMBIENT_SOURCES,
  MUSIC_TRACKS,
  VOLUME_PRESETS,
  getTerrainAmbients,
  shouldTriggerExplorationMusic,
  TerrainAmbient,
} from "@/lib/soundscape";

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
  category: "music" | "ambient";
  fadeSpeed: number;
  loaded: boolean;
}

function getTerrainComposition(world: WorldData, x: number, z: number, radius: number = 10) {
  const composition = {
    forest: 0,
    water: 0,
    mountain: 0,
    ground: 0,
    total: 0,
  };

  if (!world || !world.terrain || world.terrain.length === 0 || !world.gridSize) {
    return composition;
  }

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
        case "forest":
          composition.forest += weight;
          break;
        case "water":
          composition.water += weight;
          break;
        case "mountain":
          composition.mountain += weight;
          break;
        default:
          composition.ground += weight;
      }

      if (cell.hasRiver) {
        composition.water += weight * 0.5;
      }
    }
  }

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
  const audioUnlockedRef = useRef(false);
  const lastMusicTimeRef = useRef(0);
  const lastLandRef = useRef<string | null>(null);
  const musicActiveRef = useRef(false);
  const musicFadeTimeoutRef = useRef<number | null>(null);
  const initRef = useRef(false);

  const timeContext = useMemo<TimeOfDayContext>(() => ({ worldId: WORLD_A_ID, worldX, worldY }), [worldX, worldY]);
  const nightTime = useMemo(() => isNight(getTimeOfDay(timeContext)), [timeContext]);

  const currentLandKey = `${worldX}_${worldY}`;

  useEffect(() => {
    if (initRef.current) return;
    initRef.current = true;

    const ambientKeys = Object.keys(AMBIENT_SOURCES) as TerrainAmbient[];
    ambientKeys.forEach((key) => {
      const src = AMBIENT_SOURCES[key];
      const audio = new Audio();
      audio.loop = true;
      audio.volume = 0;
      audio.preload = "auto";
      audio.src = src;

      const layer: AudioLayer = {
        id: `ambient_${key}`,
        audio,
        targetVolume: 0,
        currentVolume: 0,
        category: "ambient",
        fadeSpeed: 0.008,
        loaded: false,
      };

      audio.addEventListener(
        "canplaythrough",
        () => {
          layer.loaded = true;
        },
        { once: true },
      );

      audio.addEventListener(
        "error",
        () => {
          console.warn(`[Audio] Failed to load: ${key}`);
        },
        { once: true },
      );

      layersRef.current.set(`ambient_${key}`, layer);
    });

    const musicKeys = Object.keys(MUSIC_TRACKS) as (keyof typeof MUSIC_TRACKS)[];
    musicKeys.forEach((key) => {
      const src = MUSIC_TRACKS[key];
      const audio = new Audio();
      audio.loop = false;
      audio.volume = 0;
      audio.preload = "auto";
      audio.src = src;

      const layer: AudioLayer = {
        id: `music_${key}`,
        audio,
        targetVolume: 0,
        currentVolume: 0,
        category: "music",
        fadeSpeed: 0.004,
        loaded: false,
      };

      audio.addEventListener(
        "canplaythrough",
        () => {
          layer.loaded = true;
        },
        { once: true },
      );

      audio.addEventListener("ended", () => {
        musicActiveRef.current = false;
        layer.targetVolume = 0;
        layer.currentVolume = 0;
        layer.audio.volume = 0;
      });

      audio.addEventListener(
        "error",
        () => {
          console.warn(`[Audio] Failed to load: ${key}`);
        },
        { once: true },
      );

      layersRef.current.set(`music_${key}`, layer);
    });

    const runFadeLoop = () => {
      layersRef.current.forEach((layer) => {
        const diff = layer.targetVolume - layer.currentVolume;

        if (Math.abs(diff) > 0.001) {
          const step = diff > 0 ? Math.min(layer.fadeSpeed, diff) : Math.max(-layer.fadeSpeed, diff);

          layer.currentVolume = Math.max(0, Math.min(1, layer.currentVolume + step));
          layer.audio.volume = layer.currentVolume;
        }

        if (
          layer.category === "music" &&
          layer.currentVolume < 0.001 &&
          layer.targetVolume < 0.001 &&
          !layer.audio.paused
        ) {
          layer.audio.pause();
          layer.audio.currentTime = 0;
        }
      });

      fadeRafRef.current = requestAnimationFrame(runFadeLoop);
    };

    fadeRafRef.current = requestAnimationFrame(runFadeLoop);

    return () => {
      if (fadeRafRef.current) cancelAnimationFrame(fadeRafRef.current);
      if (musicFadeTimeoutRef.current) clearTimeout(musicFadeTimeoutRef.current);

      // FIX: Proper audio cleanup to release decoded buffers
      layersRef.current.forEach((layer) => {
        try {
          // 1. Pause playback
          layer.audio.pause();
          
          // 2. Remove all event listeners
          layer.audio.oncanplaythrough = null;
          layer.audio.onended = null;
          layer.audio.onerror = null;
          layer.audio.onplay = null;
          layer.audio.onpause = null;
          
          // 3. Clear source
          layer.audio.src = "";
          
          // 4. Call load() to release decoded audio buffers
          layer.audio.load();
          
          // 5. Null out volume/state
          layer.currentVolume = 0;
          layer.targetVolume = 0;
        } catch (e) {
          // Ignore cleanup errors
        }
      });
      
      // 6. Clear the map to release references
      layersRef.current.clear();
      initRef.current = false;
    };
  }, []);

  useEffect(() => {
    const unlock = () => {
      if (audioUnlockedRef.current) return;
      audioUnlockedRef.current = true;

      layersRef.current.forEach((layer) => {
        if (layer.category === "ambient" && layer.loaded) {
          layer.audio.play().catch(() => {});
        }
      });
    };

    const events = ["pointerdown", "click", "keydown", "touchstart"];
    events.forEach((e) => window.addEventListener(e, unlock, { once: true, capture: true }));

    return () => {
      events.forEach((e) => window.removeEventListener(e, unlock, { capture: true } as EventListenerOptions));
    };
  }, []);

  const triggerMusic = useCallback(() => {
    if (!audioUnlockedRef.current || !musicEnabled || musicActiveRef.current) return;

    const now = Date.now();
    const timeSinceLast = now - lastMusicTimeRef.current;

    if (timeSinceLast < 60000 && lastMusicTimeRef.current > 0) return;

    const tracks = Object.keys(MUSIC_TRACKS) as (keyof typeof MUSIC_TRACKS)[];
    const track = tracks[Math.floor(Math.random() * tracks.length)];
    const layer = layersRef.current.get(`music_${track}`);

    if (!layer || !layer.loaded) return;

    lastMusicTimeRef.current = now;
    musicActiveRef.current = true;

    layer.audio.currentTime = 0;
    layer.targetVolume = VOLUME_PRESETS.music.peak * masterVolume;
    layer.audio.play().catch(() => {
      musicActiveRef.current = false;
    });

    if (musicFadeTimeoutRef.current) clearTimeout(musicFadeTimeoutRef.current);
    musicFadeTimeoutRef.current = window.setTimeout(() => {
      layer.targetVolume = 0;
    }, 150000);
  }, [masterVolume, musicEnabled]);

  useEffect(() => {
    if (!musicEnabled || !audioUnlockedRef.current) return;

    const prev = lastLandRef.current;
    const changed = prev !== null && prev !== currentLandKey;

    if (changed) {
      triggerMusic();
    }

    lastLandRef.current = currentLandKey;
  }, [currentLandKey, musicEnabled, triggerMusic]);

  useEffect(() => {
    if (!musicEnabled || !enabled) return;

    const checkInterval = setInterval(() => {
      if (!audioUnlockedRef.current) return;
      const timeSinceLast = Date.now() - lastMusicTimeRef.current;
      if (shouldTriggerExplorationMusic(timeSinceLast, 180000)) {
        triggerMusic();
      }
    }, 30000);

    return () => clearInterval(checkInterval);
  }, [musicEnabled, enabled, triggerMusic]);

  useEffect(() => {
    if (!enabled || !world || !world.terrain || world.terrain.length === 0) {
      layersRef.current.forEach((layer) => {
        if (layer.category === "ambient") {
          layer.targetVolume = 0;
        }
      });
      return;
    }

    const composition = getTerrainComposition(world, playerPosition.x, playerPosition.y);
    const ambientMix = getTerrainAmbients(composition, nightTime);

    const duckFactor = musicActiveRef.current ? 0.6 : 1.0;

    Object.entries(ambientMix).forEach(([key, intensity]) => {
      const layer = layersRef.current.get(`ambient_${key}`);
      if (!layer) return;

      const baseVolume = VOLUME_PRESETS.ambient[key as TerrainAmbient] || 0.2;
      const targetVol = sfxEnabled ? intensity * baseVolume * masterVolume * duckFactor : 0;
      layer.targetVolume = targetVol;

      if (audioUnlockedRef.current && layer.loaded && targetVol > 0.01 && layer.audio.paused) {
        layer.audio.play().catch(() => {});
      }
    });

    if (!musicEnabled) {
      layersRef.current.forEach((layer) => {
        if (layer.category === "music") {
          layer.targetVolume = 0;
        }
      });
      musicActiveRef.current = false;
    }
  }, [world, playerPosition, nightTime, enabled, sfxEnabled, musicEnabled, masterVolume]);

  return {
    triggerMusic,
    isPlaying: audioUnlockedRef.current,
  };
}
