// SmoothTerrainMesh - Terrain with indexed geometry for smooth shading
// Uses shared vertices + proper vertex normals for non-faceted appearance
// CRITICAL: No Math.random() or Date.now() - all rendering is deterministic

import { useMemo } from "react";
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

export function SmoothTerrainMesh({
  world,
  worldX = 0,
  worldY = 0,
  microDetailEnabled = true,
}: SmoothTerrainMeshProps) {
  const heightScale = WORLD_HEIGHT_SCALE;
  const waterLevel = getWaterLevel(world.vars);
  const waterHeight = waterLevel * heightScale;

  const pathMaxHeight = waterHeight + PATH_HEIGHT_OFFSET;

  // Deterministic river carve amount (world units), computed from local context only.
  const computeRiverMask = (x: number, flippedY: number) => {
    // 0..1 mask based on distance (radius 2). Deterministic.
    // 1 = river center, ~0.6 = adjacent, ~0.25 = 2 tiles away, 0 = outside.
    let best = 0;

    for (let dy = -2; dy <= 2; dy++) {
      const row = world.terrain[flippedY + dy];
      if (!row) continue;

      for (let dx = -2; dx <= 2; dx++) {
        const c = row[x + dx];
        if (!c?.hasRiver) continue;

        const d = Math.max(Math.abs(dx), Math.abs(dy)); // Chebyshev distance (cheap)
        const w = d === 0 ? 1 : d === 1 ? 0.6 : 0.25;
        if (w > best) best = w;
      }
    }

    return best; // 0..1
  };

  const computeRiverCarve = (x: number, y: number, flippedY: number, cell: TerrainCell) => {
    const isRiver = !!cell.hasRiver;
    const mask = computeRiverMask(x, flippedY);
    if (mask <= 0) return 0;

    // deep in center, shallow at banks
    const centerFactor = isRiver ? 1 : mask; // center tiles get full depth

    const bedNoise = getMicroVariation(x * 3.1, y * 3.1, world.seed) * 0.6;

    const BANK_CARVE = 1;
    const BED_MIN = 2.4;
    const BED_MAX = 20;

    const bedCarve = BED_MIN + (BED_MAX - BED_MIN) * centerFactor;
    const carve = (isRiver ? bedCarve + bedNoise : BANK_CARVE) * mask;

    return Math.max(0, carve);
  };

  const geometry = useMemo(() => {
    const size = world.gridSize;
    const vertCount = size * size;
    const cellCount = (size - 1) * (size - 1);
    const indexCount = cellCount * 6;

    const positions = new Float32Array(vertCount * 3);
    const colors = new Float32Array(vertCount * 3);
    const uvs = new Float32Array(vertCount * 2);
    const indices = new Uint32Array(indexCount);

    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const vi = y * size + x;
        const flippedY = size - 1 - y;
        const cell = world.terrain[flippedY]?.[x];

        let h = 0;

        if (cell) {
          const baseH = cell.elevation * heightScale;
          h = baseH;

          // Carve riverbed relative to baseH only (cannot ever go above baseH)
          const carve = computeRiverCarve(x, y, flippedY, cell);

          if (carve > 0) {
            const isRiver = !!cell.hasRiver;

            // Ensure visible but bounded carve (still relative to baseH)
            const MIN_CARVE = isRiver ? 0.5 : 0.18;
            const MAX_CARVE = isRiver ? 1.8 : 0.9;

            const clampedCarve = Math.min(MAX_CARVE, Math.max(MIN_CARVE, carve));
            h = baseH - clampedCarve;
          }

          if (cell.isPath && !cell.isBridge) {
            h = Math.min(h, pathMaxHeight);
          }
        }

        positions[vi * 3] = x;
        positions[vi * 3 + 1] = h;
        positions[vi * 3 + 2] = y;

        const kind = cell ? getCellMaterialKind(cell) : "ground";
        let baseColor = BASE_COLORS[kind] || BASE_COLORS.ground;

        if (cell) {
          const mask = computeRiverMask(x, flippedY); // 0..1
          if (mask > 0) {
            // Darker than water so the transparent surface still pops
            const wetBed = { r: 0.06, g: 0.14, b: 0.18 };

            // Keep subtle; center is stronger, banks weaker
            const wet = Math.min(1, mask * 0.45);

            baseColor = {
              r: baseColor.r * (1 - wet) + wetBed.r * wet,
              g: baseColor.g * (1 - wet) + wetBed.g * wet,
              b: baseColor.b * (1 - wet) + wetBed.b * wet,
            };
          }
        }

        const microVar = getMicroVariation(x, y, world.seed);
        const elevLight = 0.7 + (cell ? Math.pow(cell.elevation, 0.7) * 0.4 : 0) + microVar;

        colors[vi * 3] = Math.min(1, baseColor.r * elevLight);
        colors[vi * 3 + 1] = Math.min(1, baseColor.g * elevLight);
        colors[vi * 3 + 2] = Math.min(1, baseColor.b * elevLight);

        const worldAbsX = x + worldX * size;
        const worldAbsZ = y + worldY * size;
        uvs[vi * 2] = worldAbsX * 0.08;
        uvs[vi * 2 + 1] = worldAbsZ * 0.08;
      }
    }

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
    const worldOffset = new THREE.Vector2(worldX * world.gridSize, worldY * world.gridSize);

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

  return <mesh geometry={geometry} material={material} receiveShadow />;
}
