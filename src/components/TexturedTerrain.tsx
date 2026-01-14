// TexturedTerrain.tsx
// FIXED: Implementing Relative Carving and Exporting SimpleTerrainMesh

import { useMemo, useRef, useEffect } from "react";
import * as THREE from "three";
import { WorldData, TerrainCell } from "@/lib/worldData";
import { WORLD_HEIGHT_SCALE, getWaterLevel, PATH_HEIGHT_OFFSET } from "@/lib/worldConstants";
import { MaterialKind, getMaterialKind } from "@/lib/materialRegistry";
import { createTerrainPbrDetailMaterial } from "@/lib/terrainPbrMaterial";

interface TexturedTerrainMeshProps {
  world: WorldData;
  worldX?: number;
  worldY?: number;
  texturesEnabled?: boolean;
  microDetailEnabled?: boolean;
}

const MATERIAL_KINDS: MaterialKind[] = [
  "ground",
  "forest",
  "mountain",
  "snow",
  "water",
  "path",
  "rock",
  "sand",
  "riverbed",
];

const UV_SCALES: Record<MaterialKind, number> = {
  ground: 0.08,
  forest: 0.1,
  mountain: 0.12,
  snow: 0.06,
  water: 0.04,
  path: 0.15,
  rock: 0.14,
  sand: 0.07,
  riverbed: 0.12,
};

const BASE_COLORS: Record<string, { r: number; g: number; b: number }> = {
  ground: { r: 0.5, g: 0.44, b: 0.28 },
  forest: { r: 0.18, g: 0.35, b: 0.15 },
  mountain: { r: 0.45, g: 0.43, b: 0.42 },
  snow: { r: 0.95, g: 0.95, b: 1.0 },
  water: { r: 0.15, g: 0.35, b: 0.45 },
  path: { r: 0.58, g: 0.48, b: 0.35 },
  rock: { r: 0.42, g: 0.42, b: 0.42 },
  sand: { r: 0.76, g: 0.62, b: 0.38 },
  riverbed: { r: 0.28, g: 0.26, b: 0.2 },
};

const PBR_PROPS: Record<
  MaterialKind,
  { roughness: number; metalness: number; detailScale: number; albedoVar: number; roughVar: number; slopeAO: number }
> = {
  ground: { roughness: 0.92, metalness: 0.02, detailScale: 0.9, albedoVar: 0.08, roughVar: 0.18, slopeAO: 0.12 },
  forest: { roughness: 0.94, metalness: 0.02, detailScale: 0.95, albedoVar: 0.07, roughVar: 0.16, slopeAO: 0.1 },
  mountain: { roughness: 0.8, metalness: 0.04, detailScale: 1.1, albedoVar: 0.08, roughVar: 0.22, slopeAO: 0.14 },
  snow: { roughness: 0.68, metalness: 0.01, detailScale: 0.7, albedoVar: 0.05, roughVar: 0.1, slopeAO: 0.06 },
  water: { roughness: 0.22, metalness: 0.1, detailScale: 0.6, albedoVar: 0.03, roughVar: 0.08, slopeAO: 0.0 },
  path: { roughness: 0.86, metalness: 0.03, detailScale: 1.25, albedoVar: 0.08, roughVar: 0.2, slopeAO: 0.1 },
  rock: { roughness: 0.78, metalness: 0.05, detailScale: 1.35, albedoVar: 0.09, roughVar: 0.25, slopeAO: 0.16 },
  sand: { roughness: 0.88, metalness: 0.01, detailScale: 0.85, albedoVar: 0.06, roughVar: 0.14, slopeAO: 0.08 },
  riverbed: { roughness: 0.65, metalness: 0.1, detailScale: 1.0, albedoVar: 0.05, roughVar: 0.15, slopeAO: 0.2 },
};

function getCellMaterialKind(cell: TerrainCell): MaterialKind {
  if (cell.hasRiver) return "riverbed";
  if (cell.isPath || cell.isBridge) return "path";
  return getMaterialKind(cell.type, cell.elevation, cell.moisture);
}

