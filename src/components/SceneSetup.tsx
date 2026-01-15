// SceneSetup - Renderer configuration and scene-level settings
// Handles tone mapping, color space, exposure, and shadow configuration

import { useThree, useFrame } from '@react-three/fiber';
import { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import { getTimeOfDay, getLightingParams, isNight, isTwilight, TimeOfDayContext } from '@/lib/timeOfDay';
import { WORLD_A_ID } from '@/lib/worldContext';

interface SceneSetupProps {
  worldX?: number;
  worldY?: number;
  shadowsEnabled?: boolean;
}

// Exposure values tuned for time of day
const EXPOSURE_DAY = 1.0;
const EXPOSURE_TWILIGHT = 0.9;
const EXPOSURE_NIGHT = 0.75;

export function SceneSetup({ worldX = 0, worldY = 0, shadowsEnabled = true }: SceneSetupProps) {
  const { gl, scene } = useThree();
  
  // Get time-based lighting
  const timeContext: TimeOfDayContext = useMemo(() => ({
    worldId: WORLD_A_ID,
    worldX,
    worldY
  }), [worldX, worldY]);
  
  const timeOfDay = useMemo(() => getTimeOfDay(timeContext), [timeContext]);
  const lighting = useMemo(() => getLightingParams(timeOfDay), [timeOfDay]);
  const night = isNight(timeOfDay);
  const twilight = isTwilight(timeOfDay);
  
  // Configure renderer once on mount
  // Note: outputColorSpace, toneMapping, and toneMappingExposure are set in Canvas onCreated
  useEffect(() => {
    // Use modern light units (better PBR response)
    // @ts-expect-error - present in Three r160, but TS types may vary
    gl.useLegacyLights = false;

    // Configure shadow maps if enabled
    if (shadowsEnabled) {
      gl.shadowMap.enabled = true;
      gl.shadowMap.type = THREE.PCFSoftShadowMap;
    } else {
      gl.shadowMap.enabled = false;
    }
  }, [gl, shadowsEnabled]);
  
  // Update exposure based on time of day
  // Base exposure is set to 1.25 in Canvas onCreated for post-FX pipeline
  // We modulate it here for day/night cycle
  useFrame(() => {
    const baseExposure = 1.25;
    let multiplier = 1.0;
    if (night) {
      multiplier = EXPOSURE_NIGHT / EXPOSURE_DAY; // ~0.75
    } else if (twilight) {
      multiplier = EXPOSURE_TWILIGHT / EXPOSURE_DAY; // ~0.9
    }
    gl.toneMappingExposure = baseExposure * multiplier;
  });
  
  // Set scene background to match fog color for seamless atmosphere
  useEffect(() => {
    const fogColor = new THREE.Color(lighting.fogColor.r, lighting.fogColor.g, lighting.fogColor.b);
    scene.background = fogColor;
  }, [scene, lighting.fogColor]);
  
  return null;
}
