// Textured Terrain - 3D terrain mesh with procedural textures from @nexart/ui-renderer
// Replaces flat vertex colors with rich, deterministic textures.
// CRITICAL: All textures are deterministic - same inputs = same output.

import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { WorldData, TerrainCell } from '@/lib/worldData';
import {
  WORLD_HEIGHT_SCALE,
  getWaterLevel,
  RIVER_DEPTH_OFFSET,
  PATH_HEIGHT_OFFSET,
} from '@/lib/worldConstants';
import { useWorldTextures } from '@/hooks/useWorldTextures';
import { MaterialKind, getMaterialKind } from '@/lib/materialRegistry';

interface TexturedTerrainMeshProps {
  world: WorldData;
  worldX?: number;
  worldY?: number;
  texturesEnabled?: boolean;
}

const MATERIAL_KINDS: MaterialKind[] = [
  'ground',
  'forest',
  'mountain',
  'snow',
  'water',
  'path',
  'rock',
  'sand',
];

// UV scale for world-aligned textures (smaller = more repetition = more visible texture)
const UV_SCALE = 0.25;

// Fallback colors when textures aren't ready
const FALLBACK_COLORS: Record<string, { r: number; g: number; b: number }> = {
  ground: { r: 0.50, g: 0.44, b: 0.28 },
  forest: { r: 0.18, g: 0.35, b: 0.15 },
  mountain: { r: 0.45, g: 0.43, b: 0.42 },
  snow: { r: 0.95, g: 0.95, b: 1.0 },
  water: { r: 0.15, g: 0.35, b: 0.45 },
  path: { r: 0.58, g: 0.48, b: 0.35 },
  rock: { r: 0.42, g: 0.42, b: 0.42 },
  sand: { r: 0.76, g: 0.62, b: 0.38 },
};

// Deterministic micro-variation for organic feel
function getMicroVariation(x: number, y: number, seed: number): number {
  const n = Math.sin(x * 12.9898 + y * 78.233 + seed * 0.1) * 43758.5453;
  return (n - Math.floor(n)) * 0.15 - 0.075;
}

// Get tile base color from type with shading
function getTileColor(
  type: TerrainCell['type'],
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
  const elevationLight = Math.pow(elevation, 0.7) * 0.5;
  const brightness = baseBrightness + elevationLight;
  const ao = 0.9 + elevation * 0.1;

  if (hasRiver) {
    return { r: 0.18 + microVar * 0.5, g: 0.45 + microVar * 0.5, b: 0.55 + microVar * 0.3 };
  }

  if (isPath && type !== 'bridge') {
    return {
      r: (0.62 + microVar) * brightness * ao,
      g: (0.52 + microVar) * brightness * ao,
      b: (0.38 + microVar * 0.5) * brightness * ao,
    };
  }

  const kind = getMaterialKind(type, elevation, moisture);
  const fallback = FALLBACK_COLORS[kind] || FALLBACK_COLORS.ground;

  return {
    r: (fallback.r + microVar) * brightness * ao,
    g: (fallback.g + microVar) * brightness * ao,
    b: (fallback.b + microVar) * brightness * ao,
  };
}

function getCellMaterialKind(cell: WorldData['terrain'][number][number]): MaterialKind {
  // Rivers are a depression carved into terrain; treat as water for texturing.
  if (cell.hasRiver) return 'water';

  // Paths/bridges should use the path material.
  if (cell.isPath || cell.isBridge || cell.type === 'path' || cell.type === 'bridge') return 'path';

  return getMaterialKind(cell.type, cell.elevation, cell.moisture);
}

