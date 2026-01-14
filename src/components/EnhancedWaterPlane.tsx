// EnhancedWaterPlane - Frontierra Version 3.0
// Fixes: Quad-bleed, floating sheets, and tiling blobs.

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

export function EnhancedWaterPlane({ world, worldX = 0, worldY = 0, animated = true }: EnhancedWaterPlaneProps) {
  const meshRef = useRef<THREE.Mesh>(null);

  const heightScale = WORLD_HEIGHT_SCALE;
  const waterLevel = getWaterLevel(world.vars);
  const waterHeight = waterLevel * heightScale;

  // River surface: slightly above your carved bed. Tune this once your bed carve is final.
  const riverSurface = waterHeight - RIVER_DEPTH_OFFSET * 0.5;

  // 1) SELECTIVE GEOMETRY (per-cell quads for water/river only)
  const geometry = useMemo(() => {
    const size = world.gridSize;

    const positions: number[] = [];
    const uvs: number[] = [];
    const indices: number[] = [];

    // Weld vertices to keep it continuous and reduce seams
    const vertexMap = new Map<string, number>();

    const addVertex = (x: number, z: number, y: number) => {
      const key = `${x},${z},${y}`;
      const existing = vertexMap.get(key);
      if (existing !== undefined) return existing;

      const idx = positions.length / 3;
      positions.push(x, y, z);

      // world-space UVs (seamless across chunks)
      uvs.push((x + worldX * (size - 1)) * 0.1, (z + worldY * (size - 1)) * 0.1);

      vertexMap.set(key, idx);
      return idx;
    };

    // IMPORTANT: match your terrain’s flippedY sampling convention
    for (let y = 0; y < size - 1; y++) {
      for (let x = 0; x < size - 1; x++) {
        const flippedY = size - 1 - y;
        const cell = world.terrain[flippedY]?.[x];
        if (!cell) continue;

        const isWater = cell.type === "water";
        const isRiver = !!cell.hasRiver;

        if (!isWater && !isRiver) continue;

        const surfaceY = (isRiver ? riverSurface : waterHeight) + 0.01; // epsilon lift
        const v00 = addVertex(x, y, surfaceY);
        const v10 = addVertex(x + 1, y, surfaceY);
        const v01 = addVertex(x, y + 1, surfaceY);
        const v11 = addVertex(x + 1, y + 1, surfaceY);

        indices.push(v00, v01, v10);
        indices.push(v01, v11, v10);
      }
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
    geo.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
    geo.setIndex(indices);
    geo.computeVertexNormals();
    geo.computeBoundingSphere();
    return geo;
  }, [world, waterHeight, riverSurface, worldX, worldY]);

  // 2) SHADER MATERIAL
  const shaderMaterial = useMemo(() => {
    const night = isNight(getTimeOfDay({ worldId: WORLD_A_ID, worldX, worldY }));

    return new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uDeepColor: { value: night ? new THREE.Color(0x020a10) : new THREE.Color(0x082540) },
        uShallowColor: { value: night ? new THREE.Color(0x0a1a25) : new THREE.Color(0x206080) },
        uOpacity: { value: night ? 0.85 : 0.7 },
      },
      vertexShader: `
        varying vec3 vWorldPos;
        void main() {
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

        float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123); }

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
          float t = uTime * 0.4;
          float w1 = noise(vWorldPos.xz * 0.8 + t);
          float w2 = noise(vWorldPos.xz * 1.2 - t * 0.8);
          float combined = (w1 + w2) * 0.5;

          vec3 col = mix(uDeepColor, uShallowColor, combined);

          float spec = pow(combined, 4.0) * 0.2;
          col += spec;

          gl_FragColor = vec4(col, uOpacity);
        }
      `,
      transparent: true,
      depthWrite: false,
    });
  }, [worldX, worldY]);

  // Animate deterministically (visual only)
  useFrame((_, delta) => {
    if (animated) shaderMaterial.uniforms.uTime.value += delta;
  });

  useEffect(() => {
    return () => {
      geometry.dispose();
      shaderMaterial.dispose();
    };
  }, [geometry, shaderMaterial]);

  return <mesh ref={meshRef} geometry={geometry} material={shaderMaterial} />;
}
