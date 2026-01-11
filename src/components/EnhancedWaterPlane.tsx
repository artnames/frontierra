// EnhancedWaterPlane - Water with fresnel, depth tint, and subtle animation
// Uses MeshPhysicalMaterial with custom shader injection for effects
// CRITICAL: No non-deterministic world state changes - animation is visual only

import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { WorldData } from '@/lib/worldData';
import {
  WORLD_HEIGHT_SCALE,
  getWaterLevel,
} from '@/lib/worldConstants';
import { getTimeOfDay, isNight, TimeOfDayContext } from '@/lib/timeOfDay';
import { WORLD_A_ID } from '@/lib/worldContext';

interface EnhancedWaterPlaneProps {
  world: WorldData;
  worldX?: number;
  worldY?: number;
  animated?: boolean;
}

// Water color palette
const WATER_COLORS = {
  day: {
    shallow: new THREE.Color(0.15, 0.45, 0.55),
    deep: new THREE.Color(0.08, 0.25, 0.40),
  },
  night: {
    shallow: new THREE.Color(0.06, 0.18, 0.28),
    deep: new THREE.Color(0.03, 0.10, 0.18),
  },
};

export function EnhancedWaterPlane({
  world,
  worldX = 0,
  worldY = 0,
  animated = true,
}: EnhancedWaterPlaneProps) {
  const meshRef = useRef<THREE.Mesh>(null);
  const materialRef = useRef<THREE.ShaderMaterial>(null);

  const heightScale = WORLD_HEIGHT_SCALE;
  const waterLevel = getWaterLevel(world.vars);
  const waterThresholdHeight = waterLevel * heightScale;

  // Time of day context
  const timeContext: TimeOfDayContext = useMemo(() => ({
    worldId: WORLD_A_ID,
    worldX,
    worldY
  }), [worldX, worldY]);

  const timeOfDay = useMemo(() => getTimeOfDay(timeContext), [timeContext]);
  const night = isNight(timeOfDay);

  // Calculate water plane height (sits just below lowest non-water terrain)
  const waterPlaneHeight = useMemo(() => {
    let minNonWaterElevation = Infinity;
    let waterCellCount = 0;

    for (const row of world.terrain) {
      for (const cell of row) {
        if (cell.type === 'water') {
          waterCellCount++;
        } else if (cell.type !== 'bridge') {
          const cellHeight = cell.elevation * heightScale;
          if (cellHeight < minNonWaterElevation) {
            minNonWaterElevation = cellHeight;
          }
        }
      }
    }

    if (waterCellCount === 0) {
      return minNonWaterElevation - 2;
    }

    const maxSafeHeight = minNonWaterElevation - 0.3;
    return Math.min(waterThresholdHeight, maxSafeHeight);
  }, [world.terrain, heightScale, waterThresholdHeight]);

  // Custom shader material for fresnel + animated normals
  const shaderMaterial = useMemo(() => {
    const colors = night ? WATER_COLORS.night : WATER_COLORS.day;
    
    return new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uShallowColor: { value: colors.shallow },
        uDeepColor: { value: colors.deep },
        uFresnelPower: { value: 2.5 },
        uFresnelBias: { value: 0.1 },
        uAnimated: { value: animated ? 1.0 : 0.0 },
        uOpacity: { value: night ? 0.80 : 0.70 },
        uReflectivity: { value: night ? 0.4 : 0.25 },
      },
      vertexShader: `
        varying vec3 vWorldPosition;
        varying vec3 vWorldNormal;
        varying vec2 vUv;
        
        void main() {
          vUv = uv;
          vec4 worldPos = modelMatrix * vec4(position, 1.0);
          vWorldPosition = worldPos.xyz;
          vWorldNormal = normalize(mat3(modelMatrix) * normal);
          gl_Position = projectionMatrix * viewMatrix * worldPos;
        }
      `,
      fragmentShader: `
        uniform float uTime;
        uniform vec3 uShallowColor;
        uniform vec3 uDeepColor;
        uniform float uFresnelPower;
        uniform float uFresnelBias;
        uniform float uAnimated;
        uniform float uOpacity;
        uniform float uReflectivity;
        
        varying vec3 vWorldPosition;
        varying vec3 vWorldNormal;
        varying vec2 vUv;
        
        // Simple noise for water movement
        float hash(vec2 p) {
          return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
        }
        
        float noise(vec2 p) {
          vec2 i = floor(p);
          vec2 f = fract(p);
          f = f * f * (3.0 - 2.0 * f);
          float a = hash(i);
          float b = hash(i + vec2(1.0, 0.0));
          float c = hash(i + vec2(0.0, 1.0));
          float d = hash(i + vec2(1.0, 1.0));
          return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
        }
        
        void main() {
          vec3 viewDir = normalize(cameraPosition - vWorldPosition);
          
          // Animated normal perturbation (subtle waves)
          vec3 normal = vWorldNormal;
          if (uAnimated > 0.5) {
            float wave1 = noise(vWorldPosition.xz * 0.15 + uTime * 0.3) * 2.0 - 1.0;
            float wave2 = noise(vWorldPosition.xz * 0.25 - uTime * 0.2) * 2.0 - 1.0;
            normal.x += wave1 * 0.08;
            normal.z += wave2 * 0.08;
            normal = normalize(normal);
          }
          
          // Fresnel effect (more reflection at grazing angles)
          float fresnel = uFresnelBias + (1.0 - uFresnelBias) * pow(1.0 - max(dot(viewDir, normal), 0.0), uFresnelPower);
          
          // Depth-based coloring (center = deep, edges = shallow based on position)
          float depth = smoothstep(0.0, 0.4, length(vUv - 0.5));
          vec3 waterColor = mix(uDeepColor, uShallowColor, depth);
          
          // Add slight specular highlight
          vec3 lightDir = normalize(vec3(0.3, 1.0, 0.2));
          float spec = pow(max(dot(reflect(-lightDir, normal), viewDir), 0.0), 32.0);
          vec3 specColor = vec3(1.0, 0.98, 0.95) * spec * 0.3;
          
          // Blend fresnel reflection with water color
          vec3 reflectionColor = vec3(0.5, 0.6, 0.7) * uReflectivity;
          vec3 finalColor = mix(waterColor, reflectionColor, fresnel * uReflectivity) + specColor;
          
          gl_FragColor = vec4(finalColor, uOpacity);
        }
      `,
      transparent: true,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
  }, [night, animated]);

  // Animate water
  useFrame((_, delta) => {
    if (shaderMaterial && animated) {
      shaderMaterial.uniforms.uTime.value += delta;
    }
  });

  return (
    <mesh
      ref={meshRef}
      position={[world.gridSize / 2, waterPlaneHeight, world.gridSize / 2]}
      rotation={[-Math.PI / 2, 0, 0]}
      material={shaderMaterial}
    >
      <planeGeometry args={[world.gridSize, world.gridSize, 1, 1]} />
    </mesh>
  );
}
