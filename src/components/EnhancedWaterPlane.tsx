// EnhancedWaterPlane.tsx - Conformal River Mesh with Waterfall Detection
// CRITICAL: Deterministic elevation pinning and slope-based foam logic.

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
  day: { shallow: new THREE.Color(0.2, 0.5, 0.6), deep: new THREE.Color(0.05, 0.15, 0.25) },
  night: { shallow: new THREE.Color(0.05, 0.1, 0.15), deep: new THREE.Color(0.01, 0.02, 0.05) },
};

export function EnhancedWaterPlane({ world, worldX = 0, worldY = 0, animated = true }: EnhancedWaterPlaneProps) {
  const meshRef = useRef<THREE.Mesh>(null);
  const materialRef = useRef<THREE.ShaderMaterial>(null);

  const heightScale = WORLD_HEIGHT_SCALE;
  const waterLevel = getWaterLevel(world.vars);
  const waterHeight = waterLevel * heightScale;
  // Sits slightly above the carved bed (-0.25 carve + 0.20 water offset = 0.05 above bed)
  const riverDepthOffset = 0.2;

  // 1. GENERATE CONFORMAL GEOMETRY
  const geometry = useMemo(() => {
    const size = world.gridSize;
    const positions: number[] = [];
    const uvs: number[] = [];
    const slopes: number[] = []; // Custom attribute for waterfall detection
    const indices: number[] = [];
    const vertexMap = new Map<string, number>();

    const addVertex = (vx: number, vy: number, vh: number, vslope: number) => {
      const key = `${vx.toFixed(2)},${vy.toFixed(2)},${vh.toFixed(2)}`;
      if (vertexMap.has(key)) return vertexMap.get(key)!;

      const idx = positions.length / 3;
      positions.push(vx, vh, vy);
      uvs.push((vx + worldX * (size - 1)) * 0.1, (vy + worldY * (size - 1)) * 0.1);
      slopes.push(vslope);

      vertexMap.set(key, idx);
      return idx;
    };

    for (let y = 0; y < size - 1; y++) {
      for (let x = 0; x < size - 1; x++) {
        const flippedY = size - 1 - y;
        const cell = world.terrain[flippedY]?.[x];

        if (cell?.hasRiver || cell?.type === "water") {
          // DETERMINISTIC PINNING: Water follows ground height
          const baseH = cell.elevation * heightScale;
          const h = cell.hasRiver ? baseH - riverDepthOffset : waterHeight;

          // Waterfall Detection: Check neighboring cell elevations
          const nextCell = world.terrain[flippedY - 1]?.[x] || cell;
          const drop = Math.abs(cell.elevation - nextCell.elevation);
          const slopeIntensity = Math.min(1.0, drop * 5.0); // 0 = flat, 1 = steep drop

          const v00 = addVertex(x, y, h, slopeIntensity);
          const v10 = addVertex(x + 1, y, h, slopeIntensity);
          const v01 = addVertex(x, y + 1, h, slopeIntensity);
          const v11 = addVertex(x + 1, y + 1, h, slopeIntensity);

          indices.push(v00, v01, v10, v01, v11, v10);
        }
      }
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
    geo.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
    geo.setAttribute("slope", new THREE.Float32BufferAttribute(slopes, 1));
    geo.setIndex(indices);
    geo.computeVertexNormals();
    return geo;
  }, [world, waterHeight, heightScale, worldX, worldY]);

  // 2. SHADER MATERIAL WITH WATERFALL FOAM
  const shaderMaterial = useMemo(() => {
    const isNightTime = isNight(getTimeOfDay({ worldId: WORLD_A_ID, worldX, worldY }));
    const colors = isNightTime ? WATER_COLORS.night : WATER_COLORS.day;

    return new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uDeepColor: { value: colors.deep },
        uShallowColor: { value: colors.shallow },
        uOpacity: { value: isNightTime ? 0.85 : 0.75 },
      },
      vertexShader: `
        attribute float slope;
        varying vec3 vWorldPos;
        varying float vSlope;
        varying vec2 vUv;
        void main() {
          vUv = uv;
          vSlope = slope;
          vec4 wp = modelMatrix * vec4(position, 1.0);
          vWorldPos = wp.xyz;
          gl_Position = projectionMatrix * viewMatrix * wp;
        }
      `,
      fragmentShader: `
        uniform float uTime;
        uniform vec3 uDeepColor;
        uniform vec3 uShallowColor;
        uniform float uOpacity;
        varying vec3 vWorldPos;
        varying float vSlope;
        varying vec2 vUv;

        float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123); }
        float noise(vec2 p) {
          vec2 i = floor(p); vec2 f = fract(p);
          f = f * f * (3.0 - 2.0 * f);
          return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y);
        }

        void main() {
          // Increase flow speed on slopes (waterfalls)
          float flowSpeed = 0.4 + (vSlope * 2.5);
          float t = uTime * flowSpeed;
          
          // World-space waves
          float w1 = noise(vWorldPos.xz * 1.2 + t);
          float w2 = noise(vWorldPos.xz * 2.0 - t * 0.5);
          float combined = (w1 + w2) * 0.5;

          vec3 baseColor = mix(uDeepColor, uShallowColor, combined);
          
          // Waterfall Foam Logic
          // If vSlope is high, mix in white foam based on noise
          float foamMask = smoothstep(0.4, 0.8, noise(vWorldPos.xz * 4.0 + t * 2.0));
          vec3 foamColor = vec3(0.9, 0.95, 1.0);
          vec3 finalColor = mix(baseColor, foamColor, vSlope * foamMask);

          // Subtle highlights
          float spec = pow(combined, 8.0) * 0.3;
          finalColor += spec;

          gl_FragColor = vec4(finalColor, uOpacity);
        }
      `,
      transparent: true,
      depthWrite: false,
    });
  }, [worldX, worldY]);

  useFrame((_, delta) => {
    if (materialRef.current) materialRef.current.uniforms.uTime.value += delta;
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
        if (!materialRef.current) materialRef.current = shaderMaterial;
      }}
    />
  );
}
