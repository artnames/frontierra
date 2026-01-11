// Textured Terrain - 3D terrain mesh with procedural textures from @nexart/ui-renderer
// Uses custom ShaderMaterial to properly modulate vertex colors with texture luminance.
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
import { createTerrainPbrDetailMaterial } from '@/lib/terrainPbrMaterial';

interface TexturedTerrainMeshProps {
  world: WorldData;
  worldX?: number;
  worldY?: number;
  texturesEnabled?: boolean;
  microDetailEnabled?: boolean;
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

// UV scales per material - larger = less repetition, less striping
const UV_SCALES: Record<MaterialKind, number> = {
  ground: 0.08,
  forest: 0.10,
  mountain: 0.12,
  snow: 0.06,
  water: 0.04,
  path: 0.15,
  rock: 0.14,
  sand: 0.07,
};

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

// Texture influence per material (0-1) - how much texture modulates base color
const TEXTURE_INFLUENCE: Record<MaterialKind, number> = {
  ground: 0.25,    // Visible earth variation
  forest: 0.22,    // Visible undergrowth texture
  mountain: 0.28,  // More visible rock striations
  snow: 0.15,      // Subtle - snow is mostly uniform
  water: 0.12,     // Minimal - just brightness noise
  path: 0.30,      // More visible for worn/trampled look
  rock: 0.30,      // Visible cracks and texture
  sand: 0.20,      // Gentle ripple patterns
};

// PBR detail material keeps vertex colors primary but adds micro grain + roughness variation

// Material tuning per kind (kept subtle to preserve stylized look)
const PBR_PROPS: Record<MaterialKind, { roughness: number; metalness: number; transparent?: boolean; opacity?: number; detailScale: number; albedoVar: number; roughVar: number; slopeAO: number }> = {
  ground:   { roughness: 0.92, metalness: 0.02, detailScale: 0.90, albedoVar: 0.08, roughVar: 0.18, slopeAO: 0.12 },
  forest:   { roughness: 0.94, metalness: 0.02, detailScale: 0.95, albedoVar: 0.07, roughVar: 0.16, slopeAO: 0.10 },
  mountain: { roughness: 0.80, metalness: 0.04, detailScale: 1.10, albedoVar: 0.08, roughVar: 0.22, slopeAO: 0.14 },
  snow:     { roughness: 0.68, metalness: 0.01, detailScale: 0.70, albedoVar: 0.05, roughVar: 0.10, slopeAO: 0.06 },
  water:    { roughness: 0.22, metalness: 0.10, transparent: true, opacity: 0.85, detailScale: 0.60, albedoVar: 0.03, roughVar: 0.08, slopeAO: 0.00 },
  path:     { roughness: 0.86, metalness: 0.03, detailScale: 1.25, albedoVar: 0.08, roughVar: 0.20, slopeAO: 0.10 },
  rock:     { roughness: 0.78, metalness: 0.05, detailScale: 1.35, albedoVar: 0.09, roughVar: 0.25, slopeAO: 0.16 },
  sand:     { roughness: 0.88, metalness: 0.01, detailScale: 0.85, albedoVar: 0.06, roughVar: 0.14, slopeAO: 0.08 },
};

// Deterministic micro-variation for organic feel
function getMicroVariation(x: number, y: number, seed: number): number {
  const n = Math.sin(x * 12.9898 + y * 78.233 + seed * 0.1) * 43758.5453;
  return (n - Math.floor(n)) * 0.15 - 0.075;
}

// Get tile base color from type with shading (for SimpleTerrainMesh fallback)
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
  if (cell.hasRiver) return 'water';
  if (cell.isPath || cell.isBridge || cell.type === 'path' || cell.type === 'bridge') return 'path';
  return getMaterialKind(cell.type, cell.elevation, cell.moisture);
}

