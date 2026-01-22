// EnhancedWaterPlane - Water rendering with CELL-BASED rivers
// CRITICAL: Uses shared constants from worldConstants.ts for collision alignment
// CRITICAL: Uses canonical palette from src/theme/palette.ts
// COORDINATE FIX: Rivers now use IDENTICAL loop structure as SmoothTerrainMesh
// This guarantees pixel-perfect alignment with terrain
// FIX A: Proper geometry/material disposal with refs to avoid race conditions

import { useMemo, useRef, useEffect } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { WorldData, TerrainCell } from "@/lib/worldData";
import { 
  WORLD_HEIGHT_SCALE, 
  getWaterHeight, 
  toRow,
} from "@/lib/worldConstants";
import { buildRiverCellMesh, hasRiverCells, countRiverCells } from "@/lib/riverCellMesh";
import { toThreeColor, PALETTE, hexToRgb01 } from "@/theme/palette";
import { setGlobalRiverStats } from "@/hooks/useGeneratorProof";

const DEV = import.meta.env.DEV;

interface EnhancedWaterPlaneProps {
  world: WorldData;
  worldX?: number;
  worldY?: number;
  animated?: boolean;
}

/**
 * Build water mesh over selected cells.
 * edgeFloor keeps some opacity even on boundary vertices (important for thin rivers).
 */
