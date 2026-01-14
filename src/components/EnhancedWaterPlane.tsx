// src/components/EnhancedWaterPlane.tsx
import { useMemo, useRef, useEffect } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { WorldData, TerrainCell } from "@/lib/worldData";
import { WORLD_HEIGHT_SCALE, getWaterLevel } from "@/lib/worldConstants";

interface EnhancedWaterPlaneProps {
  world: WorldData;
  worldX?: number;
  worldY?: number;
  animated?: boolean;
}

function microVar(x: number, y: number, seed: number) {
  const n = Math.sin(x * 12.9898 + y * 78.233 + seed * 0.1) * 43758.5453;
  return (n - Math.floor(n)) * 0.15 - 0.075;
}

/**
 * Radius-based deterministic mask for “soft river edges”.
 * 1.0 on river cells, ~0.6 adjacent, ~0.25 within 2 tiles, else 0.
 */
function riverMaskAtVertex(world: WorldData, x: number, fy: number): number {
  let best = 0;

  for (let dy = -2; dy <= 2; dy++) {
    const row = world.terrain[fy + dy];
    if (!row) continue;

    for (let dx = -2; dx <= 2; dx++) {
      const c = row[x + dx];
      if (!c?.hasRiver) continue;

      const d = Math.max(Math.abs(dx), Math.abs(dy)); // Chebyshev distance
      const w = d === 0 ? 1 : d === 1 ? 0.6 : 0.25;
      if (w > best) best = w;
    }
  }

  return best; // 0..1
}

// Must stay aligned with SmoothTerrainMesh’s carve logic (deterministic)
function riverCarve(world: WorldData, x: number, y: number, fy: number, cell: TerrainCell) {
  const isRiver = !!cell.hasRiver;

  const left = world.terrain[fy]?.[x - 1];
  const right = world.terrain[fy]?.[x + 1];
  const up = world.terrain[fy - 1]?.[x];
  const down = world.terrain[fy + 1]?.[x];

  const nearRiver = isRiver || !!left?.hasRiver || !!right?.hasRiver || !!up?.hasRiver || !!down?.hasRiver;
  if (!nearRiver) return 0;

  const riverNeighbors =
    (left?.hasRiver ? 1 : 0) + (right?.hasRiver ? 1 : 0) + (up?.hasRiver ? 1 : 0) + (down?.hasRiver ? 1 : 0);

  // straight rivers (2 neighbors) still get deep centerFactor
  const centerFactor = Math.min(1, riverNeighbors / 2);
  const bedNoise = microVar(x * 3.1, y * 3.1, world.seed) * 0.6;

  const BANK_CARVE = 0.05;
  const BED_MIN = 0.12;
  const BED_MAX = 0.3;

  const bedCarve = BED_MIN + (BED_MAX - BED_MIN) * centerFactor;
  const carve = isRiver ? bedCarve + bedNoise : BANK_CARVE;

  const MIN_CARVE = isRiver ? 0.1 : 0.02;
  const MAX_CARVE = isRiver ? 0.45 : 0.1;

  return Math.min(MAX_CARVE, Math.max(MIN_CARVE, Math.max(0, carve)));
}

/**
 * Builds welded water geometry where each vertex (x,y) is computed ONCE
 * from the vertex’s own TerrainCell. This avoids “ghost walls/sheets”.
 *
 * We add a quad if ANY corner mask > 0. Corners with mask=0 still get a vertex
 * (with alpha 0 in shader), which allows smooth feathered boundaries.
 */
