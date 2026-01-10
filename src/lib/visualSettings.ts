// Visual Settings - localStorage persisted, no server sync
// Controls visual-only options that never affect world determinism

export interface VisualSettings {
  materialRichness: boolean;
  showVegetation: boolean;
  // Audio settings
  musicEnabled: boolean;
  sfxEnabled: boolean;
  masterVolume: number; // 0-1
}

export const defaultVisualSettings: VisualSettings = {
  materialRichness: true,
  showVegetation: true,
  musicEnabled: true,
  sfxEnabled: true,
  masterVolume: 0.4
};

const STORAGE_KEY = 'nexart-visual-settings';

export function loadVisualSettings(): VisualSettings {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      return { ...defaultVisualSettings, ...parsed };
    }
  } catch (e) {
    console.warn('Failed to load visual settings:', e);
  }
  return { ...defaultVisualSettings };
}

export function saveVisualSettings(settings: VisualSettings): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch (e) {
    console.warn('Failed to save visual settings:', e);
  }
}
