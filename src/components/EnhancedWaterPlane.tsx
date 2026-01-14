// EnhancedWaterPlane.tsx
// Rivers are pinned to the carved terrain bed (local), not global sea level.
// Lakes/Ocean stay flat at waterHeight.
// Deterministic: no Math.random(), no Date.now().

import { useMemo, useRef, useEffect } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { WorldData, TerrainCell } from "@/lib/worldData";
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

// Deterministic micro-variation (same style as your terrain)
function microVar(x: number, y: number, seed: number): number {
  const n = Math.sin(x * 12.9898 + y * 78.233 + seed * 0.1) * 43758.5453;
  return (n - Math.floor(n)) * 0.15 - 0.075;
}

// IMPORTANT: replicate the river carve logic so water can sit on the carved bed.
function carvedTerrainHeightAt(
  world: WorldData,
  x: number,
  y: number,
  heightScale: number,
  waterLevel: number,
): number {
  const size = world.gridSize;
  const flippedY = size - 1 - y;
  const cell = world.terrain[flippedY]?.[x];
  if (!cell) return 0;

  const baseH = cell.elevation * heightScale;
  let h = baseH;

  const isRiver = !!cell.hasRiver;

  // 4-neighborhood on the cell grid (same pattern as terrain)
  const left = world.terrain[flippedY]?.[x - 1];
  const right = world.terrain[flippedY]?.[x + 1];
  const up = world.terrain[flippedY - 1]?.[x];
  const down = world.terrain[flippedY + 1]?.[x];

  const nearRiver = isRiver || !!left?.hasRiver || !!right?.hasRiver || !!up?.hasRiver || !!down?.hasRiver;

  if (nearRiver) {
    const riverNeighbors =
      (left?.hasRiver ? 1 : 0) + (right?.hasRiver ? 1 : 0) + (up?.hasRiver ? 1 : 0) + (down?.hasRiver ? 1 : 0);

    // straight rivers (2 neighbors) should still carve deeply
    const centerFactor = Math.min(1, riverNeighbors / 2);

    const bedNoise = microVar(x * 3.1, y * 3.1, world.seed) * 0.6;

    const BANK_CARVE = 0.05;
    const BED_MIN = 0.12;
    const BED_MAX = 0.3;

    const bedCarve = BED_MIN + (BED_MAX - BED_MIN) * centerFactor;
    const carve = isRiver ? bedCarve + bedNoise : BANK_CARVE;

    h = baseH - carve;

    // clamp RELATIVE to baseH (prevents “river ridge” mistakes)
    const MIN_CARVE = isRiver ? 0.1 : 0.02;
    const MAX_CARVE = isRiver ? 0.45 : 0.1;

    h = Math.min(h, baseH - MIN_CARVE);
    h = Math.max(h, baseH - MAX_CARVE);
  }

  // NOTE: we deliberately do NOT clamp rivers to global waterHeight here,
  // because mountain rivers are not sea-level.
  // Lake/ocean surfaces are handled separately as flat planes.

  return h;
}

