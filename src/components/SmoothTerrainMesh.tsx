// SmoothTerrainMesh - Frontierra Version 2.1
// Focus: Stable Carving, Deterministic UVs, and Memory Safety

import { useMemo, useEffect } from "react";
import * as THREE from "three";
import { WorldData, TerrainCell } from "@/lib/worldData";
import { WORLD_HEIGHT_SCALE, getWaterLevel, RIVER_DEPTH_OFFSET, PATH_HEIGHT_OFFSET } from "@/lib/worldConstants";
import { MaterialKind, getMaterialKind } from "@/lib/materialRegistry";
import { createTerrainPbrDetailMaterial } from "@/lib/terrainPbrMaterial";

interface SmoothTerrainMeshProps {
  world: WorldData;
  worldX?: number;
  worldY?: number;
  microDetailEnabled?: boolean;
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

function getMicroVariation(x: number, y: number, seed: number): number {
  const n = Math.sin(x * 12.9898 + y * 78.233 + seed * 0.1) * 43758.5453;
  return (n - Math.floor(n)) * 0.15 - 0.075;
}

function getCellMaterialKind(cell: TerrainCell): MaterialKind {
  if (cell.type === "water") return "water";
  if (cell.hasRiver) return "riverbed";
  if (cell.isPath || cell.isBridge) return "path";
  return getMaterialKind(cell.type, cell.elevation, cell.moisture);
}

export function SmoothTerrainMesh({
  world,
  worldX = 0,
  worldY = 0,
  microDetailEnabled = true,
}: SmoothTerrainMeshProps) {
  const heightScale = WORLD_HEIGHT_SCALE;
  const riverDepth = getWaterLevel(world.vars) * heightScale - RIVER_DEPTH_OFFSET;
  const pathMaxHeight = getWaterLevel(world.vars) * heightScale + PATH_HEIGHT_OFFSET;

  const geometry = useMemo(() => {
    const size = world.gridSize;
    const vertCount = size * size;
    const positions = new Float32Array(vertCount * 3);
    const colors = new Float32Array(vertCount * 3);
    const uvs = new Float32Array(vertCount * 2);
    const indices = new Uint32Array((size - 1) * (size - 1) * 6);

    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const vi = y * size + x;
        const flippedY = size - 1 - y;
        const cell = world.terrain[flippedY]?.[x];

        let h = cell ? cell.elevation * heightScale : 0;

        // --- 1. PROXIMITY-BASED CARVING (Fixes "Scooping" Landmine) ---
        if (cell) {
          const left = world.terrain[flippedY]?.[x - 1];
          const right = world.terrain[flippedY]?.[x + 1];
          const up = world.terrain[flippedY - 1]?.[x];
          const down = world.terrain[flippedY + 1]?.[x];

          const riverNeighbors =
            (left?.hasRiver ? 1 : 0) + (right?.hasRiver ? 1 : 0) + (up?.hasRiver ? 1 : 0) + (down?.hasRiver ? 1 : 0);
          const isNearRiver = cell.hasRiver || riverNeighbors > 0;

          if (isNearRiver) {
            const centerFactor = Math.min(1, riverNeighbors / 2); // 2 neighbors = full channel
            const bedNoise = getMicroVariation(x * 3.1, y * 3.1, world.seed) * 0.5;

            // Channel depth calculation
            const carve = cell.hasRiver ? 0.15 + 0.15 * centerFactor + bedNoise : 0.05; // Gentle dip for banks
            h -= carve;

            // Clamping the riverbed specifically
            if (cell.hasRiver) {
              const softFloor = riverDepth - 0.12 - centerFactor * 0.06;
              h = Math.max(h, softFloor);
              h = Math.min(h, riverDepth + 0.02);
            }
          }
        }

        if (cell?.isPath && !cell?.isBridge) h = Math.min(h, pathMaxHeight);

        positions[vi * 3] = x;
        positions[vi * 3 + 1] = h;
        positions[vi * 3 + 2] = y;

        // Color and Deterministic UVs
        const kind = cell ? getCellMaterialKind(cell) : "ground";
        const baseColor = BASE_COLORS[kind] || BASE_COLORS.ground;
        const microVar = getMicroVariation(x, y, world.seed);
        const elevLight = 0.7 + (cell ? Math.pow(cell.elevation, 0.7) * 0.4 : 0) + microVar;

        colors[vi * 3] = Math.min(1, baseColor.r * elevLight);
        colors[vi * 3 + 1] = Math.min(1, baseColor.g * elevLight);
        colors[vi * 3 + 2] = Math.min(1, baseColor.b * elevLight);

        // UV Fix: Use (size - 1) to match adjacent chunk starting points
        uvs[vi * 2] = (x + worldX * (size - 1)) * 0.08;
        uvs[vi * 2 + 1] = (y + worldY * (size - 1)) * 0.08;
      }
    }

    let ii = 0;
    for (let y = 0; y < size - 1; y++) {
      for (let x = 0; x < size - 1; x++) {
        const v00 = y * size + x,
          v10 = y * size + (x + 1),
          v01 = (y + 1) * size + x,
          v11 = (y + 1) * size + (x + 1);
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
  }, [world, heightScale, riverDepth, pathMaxHeight, worldX, worldY]);

  const material = useMemo(() => {
    return createTerrainPbrDetailMaterial({
      detailTexture: null,
      textureInfluence: 0,
      microDetailEnabled,
      worldOffset: new THREE.Vector2(worldX * (world.gridSize - 1), worldY * (world.gridSize - 1)),
      detailScale: 0.9,
      albedoVariation: 0.08,
      roughnessVariation: 0.18,
      slopeAO: 0.12,
      baseRoughness: 0.88,
      baseMetalness: 0.02,
    });
  }, [microDetailEnabled, worldX, worldY, world.gridSize]);

  // SAFE DISPOSAL: Only dispose of geometry.
  // Materials are often shared or cached by Three.js; disposing them can turn other chunks black.
  useEffect(() => {
    return () => geometry.dispose();
  }, [geometry]);

  return <mesh geometry={geometry} material={material} receiveShadow />;
}
