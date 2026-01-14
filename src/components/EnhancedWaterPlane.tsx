// EnhancedWaterPlane - Conformal Rivers + Welded Mesh
// FIXED: Rivers no longer float on mountains. River surface conforms to carved bed.
// CRITICAL: Deterministic (no Math.random/Date.now). Animation is visual only.

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
  day: {
    shallow: new THREE.Color(0.15, 0.45, 0.55),
    deep: new THREE.Color(0.08, 0.25, 0.4),
  },
  night: {
    shallow: new THREE.Color(0.06, 0.18, 0.28),
    deep: new THREE.Color(0.03, 0.1, 0.18),
  },
};

// Deterministic micro helper (same style as terrain)
function micro(x: number, y: number, seed: number): number {
  const n = Math.sin(x * 12.9898 + y * 78.233 + seed * 0.1) * 43758.5453;
  return (n - Math.floor(n)) * 0.15 - 0.075;
}

export function EnhancedWaterPlane({ world, worldX = 0, worldY = 0, animated = true }: EnhancedWaterPlaneProps) {
  const materialRef = useRef<THREE.ShaderMaterial | null>(null);

  const heightScale = WORLD_HEIGHT_SCALE;
  const waterLevel = getWaterLevel(world.vars);
  const waterHeight = waterLevel * heightScale;
  const riverDepthTarget = waterHeight - RIVER_DEPTH_OFFSET;

  const night = isNight(getTimeOfDay({ worldId: WORLD_A_ID, worldX, worldY }));

  const geometry = useMemo(() => {
    const size = world.gridSize;

    const positions: number[] = [];
    const uvs: number[] = [];
    const indices: number[] = [];

    // weld by coordinate (x,y)
    const vertexMap = new Map<string, number>();

    const ensureVertex = (vx: number, vy: number, desiredH: number) => {
      const key = `${vx},${vy}`;
      const existing = vertexMap.get(key);
      if (existing !== undefined) {
        // deterministically adjust height when reused:
        // lakes can win (higher), rivers stay slightly below.
        const yi = existing * 3 + 1;
        positions[yi] = Math.max(positions[yi], desiredH);
        return existing;
      }

      const idx = positions.length / 3;
      positions.push(vx, desiredH, vy);

      // global UVs to avoid chunk seams
      uvs.push((vx + worldX * (size - 1)) * 0.12, (vy + worldY * (size - 1)) * 0.12);

      vertexMap.set(key, idx);
      return idx;
    };

    // Compute a conformal river surface height from the same inputs terrain uses:
    // base elevation - carve + small fill lift. Also clamp near riverDepthTarget.
    const riverSurfaceForCell = (cellX: number, cellY: number, flippedY: number) => {
      const cell = world.terrain[flippedY]?.[cellX];
      if (!cell) return riverDepthTarget;

      const baseH = cell.elevation * heightScale;

      const left = world.terrain[flippedY]?.[cellX - 1];
      const right = world.terrain[flippedY]?.[cellX + 1];
      const up = world.terrain[flippedY - 1]?.[cellX];
      const down = world.terrain[flippedY + 1]?.[cellX];

      const riverNeighbors =
        (left?.hasRiver ? 1 : 0) + (right?.hasRiver ? 1 : 0) + (up?.hasRiver ? 1 : 0) + (down?.hasRiver ? 1 : 0);

      const centerFactor = Math.min(1, riverNeighbors / 2);

      const bedNoise = micro(cellX * 3.1, cellY * 3.1, world.seed) * 0.6;

      const BED_MIN = 0.12;
      const BED_MAX = 0.3;
      const bedCarve = BED_MIN + (BED_MAX - BED_MIN) * centerFactor;

      const bedH = baseH - (bedCarve + bedNoise);

      // water sits slightly above bed, but never above local terrain
      const FILL_LIFT = 0.06;
      let surface = bedH + FILL_LIFT;

      // keep near the global river depth target so rivers don't become weird at extremes
      const softFloor = riverDepthTarget - 0.12 - centerFactor * 0.06;
      const softCeil = riverDepthTarget + 0.04;
      surface = Math.max(surface, softFloor);
      surface = Math.min(surface, softCeil);

      // never above base terrain
      surface = Math.min(surface, baseH - 0.02);

      return surface;
    };

    const EPS = 0.012; // anti z-fight

    // Build quads only where we have river/water
    for (let y = 0; y < size - 1; y++) {
      for (let x = 0; x < size - 1; x++) {
        const flippedY = size - 1 - y;
        const cell = world.terrain[flippedY]?.[x];
        if (!cell) continue;

        const isLake = cell.type === "water";
        const isRiver = !!cell.hasRiver;

        if (!isLake && !isRiver) continue;

        const h = isLake ? waterHeight + EPS : riverSurfaceForCell(x, y, flippedY) + EPS;

        const v00 = ensureVertex(x, y, h);
        const v10 = ensureVertex(x + 1, y, h);
        const v01 = ensureVertex(x, y + 1, h);
        const v11 = ensureVertex(x + 1, y + 1, h);

        indices.push(v00, v01, v10);
        indices.push(v01, v11, v10);
      }
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
    geo.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
    geo.setIndex(indices);
    geo.computeVertexNormals();
    return geo;
  }, [world, worldX, worldY, heightScale, waterHeight, riverDepthTarget]);

  const shaderMaterial = useMemo(() => {
    const colors = night ? WATER_COLORS.night : WATER_COLORS.day;

    const mat = new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uShallowColor: { value: colors.shallow },
        uDeepColor: { value: colors.deep },
        uOpacity: { value: night ? 0.85 : 0.75 },
        uAnimated: { value: animated ? 1.0 : 0.0 },
      },
      vertexShader: `
        varying vec3 vWorldPosition;
        void main() {
          vec4 wp = modelMatrix * vec4(position, 1.0);
          vWorldPosition = wp.xyz;
          gl_Position = projectionMatrix * viewMatrix * wp;
        }
      `,
      fragmentShader: `
        uniform float uTime;
        uniform vec3 uShallowColor;
        uniform vec3 uDeepColor;
        uniform float uOpacity;
        uniform float uAnimated;
        varying vec3 vWorldPosition;

        float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123); }
        float noise(vec2 p) {
          vec2 i = floor(p); vec2 f = fract(p);
          f = f * f * (3.0 - 2.0 * f);
          float a = hash(i);
          float b = hash(i + vec2(1.0, 0.0));
          float c = hash(i + vec2(0.0, 1.0));
          float d = hash(i + vec2(1.0, 1.0));
          return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
        }

        void main() {
          float t = uTime * 0.5;
          float w = 0.5;

          if (uAnimated > 0.5) {
            float w1 = noise(vWorldPosition.xz * 1.2 + t);
            float w2 = noise(vWorldPosition.xz * 2.0 - t * 0.4);
            w = (w1 + w2) * 0.5;
          }

          vec3 color = mix(uDeepColor, uShallowColor, w);

          // tiny deterministic spec highlight
          float spec = pow(w, 10.0) * 0.25;
          gl_FragColor = vec4(color + spec, uOpacity);
        }
      `,
      transparent: true,
      side: THREE.DoubleSide,
      depthWrite: false,
    });

    materialRef.current = mat;
    return mat;
  }, [night, animated]);

  useFrame((_, delta) => {
    if (materialRef.current && animated) {
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
