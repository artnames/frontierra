// EnhancedWaterPlane.tsx - Deterministic river-conformal water with soft edges

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

export function EnhancedWaterPlane({ world, worldX = 0, worldY = 0, animated = true }: EnhancedWaterPlaneProps) {
  const materialRef = useRef<THREE.ShaderMaterial>(null);

  const heightScale = WORLD_HEIGHT_SCALE;
  const waterLevel = getWaterLevel(world.vars);
  const waterHeight = waterLevel * heightScale;

  const geometry = useMemo(() => {
    const size = world.gridSize;

    const isWaterOrRiverCell = (fy: number, x: number) => {
      const c = world.terrain[fy]?.[x];
      return !!c && (c.type === "water" || c.hasRiver);
    };

    const isNearWaterOrRiverCell = (fy: number, x: number) => {
      if (isWaterOrRiverCell(fy, x)) return true;
      const cL = world.terrain[fy]?.[x - 1];
      const cR = world.terrain[fy]?.[x + 1];
      const cU = world.terrain[fy - 1]?.[x];
      const cD = world.terrain[fy + 1]?.[x];
      return (
        (!!cL && (cL.type === "water" || cL.hasRiver)) ||
        (!!cR && (cR.type === "water" || cR.hasRiver)) ||
        (!!cU && (cU.type === "water" || cU.hasRiver)) ||
        (!!cD && (cD.type === "water" || cD.hasRiver))
      );
    };

    // Same carve logic as terrain (must remain deterministic)
    const computeRiverCarve = (x: number, y: number, fy: number, cell: TerrainCell) => {
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
    };

    // Vertex map that averages heights deterministically
    type VAcc = { index: number; sumH: number; count: number; alpha: number };
    const vmap = new Map<string, VAcc>();

    const positions: number[] = [];
    const uvs: number[] = [];
    const alphas: number[] = [];
    const indices: number[] = [];

    const ensureVertex = (vx: number, vy: number) => {
      const key = `${vx},${vy}`;
      let acc = vmap.get(key);
      if (acc) return acc.index;

      const idx = positions.length / 3;
      positions.push(vx, 0, vy); // temp height; filled after averaging
      uvs.push((vx + worldX * (size - 1)) * 0.12, (vy + worldY * (size - 1)) * 0.12);
      alphas.push(0);
      acc = { index: idx, sumH: 0, count: 0, alpha: 0 };
      vmap.set(key, acc);
      return idx;
    };

    // Add a height contribution + alpha contribution to a vertex
    const contribute = (vx: number, vy: number, h: number, a: number) => {
      const key = `${vx},${vy}`;
      const acc = vmap.get(key);
      if (!acc) return;
      acc.sumH += h;
      acc.count += 1;
      // alpha: take max (keeps interior strong, boundary fades via boundary rule below)
      acc.alpha = Math.max(acc.alpha, a);
    };

    // Build quads for water/river + 1-cell padding for soft edge
    for (let y = 0; y < size - 1; y++) {
      for (let x = 0; x < size - 1; x++) {
        const fy = size - 1 - y;

        if (!isNearWaterOrRiverCell(fy, x)) continue;

        const c00 = world.terrain[fy]?.[x];
        if (!c00) continue;

        const core = isWaterOrRiverCell(fy, x);
        const cellIsLake = c00.type === "water";
        const cellIsRiver = !!c00.hasRiver;

        // Height:
        // - lakes/ocean stay flat at waterHeight
        // - rivers follow the carved bed (baseH - carve + lift)
        const baseH = c00.elevation * heightScale;
        const carve = cellIsRiver ? computeRiverCarve(x, y, fy, c00) : 0;

        const SURFACE_LIFT = 0.02; // prevent z-fight with bed
        const h = cellIsLake ? waterHeight : cellIsRiver ? baseH - carve + SURFACE_LIFT : waterHeight; // padding around rivers/lakes stays near waterHeight; alpha fades it out

        const v00 = ensureVertex(x, y);
        const v10 = ensureVertex(x + 1, y);
        const v01 = ensureVertex(x, y + 1);
        const v11 = ensureVertex(x + 1, y + 1);

        // Contribute heights
        contribute(x, y, h, core ? 1 : 0);
        contribute(x + 1, y, h, core ? 1 : 0);
        contribute(x, y + 1, h, core ? 1 : 0);
        contribute(x + 1, y + 1, h, core ? 1 : 0);

        indices.push(v00, v01, v10);
        indices.push(v01, v11, v10);
      }
    }

    // Finalize averaged heights + edge alpha (deterministic boundary fade)
    for (const [key, acc] of vmap.entries()) {
      const [sx, sy] = key.split(",").map((n) => parseInt(n, 10));
      const idx = acc.index;

      const hFinal = acc.count > 0 ? acc.sumH / acc.count : 0;
      positions[idx * 3 + 1] = hFinal;

      // Boundary fade: if any adjacent cell around this vertex is NOT water/river, fade out.
      // This removes the hard “tile edge” look without changing world data.
      const cx = sx;
      const cy = sy;
      const fy = size - 1 - cy;

      const around =
        isWaterOrRiverCell(fy, cx) &&
        isWaterOrRiverCell(fy, cx - 1) &&
        isWaterOrRiverCell(fy - 1, cx) &&
        isWaterOrRiverCell(fy - 1, cx - 1);

      // interior = 1, boundary = 0 (shader will smooth it)
      const boundaryAlpha = around ? 1 : 0;

      // combine with “core cell” alpha contribution:
      alphas[idx] = Math.min(1, acc.alpha) * boundaryAlpha;
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
    geo.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
    geo.setAttribute("aAlpha", new THREE.Float32BufferAttribute(alphas, 1));
    geo.setIndex(indices);
    geo.computeVertexNormals();

    return geo;
  }, [world, worldX, worldY, heightScale, waterHeight]);

  const shaderMaterial = useMemo(() => {
    const mat = new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uOpacity: { value: 0.75 },
        uDeep: { value: new THREE.Color(0x082540) },
        uShallow: { value: new THREE.Color(0x206080) },
      },
      vertexShader: `
        attribute float aAlpha;
        varying float vAlpha;
        varying vec3 vWorldPosition;

        void main() {
          vAlpha = aAlpha;
          vec4 wp = modelMatrix * vec4(position, 1.0);
          vWorldPosition = wp.xyz;
          gl_Position = projectionMatrix * viewMatrix * wp;
        }
      `,
      fragmentShader: `
        uniform float uTime;
        uniform float uOpacity;
        uniform vec3 uDeep;
        uniform vec3 uShallow;

        varying float vAlpha;
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

          vec3 col = mix(uDeep, uShallow, combined);

          // foam-ish edge highlight using alpha falloff
          float edge = 1.0 - vAlpha;
          float foam = smoothstep(0.2, 1.0, edge) * 0.18;
          col += foam;

          float spec = pow(combined, 10.0) * 0.25;
          float a = uOpacity * smoothstep(0.0, 1.0, vAlpha);

          gl_FragColor = vec4(col + spec, a);
        }
      `,
      transparent: true,
      side: THREE.DoubleSide,
      depthWrite: false,
    });

    materialRef.current = mat;
    return mat;
  }, []);

  useFrame((_, delta) => {
    if (animated && materialRef.current) {
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
