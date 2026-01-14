// EnhancedWaterPlane.tsx - Frontierra Conformal Ribbon Version
// FIXED: Vertex Welding for continuous flow and Relative Height Pinning for mountains.

import { useMemo, useRef, useEffect } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { WorldData } from "@/lib/worldData";
import { WORLD_HEIGHT_SCALE } from "@/lib/worldConstants";
import { getTimeOfDay, isNight } from "@/lib/timeOfDay";
import { WORLD_A_ID } from "@/lib/worldContext";

interface EnhancedWaterPlaneProps {
  world: WorldData;
  worldX?: number;
  worldY?: number;
  animated?: boolean;
}

const WATER_COLORS = {
  day: { shallow: new THREE.Color(0.15, 0.45, 0.55), deep: new THREE.Color(0.08, 0.25, 0.4) },
  night: { shallow: new THREE.Color(0.06, 0.18, 0.28), deep: new THREE.Color(0.03, 0.1, 0.18) },
};

export function EnhancedWaterPlane({ world, worldX = 0, worldY = 0, animated = true }: EnhancedWaterPlaneProps) {
  const meshRef = useRef<THREE.Mesh>(null);
  const materialRef = useRef<THREE.ShaderMaterial>(null);
  const heightScale = WORLD_HEIGHT_SCALE;

  const night = isNight(getTimeOfDay({ worldId: WORLD_A_ID, worldX, worldY }));

  // 1. GENERATE CONFORMAL GEOMETRY (The Ribbon Builder)
  const geometry = useMemo(() => {
    const size = world.gridSize;
    const positions: number[] = [];
    const uvs: number[] = [];
    const indices: number[] = [];

    // Vertex Map for welding: Ensures shared edges between quads are perfectly smooth
    const vertexMap = new Map<string, number>();

    const addVertex = (vx: number, vy: number, vh: number) => {
      // Key includes height to ensure mountain slopes weld correctly
      const key = `${vx},${vy},${vh.toFixed(3)}`;
      if (vertexMap.has(key)) return vertexMap.get(key)!;

      const idx = positions.length / 3;
      positions.push(vx, vh, vy);

      // Global UVs for seamless wave movement across chunks
      uvs.push((vx + worldX * (size - 1)) * 0.15, (vy + worldY * (size - 1)) * 0.15);

      vertexMap.set(key, idx);
      return idx;
    };

    for (let y = 0; y < size - 1; y++) {
      for (let x = 0; x < size - 1; x++) {
        const flippedY = size - 1 - y;
        const cell = world.terrain[flippedY]?.[x];

        // Only draw geometry where the world data says there is water or a river
        if (cell?.hasRiver || cell?.type === "water") {
          // RELATIVE PINNING: Sits exactly 0.1 units above the -0.3 terrain carve
          const waterHeight = cell.elevation * heightScale - 0.2;

          const v00 = addVertex(x, y, waterHeight);
          const v10 = addVertex(x + 1, y, waterHeight);
          const v01 = addVertex(x, y + 1, waterHeight);
          const v11 = addVertex(x + 1, y + 1, waterHeight);

          // Triangle 1
          indices.push(v00, v01, v10);
          // Triangle 2
          indices.push(v01, v11, v10);
        }
      }
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
    geo.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
    geo.setIndex(indices);
    geo.computeVertexNormals();
    return geo;
  }, [world, heightScale, worldX, worldY]);

  // 2. SHADER MATERIAL (Fresnel + Global World-Space Waves)
  const shaderMaterial = useMemo(() => {
    const colors = night ? WATER_COLORS.night : WATER_COLORS.day;

    return new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uShallowColor: { value: colors.shallow },
        uDeepColor: { value: colors.deep },
        uOpacity: { value: night ? 0.8 : 0.7 },
      },
      vertexShader: `
        varying vec3 vWorldPosition;
        varying vec2 vUv;
        void main() {
          vUv = uv;
          vec4 worldPos = modelMatrix * vec4(position, 1.0);
          vWorldPosition = worldPos.xyz;
          gl_Position = projectionMatrix * viewMatrix * worldPos;
        }
      `,
      fragmentShader: `
        uniform float uTime;
        uniform vec3 uShallowColor;
        uniform vec3 uDeepColor;
        uniform float uOpacity;
        varying vec3 vWorldPosition;
        varying vec2 vUv;

        float hash(vec2 p) {
          return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
        }

        float noise(vec2 p) {
          vec2 i = floor(p); vec2 f = fract(p);
          f = f * f * (3.0 - 2.0 * f);
          return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x), 
                     mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y);
        }

        void main() {
          // Waves tied to global world coordinates (prevents tiling seams)
          float t = uTime * 0.5;
          float w1 = noise(vWorldPosition.xz * 1.5 + t);
          float w2 = noise(vWorldPosition.xz * 2.5 - t * 0.6);
          float combined = (w1 + w2) * 0.5;

          vec3 finalColor = mix(uDeepColor, uShallowColor, combined);
          
          // Specular shimmer
          float spec = pow(combined, 12.0) * 0.4;
          finalColor += spec;

          gl_FragColor = vec4(finalColor, uOpacity);
        }
      `,
      transparent: true,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
  }, [night]);

  useFrame((state, delta) => {
    if (materialRef.current) {
      materialRef.current.uniforms.uTime.value += delta;
    }
  });

  useEffect(() => {
    return () => geometry.dispose();
  }, [geometry]);

  return (
    <mesh
      ref={meshRef}
      geometry={geometry}
      material={shaderMaterial}
      onBeforeRender={() => {
        materialRef.current = shaderMaterial;
      }}
    />
  );
}