export function EnhancedWaterPlane({ world, worldX = 0, worldY = 0, animated = true }: EnhancedWaterPlaneProps) {
  const materialRef = useRef<THREE.ShaderMaterial>(null);

  const heightScale = WORLD_HEIGHT_SCALE;
  const waterLevel = getWaterLevel(world.vars);
  const waterHeight = waterLevel * heightScale;

  const night = isNight(getTimeOfDay({ worldId: WORLD_A_ID, worldX, worldY }));
  const colors = night ? WATER_COLORS.night : WATER_COLORS.day;

  // Lift to prevent z-fighting with the carved bed
  const RIVER_LIFT = 0.03;
  const WATER_LIFT = 0.02;

  const geometry = useMemo(() => {
    const size = world.gridSize;

    const positions: number[] = [];
    const uvs: number[] = [];
    const indices: number[] = [];
    const vertexMap = new Map<string, number>();

    // Decide surface type per vertex by looking at nearby cells.
    // This avoids “quad uses only one cell” misalignment.
    const vertexSurfaceAt = (vx: number, vy: number): "none" | "river" | "water" => {
      const cells: (TerrainCell | undefined)[] = [];

      const pushCell = (cx: number, cy: number) => {
        if (cx < 0 || cy < 0 || cx >= size || cy >= size) return;
        const flippedY = size - 1 - cy;
        cells.push(world.terrain[flippedY]?.[cx]);
      };

      // the 4 cells that share this vertex
      pushCell(vx, vy);
      pushCell(vx - 1, vy);
      pushCell(vx, vy - 1);
      pushCell(vx - 1, vy - 1);

      // river wins over water
      if (cells.some((c) => c?.hasRiver)) return "river";
      if (cells.some((c) => c?.type === "water")) return "water";
      return "none";
    };

    const addVertex = (vx: number, vy: number, surface: "river" | "water", vh: number) => {
      // key includes surface so river and lake vertices can coexist at same (x,y) if needed
      const key = `${vx},${vy},${surface}`;
      const existing = vertexMap.get(key);
      if (existing !== undefined) return existing;

      const idx = positions.length / 3;
      positions.push(vx, vh, vy);

      // global UVs (seamless across chunks)
      uvs.push((vx + worldX * (size - 1)) * 0.12, (vy + worldY * (size - 1)) * 0.12);

      vertexMap.set(key, idx);
      return idx;
    };

    // Build indices by checking the 4 corners of each quad
    for (let y = 0; y < size - 1; y++) {
      for (let x = 0; x < size - 1; x++) {
        // Determine whether this quad should exist:
        // if ANY corner vertex belongs to river/water.
        const s00 = vertexSurfaceAt(x, y);
        const s10 = vertexSurfaceAt(x + 1, y);
        const s01 = vertexSurfaceAt(x, y + 1);
        const s11 = vertexSurfaceAt(x + 1, y + 1);

        const hasAny = s00 !== "none" || s10 !== "none" || s01 !== "none" || s11 !== "none";
        if (!hasAny) continue;

        const heightFor = (vx: number, vy: number, s: "river" | "water") => {
          if (s === "water") return waterHeight + WATER_LIFT;

          // river: sit on the locally carved bed + lift
          const bed = carvedTerrainHeightAt(world, vx, vy, heightScale, waterLevel);
          return bed + RIVER_LIFT;
        };

        // If a corner is none but the quad is being drawn (because other corners are water),
        // we treat it as “water” to keep the surface closed.
        const fix = (s: "none" | "river" | "water"): "river" | "water" => (s === "river" ? "river" : "water");

        const aS = fix(s00);
        const bS = fix(s01);
        const cS = fix(s10);
        const dS = fix(s11);

        const v00 = addVertex(x, y, aS, heightFor(x, y, aS));
        const v01 = addVertex(x, y + 1, bS, heightFor(x, y + 1, bS));
        const v10 = addVertex(x + 1, y, cS, heightFor(x + 1, y, cS));
        const v11 = addVertex(x + 1, y + 1, dS, heightFor(x + 1, y + 1, dS));

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
  }, [world, worldX, worldY, heightScale, waterLevel, waterHeight]);

  const shaderMaterial = useMemo(() => {
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
          float spec = pow(combined, 10.0) * 0.3;

          gl_FragColor = vec4(color + spec, uOpacity);
        }
      `,
      transparent: true,
      side: THREE.DoubleSide,
      depthWrite: false,
    });

    materialRef.current = mat;
    return mat;
  }, [colors.deep, colors.shallow, night]);

  useFrame((_, delta) => {
    if (!animated) return;
    if (materialRef.current) materialRef.current.uniforms.uTime.value += delta;
  });

  useEffect(() => {
    return () => {
      geometry.dispose();
      shaderMaterial.dispose();
    };
  }, [geometry, shaderMaterial]);

  return <mesh geometry={geometry} material={shaderMaterial} />;
}
