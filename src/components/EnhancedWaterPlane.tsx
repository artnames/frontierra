// EnhancedWaterPlane.tsx - Frontierra Final Conformal Version
// FIXED: Absolute pinning to riverSurface and vertex welding for continuous flow.

import { useMemo, useRef, useEffect } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { WorldData } from "@/lib/worldData";
import { WORLD_HEIGHT_SCALE, getWaterLevel, RIVER_DEPTH_OFFSET } from "@/lib/worldConstants";
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
  const materialRef = useRef<THREE.ShaderMaterial>(null);
  const heightScale = WORLD_HEIGHT_SCALE;

  const waterLevel = getWaterLevel(world.vars);
  const waterHeight = waterLevel * heightScale;
  // This MUST match the riverSurface in SmoothTerrainMesh.tsx
  const riverSurface = waterHeight - RIVER_DEPTH_OFFSET * 0.5;

  const night = isNight(getTimeOfDay({ worldId: WORLD_A_ID, worldX, worldY }));

  // 1. GENERATE WELDED GEOMETRY
  const geometry = useMemo(() => {
    const size = world.gridSize;
    const positions: number[] = [];
    const uvs: number[] = [];
    const indices: number[] = [];
    const vertexMap = new Map<string, number>();

    const addVertex = (vx: number, vy: number, vh: number) => {
      // Key by coordinate only; height is determined by the surface type
      const key = `${vx},${vy}`;
      if (vertexMap.has(key)) return vertexMap.get(key)!;

      const idx = positions.length / 3;
      positions.push(vx, vh, vy);

      // Global UVs for seamless world-space texture flow
      uvs.push((vx + worldX * (size - 1)) * 0.12, (vy + worldY * (size - 1)) * 0.12);

      vertexMap.set(key, idx);
      return idx;
    };

    for (let y = 0; y < size - 1; y++) {
      for (let x = 0; x < size - 1; x++) {
        const flippedY = size - 1 - y;
        const cell = world.terrain[flippedY]?.[x];

        if (cell?.hasRiver || cell?.type === "water") {
          // PINNING: Use absolute heights, not relative-to-mountain heights.
          // This prevents water from "climbing" mountains.
          const h = cell.hasRiver ? riverSurface : waterHeight;

          const v00 = addVertex(x, y, h);
          const v10 = addVertex(x + 1, y, h);
          const v01 = addVertex(x, y + 1, h);
          const v11 = addVertex(x + 1, y + 1, h);

          indices.push(v00, v01, v10);
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
  }, [world, heightScale, riverSurface, waterHeight, worldX, worldY]);

  // 2. DETEMINISTIC SHADER
  const shaderMaterial = useMemo(() => {
    const colors = night ? WATER_COLORS.night : WATER_COLORS.day;

    const mat = new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uShallowColor: { value: colors.shallow },
        uDeepColor: { value: colors.deep },
        uOpacity: { value: night ? 0.85 : 0.75 },
      },
      vertexShader: `
        varying vec3 vWorldPosition;
        void main() {
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

        float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123); }
        float noise(vec2 p) {
          vec2 i = floor(p); vec2 f = fract(p);
          f = f * f * (3.0 - 2.0 * f);
          return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x), 
                     mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y);
        }

        void main() {
          float t = uTime * 0.5;
          float w1 = noise(vWorldPosition.xz * 1.2 + t);
          float w2 = noise(vWorldPosition.xz * 2.0 - t * 0.4);
          float combined = (w1 + w2) * 0.5;

          vec3 color = mix(uDeepColor, uShallowColor, combined);
          
          // Specular highlight
          float spec = pow(combined, 10.0) * 0.3;
          gl_FragColor = vec4(color + spec, uOpacity);
        }
      `,
      transparent: true,
      side: THREE.DoubleSide,
      depthWrite: false, // Prevents Z-fighting artifacts on edges
    });

    materialRef.current = mat; // Direct assignment in useMemo for useFrame access
    return mat;
  }, [night]);

  useFrame((state, delta) => {
    if (materialRef.current) {
      materialRef.current.uniforms.uTime.value += delta;
    }
  });

  useEffect(() => {
    return () => {
      geometry.dispose();
      shaderMaterial.dispose();
    };
  }, [geometry, shaderMaterial]);

  return <mesh geometry={geometry} material={shaderMaterial} />;
}
