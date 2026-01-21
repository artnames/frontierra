// EnhancedWaterPlane - Water rendering with smooth contour-based rivers
// CRITICAL: Uses shared constants from worldConstants.ts for collision alignment
// CRITICAL: Uses canonical palette from src/theme/palette.ts
// Rivers use Marching Squares + Chaikin smoothing for smooth silhouettes
// FIX A: Proper geometry/material disposal with refs to avoid race conditions
// RIVER FIX: Ensure rivers are always visible with proper colors and depth settings

import { useMemo, useRef, useEffect } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { WorldData, TerrainCell } from "@/lib/worldData";
import { 
  WORLD_HEIGHT_SCALE, 
  getWaterHeight, 
  RIVER_WATER_ABOVE_BED,
  computeRiverCarveDepth,
} from "@/lib/worldConstants";
import { buildSmoothRiverGeometry, hasRiverCells } from "@/lib/riverContourMesh";
import { toThreeColor, ROLES, PALETTE } from "@/theme/palette";

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

  // River geometry - smooth contour-based mesh using Marching Squares
  const riverGeo = useMemo(() => {
    if (!world || !world.terrain || world.terrain.length === 0) {
      return new THREE.BufferGeometry();
    }

    // Try smooth contour-based mesh first
    if (hasRivers) {
      const smoothGeo = buildSmoothRiverGeometry(world, worldX, worldY);
      
      // Check if we got valid geometry
      const posAttr = smoothGeo.getAttribute('position');
      if (posAttr && posAttr.count >= 3) {
        if (DEV) {
          console.debug(`[EnhancedWaterPlane] River contour mesh: ${posAttr.count} vertices`);
        }
        return smoothGeo;
      }
      smoothGeo.dispose();
      
      if (DEV) {
        console.warn('[EnhancedWaterPlane] Contour mesh failed, using cell-based fallback');
      }
    }

    // Fallback: cell-based geometry (old method)
    const SURFACE_LIFT = 0.12; // Larger lift to ensure visibility above terrain
    const bankClearance = 0.02;

    if (DEV) {
      console.debug('[EnhancedWaterPlane] Using cell-based river fallback');
    }

    return buildWaterGeometry(
      world,
      worldX,
      worldY,
      (c) => !!c.hasRiver && c.type !== "water",
      (cell, x, y, fy) => {
        const baseH = cell.elevation * heightScale;
        const carve = computeRiverCarveDepth(
          world.terrain,
          x,
          y,
          fy,
          true,
          world.seed
        );
        const bedHeight = baseH - carve;
        const waterSurface = bedHeight + RIVER_WATER_ABOVE_BED;
        const surface = Math.min(waterSurface, baseH - bankClearance);
        return surface + SURFACE_LIFT;
      },
      0.85, // High edge floor for visible edges
    );
  }, [world, worldX, worldY, heightScale, hasRivers]);

  // Lake/ocean geometry - flat plane at water level
  const lakeGeo = useMemo(() => {
    if (!world || !world.terrain || world.terrain.length === 0) {
      return new THREE.BufferGeometry();
    }

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
    // WATER/RIVER VISIBILITY FIX: Use palette-aligned colors
    // Deep: Rich teal-blue that's visible against terrain
    // Shallow: Lighter cyan-teal for depth variation
    const deepColor = new THREE.Color(0.0, 0.11, 0.14);    // #001C24 from palette (abyss)
    const shallowColor = new THREE.Color(0.34, 0.43, 0.27); // #576E45 (forest) for shallow
    const foamColor = toThreeColor(PALETTE.mist, { linear: true });
    
    if (DEV) {
      console.debug('[EnhancedWaterPlane] Water colors (palette):', {
        deep: PALETTE.abyss,
        shallow: PALETTE.forest,
        foam: PALETTE.mist
      });
    }
    
    const m = new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uOpacity: { value: 0.92 }, // High opacity for visibility
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
          float t = uTime * 0.3;
          
          // WORLD-SPACE waves - no grid repetition
          // Use world position directly with low frequency
          vec2 worldUV = vWPos.xz * 0.08;
          
          // Animated water waves using world coordinates
          float w1 = fbm(worldUV + vec2(t * 0.5, t * 0.3));
          float w2 = fbm(worldUV * 1.5 - vec2(t * 0.2, t * 0.4));
          float w = w1 * 0.6 + w2 * 0.4;

          // Blend between deep and shallow - natural variation
          vec3 col = mix(uDeep, uShallow, w * 0.5 + 0.25);

          // Edge handling: high minimum opacity even at edges
          float edgeFade = smoothstep(0.0, 0.4, vEdge);
          float a = uOpacity * mix(0.8, 1.0, edgeFade);

          // Foam/highlight at edges and wave peaks
          float foamAmount = (1.0 - edgeFade) * 0.2 + w * 0.1;
          col = mix(col, uFoam, foamAmount);

          // Fresnel-like rim highlight
          vec3 viewDir = normalize(-vWPos);
          float fresnel = pow(1.0 - max(0.0, dot(normalize(vNormal), viewDir)), 2.5);
          col += vec3(fresnel * 0.06);

          // Subtle specular on waves
          float spec = pow(max(0.0, w * 0.5 + 0.5), 8.0) * 0.1;
          col += vec3(spec);

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
