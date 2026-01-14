import { useMemo, useRef, useEffect } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { WorldData, TerrainCell } from "@/lib/worldData";
import { WORLD_HEIGHT_SCALE, getWaterLevel, RIVER_DEPTH_OFFSET } from "@/lib/worldConstants";

interface EnhancedWaterPlaneProps {
  world: WorldData;
  worldX?: number;
  worldY?: number;
  animated?: boolean;
}

function buildWaterGeometry(
  world: WorldData,
  worldX: number,
  worldY: number,
  pickCell: (cell: TerrainCell) => boolean,
  heightAtVertex: (cell: TerrainCell, x: number, y: number, fy: number) => number,
  edgeFloor = 0, // NEW: keep some opacity on thin shapes like rivers
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

      const interior = isPicked(fy, x) && isPicked(fy, x + 1) && isPicked(fy - 1, x) && isPicked(fy - 1, x + 1);

      // NEW: don’t kill opacity on thin rivers — keep a minimum edge value
      if (!interior) {
        const e = Math.max(edgeFloor, 0);
        edge[v00] = Math.min(edge[v00], e);
        edge[v10] = Math.min(edge[v10], e);
        edge[v01] = Math.min(edge[v01], e);
        edge[v11] = Math.min(edge[v11], e);
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
    const bankClearance = 0.01;

    // Your rule:
    // gl = baseH
    // rb = gl - RIVER_DEPTH_OFFSET
    // rl = rb + 0.5*RIVER_DEPTH_OFFSET = gl - 0.5*RIVER_DEPTH_OFFSET
    const halfDepth = RIVER_DEPTH_OFFSET * 5.5;

    return buildWaterGeometry(
      world,
      worldX,
      worldY,
      (c) => !!c.hasRiver,
      (cell) => {
        const gl = cell.elevation * heightScale;
        const rl = gl - halfDepth;

        // never above local ground
        const surface = Math.min(rl, gl - bankClearance);
        return surface + SURFACE_LIFT;
      },
      0.45, // edgeFloor: keep opacity on thin rivers
    );
  }, [world, worldX, worldY, heightScale]);

  const lakeGeo = useMemo(() => {
    const SURFACE_LIFT = 0.02;
    return buildWaterGeometry(
      world,
      worldX,
      worldY,
      (c) => c.type === "water",
      () => waterHeight + SURFACE_LIFT,
      0.0,
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

          float edgeFade = smoothstep(0.0, 1.0, vEdge); // 0 at boundary, 1 inside
          float a = uOpacity * mix(0.35, 1.0, edgeFade); // NEW: higher minimum alpha

          float foam = (1.0 - edgeFade) * 0.18;
          col += foam;

          gl_FragColor = vec4(col, a);
        }
      `,
      transparent: true,
      side: THREE.FrontSide,
      depthWrite: false,
      polygonOffset: true, // NEW: reduce z-fighting
      polygonOffsetFactor: -1,
      polygonOffsetUnits: -1,
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
