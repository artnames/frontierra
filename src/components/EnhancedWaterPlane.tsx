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
  const materialRef = useRef<THREE.ShaderMaterial>(null);

  const heightScale = WORLD_HEIGHT_SCALE;
  const waterLevel = getWaterLevel(world.vars);
  const waterHeight = waterLevel * heightScale;
  const riverDepth = waterHeight - RIVER_DEPTH_OFFSET * 0.5; // Sits slightly above the bed carving

  // 1. GENERATE SELECTIVE GEOMETRY
  const geometry = useMemo(() => {
    const size = world.gridSize;
    const positions: number[] = [];
    const uvs: number[] = [];
    const indices: number[] = [];

    // Map to keep track of added vertices to allow welding (sharing)
    const vertexMap = new Map<string, number>();

    const addVertex = (x: number, y: number, height: number) => {
      const key = `${x},${y},${height}`;
      if (vertexMap.has(key)) return vertexMap.get(key)!;

      const idx = positions.length / 3;
      positions.push(x, height, y);

      // Global UVs for seamless textures
      uvs.push((x + worldX * (size - 1)) * 0.1, (y + worldY * (size - 1)) * 0.1);

      vertexMap.set(key, idx);
      return idx;
    };

    for (let y = 0; y < size - 1; y++) {
      for (let x = 0; x < size - 1; x++) {
        const flippedY = size - 1 - y;
        const cell = world.terrain[flippedY]?.[x];

        // ONLY draw if this specific cell is water or river
        if (cell?.hasRiver || cell?.type === "water") {
          const h = cell.hasRiver ? riverDepth : waterHeight;
          const epsilon = 0.01; // Tiny lift to prevent Z-fighting with bed

          // Define corners for this cell quad
          const v00 = addVertex(x, y, h + epsilon);
          const v10 = addVertex(x + 1, y, h + epsilon);
          const v01 = addVertex(x, y + 1, h + epsilon);
          const v11 = addVertex(x + 1, y + 1, h + epsilon);

          // Triangulate
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
  }, [world, waterHeight, riverDepth, worldX, worldY]);

  // 2. SHADER MATERIAL (Removing the 'Chunk Blob' Logic)
  const shaderMaterial = useMemo(() => {
    const isNightTime = isNight(getTimeOfDay({ worldId: WORLD_A_ID, worldX, worldY }));

    return new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uDeepColor: { value: isNightTime ? new THREE.Color(0x020a10) : new THREE.Color(0x082540) },
        uShallowColor: { value: isNightTime ? new THREE.Color(0x0a1a25) : new THREE.Color(0x206080) },
        uOpacity: { value: isNightTime ? 0.85 : 0.7 },
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
          vec2 i = floor(p); vec2 f = fract(p);
          f = f * f * (3.0 - 2.0 * f);
          return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y);
        }

        void main() {
          // Deterministic World-Space Waves
          float t = uTime * 0.4;
          float w1 = noise(vWorldPos.xz * 0.8 + t);
          float w2 = noise(vWorldPos.xz * 1.2 - t * 0.8);
          float combined = (w1 + w2) * 0.5;

          // Subtle color variation based on wave height
          vec3 finalColor = mix(uDeepColor, uShallowColor, combined);
          
          // Add a simple specular reflection
          float spec = pow(combined, 4.0) * 0.2;
          finalColor += spec;

          gl_FragColor = vec4(finalColor, uOpacity);
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

  return <mesh ref={meshRef} geometry={geometry} material={shaderMaterial} />;
}