function buildWaterGeometry(
  world: WorldData,
  worldX: number,
  worldY: number,
  pickCell: (cell: TerrainCell) => boolean,
  heightAtVertex: (cell: TerrainCell, x: number, y: number, fy: number) => number,
  edgeFloor = 0,
) {
  // Guard against incomplete world data
  if (!world || !world.terrain || world.terrain.length === 0 || !world.gridSize) {
    return new THREE.BufferGeometry();
  }

  const size = world.gridSize;

  const positions: number[] = [];
  const uvs: number[] = [];
  const edge: number[] = [];
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

  // Use SAME loop structure as SmoothTerrainMesh for coordinate consistency
  // y is the render Z coordinate, terrain is accessed via toRow(y, size)
  for (let y = 0; y < size - 1; y++) {
    for (let x = 0; x < size - 1; x++) {
      const fy = toRow(y, size);
      const c = world.terrain[fy]?.[x];
      if (!c || !pickCell(c)) continue;

      // Get corner cells - note: y+1 means fy-1 in terrain array
      const c00 = world.terrain[fy]?.[x];
      const c10 = world.terrain[fy]?.[x + 1];
      const fy01 = toRow(y + 1, size);
      const c01 = world.terrain[fy01]?.[x];
      const c11 = world.terrain[fy01]?.[x + 1];
      if (!c00 || !c10 || !c01 || !c11) continue;

      // Heights at each corner - pass render coordinates (x, y) for consistency
      const h00 = heightAtVertex(c00, x, y, fy);
      const h10 = heightAtVertex(c10, x + 1, y, fy);
      const h01 = heightAtVertex(c01, x, y + 1, fy01);
      const h11 = heightAtVertex(c11, x + 1, y + 1, fy01);

      const v00 = ensureV(x, y, h00);
      const v10 = ensureV(x + 1, y, h10);
      const v01 = ensureV(x, y + 1, h01);
      const v11 = ensureV(x + 1, y + 1, h11);

      // Same triangle winding as terrain mesh
      indices.push(v00, v01, v10);
      indices.push(v01, v11, v10);

      // Check all 4 corners for interior detection
      const interior = isPicked(fy, x) && isPicked(fy, x + 1) && isPicked(fy01, x) && isPicked(fy01, x + 1);

      if (!interior) {
        const e = Math.max(0, Math.min(1, edgeFloor));
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

  // FIX A: Track previous resources for safe disposal
  const prevRiverGeoRef = useRef<THREE.BufferGeometry | null>(null);
  const prevLakeGeoRef = useRef<THREE.BufferGeometry | null>(null);
  const prevMaterialRef = useRef<THREE.ShaderMaterial | null>(null);

  // Water surface height for lakes/ocean - uses shared function
  const waterHeight = useMemo(() => {
    if (!world?.vars) return 0;
    return getWaterHeight(world.vars);
  }, [world?.vars]);

  // RIVER FIX: Check if world has river cells and log in DEV mode
  const hasRivers = useMemo(() => {
    const result = world ? hasRiverCells(world) : false;
    if (DEV) {
      console.debug(`[EnhancedWaterPlane] hasRivers=${result}, waterHeight=${waterHeight.toFixed(2)}`);
    }
    return result;
  }, [world, waterHeight]);

  // Count river cells for debug stats
  const riverCellCount = useMemo(() => {
    return world ? countRiverCells(world) : 0;
  }, [world]);

  // River geometry - CELL-BASED mesh for perfect terrain alignment
  // Uses IDENTICAL loop/coordinate system as SmoothTerrainMesh
  const riverGeo = useMemo(() => {
    if (!world || !world.terrain || world.terrain.length === 0 || riverCellCount === 0) {
      setGlobalRiverStats({ riverCellCount: 0, riverVertices: 0, riverIndices: 0 });
      return new THREE.BufferGeometry();
    }

    // Build cell-based river mesh (NO dilation/blur/marching squares)
    const geo = buildRiverCellMesh(world, worldX, worldY);
    
    // Report geometry stats
    const posAttr = geo.getAttribute('position');
    const vertexCount = posAttr?.count ?? 0;
    const indexCount = geo.index?.count ?? 0;
    
    setGlobalRiverStats({
      riverCellCount,
      riverVertices: vertexCount,
      riverIndices: indexCount
    });

    if (DEV) {
      console.debug(`[EnhancedWaterPlane] River cell mesh: ${riverCellCount} cells, ${vertexCount} vertices, ${indexCount} indices`);
    }

    return geo;
  }, [world, worldX, worldY, riverCellCount]);

  // Lake/ocean geometry - flat plane at water level, extended slightly into ground for smooth edges
  const lakeGeo = useMemo(() => {
    if (!world || !world.terrain || world.terrain.length === 0) {
      return new THREE.BufferGeometry();
    }

    const SURFACE_LIFT = 0.02;
    const size = world.gridSize;
    
    // Build a set of water cells AND their neighbors for smooth edge blending
    const waterAndNeighbors = new Set<string>();
    
    for (let fy = 0; fy < size; fy++) {
      for (let x = 0; x < size; x++) {
        const cell = world.terrain[fy]?.[x];
        if (cell?.type === "water") {
          // Add the water cell itself
          waterAndNeighbors.add(`${x},${fy}`);
          // Add 1-cell border around water for smooth edge blending
          for (let dy = -1; dy <= 1; dy++) {
            for (let dx = -1; dx <= 1; dx++) {
              const nx = x + dx;
              const nfy = fy + dy;
              if (nx >= 0 && nx < size && nfy >= 0 && nfy < size) {
                waterAndNeighbors.add(`${nx},${nfy}`);
              }
            }
          }
        }
      }
    }
    
    return buildWaterGeometry(
      world,
      worldX,
      worldY,
      (c) => {
        // Include water cells AND their neighbors for extended coverage
        const isWater = c.type === "water";
        return isWater; // Still only pick water cells, but edge handling will blend
      },
      () => waterHeight + SURFACE_LIFT,
      0.4, // Higher edge floor = more opacity at edges, less tile-like
    );
  }, [world, worldX, worldY, waterHeight]);

  const material = useMemo(() => {
    // WATER VISUAL: Darker, more opaque water with smooth edges
    // Opacity: 0.72 for more solid, visible water
    // Colors: Darker blue tones from palette
    const deepRgb = hexToRgb01(PALETTE.abyss);   // #001C24 - very dark blue
    const shallowRgb = hexToRgb01(PALETTE.deep); // #232D26 - dark forest-blue
    const foamRgb = hexToRgb01(PALETTE.sage);    // #6B746B - muted foam
    
    const deepColor = new THREE.Color(deepRgb.r, deepRgb.g, deepRgb.b);
    const shallowColor = new THREE.Color(
      shallowRgb.r * 0.7 + deepRgb.r * 0.3,  // Blend toward deep blue
      shallowRgb.g * 0.5 + 0.15,              // Add slight blue tint
      shallowRgb.b * 0.5 + 0.25               // More blue
    );
    const foamColor = new THREE.Color(foamRgb.r, foamRgb.g, foamRgb.b);
    
    if (DEV) {
      console.debug('[EnhancedWaterPlane] Water colors (darker, more opaque):', {
        deep: PALETTE.abyss,
        shallow: 'blend',
        foam: PALETTE.sage,
        opacity: 0.72
      });
    }
    
    const m = new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uOpacity: { value: 0.72 }, // 72% opacity - more solid water
        uDeep: { value: deepColor },
        uShallow: { value: shallowColor },
        uFoam: { value: foamColor },
        uSeed: { value: world?.seed ?? 0 }, // For deterministic noise
      },
      vertexShader: `
        attribute float aEdge;
        varying float vEdge;
        varying vec3 vWPos;
        varying vec3 vNormal;

        void main() {
          vEdge = aEdge;
          vNormal = normalMatrix * normal;
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
        uniform vec3 uFoam;
        uniform float uSeed;

        varying float vEdge;
        varying vec3 vWPos;
        varying vec3 vNormal;

        // Deterministic hash using world position + seed (no grid repetition)
        float hash(vec2 p) { 
          return fract(sin(dot(p + uSeed * 0.001, vec2(127.1, 311.7))) * 43758.5453123); 
        }
        
        // Smooth world-space noise (no tiling at 64x64)
        float noise(vec2 p) {
          vec2 i = floor(p); 
          vec2 f = fract(p);
          f = f * f * (3.0 - 2.0 * f);
          return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x),
                     mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y);
        }
        
        // Multi-octave noise for natural waves
        float fbm(vec2 p) {
          float v = 0.0;
          float a = 0.5;
          for (int i = 0; i < 3; i++) {
            v += a * noise(p);
            p *= 2.0;
            a *= 0.5;
          }
          return v;
        }

        void main() {
          float t = uTime;
          
          // RIVER FLOW ANIMATION - directional movement along river
          // Primary flow direction (downstream feel)
          vec2 flowDir = normalize(vec2(0.7, 1.0)); // Diagonal downstream
          vec2 flowOffset = flowDir * t * 0.4; // Flow speed
          
          // World-space UV with flow
          vec2 worldUV = vWPos.xz * 0.12;
          
          // Flowing water pattern - multiple layers moving at different speeds
          float flow1 = fbm(worldUV + flowOffset);
          float flow2 = fbm(worldUV * 1.8 + flowOffset * 1.3 + vec2(100.0, 50.0));
          float flow3 = fbm(worldUV * 0.5 + flowOffset * 0.6); // Slow background flow
          
          // Combine flow layers for natural water movement
          float flowPattern = flow1 * 0.5 + flow2 * 0.3 + flow3 * 0.2;
          
          // Add perpendicular ripples for realism
          vec2 rippleDir = vec2(-flowDir.y, flowDir.x);
          float ripples = sin(dot(vWPos.xz, rippleDir) * 3.0 + t * 2.0) * 0.5 + 0.5;
          ripples *= fbm(worldUV * 2.0) * 0.3;
          
          float w = flowPattern + ripples * 0.2;

          // Blend between deep and shallow based on flow pattern - favor deep color
          vec3 col = mix(uDeep, uShallow, w * 0.35 + 0.1);

          // Edge handling: smoother fade into ground, maintain high opacity
          float edgeFade = smoothstep(0.0, 0.5, vEdge);
          float a = uOpacity * mix(0.7, 1.0, edgeFade); // Higher minimum opacity at edges

          // Subtle foam at edges and flow peaks
          float foamAmount = (1.0 - edgeFade) * 0.12 + pow(flowPattern, 3.0) * 0.08;
          col = mix(col, uFoam, foamAmount);

          // Fresnel-like rim highlight - subtle for dark water
          vec3 viewDir = normalize(-vWPos);
          float fresnel = pow(1.0 - max(0.0, dot(normalize(vNormal), viewDir)), 2.5);
          col += vec3(fresnel * 0.12);

          // Flowing specular highlights
          float flowSpec = pow(max(0.0, flow1 * 0.6 + 0.4), 6.0) * 0.15;
          col += vec3(flowSpec);

          gl_FragColor = vec4(col, a);
        }
      `,
      transparent: true,
      side: THREE.DoubleSide,
      depthWrite: false,
      depthTest: true,
      polygonOffset: true,
      polygonOffsetFactor: -6, // Strong offset to render above terrain
      polygonOffsetUnits: -6,
    });

    matRef.current = m;
    return m;
  }, [world?.seed]);

  useFrame((_, dt) => {
    if (animated && matRef.current) matRef.current.uniforms.uTime.value += dt;
  });

  // FIX A: Dispose previous resources when new ones are created, and current on unmount
  useEffect(() => {
    // Dispose previous river geometry if different
    if (prevRiverGeoRef.current && prevRiverGeoRef.current !== riverGeo) {
      try {
        prevRiverGeoRef.current.dispose();
      } catch (e) {
        // Ignore disposal errors (already disposed)
      }
    }
    prevRiverGeoRef.current = riverGeo;

    // Dispose previous lake geometry if different
    if (prevLakeGeoRef.current && prevLakeGeoRef.current !== lakeGeo) {
      try {
        prevLakeGeoRef.current.dispose();
      } catch (e) {
        // Ignore disposal errors
      }
    }
    prevLakeGeoRef.current = lakeGeo;

    // Cleanup on unmount only
    return () => {
      if (prevRiverGeoRef.current) {
        try {
          prevRiverGeoRef.current.dispose();
        } catch (e) {
          // Ignore
        }
        prevRiverGeoRef.current = null;
      }
      if (prevLakeGeoRef.current) {
        try {
          prevLakeGeoRef.current.dispose();
        } catch (e) {
          // Ignore
        }
        prevLakeGeoRef.current = null;
      }
    };
  }, [riverGeo, lakeGeo]);

  // FIX A: Dispose material only on unmount (material is stable)
  useEffect(() => {
    prevMaterialRef.current = material;
    return () => {
      if (prevMaterialRef.current) {
        try {
          prevMaterialRef.current.dispose();
        } catch (e) {
          // Ignore
        }
        prevMaterialRef.current = null;
      }
    };
  }, [material]);

  // Early return after all hooks
  if (!world || !world.terrain || world.terrain.length === 0 || !world.vars) {
    return null;
  }

  return (
    <>
      <mesh geometry={lakeGeo} material={material} />
      <mesh geometry={riverGeo} material={material} />
    </>
  );
}