export function TexturedTerrainMesh({
  world,
  worldX = 0,
  worldY = 0,
  texturesEnabled = true,
  microDetailEnabled = true,
}: TexturedTerrainMeshProps) {
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

  // Build separate geometries per material kind with appropriate UVs
  const geometriesPerKind = useMemo(() => {
    const size = world.gridSize;
    
    const cellsByKind: Record<MaterialKind, { x: number; y: number; cell: TerrainCell; height: number }[]> = {
      ground: [], forest: [], mountain: [], snow: [], water: [], path: [], rock: [], sand: [],
    };
    
    // Compute heights
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
        if (cell.hasRiver) h = Math.min(h, riverDepth);
        if (cell.isPath && !cell.isBridge) h = Math.min(h, pathMaxHeight);
        heights[y][x] = h;
      }
    }
    
    // Collect cells by material kind
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const flippedY = size - 1 - y;
        const cell = world.terrain[flippedY]?.[x];
        if (!cell) continue;
        const kind = getCellMaterialKind(cell);
        cellsByKind[kind].push({ x, y, cell, height: heights[y][x] });
      }
    }
    
    // Slope helper
    const getSlope = (x: number, y: number): number => {
      const h = heights[y]?.[x] ?? 0;
      const hL = heights[y]?.[x - 1] ?? h;
      const hR = heights[y]?.[x + 1] ?? h;
      const hU = heights[y - 1]?.[x] ?? h;
      const hD = heights[y + 1]?.[x] ?? h;
      const dx = (hR - hL) / 2;
      const dy = (hD - hU) / 2;
      return Math.min(1, Math.sqrt(dx * dx + dy * dy) / 5);
    };
    
    const geos: Map<MaterialKind, THREE.BufferGeometry> = new Map();
    
    for (const kind of MATERIAL_KINDS) {
      const cells = cellsByKind[kind];
      if (cells.length === 0) continue;
      
      const uvScale = UV_SCALES[kind];
      const baseColor = FALLBACK_COLORS[kind];
      
      const vertCount = cells.length * 6;
      const positions = new Float32Array(vertCount * 3);
      const colors = new Float32Array(vertCount * 3);
      const uvs = new Float32Array(vertCount * 2);
      
      let vi = 0;
      for (const { x, y, cell, height } of cells) {
        const h00 = height;
        const h10 = heights[y]?.[x + 1] ?? height;
        const h01 = heights[y + 1]?.[x] ?? height;
        const h11 = heights[y + 1]?.[x + 1] ?? height;
        
        // Slope-based attenuation stored in vertex color brightness
        const slope = getSlope(x, y);
        const slopeAttenuation = 1 - slope * 0.5;
        
        const microVar = getMicroVariation(x, y, world.seed);
        const elevLight = 0.7 + Math.pow(cell.elevation, 0.7) * 0.4 + microVar;
        
        const r = Math.min(1, baseColor.r * elevLight * slopeAttenuation);
        const g = Math.min(1, baseColor.g * elevLight * slopeAttenuation);
        const b = Math.min(1, baseColor.b * elevLight * slopeAttenuation);
        
        // World-aligned UVs
        const worldAbsX = x + worldX * size;
        const worldAbsZ = y + worldY * size;
        const u0 = worldAbsX * uvScale;
        const v0 = worldAbsZ * uvScale;
        const u1 = (worldAbsX + 1) * uvScale;
        const v1 = (worldAbsZ + 1) * uvScale;
        
        // Triangle 1
        positions[vi * 3] = x; positions[vi * 3 + 1] = h00; positions[vi * 3 + 2] = y;
        colors[vi * 3] = r; colors[vi * 3 + 1] = g; colors[vi * 3 + 2] = b;
        uvs[vi * 2] = u0; uvs[vi * 2 + 1] = v0;
        vi++;
        
        positions[vi * 3] = x; positions[vi * 3 + 1] = h01; positions[vi * 3 + 2] = y + 1;
        colors[vi * 3] = r; colors[vi * 3 + 1] = g; colors[vi * 3 + 2] = b;
        uvs[vi * 2] = u0; uvs[vi * 2 + 1] = v1;
        vi++;
        
        positions[vi * 3] = x + 1; positions[vi * 3 + 1] = h10; positions[vi * 3 + 2] = y;
        colors[vi * 3] = r; colors[vi * 3 + 1] = g; colors[vi * 3 + 2] = b;
        uvs[vi * 2] = u1; uvs[vi * 2 + 1] = v0;
        vi++;
        
        // Triangle 2
        positions[vi * 3] = x; positions[vi * 3 + 1] = h01; positions[vi * 3 + 2] = y + 1;
        colors[vi * 3] = r; colors[vi * 3 + 1] = g; colors[vi * 3 + 2] = b;
        uvs[vi * 2] = u0; uvs[vi * 2 + 1] = v1;
        vi++;
        
        positions[vi * 3] = x + 1; positions[vi * 3 + 1] = h11; positions[vi * 3 + 2] = y + 1;
        colors[vi * 3] = r; colors[vi * 3 + 1] = g; colors[vi * 3 + 2] = b;
        uvs[vi * 2] = u1; uvs[vi * 2 + 1] = v1;
        vi++;
        
        positions[vi * 3] = x + 1; positions[vi * 3 + 1] = h10; positions[vi * 3 + 2] = y;
        colors[vi * 3] = r; colors[vi * 3 + 1] = g; colors[vi * 3 + 2] = b;
        uvs[vi * 2] = u1; uvs[vi * 2 + 1] = v0;
        vi++;
      }
      
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
      geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
      geo.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
      geo.computeVertexNormals();
      
      geos.set(kind, geo);
    }
    
    return geos;
  }, [world, heightScale, riverDepth, pathMaxHeight, worldX, worldY]);

  // Create PBR materials per kind (vertex colors primary + deterministic micro-detail)
  const materialsPerKind = useMemo(() => {
    const mats: Map<MaterialKind, THREE.MeshStandardMaterial> = new Map();

    const worldOffset = new THREE.Vector2(worldX * world.gridSize, worldY * world.gridSize);

    for (const kind of MATERIAL_KINDS) {
      if (!geometriesPerKind.has(kind)) continue;

      const influence = TEXTURE_INFLUENCE[kind];
      const tex = texturesEnabled && isReady ? textures.get(kind) ?? null : null;

      if (tex) {
        tex.wrapS = THREE.RepeatWrapping;
        tex.wrapT = THREE.RepeatWrapping;
        tex.minFilter = THREE.LinearMipmapLinearFilter;
        tex.magFilter = THREE.LinearFilter;
        tex.anisotropy = 4;
        tex.needsUpdate = true;
      }

      const pbr = PBR_PROPS[kind];
      mats.set(
        kind,
        createTerrainPbrDetailMaterial({
          detailTexture: tex,
          textureInfluence: influence,
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
        })
      );
    }

    return mats;
  }, [texturesEnabled, isReady, textures, geometriesPerKind, microDetailEnabled, worldX, worldY, world.gridSize]);

  return (
    <group position={[0, 0, 0]}>
      {MATERIAL_KINDS.map((kind) => {
        const geo = geometriesPerKind.get(kind);
        const mat = materialsPerKind.get(kind);
        if (!geo || !mat) return null;
        return <mesh key={kind} geometry={geo} material={mat} receiveShadow />;
      })}
    </group>
  );
}