function buildConformalWaterGeometry(
  world: WorldData,
  worldX: number,
  worldY: number,
  maskAtVertex: (cell: TerrainCell, x: number, y: number, fy: number) => number,
  heightAtVertex: (cell: TerrainCell, x: number, y: number, fy: number, mask: number) => number,
) {
  const size = world.gridSize;

  const positions: number[] = [];
  const uvs: number[] = [];
  const masks: number[] = [];
  const indices: number[] = [];

  const vertIndex = new Map<string, number>();

  const ensureV = (vx: number, vy: number) => {
    const k = `${vx},${vy}`;
    const existing = vertIndex.get(k);
    if (existing !== undefined) return existing;

    const fy = size - 1 - vy;
    const cell = world.terrain[fy]?.[vx];

    const m = cell ? maskAtVertex(cell, vx, vy, fy) : 0;
    const h = cell ? heightAtVertex(cell, vx, vy, fy, m) : 0;

    const idx = positions.length / 3;
    positions.push(vx, h, vy);
    uvs.push((vx + worldX * (size - 1)) * 0.12, (vy + worldY * (size - 1)) * 0.12);
    masks.push(m);

    vertIndex.set(k, idx);
    return idx;
  };

  for (let y = 0; y < size - 1; y++) {
    for (let x = 0; x < size - 1; x++) {
      // compute masks for the 4 vertices using their own cells
      const fy00 = size - 1 - y;
      const fy01 = size - 1 - (y + 1);

      const c00 = world.terrain[fy00]?.[x];
      const c10 = world.terrain[fy00]?.[x + 1];
      const c01 = world.terrain[fy01]?.[x];
      const c11 = world.terrain[fy01]?.[x + 1];

      const m00 = c00 ? maskAtVertex(c00, x, y, fy00) : 0;
      const m10 = c10 ? maskAtVertex(c10, x + 1, y, fy00) : 0;
      const m01 = c01 ? maskAtVertex(c01, x, y + 1, fy01) : 0;
      const m11 = c11 ? maskAtVertex(c11, x + 1, y + 1, fy01) : 0;

      // only draw if any corner is “active”
      if (m00 <= 0 && m10 <= 0 && m01 <= 0 && m11 <= 0) continue;

      const v00 = ensureV(x, y);
      const v10 = ensureV(x + 1, y);
      const v01 = ensureV(x, y + 1);
      const v11 = ensureV(x + 1, y + 1);

      indices.push(v00, v01, v10);
      indices.push(v01, v11, v10);
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  geo.setAttribute("aMask", new THREE.Float32BufferAttribute(masks, 1));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

export function EnhancedWaterPlane({ world, worldX = 0, worldY = 0, animated = true }: EnhancedWaterPlaneProps) {
  const matRef = useRef<THREE.ShaderMaterial | null>(null);

  const heightScale = WORLD_HEIGHT_SCALE;
  const waterHeight = getWaterLevel(world.vars) * heightScale;

  // Rivers: conformal to carved terrain (baseH - carve*mask) with a small lift.
  const riverGeo = useMemo(() => {
    const SURFACE_LIFT = 0.02;

    return buildConformalWaterGeometry(
      world,
      worldX,
      worldY,
      (cell, x, y, fy) => {
        // full strength on river tiles, feathered around them
        const feather = riverMaskAtVertex(world, x, fy);
        return cell.hasRiver ? 1 : feather;
      },
      (cell, x, y, fy, mask) => {
        const baseH = cell.elevation * heightScale;

        // IMPORTANT: scale carve by mask so edges transition smoothly
        const carve = riverCarve(world, x, y, fy, cell) * mask;

        // If mask=0, we return baseH (no lift) so geometry “hugs” terrain invisibly.
        // If mask>0, we conform to the carved trench + a small surface lift.
        return baseH - carve + SURFACE_LIFT * mask;
      },
    );
  }, [world, worldX, worldY, heightScale]);

  // Lakes/Ocean: flat at waterHeight, feather to 0 outside.
  const lakeGeo = useMemo(() => {
    const SURFACE_LIFT = 0.02;

    return buildConformalWaterGeometry(
      world,
      worldX,
      worldY,
      (cell) => (cell.type === "water" ? 1 : 0),
      (cell, x, y, fy, mask) => {
        // If mask=0, return base terrain height (invisible), so shore fades cleanly.
        if (mask <= 0) return cell.elevation * heightScale;
        return waterHeight + SURFACE_LIFT;
      },
    );
  }, [world, worldX, worldY, waterHeight, heightScale]);

  const material = useMemo(() => {
    const m = new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uOpacity: { value: 0.78 },
        uDeep: { value: new THREE.Color(0x082540) },
        uShallow: { value: new THREE.Color(0x206080) },
      },
      vertexShader: `
        attribute float aMask;
        varying float vMask;
        varying vec3 vWPos;

        void main() {
          vMask = aMask;
          vec4 wp = modelMatrix * vec4(position, 1.0);
          vWPos = wp.xyz;
          gl_Position = projectionMatrix * viewMatrix * wp;
        }
      `,
      fragmentShader: `
        uniform float uTime;
        uniform float uOpacity;
        uniform vec3 uDeep;
        uniform vec3 uShallow;

        varying float vMask;
        varying vec3 vWPos;

        float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123); }
        float noise(vec2 p) {
          vec2 i = floor(p); vec2 f = fract(p);
          f = f * f * (3.0 - 2.0 * f);
          return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x),
                     mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y);
        }

        void main() {
          // Edge feather: 0 outside, 1 inside
          float edgeFade = smoothstep(0.15, 1.0, vMask);

          // Waves only matter where water exists
          float t = uTime * 0.5;
          float w1 = noise(vWPos.xz * 1.2 + t);
          float w2 = noise(vWPos.xz * 2.0 - t * 0.4);
          float w = (w1 + w2) * 0.5;

          vec3 col = mix(uDeep, uShallow, w);

          // Foam tint near boundaries
          float foam = (1.0 - edgeFade) * 0.18;
          col += foam;

          float a = uOpacity * edgeFade;
          gl_FragColor = vec4(col, a);
        }
      `,
      transparent: true,
      side: THREE.FrontSide, // avoids backface “sheets”
      depthWrite: false,
    });

    matRef.current = m;
    return m;
  }, []);

  useFrame((_, dt) => {
    if (animated && matRef.current) matRef.current.uniforms.uTime.value += dt;
  });

  useEffect(() => {
    return () => {
      riverGeo.dispose();
      lakeGeo.dispose();
      material.dispose();
    };
  }, [riverGeo, lakeGeo, material]);

  return (
    <>
      <mesh geometry={lakeGeo} material={material} />
      <mesh geometry={riverGeo} material={material} />
    </>
  );
}
