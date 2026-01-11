// EnhancedAtmosphere - Improved lighting and fog for visual richness
// Uses FogExp2 for more natural atmospheric perspective
// Includes shadow-enabled directional light and hemisphere fill

import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { getTimeOfDay, getLightingParams, isNight, isTwilight, TimeOfDayContext } from '@/lib/timeOfDay';
import { WORLD_A_ID } from '@/lib/worldContext';

interface EnhancedAtmosphereProps {
  worldX?: number;
  worldY?: number;
  fogEnabled?: boolean;
  shadowsEnabled?: boolean;
}

// Fog density tuned for atmosphere without obscuring close terrain
const FOG_DENSITY_DAY = 0.012;
const FOG_DENSITY_TWILIGHT = 0.015;
const FOG_DENSITY_NIGHT = 0.018;

// Shadow map configuration
const SHADOW_MAP_SIZE = 2048;
const SHADOW_CAMERA_SIZE = 80;
const SHADOW_CAMERA_NEAR = 1;
const SHADOW_CAMERA_FAR = 200;
const SHADOW_BIAS = -0.0002;

export function EnhancedAtmosphere({ 
  worldX = 0, 
  worldY = 0, 
  fogEnabled = true,
  shadowsEnabled = true 
}: EnhancedAtmosphereProps) {
  const directionalLightRef = useRef<THREE.DirectionalLight>(null);
  
  // Get deterministic time of day
  const timeContext: TimeOfDayContext = useMemo(() => ({
    worldId: WORLD_A_ID,
    worldX,
    worldY
  }), [worldX, worldY]);
  
  const timeOfDay = useMemo(() => getTimeOfDay(timeContext), [timeContext]);
  const lighting = useMemo(() => getLightingParams(timeOfDay), [timeOfDay]);
  const night = isNight(timeOfDay);
  const twilight = isTwilight(timeOfDay);
  
  // Calculate sun position from angle
  const sunPosition = useMemo(() => {
    const angle = lighting.sunAngle;
    const radius = 80;
    const height = Math.sin(angle) * radius;
    const horizontal = Math.cos(angle) * radius;
    // Position sun centered over world
    return [horizontal + 32, Math.max(10, height), 32] as [number, number, number];
  }, [lighting.sunAngle]);
  
  // Convert colors to Three.js format
  const fogColor = useMemo(() => 
    new THREE.Color(lighting.fogColor.r, lighting.fogColor.g, lighting.fogColor.b),
    [lighting.fogColor]
  );
  
  const sunColor = useMemo(() => 
    new THREE.Color(lighting.sunColor.r, lighting.sunColor.g, lighting.sunColor.b),
    [lighting.sunColor]
  );
  
  const ambientColor = useMemo(() => 
    new THREE.Color(lighting.ambientColor.r, lighting.ambientColor.g, lighting.ambientColor.b),
    [lighting.ambientColor]
  );
  
  // Hemisphere light colors - provides soft fill from sky and ground reflection
  const skyColor = useMemo(() => {
    if (night) return '#1a2040';
    if (twilight) return '#665588';
    return '#88aacc';
  }, [night, twilight]);
  
  const groundColor = useMemo(() => {
    if (night) return '#101520';
    if (twilight) return '#443344';
    return '#445544'; // Slight green tint from ground reflection
  }, [night, twilight]);
  
  // Get fog density based on time
  const fogDensity = useMemo(() => {
    if (night) return FOG_DENSITY_NIGHT;
    if (twilight) return FOG_DENSITY_TWILIGHT;
    return FOG_DENSITY_DAY;
  }, [night, twilight]);
  
  // Configure shadow camera for directional light
  useFrame(() => {
    if (directionalLightRef.current && shadowsEnabled) {
      const light = directionalLightRef.current;
      // Update shadow camera to follow world center
      light.shadow.camera.left = -SHADOW_CAMERA_SIZE / 2;
      light.shadow.camera.right = SHADOW_CAMERA_SIZE / 2;
      light.shadow.camera.top = SHADOW_CAMERA_SIZE / 2;
      light.shadow.camera.bottom = -SHADOW_CAMERA_SIZE / 2;
      light.shadow.camera.updateProjectionMatrix();
    }
  });
  
  return (
    <>
      {/* Exponential fog for natural atmosphere */}
      {fogEnabled && (
        <fogExp2 attach="fog" args={[fogColor, fogDensity]} />
      )}
      
      {/* Ambient light - provides base illumination */}
      <ambientLight color={ambientColor} intensity={lighting.ambientIntensity * 0.8} />
      
      {/* Main directional light (sun/moon) with shadows */}
      <directionalLight
        ref={directionalLightRef}
        position={sunPosition}
        color={sunColor}
        intensity={lighting.sunIntensity}
        castShadow={shadowsEnabled}
        shadow-mapSize-width={SHADOW_MAP_SIZE}
        shadow-mapSize-height={SHADOW_MAP_SIZE}
        shadow-camera-near={SHADOW_CAMERA_NEAR}
        shadow-camera-far={SHADOW_CAMERA_FAR}
        shadow-bias={SHADOW_BIAS}
      />
      
      {/* Hemisphere light for soft sky/ground fill - adds depth without harsh shadows */}
      <hemisphereLight 
        args={[skyColor, groundColor, night ? 0.25 : (twilight ? 0.35 : 0.45)]} 
      />
      
      {/* Secondary fill light from opposite direction - reduces harsh shadows */}
      <directionalLight
        position={[-sunPosition[0], sunPosition[1] * 0.3, -sunPosition[2]]}
        color={night ? '#2a3050' : '#aabbcc'}
        intensity={night ? 0.1 : 0.15}
      />
    </>
  );
}
