// EnhancedWaterPlane - Frontierra Version
// Fixed: Follows river paths, seamless waves, and correct ground alignment.

import { useMemo, useRef, useEffect } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { WorldData } from "@/lib/worldData";
import { WORLD_HEIGHT_SCALE, getWaterLevel } from "@/lib/worldConstants";
import { getTimeOfDay, isNight } from "@/lib/timeOfDay";
import { WORLD_A_ID } from "@/lib/worldContext";

interface EnhancedWaterPlaneProps {
  world: WorldData;
  worldX?: number;
  worldY?: number;
  animated?: boolean;
}

const WATER_COLORS = {
  day: { shallow: new THREE.Color(0.2, 0.5, 0.6), deep: new THREE.Color(0.05, 0.15, 0.25) },
  night: { shallow: new THREE.Color(0.05, 0.1, 0.15), deep: new THREE.Color(0.01, 0.02, 0.05) },
};

export function EnhancedWaterPlane({ world, worldX = 0, worldY = 0, animated = true }: EnhancedWaterPlaneProps) {
  const materialRef = useRef<THREE.ShaderMaterial>(null);
  const heightScale = WORLD_HEIGHT_SCALE;
  const waterHeight = getWaterLevel(world.vars) * heightScale;

  // 1. GENERATE GEOMETRY (Only where water actually is)
  const geometry = useMemo(() => {
    const size = world.gridSize;
    const positions = new Float32Array(size * size * 3);
    const uvs = new Float32Array(size * size * 2);
    const indices: number[] = [];

    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const vi = y * size + x;
        positions[vi * 3] = x;
        positions[vi * 3 + 1] = 0; // Local Y is 0, we move the whole mesh to waterHeight
        positions[vi * 3 + 2] = y;

        // Global UVs for seamless wave animation across chunks
        uvs[vi * 2] = (x + worldX * (size - 1)) * 0.1;
        uvs[vi * 2 + 1] = (y + worldY * (size - 1)) * 0.1;
      }
    }

    for (let y = 0; y < size - 1; y++) {
      for (let x = 0; x < size - 1; x++) {
        const flippedY = size - 1 - y;
        const c00 = world.terrain[flippedY]?.[x];
        const c10 = world.terrain[flippedY]?.[x + 1];
        const c01 = world.terrain[flippedY - 1]?.[x];
        const c11 = world.terrain[flippedY - 1]?.[x + 1];

        // Only create triangles if one of the corners is water or river
        if (
          c00?.hasRiver ||
          c00?.type === "water" ||
          c10?.hasRiver ||
          c10?.type === "water" ||
          c01?.hasRiver ||
          c01?.type === "water" ||
          c11?.hasRiver ||
          c11?.type === "water"
        ) {
          const v00 = y * size + x,
            v10 = y * size + (x + 1),
            v01 = (y + 1) * size + x,
            v11 = (y + 1) * size + (x + 1);
          indices.push(v00, v01, v10, v01, v11, v10);
        }
      }
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geo.setAttribute("uv", new THREE.BufferAttribute(uvs, 2));
    geo.setIndex(indices);
    return geo;
  }, [world, worldX, worldY]);

  // 2. SHADER MATERIAL
  const shaderMaterial = useMemo(() => {
    const colors = isNight(getTimeOfDay({ worldId: WORLD_A_ID, worldX, worldY }))
      ? WATER_COLORS.night
      : WATER_COLORS.day;
    return new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uShallowColor: { value: colors.shallow },
        uDeepColor: { value: colors.deep },
        uOpacity: { value: 0.75 },
      },
      vertexShader: `
        varying vec2 vUv;
        varying vec3 vWorldPos;
        void main() {
          vUv = uv;
          vec4 wp = modelMatrix * vec4(position, 1.0);
          vWorldPos = wp.xyz;
          gl_Position = projectionMatrix * viewMatrix * wp;
        }
      `,
      fragmentShader: `
        uniform float uTime;
        uniform vec3 uShallowColor;
        uniform vec3 uDeepColor;
        uniform float uOpacity;
        varying vec2 vUv;
        varying vec3 vWorldPos;

        float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123); }
        float noise(vec2 p) {
          vec2 i = floor(p); vec2 f = fract(p);
          f = f * f * (3.0 - 2.0 * f);
          return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y);
        }

        void main() {
          // Waves based on world position (seamless)
          float n = noise(vWorldPos.xz * 1.5 + uTime * 0.5) * 0.5 + 0.5;
          float n2 = noise(vWorldPos.xz * 2.5 - uTime * 0.3) * 0.5 + 0.5;
          
          // Mix colors based on noise for a "moving water" look
          vec3 color = mix(uDeepColor, uShallowColor, n * n2);
          
          // Edge foam / highlight
          float foam = smoothstep(0.7, 0.95, n * n2);
          color += foam * 0.15;

          gl_FragColor = vec4(color, uOpacity);
        }
      `,
      transparent: true,
      depthWrite: false,
    });
  }, [worldX, worldY]);

  useFrame((state, delta) => {
    if (materialRef.current) materialRef.current.uniforms.uTime.value += delta;
  });

  useEffect(() => {
    return () => geometry.dispose();
  }, [geometry]);

  return (
    <mesh
      geometry={geometry}
      material={shaderMaterial}
      position={[0, waterHeight + 0.02, 0]} // sits 0.02 above the "base" to prevent flickering
    />
  );
}