// Simple fallback terrain (vertex colors only) for when textures are disabled
// Uses the same explicit vertex positioning as TexturedTerrainMesh for alignment
// Now includes optional micro-detail noise and fog support

interface SimpleTerrainMeshProps {
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
  worldY = 0
}: SimpleTerrainMeshProps) {
  const meshRef = useRef<THREE.Mesh>(null);
  
  const heightScale = WORLD_HEIGHT_SCALE;
  const waterLevel = getWaterLevel(world.vars);
  const waterHeight = waterLevel * heightScale;
  const riverDepth = waterHeight - RIVER_DEPTH_OFFSET;
  const pathMaxHeight = waterHeight + PATH_HEIGHT_OFFSET;
  
  const geometry = useMemo(() => {
    const size = world.gridSize;
    
    // Compute heights grid first
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
        if (cell.hasRiver) h = Math.min(h, riverDepth);
        if (cell.isPath && !cell.isBridge) h = Math.min(h, pathMaxHeight);
        heights[y][x] = h;
      }
    }
    
    // Build triangles explicitly - 2 triangles per cell, 6 vertices per cell
    const cellCount = (size - 1) * (size - 1);
    const vertCount = cellCount * 6;
    const positions = new Float32Array(vertCount * 3);
    const colors = new Float32Array(vertCount * 3);
    
    let vi = 0;
    for (let y = 0; y < size - 1; y++) {
      for (let x = 0; x < size - 1; x++) {
        const flippedY = size - 1 - y;
        const cell = world.terrain[flippedY]?.[x];
        
        const h00 = heights[y][x];
        const h10 = heights[y][x + 1];
        const h01 = heights[y + 1]?.[x] ?? h00;
        const h11 = heights[y + 1]?.[x + 1] ?? h10;
        
        const { r, g, b } = cell ? getTileColor(
          cell.type,
          cell.elevation,
          cell.moisture,
          cell.hasRiver,
          cell.isPath,
          x,
          flippedY,
          world.seed
        ) : { r: 0.5, g: 0.5, b: 0.5 };
        
        // Triangle 1: (x,y), (x,y+1), (x+1,y)
        positions[vi * 3] = x; positions[vi * 3 + 1] = h00; positions[vi * 3 + 2] = y;
        colors[vi * 3] = r; colors[vi * 3 + 1] = g; colors[vi * 3 + 2] = b;
        vi++;
        
        positions[vi * 3] = x; positions[vi * 3 + 1] = h01; positions[vi * 3 + 2] = y + 1;
        colors[vi * 3] = r; colors[vi * 3 + 1] = g; colors[vi * 3 + 2] = b;
        vi++;
        
        positions[vi * 3] = x + 1; positions[vi * 3 + 1] = h10; positions[vi * 3 + 2] = y;
        colors[vi * 3] = r; colors[vi * 3 + 1] = g; colors[vi * 3 + 2] = b;
        vi++;
        
        // Triangle 2: (x,y+1), (x+1,y+1), (x+1,y)
        positions[vi * 3] = x; positions[vi * 3 + 1] = h01; positions[vi * 3 + 2] = y + 1;
        colors[vi * 3] = r; colors[vi * 3 + 1] = g; colors[vi * 3 + 2] = b;
        vi++;
        
        positions[vi * 3] = x + 1; positions[vi * 3 + 1] = h11; positions[vi * 3 + 2] = y + 1;
        colors[vi * 3] = r; colors[vi * 3 + 1] = g; colors[vi * 3 + 2] = b;
        vi++;
        
        positions[vi * 3] = x + 1; positions[vi * 3 + 1] = h10; positions[vi * 3 + 2] = y;
        colors[vi * 3] = r; colors[vi * 3 + 1] = g; colors[vi * 3 + 2] = b;
        vi++;
      }
    }
    
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geo.computeVertexNormals();
    
    return geo;
  }, [world, heightScale, riverDepth, pathMaxHeight]);
  
  return (
    <mesh ref={meshRef} geometry={geometry} position={[0, 0, 0]} receiveShadow>
      <meshStandardMaterial vertexColors side={THREE.DoubleSide} roughness={0.85} metalness={0.05} />
    </mesh>
  );
}
