// useVisualSettings - React hook for visual settings state
// Settings are localStorage-only, never synced to backend
// IMPORTANT: this is a shared in-app store (all hook callers stay in sync)

import { useCallback, useSyncExternalStore } from 'react';
import {
  VisualSettings,
  defaultVisualSettings,
  loadVisualSettings,
  saveVisualSettings,
} from '@/lib/visualSettings';

// ---- minimal shared store (single-tab) ----
let snapshot: VisualSettings | null = null;
const listeners = new Set<() => void>();

function getSnapshot(): VisualSettings {
  if (!snapshot) snapshot = loadVisualSettings();
  return snapshot;
}

function setSnapshot(next: VisualSettings) {
  snapshot = next;
  saveVisualSettings(next);
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useVisualSettings() {
  const settings = useSyncExternalStore(subscribe, getSnapshot, () => defaultVisualSettings);

  // Update a single setting
  const updateSetting = useCallback(<K extends keyof VisualSettings>(
    key: K,
    value: VisualSettings[K]
  ) => {
    const prev = getSnapshot();
    const next = { ...prev, [key]: value };
    setSnapshot(next);
  }, []);

  // Toggle material richness
  const toggleMaterialRichness = useCallback(() => {
    updateSetting('materialRichness', !settings.materialRichness);
  }, [settings.materialRichness, updateSetting]);

  // Toggle vegetation visibility
  const toggleVegetation = useCallback(() => {
    updateSetting('showVegetation', !settings.showVegetation);
  }, [settings.showVegetation, updateSetting]);

  // Toggle music
  const toggleMusic = useCallback(() => {
    updateSetting('musicEnabled', !settings.musicEnabled);
  }, [settings.musicEnabled, updateSetting]);

  // Toggle SFX
  const toggleSfx = useCallback(() => {
    updateSetting('sfxEnabled', !settings.sfxEnabled);
  }, [settings.sfxEnabled, updateSetting]);

  // Set master volume
  const setMasterVolume = useCallback((volume: number) => {
    updateSetting('masterVolume', Math.max(0, Math.min(1, volume)));
  }, [updateSetting]);

  // Toggle fog
  const toggleFog = useCallback(() => {
    updateSetting('fogEnabled', !settings.fogEnabled);
  }, [settings.fogEnabled, updateSetting]);

  // Toggle micro detail
  const toggleMicroDetail = useCallback(() => {
    updateSetting('microDetailEnabled', !settings.microDetailEnabled);
  }, [settings.microDetailEnabled, updateSetting]);

  // Toggle shadows
  const toggleShadows = useCallback(() => {
    updateSetting('shadowsEnabled', !settings.shadowsEnabled);
  }, [settings.shadowsEnabled, updateSetting]);

  // Toggle smooth shading
  const toggleSmoothShading = useCallback(() => {
    updateSetting('smoothShading', !settings.smoothShading);
  }, [settings.smoothShading, updateSetting]);

  // Toggle water animation
  const toggleWaterAnimation = useCallback(() => {
    updateSetting('waterAnimation', !settings.waterAnimation);
  }, [settings.waterAnimation, updateSetting]);

  return {
    settings,
    isLoaded: true,
    materialRichness: settings.materialRichness,
    showVegetation: settings.showVegetation,
    musicEnabled: settings.musicEnabled,
    sfxEnabled: settings.sfxEnabled,
    masterVolume: settings.masterVolume,
    fogEnabled: settings.fogEnabled,
    microDetailEnabled: settings.microDetailEnabled,
    shadowsEnabled: settings.shadowsEnabled,
    smoothShading: settings.smoothShading,
    waterAnimation: settings.waterAnimation,
    toggleMaterialRichness,
    toggleVegetation,
    toggleMusic,
    toggleSfx,
    setMasterVolume,
    toggleFog,
    toggleMicroDetail,
    toggleShadows,
    toggleSmoothShading,
    toggleWaterAnimation,
    updateSetting,
  };
}