export function TexturedTerrainMesh({
  world,
  worldX = 0,
  worldY = 0,
  texturesEnabled = true,
}: TexturedTerrainMeshProps) {
  // Load procedural textures
  const { textures, isReady } = useWorldTextures({
    worldX,
    worldY,
    seed: world.seed,
    vars: world.vars,
    enabled: texturesEnabled,
  });

  const heightScale = WORLD_HEIGHT_SCALE;
  const waterLevel = getWaterLevel(world.vars);
  const waterHeight = waterLevel * heightScale;
  const riverDepth = waterHeight - RIVER_DEPTH_OFFSET;
  const pathMaxHeight = waterHeight + PATH_HEIGHT_OFFSET;

  // Build geometry with UVs + vertex colors; plus indexed groups so each tile type can use its own texture.
  const geometry = useMemo(() => {
    const size = world.gridSize;
    const geo = new THREE.PlaneGeometry(size, size, size - 1, size - 1);
    geo.rotateX(-Math.PI / 2);

    const positions = geo.attributes.position;
    const colors = new Float32Array(positions.count * 3);
    const uvs = new Float32Array(positions.count * 2);

    for (let i = 0; i < positions.count; i++) {
      const x = Math.floor(i % size);
      const y = Math.floor(i / size);
      const flippedY = size - 1 - y;

      const cell = world.terrain[flippedY]?.[x];
      if (!cell) continue;

      let height = cell.elevation * heightScale;

      if (cell.hasRiver) {
        height = Math.min(height, riverDepth);
      }

      if (cell.isPath && !cell.isBridge) {
        height = Math.min(height, pathMaxHeight);
      }

      positions.setY(i, height);

      // Vertex colors (used when textures are OFF / not ready)
      const { r, g, b } = getTileColor(
        cell.type,
        cell.elevation,
        cell.moisture,
        cell.hasRiver,
        cell.isPath,
        x,
        flippedY,
        world.seed,
      );
      colors[i * 3] = r;
      colors[i * 3 + 1] = g;
      colors[i * 3 + 2] = b;

      // WORLD-ALIGNED UV coordinates
      // Use absolute world coordinates so textures tile seamlessly across land boundaries
      const worldAbsX = x + worldX * size;
      const worldAbsZ = flippedY + worldY * size;
      uvs[i * 2] = worldAbsX * UV_SCALE;
      uvs[i * 2 + 1] = worldAbsZ * UV_SCALE;
    }

    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geo.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));

    // Rebuild index so triangles are grouped by material kind (8 draw calls, not thousands).
    const indicesByKind: Record<MaterialKind, number[]> = {
      ground: [],
      forest: [],
      mountain: [],
      snow: [],
      water: [],
      path: [],
      rock: [],
      sand: [],
    };

    for (let y = 0; y < size - 1; y++) {
      for (let x = 0; x < size - 1; x++) {
        const flippedCellY = size - 2 - y;
        const cell = world.terrain[flippedCellY]?.[x];
        if (!cell) continue;

        const kind = getCellMaterialKind(cell);

        // Match THREE.PlaneGeometry winding/order.
        const a = x + size * y;
        const b = x + size * (y + 1);
        const c = x + 1 + size * (y + 1);
        const d = x + 1 + size * y;

        indicesByKind[kind].push(a, b, d, b, c, d);
      }
    }

    geo.clearGroups();
    const newIndex: number[] = [];
    let start = 0;

    MATERIAL_KINDS.forEach((kind, materialIndex) => {
      const chunk = indicesByKind[kind];
      if (chunk.length === 0) return;
      newIndex.push(...chunk);
      geo.addGroup(start, chunk.length, materialIndex);
      start += chunk.length;
    });

    geo.setIndex(newIndex);
    geo.computeVertexNormals();

    return geo;
  }, [world, heightScale, riverDepth, pathMaxHeight, worldX, worldY]);

  // Material(s): if textures are enabled, use a multi-material so mountains/water/paths/etc each get their own texture.
  const material = useMemo<THREE.Material | THREE.Material[]>(() => {
    const vertexColorFallback = new THREE.MeshStandardMaterial({
      vertexColors: true,
      side: THREE.DoubleSide,
      roughness: 0.85,
      metalness: 0.05,
    });

    if (!texturesEnabled || !isReady) return vertexColorFallback;

    // Require the full set before swapping to textured mode.
    const hasAll = MATERIAL_KINDS.every((k) => textures.get(k));
    if (!hasAll) return vertexColorFallback;

    const mats = MATERIAL_KINDS.map((kind) => {
      const tex = textures.get(kind)!;
      
      // Configure texture for proper tiling
      tex.wrapS = THREE.RepeatWrapping;
      tex.wrapT = THREE.RepeatWrapping;
      // Sharper look so the procedural "sketch" detail is actually perceivable.
      tex.minFilter = THREE.NearestMipmapNearestFilter;
      tex.magFilter = THREE.NearestFilter;
      tex.anisotropy = 4;
      tex.needsUpdate = true;
      
      const isWater = kind === 'water';

      // CRITICAL: vertexColors = false, color = white to let texture shine through
      return new THREE.MeshStandardMaterial({
        map: tex,
        color: 0xffffff,
        vertexColors: false,
        side: THREE.DoubleSide,
        roughness: isWater ? 0.35 : 0.85,
        metalness: isWater ? 0.10 : 0.05,
      });
    });

    return mats;
  }, [texturesEnabled, isReady, textures]);

  return (
    <mesh
      geometry={geometry}
      material={material as THREE.Material | THREE.Material[]}
      position={[world.gridSize / 2, 0, world.gridSize / 2]}
    />
  );
}


// Simple fallback terrain (vertex colors only) for when textures are disabled
export function SimpleTerrainMesh({ world }: { world: WorldData }) {
  const meshRef = useRef<THREE.Mesh>(null);
  
  const heightScale = WORLD_HEIGHT_SCALE;
  const waterLevel = getWaterLevel(world.vars);
  const waterHeight = waterLevel * heightScale;
  const riverDepth = waterHeight - RIVER_DEPTH_OFFSET;
  const pathMaxHeight = waterHeight + PATH_HEIGHT_OFFSET;
  
  const { geometry } = useMemo(() => {
    const size = world.gridSize;
    const geometry = new THREE.PlaneGeometry(size, size, size - 1, size - 1);
    geometry.rotateX(-Math.PI / 2);
    
    const positions = geometry.attributes.position;
    const colors = new Float32Array(positions.count * 3);
    
    for (let i = 0; i < positions.count; i++) {
      const x = Math.floor(i % size);
      const y = Math.floor(i / size);
      const flippedY = size - 1 - y;
      
      const cell = world.terrain[flippedY]?.[x];
      if (cell) {
        let height = cell.elevation * heightScale;
        
        if (cell.hasRiver) {
          height = Math.min(height, riverDepth);
        }
        
        if (cell.isPath && !cell.isBridge) {
          height = Math.min(height, pathMaxHeight);
        }
        
        positions.setY(i, height);
        
        const { r, g, b } = getTileColor(
          cell.type,
          cell.elevation,
          cell.moisture,
          cell.hasRiver,
          cell.isPath,
          x,
          flippedY,
          world.seed
        );
        colors[i * 3] = r;
        colors[i * 3 + 1] = g;
        colors[i * 3 + 2] = b;
      }
    }
    
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geometry.computeVertexNormals();
    
    return { geometry };
  }, [world, heightScale, waterHeight, riverDepth, pathMaxHeight]);
  
  return (
    <mesh ref={meshRef} geometry={geometry} position={[world.gridSize / 2, 0, world.gridSize / 2]}>
      <meshStandardMaterial vertexColors side={THREE.DoubleSide} roughness={0.85} metalness={0.05} />
    </mesh>
  );
}
