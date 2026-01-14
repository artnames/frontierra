// SmoothTerrainMesh - Frontierra Version 3.2
// FIXED: Relative mountain carving and Prop synchronization for WorldExplorer
// CRITICAL: All rendering is deterministic - same inputs = same output.

import { useMemo, useEffect } from "react";
import * as THREE from "three";
import { WorldData, TerrainCell } from "@/lib/worldData";
import { WORLD_HEIGHT_SCALE, getWaterLevel, PATH_HEIGHT_OFFSET } from "@/lib/worldConstants";
import { MaterialKind, getMaterialKind } from "@/lib/materialRegistry";
import { createTerrainPbrDetailMaterial } from "@/lib/terrainPbrMaterial";

export interface SmoothTerrainMeshProps {
  world: WorldData;
  worldX?: number;
  worldY?: number;
  microDetailEnabled?: boolean;
  fogEnabled?: boolean; // Added for prop synchronization
}

const BASE_COLORS: Record<string, { r: number; g: number; b: number }> = {
  ground: { r: 0.5, g: 0.44, b: 0.28 },
  forest: { r: 0.18, g: 0.35, b: 0.15 },
  mountain: { r: 0.45, g: 0.43, b: 0.42 },
  snow: { r: 0.95, g: 0.95, b: 1.0 },
  water: { r: 0.15, g: 0.35, b: 0.45 },
  riverbed: { r: 0.28, g: 0.26, b: 0.2 },
  path: { r: 0.58, g: 0.48, b: 0.35 },
  rock: { r: 0.42, g: 0.42, b: 0.42 },
  sand: { r: 0.76, g: 0.62, b: 0.38 },
};

const PBR_SETTINGS = {
  roughness: 0.88,
  metalness: 0.02,
  detailScale: 0.9,
  albedoVar: 0.08,
  roughVar: 0.18,
  slopeAO: 0.12,
};

function getMicroVariation(x: number, y: number, seed: number): number {
  const n = Math.sin(x * 12.9898 + y * 78.233 + seed * 0.1) * 43758.5453;
  return (n - Math.floor(n)) * 0.15 - 0.075;
}

function getCellMaterialKind(cell: TerrainCell): MaterialKind {
  if (cell.type === "water") return "water";
  if (cell.hasRiver) return "riverbed";
  if (cell.isPath || cell.isBridge || cell.type === "path" || cell.type === "bridge") return "path";
  return getMaterialKind(cell.type, cell.elevation, cell.moisture);
}

/**
 * Creates INDEXED geometry with shared vertices for smooth shading.
 * Implements relative mountain carving to prevent floating rivers.
 */
export function SmoothTerrainMesh({
  world,
  worldX = 0,
  worldY = 0,
  microDetailEnabled = true,
}: SmoothTerrainMeshProps) {
  const heightScale = WORLD_HEIGHT_SCALE;
  const pathMaxHeight = getWaterLevel(world.vars) * heightScale + PATH_HEIGHT_OFFSET;

  // Build indexed geometry with shared vertices
  const geometry = useMemo(() => {
    const size = world.gridSize;
    const vertCount = size * size;
    const indexCount = (size - 1) * (size - 1) * 6;

    const positions = new Float32Array(vertCount * 3);
    const colors = new Float32Array(vertCount * 3);
    const uvs = new Float32Array(vertCount * 2);
    const indices = new Uint32Array(indexCount);

    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const vi = y * size + x;
        const flippedY = size - 1 - y;
        const cell = world.terrain[flippedY]?.[x];

        // 1. Base Elevation
        let h = cell ? cell.elevation * heightScale : 0;

        // 2. Relative River Carving
        // This ensures the terrain trench follows mountain slopes
        if (cell?.hasRiver) {
          const carvingDepth = 0.3;
          h -= carvingDepth;

          // Deterministic bed noise
          const bedNoise = getMicroVariation(x * 3.1, y * 3.1, world.seed) * 0.5;
          h -= bedNoise;
        }

        if (cell?.isPath && !cell?.isBridge) {
          h = Math.min(h, pathMaxHeight);
        }

        positions[vi * 3] = x;
        positions[vi * 3 + 1] = h;
        positions[vi * 3 + 2] = y;

        // Color Logic
        const kind = cell ? getCellMaterialKind(cell) : "ground";
        const baseColor = BASE_COLORS[kind] || BASE_COLORS.ground;
        const microVar = getMicroVariation(x, y, world.seed);
        const elevLight = 0.7 + (cell ? Math.pow(cell.elevation, 0.7) * 0.4 : 0) + microVar;

        colors[vi * 3] = Math.min(1, baseColor.r * elevLight);
        colors[vi * 3 + 1] = Math.min(1, baseColor.g * elevLight);
        colors[vi * 3 + 2] = Math.min(1, baseColor.b * elevLight);

        // UVs (Chunk-aligned for seamless texture wrapping)
        uvs[vi * 2] = (x + worldX * (size - 1)) * 0.08;
        uvs[vi * 2 + 1] = (y + worldY * (size - 1)) * 0.08;
      }
    }

    // Index Generation for smooth normals
    let ii = 0;
    for (let y = 0; y < size - 1; y++) {
      for (let x = 0; x < size - 1; x++) {
        const v00 = y * size + x;
        const v10 = y * size + (x + 1);
        const v01 = (y + 1) * size + x;
        const v11 = (y + 1) * size + (x + 1);

        indices[ii++] = v00;
        indices[ii++] = v01;
        indices[ii++] = v10;
        indices[ii++] = v01;
        indices[ii++] = v11;
        indices[ii++] = v10;
      }
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geo.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    geo.setAttribute("uv", new THREE.BufferAttribute(uvs, 2));
    geo.setIndex(new THREE.BufferAttribute(indices, 1));
    geo.computeVertexNormals();
    return geo;
  }, [world, heightScale, pathMaxHeight, worldX, worldY]);

  const material = useMemo(() => {
    const worldOffset = new THREE.Vector2(worldX * (world.gridSize - 1), worldY * (world.gridSize - 1));

    return createTerrainPbrDetailMaterial({
      detailTexture: null,
      textureInfluence: 0,
      microDetailEnabled,
      worldOffset,
      detailScale: PBR_SETTINGS.detailScale,
      albedoVariation: PBR_SETTINGS.albedoVar,
      roughnessVariation: PBR_SETTINGS.roughVar,
      slopeAO: PBR_SETTINGS.slopeAO,
      baseRoughness: PBR_SETTINGS.roughness,
      baseMetalness: PBR_SETTINGS.metalness,
    });
  }, [microDetailEnabled, worldX, worldY, world.gridSize]);

  // GPU Memory Cleanup
  useEffect(() => {
    return () => geometry.dispose();
  }, [geometry]);

  return <mesh geometry={geometry} material={material} receiveShadow castShadow />;
}
