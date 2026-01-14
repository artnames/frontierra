// Textured Terrain - 3D terrain mesh with PBR materials and procedural micro-detail
// FIXED: Exporting SimpleTerrainMesh and implementing Relative Mountain Carving

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
  {
    roughness: number;
    metalness: number;
    transparent?: boolean;
    opacity?: number;
    detailScale: number;
    albedoVar: number;
    roughVar: number;
    slopeAO: number;
  }
> = {
  ground: { roughness: 0.92, metalness: 0.02, detailScale: 0.9, albedoVar: 0.08, roughVar: 0.18, slopeAO: 0.12 },
  forest: { roughness: 0.94, metalness: 0.02, detailScale: 0.95, albedoVar: 0.07, roughVar: 0.16, slopeAO: 0.1 },
  mountain: { roughness: 0.8, metalness: 0.04, detailScale: 1.1, albedoVar: 0.08, roughVar: 0.22, slopeAO: 0.14 },
  snow: { roughness: 0.68, metalness: 0.01, detailScale: 0.7, albedoVar: 0.05, roughVar: 0.1, slopeAO: 0.06 },
  water: {
    roughness: 0.22,
    metalness: 0.1,
    transparent: true,
    opacity: 0.85,
    detailScale: 0.6,
    albedoVar: 0.03,
    roughVar: 0.08,
    slopeAO: 0.0,
  },
  path: { roughness: 0.86, metalness: 0.03, detailScale: 1.25, albedoVar: 0.08, roughVar: 0.2, slopeAO: 0.1 },
  rock: { roughness: 0.78, metalness: 0.05, detailScale: 1.35, albedoVar: 0.09, roughVar: 0.25, slopeAO: 0.16 },
  sand: { roughness: 0.88, metalness: 0.01, detailScale: 0.85, albedoVar: 0.06, roughVar: 0.14, slopeAO: 0.08 },
  riverbed: { roughness: 0.65, metalness: 0.1, detailScale: 1.0, albedoVar: 0.05, roughVar: 0.15, slopeAO: 0.2 },
};

function getMicroVariation(x: number, y: number, seed: number): number {
  const n = Math.sin(x * 12.9898 + y * 78.233 + seed * 0.1) * 43758.5453;
  return (n - Math.floor(n)) * 0.15 - 0.075;
}

function getTileColor(
  type: TerrainCell["type"],
  elevation: number,
  moisture: number,
  hasRiver: boolean,
  isPath: boolean,
  x: number,
  y: number,
  seed: number,
): { r: number; g: number; b: number } {
  const microVar = getMicroVariation(x, y, seed);
  const baseBrightness = 0.65 + microVar;
  const brightness = baseBrightness + Math.pow(elevation, 0.7) * 0.5;
  const ao = 0.9 + elevation * 0.1;

  if (hasRiver) return { r: 0.25 * brightness, g: 0.23 * brightness, b: 0.18 * brightness };

  if (isPath && type !== "bridge") {
    return {
      r: (0.62 + microVar) * brightness * ao,
      g: (0.52 + microVar) * brightness * ao,
      b: (0.38 + microVar * 0.5) * brightness * ao,
    };
  }

  const kind = getMaterialKind(type, elevation, moisture);
  const fallback = BASE_COLORS[kind] || BASE_COLORS.ground;
  return {
    r: (fallback.r + microVar) * brightness * ao,
    g: (fallback.g + microVar) * brightness * ao,
    b: (fallback.b + microVar) * brightness * ao,
  };
}

function getCellMaterialKind(cell: TerrainCell): MaterialKind {
  if (cell.hasRiver) return "riverbed";
  if (cell.isPath || cell.isBridge || cell.type === "path" || cell.type === "bridge") return "path";
  return getMaterialKind(cell.type, cell.elevation, cell.moisture);
}

