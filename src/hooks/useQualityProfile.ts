// Quality Profile Hook - Adapts rendering settings based on device capabilities
// Mobile devices get reduced quality for stable performance

import { useMemo, useEffect, useState } from 'react';

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

// Get safe device pixel ratio (capped for performance)
function getDevicePixelRatioCap(isMobile: boolean, isLowEnd: boolean): number {
  const native = typeof window !== 'undefined' ? window.devicePixelRatio : 1;
  
  if (isLowEnd) {
    return Math.min(native, 1.0);
  }
  if (isMobile) {
    return Math.min(native, 1.25);
  }
  return Math.min(native, 2.0);
}

export function useQualityProfile(): QualityProfile {
  const [profile, setProfile] = useState<QualityProfile>(() => createProfile());
  
  useEffect(() => {
    // Re-evaluate on resize (orientation changes)
    const handleResize = () => {
      setProfile(createProfile());
    };
    
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);
  
  return profile;
}

function createProfile(): QualityProfile {
  const isMobile = detectMobile();
  const isLowEnd = detectLowEnd();
  const devicePixelRatio = typeof window !== 'undefined' ? window.devicePixelRatio : 1;
  const devicePixelRatioCap = getDevicePixelRatioCap(isMobile, isLowEnd);
  
  if (isLowEnd) {
    return {
      isMobile,
      isLowEnd,
      devicePixelRatio,
      devicePixelRatioCap,
      terrainResolutionScale: 0.5,
      shadowsEnabled: false,
      shadowMapSize: 512,
      postFxEnabled: false,
      waterAnimationEnabled: false,
      vegetationDensity: 0.3,
      maxTreeInstances: 100,
      fogEnabled: true,
      microDetailEnabled: false,
      antialiasEnabled: false,
    };
  }
  
  if (isMobile) {
    return {
      isMobile,
      isLowEnd,
      devicePixelRatio,
      devicePixelRatioCap,
      terrainResolutionScale: 0.75,
      shadowsEnabled: false,
      shadowMapSize: 1024,
      postFxEnabled: false,
      waterAnimationEnabled: true,
      vegetationDensity: 0.6,
      maxTreeInstances: 300,
      fogEnabled: true,
      microDetailEnabled: false,
      antialiasEnabled: false,
    };
  }
  
  // Desktop - full quality
  return {
    isMobile,
    isLowEnd,
    devicePixelRatio,
    devicePixelRatioCap,
    terrainResolutionScale: 1.0,
    shadowsEnabled: true,
    shadowMapSize: 2048,
    postFxEnabled: true,
    waterAnimationEnabled: true,
    vegetationDensity: 1.0,
    maxTreeInstances: 1000,
    fogEnabled: true,
    microDetailEnabled: true,
    antialiasEnabled: true,
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