export function TexturedTerrainMesh({
  world,
  worldX = 0,
  worldY = 0,
  microDetailEnabled = true,
}: TexturedTerrainMeshProps) {
  const heightScale = WORLD_HEIGHT_SCALE;
  const pathMaxHeight = getWaterLevel(world.vars) * heightScale + PATH_HEIGHT_OFFSET;

  const geometriesPerKind = useMemo(() => {
    const size = world.gridSize;
    const cellsByKind: Record<MaterialKind, any[]> = {
      ground: [],
      forest: [],
      mountain: [],
      snow: [],
      water: [],
      path: [],
      rock: [],
      sand: [],
      riverbed: [],
    };

    // Step 1: Compute heights with negative carving for rivers
    const heights: number[][] = [];
    for (let y = 0; y < size; y++) {
      heights[y] = [];
      for (let x = 0; x < size; x++) {
        const fY = size - 1 - y;
        const cell = world.terrain[fY]?.[x];
        let h = (cell?.elevation || 0) * heightScale;
        if (cell?.hasRiver) h -= 0.3; // Physical trench carving
        if (cell?.isPath && !cell?.isBridge) h = Math.min(h, pathMaxHeight);
        heights[y][x] = h;
      }
    }

    // Step 2: Build Mesh
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const fY = size - 1 - y;
        const cell = world.terrain[fY]?.[x];
        if (!cell) continue;
        const kind = getCellMaterialKind(cell);
        cellsByKind[kind].push({ x, y, cell, height: heights[y][x] });
      }
    }

    const geos: Map<MaterialKind, THREE.BufferGeometry> = new Map();
    for (const kind of MATERIAL_KINDS) {
      const cells = cellsByKind[kind];
      if (cells.length === 0) continue;
      const baseColor = BASE_COLORS[kind] || BASE_COLORS.ground;
      const positions = new Float32Array(cells.length * 18);
      const colors = new Float32Array(cells.length * 18);
      const uvs = new Float32Array(cells.length * 12);
      let vi = 0;

      for (const { x, y, height } of cells) {
        const h00 = height,
          h10 = heights[y]?.[x + 1] ?? height,
          h01 = heights[y + 1]?.[x] ?? height,
          h11 = heights[y + 1]?.[x + 1] ?? height;
        const pts = [
          [x, h00, y, 0, 0],
          [x, h01, y + 1, 0, 1],
          [x + 1, h10, y, 1, 0],
          [x, h01, y + 1, 0, 1],
          [x + 1, h11, y + 1, 1, 1],
          [x + 1, h10, y, 1, 0],
        ];
        pts.forEach((p) => {
          positions[vi * 3] = p[0];
          positions[vi * 3 + 1] = p[1];
          positions[vi * 3 + 2] = p[2];
          colors[vi * 3] = baseColor.r;
          colors[vi * 3 + 1] = baseColor.g;
          colors[vi * 3 + 2] = baseColor.b;
          uvs[vi * 2] = (x + worldX * (size - 1)) * 0.1;
          uvs[vi * 2 + 1] = (y + worldY * (size - 1)) * 0.1;
          vi++;
        });
      }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
      geo.setAttribute("color", new THREE.BufferAttribute(colors, 3));
      geo.setAttribute("uv", new THREE.BufferAttribute(uvs, 2));
      geo.computeVertexNormals();
      geos.set(kind, geo);
    }
    return geos;
  }, [world, heightScale, pathMaxHeight, worldX, worldY]);

  const materialsPerKind = useMemo(() => {
    const mats: Map<MaterialKind, THREE.MeshStandardMaterial> = new Map();
    for (const kind of MATERIAL_KINDS) {
      if (!geometriesPerKind.has(kind)) continue;
      const pbr = PBR_PROPS[kind];
      mats.set(
        kind,
        createTerrainPbrDetailMaterial({
          detailTexture: null,
          textureInfluence: 0,
          microDetailEnabled,
          worldOffset: new THREE.Vector2(worldX * (world.gridSize - 1), worldY * (world.gridSize - 1)),
          detailScale: pbr.detailScale,
          albedoVariation: pbr.albedoVar,
          roughnessVariation: pbr.roughVar,
          slopeAO: pbr.slopeAO,
          baseRoughness: pbr.roughness,
          baseMetalness: pbr.metalness,
        }),
      );
    }
    return mats;
  }, [geometriesPerKind, microDetailEnabled, worldX, worldY, world.gridSize]);

  useEffect(() => {
    return () => {
      geometriesPerKind.forEach((g) => g.dispose());
      materialsPerKind.forEach((m) => m.dispose());
    };
  }, [geometriesPerKind, materialsPerKind]);

  return (
    <group>
      {Array.from(geometriesPerKind.keys()).map((kind) => (
        <mesh key={kind} geometry={geometriesPerKind.get(kind)} material={materialsPerKind.get(kind)} receiveShadow />
      ))}
    </group>
  );
}

export function SimpleTerrainMesh({
  world,
  worldX = 0,
  worldY = 0,
}: {
  world: WorldData;
  worldX?: number;
  worldY?: number;
}) {
  // Same height logic as above but simplified for fallback
  return <TexturedTerrainMesh world={world} worldX={worldX} worldY={worldY} microDetailEnabled={false} />;
}
