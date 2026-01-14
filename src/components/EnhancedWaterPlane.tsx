import { useMemo, useRef, useEffect } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { WorldData, TerrainCell } from "@/lib/worldData";
import { WORLD_HEIGHT_SCALE, getWaterLevel } from "@/lib/worldConstants";
import { WORLD_HEIGHT_SCALE, getWaterLevel, RIVER_DEPTH_OFFSET } from "@/lib/worldConstants";

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

// Must match SmoothTerrainMesh’s carve logic (deterministic)
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

function buildWaterGeometry(
  world: WorldData,
  worldX: number,
  worldY: number,
  pickCell: (cell: TerrainCell) => boolean,
  heightAtVertex: (cell: TerrainCell, x: number, y: number, fy: number) => number,
) {
  const size = world.gridSize;

  const positions: number[] = [];
  const uvs: number[] = [];
  const edge: number[] = []; // 1 interior, 0 edge
  const indices: number[] = [];

  const vertIndex = new Map<string, number>();
  const ensureV = (x: number, y: number, h: number) => {
    const k = `${x},${y}`;
    const existing = vertIndex.get(k);
    if (existing !== undefined) return existing;

    const idx = positions.length / 3;
    positions.push(x, h, y);
    uvs.push((x + worldX * (size - 1)) * 0.12, (y + worldY * (size - 1)) * 0.12);
    edge.push(1);
    vertIndex.set(k, idx);
    return idx;
  };

  const isPicked = (fy: number, x: number) => {
    const c = world.terrain[fy]?.[x];
    return !!c && pickCell(c);
  };

  for (let y = 0; y < size - 1; y++) {
    for (let x = 0; x < size - 1; x++) {
      const fy = size - 1 - y;
      const c = world.terrain[fy]?.[x];
      if (!c || !pickCell(c)) continue;

      // compute per-vertex height from the vertex's own cell sample (stable + deterministic)
      const c00 = world.terrain[fy]?.[x];
      const c10 = world.terrain[fy]?.[x + 1];
      const c01 = world.terrain[fy - 1]?.[x];
      const c11 = world.terrain[fy - 1]?.[x + 1];

      if (!c00 || !c10 || !c01 || !c11) continue;

      const h00 = heightAtVertex(c00, x, y, fy);
      const h10 = heightAtVertex(c10, x + 1, y, fy);
      const h01 = heightAtVertex(c01, x, y + 1, fy - 1);
      const h11 = heightAtVertex(c11, x + 1, y + 1, fy - 1);

      const v00 = ensureV(x, y, h00);
      const v10 = ensureV(x + 1, y, h10);
      const v01 = ensureV(x, y + 1, h01);
      const v11 = ensureV(x + 1, y + 1, h11);

      indices.push(v00, v01, v10);
      indices.push(v01, v11, v10);

      // edge detection: if any neighbor cell in this quad isn’t water of this kind, mark edge
      const interior = isPicked(fy, x) && isPicked(fy, x + 1) && isPicked(fy - 1, x) && isPicked(fy - 1, x + 1);

      if (!interior) {
        edge[v00] = 0;
        edge[v10] = 0;
        edge[v01] = 0;
        edge[v11] = 0;
      }
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  geo.setAttribute("aEdge", new THREE.Float32BufferAttribute(edge, 1));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

export function EnhancedWaterPlane({ world, worldX = 0, worldY = 0, animated = true }: EnhancedWaterPlaneProps) {
  const matRef = useRef<THREE.ShaderMaterial>(null);

  const heightScale = WORLD_HEIGHT_SCALE;
  const waterHeight = getWaterLevel(world.vars) * heightScale;

  const riverGeo = useMemo(() => {
    const SURFACE_LIFT = 0.02;

    // One consistent river surface (prevents “painted tile following terrain”)
    const riverSurface = waterHeight - RIVER_DEPTH_OFFSET * 0.5;

    return buildWaterGeometry(
      world,
      worldX,
      worldY,
      (c) => !!c.hasRiver,
      (cell) => {
        // Don’t ever let river water sit ABOVE the local terrain (prevents “water climbing hills”)
        const baseH = cell.elevation * heightScale;
        const bankClearance = 0.01;

        const surface = Math.min(riverSurface, baseH - bankClearance);
        return surface + SURFACE_LIFT;
      },
    );
  }, [world, worldX, worldY, heightScale, waterHeight]);

  const lakeGeo = useMemo(() => {
    const SURFACE_LIFT = 0.02;
    return buildWaterGeometry(
      world,
      worldX,
      worldY,
      (c) => c.type === "water",
      () => waterHeight + SURFACE_LIFT, // flat lakes/ocean
    );
  }, [world, worldX, worldY, waterHeight]);

  const material = useMemo(() => {
    const m = new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uOpacity: { value: 0.75 },
        uDeep: { value: new THREE.Color(0x082540) },
        uShallow: { value: new THREE.Color(0x206080) },
      },
      vertexShader: `
        attribute float aEdge;
        varying float vEdge;
        varying vec3 vWPos;

        void main() {
          vEdge = aEdge;
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

        varying float vEdge;
        varying vec3 vWPos;

        float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123); }
        float noise(vec2 p) {
          vec2 i = floor(p); vec2 f = fract(p);
          f = f * f * (3.0 - 2.0 * f);
          return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x),
                     mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y);
        }

        void main() {
          float t = uTime * 0.5;
          float w1 = noise(vWPos.xz * 1.2 + t);
          float w2 = noise(vWPos.xz * 2.0 - t * 0.4);
          float w = (w1 + w2) * 0.5;

          vec3 col = mix(uDeep, uShallow, w);

          // soften tile edge: edge vertices fade out slightly + get a little foam tint
          float edgeFade = smoothstep(0.0, 1.0, vEdge); // 0 at boundary, 1 inside
          float a = uOpacity * mix(0.25, 1.0, edgeFade);

          float foam = (1.0 - edgeFade) * 0.18;
          col += foam;

          gl_FragColor = vec4(col, a);
        }
      `,
      transparent: true,
      side: THREE.FrontSide, // IMPORTANT: avoids backface “sheets”
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
