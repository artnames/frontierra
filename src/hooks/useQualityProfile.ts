// Quality Profile Hook - Adapts rendering settings based on device capabilities
// Mobile devices get reduced quality for stable performance
// Integrates with user performance level setting from visualSettings

import { useMemo, useEffect, useState } from 'react';
import { 
  loadVisualSettings, 
  getEffectivePerformancePreset,
  type PerformanceLevel,
  type PerformancePreset,
} from '@/lib/visualSettings';

export interface QualityProfile {
  isMobile: boolean;
  isLowEnd: boolean;
  devicePixelRatio: number;
  devicePixelRatioCap: number;
  terrainResolutionScale: number;
  shadowsEnabled: boolean;
  shadowMapSize: number;
  postFxEnabled: boolean;
  waterAnimationEnabled: boolean;
  vegetationDensity: number;
  maxTreeInstances: number;
  fogEnabled: boolean;
  microDetailEnabled: boolean;
  antialiasEnabled: boolean;
  // User preference
  performanceLevel: PerformanceLevel;
}

// Detect if device is likely mobile based on touch + screen size
function detectMobile(): boolean {
  if (typeof window === 'undefined') return false;
  
  const hasTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
  const smallScreen = window.innerWidth < 1024 || window.innerHeight < 600;
  const mobileUA = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
  
  return (hasTouch && smallScreen) || mobileUA;
}

// Detect if device is low-end based on memory/cores
function detectLowEnd(): boolean {
  if (typeof navigator === 'undefined') return false;
  
  // Check hardware concurrency (CPU cores)
  const cores = (navigator as any).hardwareConcurrency || 4;
  // Check device memory (in GB)
  const memory = (navigator as any).deviceMemory || 4;
  
  return cores <= 2 || memory <= 2;
}

export function useQualityProfile(): QualityProfile {
  const [profile, setProfile] = useState<QualityProfile>(() => createProfile());
  
  useEffect(() => {
    // Re-evaluate on resize (orientation changes)
    const handleResize = () => {
      setProfile(createProfile());
    };
    
    // Also re-evaluate when localStorage changes (settings updated)
    const handleStorage = (e: StorageEvent) => {
      if (e.key === 'nexart-visual-settings') {
        setProfile(createProfile());
      }
    };
    
    window.addEventListener('resize', handleResize);
    window.addEventListener('storage', handleStorage);
    
    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('storage', handleStorage);
    };
  }, []);
  
  return profile;
}

function createProfile(): QualityProfile {
  const isMobile = detectMobile();
  const isLowEnd = detectLowEnd();
  const devicePixelRatio = typeof window !== 'undefined' ? window.devicePixelRatio : 1;
  
  // Get user performance preference
  const settings = loadVisualSettings();
  const performanceLevel = settings.performanceLevel;
  
  // Get effective preset based on user preference and device detection
  const preset = getEffectivePerformancePreset(performanceLevel, isMobile, isLowEnd);
  
  // Cap DPR based on preset
  const devicePixelRatioCap = Math.min(devicePixelRatio, preset.dprCap);
  
  return {
    isMobile,
    isLowEnd,
    devicePixelRatio,
    devicePixelRatioCap,
    terrainResolutionScale: isLowEnd ? 0.5 : isMobile ? 0.75 : 1.0,
    shadowsEnabled: preset.shadowsEnabled,
    shadowMapSize: isLowEnd ? 512 : isMobile ? 1024 : 2048,
    postFxEnabled: preset.postFxEnabled,
    waterAnimationEnabled: preset.waterAnimationEnabled,
    vegetationDensity: preset.vegetationDensity,
    maxTreeInstances: preset.maxTreeInstances,
    fogEnabled: preset.fogEnabled,
    microDetailEnabled: preset.microDetailEnabled,
    antialiasEnabled: !isLowEnd && !isMobile,
    performanceLevel,
  };
}

// Helper to get quality-adjusted settings merged with user preferences
export function mergeQualityWithUserSettings(
  quality: QualityProfile,
  userSettings: {
    shadowsEnabled?: boolean;
    postfxBloomEnabled?: boolean;
    waterAnimation?: boolean;
    fogEnabled?: boolean;
    microDetailEnabled?: boolean;
  }
): {
  shadowsEnabled: boolean;
  postFxEnabled: boolean;
  waterAnimationEnabled: boolean;
  fogEnabled: boolean;
  microDetailEnabled: boolean;
} {
  return {
    // User can enable features, but quality profile can force them off
    shadowsEnabled: quality.shadowsEnabled && (userSettings.shadowsEnabled ?? true),
    postFxEnabled: quality.postFxEnabled && (userSettings.postfxBloomEnabled ?? true),
    waterAnimationEnabled: quality.waterAnimationEnabled && (userSettings.waterAnimation ?? true),
    fogEnabled: quality.fogEnabled && (userSettings.fogEnabled ?? true),
    microDetailEnabled: quality.microDetailEnabled && (userSettings.microDetailEnabled ?? true),
  };
}