export function TexturedTerrainMesh({
  world,
  worldX = 0,
  worldY = 0,
  texturesEnabled = true,
  microDetailEnabled = true,
}: TexturedTerrainMeshProps) {
  const heightScale = WORLD_HEIGHT_SCALE;
  const pathMaxHeight = getWaterLevel(world.vars) * heightScale + PATH_HEIGHT_OFFSET;

  const geometriesPerKind = useMemo(() => {
    const size = world.gridSize;
    const cellsByKind: Record<MaterialKind, { x: number; y: number; cell: TerrainCell; height: number }[]> = {
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

    const heights: number[][] = [];
    for (let y = 0; y < size; y++) {
      heights[y] = [];
      for (let x = 0; x < size; x++) {
        const flippedY = size - 1 - y;
        const cell = world.terrain[flippedY]?.[x];
        if (!cell) {
          heights[y][x] = 0;
          continue;
        }

        let h = cell.elevation * heightScale;
        // RELATIVE CARVING: Key for mountain rivers
        if (cell.hasRiver) h -= 0.25;
        if (cell.isPath && !cell.isBridge) h = Math.min(h, pathMaxHeight);
        heights[y][x] = h;
      }
    }

    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const flippedY = size - 1 - y;
        const cell = world.terrain[flippedY]?.[x];
        if (!cell) continue;
        const kind = getCellMaterialKind(cell);
        cellsByKind[kind].push({ x, y, cell, height: heights[y][x] });
      }
    }

    const geos: Map<MaterialKind, THREE.BufferGeometry> = new Map();
    for (const kind of MATERIAL_KINDS) {
      const cells = cellsByKind[kind];
      if (cells.length === 0) continue;

      const uvScale = UV_SCALES[kind];
      const baseColor = BASE_COLORS[kind] || BASE_COLORS.ground;
      const positions = new Float32Array(cells.length * 18);
      const colors = new Float32Array(cells.length * 18);
      const uvs = new Float32Array(cells.length * 12);

      let vi = 0;
      for (const { x, y, cell, height } of cells) {
        const h00 = height,
          h10 = heights[y]?.[x + 1] ?? height,
          h01 = heights[y + 1]?.[x] ?? height,
          h11 = heights[y + 1]?.[x + 1] ?? height;
        const microVar = getMicroVariation(x, y, world.seed);
        const elevLight = 0.7 + Math.pow(cell.elevation, 0.7) * 0.4 + microVar;
        const r = Math.min(1, baseColor.r * elevLight),
          g = Math.min(1, baseColor.g * elevLight),
          b = Math.min(1, baseColor.b * elevLight);

        const wX = (x + worldX * (size - 1)) * uvScale,
          wZ = (y + worldY * (size - 1)) * uvScale;
        const wX1 = wX + uvScale,
          wZ1 = wZ + uvScale;

        // Triangles
        const pts = [
          [x, h00, y, wX, wZ],
          [x, h01, y + 1, wX, wZ1],
          [x + 1, h10, y, wX1, wZ],
          [x, h01, y + 1, wX, wZ1],
          [x + 1, h11, y + 1, wX1, wZ1],
          [x + 1, h10, y, wX1, wZ],
        ];
        pts.forEach((p) => {
          positions[vi * 3] = p[0];
          positions[vi * 3 + 1] = p[1];
          positions[vi * 3 + 2] = p[2];
          colors[vi * 3] = r;
          colors[vi * 3 + 1] = g;
          colors[vi * 3 + 2] = b;
          uvs[vi * 2] = p[3];
          uvs[vi * 2 + 1] = p[4];
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
    const worldOffset = new THREE.Vector2(worldX * (world.gridSize - 1), worldY * (world.gridSize - 1));
    for (const kind of MATERIAL_KINDS) {
      if (!geometriesPerKind.has(kind)) continue;
      const pbr = PBR_PROPS[kind];
      mats.set(
        kind,
        createTerrainPbrDetailMaterial({
          detailTexture: null,
          textureInfluence: 0,
          microDetailEnabled,
          worldOffset,
          detailScale: pbr.detailScale,
          albedoVariation: pbr.albedoVar,
          roughnessVariation: pbr.roughVar,
          slopeAO: pbr.slopeAO,
          baseRoughness: pbr.roughness,
          baseMetalness: pbr.metalness,
          transparent: pbr.transparent,
          opacity: pbr.opacity,
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

// FIXED: Added 'export' to resolve TS2305 in WorldExplorer.tsx
export interface SimpleTerrainMeshProps {
  world: WorldData;
  microDetailEnabled?: boolean;
  fogEnabled?: boolean;
  worldX?: number;
  worldY?: number;
}

export function SimpleTerrainMesh({
  world,
  microDetailEnabled = true,
  fogEnabled = true,
  worldX = 0,
  worldY = 0,
}: SimpleTerrainMeshProps) {
  const meshRef = useRef<THREE.Mesh>(null);
  const heightScale = WORLD_HEIGHT_SCALE;
  const pathMaxHeight = getWaterLevel(world.vars) * heightScale + PATH_HEIGHT_OFFSET;

  const geometry = useMemo(() => {
    const size = world.gridSize;
    const heights: number[][] = [];
    for (let y = 0; y < size; y++) {
      heights[y] = [];
      for (let x = 0; x < size; x++) {
        const flippedY = size - 1 - y;
        const cell = world.terrain[flippedY]?.[x];
        if (!cell) {
          heights[y][x] = 0;
          continue;
        }
        let h = cell.elevation * heightScale;
        if (cell.hasRiver) h -= 0.25;
        if (cell.isPath && !cell.isBridge) h = Math.min(h, pathMaxHeight);
        heights[y][x] = h;
      }
    }

    const cellCount = (size - 1) * (size - 1);
    const positions = new Float32Array(cellCount * 18);
    const colors = new Float32Array(cellCount * 18);

    let vi = 0;
    for (let y = 0; y < size - 1; y++) {
      for (let x = 0; x < size - 1; x++) {
        const flippedY = size - 1 - y;
        const cell = world.terrain[flippedY]?.[x];
        const h00 = heights[y][x],
          h10 = heights[y][x + 1],
          h01 = heights[y + 1]?.[x] ?? h00,
          h11 = heights[y + 1]?.[x + 1] ?? h10;
        const { r, g, b } = cell
          ? getTileColor(cell.type, cell.elevation, cell.moisture, cell.hasRiver, cell.isPath, x, flippedY, world.seed)
          : { r: 0.5, g: 0.5, b: 0.5 };

        const pts = [
          [x, h00, y],
          [x, h01, y + 1],
          [x + 1, h10, y],
          [x, h01, y + 1],
          [x + 1, h11, y + 1],
          [x + 1, h10, y],
        ];
        pts.forEach((p) => {
          positions[vi * 3] = p[0];
          positions[vi * 3 + 1] = p[1];
          positions[vi * 3 + 2] = p[2];
          colors[vi * 3] = r;
          colors[vi * 3 + 1] = g;
          colors[vi * 3 + 2] = b;
          vi++;
        });
      }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geo.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    geo.computeVertexNormals();
    return geo;
  }, [world, heightScale, pathMaxHeight]);

  return (
    <mesh ref={meshRef} geometry={geometry} receiveShadow>
      <meshStandardMaterial vertexColors side={THREE.DoubleSide} roughness={0.85} metalness={0.05} />
    </mesh>
  );
}
