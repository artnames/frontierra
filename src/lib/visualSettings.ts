// Visual Settings - localStorage persisted, no server sync
// Controls visual-only options that never affect world determinism

export type PerformanceLevel = 'low' | 'auto' | 'high';

export interface VisualSettings {
  materialRichness: boolean;
  showVegetation: boolean;
  // Audio settings
  musicEnabled: boolean;
  sfxEnabled: boolean;
  masterVolume: number; // 0-1
  // Graphics settings
  fogEnabled: boolean;
  microDetailEnabled: boolean;
  shadowsEnabled: boolean;
  smoothShading: boolean;
  waterAnimation: boolean;
  // PostFX settings
  postfxBloomEnabled: boolean;
  postfxVignetteEnabled: boolean;
  postfxOutlineEnabled: boolean;
  postfxNoiseEnabled: boolean;
  // Performance level (overrides quality profile)
  performanceLevel: PerformanceLevel;
}

export const defaultVisualSettings: VisualSettings = {
  materialRichness: true,
  showVegetation: true,
  musicEnabled: true,
  sfxEnabled: true,
  masterVolume: 0.4,
  // Graphics defaults - all enabled for rich visuals
  fogEnabled: true,
  microDetailEnabled: true,
  shadowsEnabled: true,
  smoothShading: true,
  waterAnimation: true,
  // PostFX defaults - all enabled
  postfxBloomEnabled: true,
  postfxVignetteEnabled: true,
  postfxOutlineEnabled: true,
  postfxNoiseEnabled: true,
  // Default to auto (use quality profile detection)
  performanceLevel: 'auto',
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

// ============================================
// PERFORMANCE LEVEL PRESETS
// ============================================

export interface PerformancePreset {
  dprCap: number;
  shadowsEnabled: boolean;
  postFxEnabled: boolean;
  waterAnimationEnabled: boolean;
  fogEnabled: boolean;
  microDetailEnabled: boolean;
  vegetationDensity: number;
  maxTreeInstances: number;
}

export const PERFORMANCE_PRESETS: Record<PerformanceLevel, PerformancePreset> = {
  low: {
    dprCap: 1.0,
    shadowsEnabled: false,
    postFxEnabled: false,
    waterAnimationEnabled: false,
    fogEnabled: true,
    microDetailEnabled: false,
    vegetationDensity: 0.4,
    maxTreeInstances: 150,
  },
  auto: {
    // Auto uses device detection - these are fallback values
    dprCap: 1.5,
    shadowsEnabled: true,
    postFxEnabled: true,
    waterAnimationEnabled: true,
    fogEnabled: true,
    microDetailEnabled: true,
    vegetationDensity: 0.8,
    maxTreeInstances: 500,
  },
  high: {
    dprCap: 2.0,
    shadowsEnabled: true,
    postFxEnabled: true,
    waterAnimationEnabled: true,
    fogEnabled: true,
    microDetailEnabled: true,
    vegetationDensity: 1.0,
    maxTreeInstances: 1000,
  },
};

/**
 * Get effective performance preset based on user setting and device detection
 * @param userLevel User-selected performance level
 * @param isMobile Whether device is mobile
 * @param isLowEnd Whether device is detected as low-end
 */
export function getEffectivePerformancePreset(
  userLevel: PerformanceLevel,
  isMobile: boolean,
  isLowEnd: boolean
): PerformancePreset {
  // User explicitly selected a level
  if (userLevel !== 'auto') {
    return PERFORMANCE_PRESETS[userLevel];
  }

  // Auto mode: use device detection
  if (isLowEnd) {
    return PERFORMANCE_PRESETS.low;
  }

  if (isMobile) {
    // Mobile gets a mix between low and auto
    return {
      dprCap: 1.25,
      shadowsEnabled: false,
      postFxEnabled: false,
      waterAnimationEnabled: true,
      fogEnabled: true,
      microDetailEnabled: false,
      vegetationDensity: 0.6,
      maxTreeInstances: 300,
    };
  }

  // Desktop gets high quality
  return PERFORMANCE_PRESETS.high;
}
