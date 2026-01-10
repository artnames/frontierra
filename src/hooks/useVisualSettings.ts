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

  // Toggle material richness specifically
  const toggleMaterialRichness = useCallback(() => {
    updateSetting('materialRichness', !settings.materialRichness);
  }, [settings.materialRichness, updateSetting]);

  // Toggle vegetation visibility
  const toggleVegetation = useCallback(() => {
    updateSetting('showVegetation', !settings.showVegetation);
  }, [settings.showVegetation, updateSetting]);

  return {
    settings,
    isLoaded: true,
    materialRichness: settings.materialRichness,
    showVegetation: settings.showVegetation,
    toggleMaterialRichness,
    toggleVegetation,
    updateSetting,
  };
}

