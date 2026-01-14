// EnhancedWaterPlane - Water with fresnel, depth tint, and subtle animation
// Now renders PER-CELL water surfaces for lakes + rivers (type==="water" OR hasRiver)
// CRITICAL: No non-deterministic world state changes - animation is visual only

import { useMemo, useRef } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { WorldData } from "@/lib/worldData";
import { WORLD_HEIGHT_SCALE, getWaterLevel, RIVER_DEPTH_OFFSET } from "@/lib/worldConstants";
import { getTimeOfDay, isNight, TimeOfDayContext } from "@/lib/timeOfDay";
import { WORLD_A_ID } from "@/lib/worldContext";

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
    deep: new THREE.Color(0.08, 0.25, 0.4),
  },
  night: {
    shallow: new THREE.Color(0.06, 0.18, 0.28),
    deep: new THREE.Color(0.03, 0.1, 0.18),
  },
};

export function EnhancedWaterPlane({ world, worldX = 0, worldY = 0, animated = true }: EnhancedWaterPlaneProps) {
  const meshRef = useRef<THREE.Mesh>(null);

  const heightScale = WORLD_HEIGHT_SCALE;
  const waterLevel = getWaterLevel(world.vars);
  const waterHeight = waterLevel * heightScale;

  // In your terrain you use `riverDepth = waterHeight - RIVER_DEPTH_OFFSET` as the river channel target.
  // We'll render river surface slightly ABOVE that so it reads as water in the carved trench.
  const riverSurfaceY = waterHeight - RIVER_DEPTH_OFFSET + 0.02;

  // Time of day context
  const timeContext: TimeOfDayContext = useMemo(
    () => ({
      worldId: WORLD_A_ID,
      worldX,
      worldY,
    }),
    [worldX, worldY],
  );

  const timeOfDay = useMemo(() => getTimeOfDay(timeContext), [timeContext]);
  const night = isNight(timeOfDay);

  // Build a tiled water surface mesh for:
  // - lakes/ocean: cell.type === "water"
  // - rivers: cell.hasRiver === true
  //
  // Each cell is a small quad (slightly inset) to avoid z-fighting at the shore.
  const geometry = useMemo(() => {
    const size = world.gridSize;

    // Collect water cells first (deterministic order)
    const waterCells: { x: number; y: number; isRiver: boolean }[] = [];
    for (let yy = 0; yy < size; yy++) {
      for (let xx = 0; xx < size; xx++) {
        const flippedY = size - 1 - yy;
        const cell = world.terrain[flippedY]?.[xx];
        if (!cell) continue;

        const isLake = cell.type === "water";
        const isRiver = !!cell.hasRiver;

        if (isLake || isRiver) {
          waterCells.push({ x: xx, y: yy, isRiver });
        }
      }
    }

    if (waterCells.length === 0) {
      // Empty geometry if no water at all
      return new THREE.BufferGeometry();
    }

    // One quad per cell => 4 verts, 6 indices
    const quadCount = waterCells.length;
    const positions = new Float32Array(quadCount * 4 * 3);
    const uvs = new Float32Array(quadCount * 4 * 2);
    const indices = new Uint32Array(quadCount * 6);

    // Slight inset so water doesn’t bleed over onto banks
    const inset = 0.05;

    let v = 0;
    let i = 0;

    for (let c = 0; c < quadCount; c++) {
      const { x, y, isRiver } = waterCells[c];

      // Water surface height:
      // - Rivers: sit at riverSurfaceY (matches carved trench)
      // - Lakes: sit at waterHeight (global level), slightly below to reduce z-fight
      const surfaceY = isRiver ? riverSurfaceY : waterHeight - 0.01;

      // Quad corners in world space (tile coords)
      const x0 = x + inset;
      const x1 = x + 1 - inset;
      const z0 = y + inset;
      const z1 = y + 1 - inset;

      // Positions (4 verts)
      // v0: (x0, y, z0)
      positions[v * 3 + 0] = x0;
      positions[v * 3 + 1] = surfaceY;
      positions[v * 3 + 2] = z0;
      uvs[v * 2 + 0] = 0;
      uvs[v * 2 + 1] = 0;
      v++;

      // v1: (x1, y, z0)
      positions[v * 3 + 0] = x1;
      positions[v * 3 + 1] = surfaceY;
      positions[v * 3 + 2] = z0;
      uvs[v * 2 + 0] = 1;
      uvs[v * 2 + 1] = 0;
      v++;

      // v2: (x0, y, z1)
      positions[v * 3 + 0] = x0;
      positions[v * 3 + 1] = surfaceY;
      positions[v * 3 + 2] = z1;
      uvs[v * 2 + 0] = 0;
      uvs[v * 2 + 1] = 1;
      v++;

      // v3: (x1, y, z1)
      positions[v * 3 + 0] = x1;
      positions[v * 3 + 1] = surfaceY;
      positions[v * 3 + 2] = z1;
      uvs[v * 2 + 0] = 1;
      uvs[v * 2 + 1] = 1;
      v++;

      // Indices for the quad (two triangles)
      const base = c * 4;
      indices[i++] = base + 0;
      indices[i++] = base + 2;
      indices[i++] = base + 1;

      indices[i++] = base + 2;
      indices[i++] = base + 3;
      indices[i++] = base + 1;
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geo.setAttribute("uv", new THREE.BufferAttribute(uvvs(uvs), 2)); // ensure correct typed array usage
    geo.setIndex(new THREE.BufferAttribute(indices, 1));
    geo.computeVertexNormals();
    return geo;
  }, [world, waterHeight, riverSurfaceY]);

  // Helper to guarantee Float32Array (some bundlers get picky)
  function uvvs(arr: Float32Array) {
    return arr;
  }

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
        uOpacity: { value: night ? 0.82 : 0.72 },
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
            float wave1 = noise(vWorldPosition.xz * 0.18 + uTime * 0.35) * 2.0 - 1.0;
            float wave2 = noise(vWorldPosition.xz * 0.28 - uTime * 0.22) * 2.0 - 1.0;
            normal.x += wave1 * 0.07;
            normal.z += wave2 * 0.07;
            normal = normalize(normal);
          }

          // Fresnel
          float fresnel = uFresnelBias + (1.0 - uFresnelBias) *
            pow(1.0 - max(dot(viewDir, normal), 0.0), uFresnelPower);

          // Per-tile depth tint:
          // center of tile looks deeper, edges look shallower
          float distToCenter = length(vUv - 0.5);
          float depth = smoothstep(0.05, 0.55, distToCenter); // 0 near center -> 1 near edge
          vec3 waterColor = mix(uDeepColor, uShallowColor, depth);

          // Spec highlight
          vec3 lightDir = normalize(vec3(0.3, 1.0, 0.2));
          float spec = pow(max(dot(reflect(-lightDir, normal), viewDir), 0.0), 32.0);
          vec3 specColor = vec3(1.0, 0.98, 0.95) * spec * 0.28;

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

  useFrame((_, delta) => {
    if (animated) shaderMaterial.uniforms.uTime.value += delta;
  });

  // If no water cells, render nothing
  if (!geometry || geometry.getAttribute("position")?.count === 0) return null;

  return <mesh ref={meshRef} geometry={geometry} material={shaderMaterial} />;
}
