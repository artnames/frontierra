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

// UV scales per material - larger = less repetition, less striping
// Ground/forest: slow variation; water: almost flat; mountain: medium
const UV_SCALES: Record<MaterialKind, number> = {
  ground: 0.08,    // Large scale - slow, subtle variation
  forest: 0.10,    // Slightly more visible for undergrowth feel
  mountain: 0.12,  // Medium scale
  snow: 0.06,      // Very large scale - almost uniform
  water: 0.04,     // Largest scale - texture is just noise, not pattern
  path: 0.15,      // More visible for worn texture
  rock: 0.14,      // Medium-high for craggy feel
  sand: 0.07,      // Large scale - gentle dune variation
};

// Fallback colors when textures aren't ready (also used for modulation base)
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
// Lower = more subtle, texture acts like paper grain
const TEXTURE_INFLUENCE: Record<MaterialKind, number> = {
  ground: 0.20,    // Subtle earth variation
  forest: 0.18,    // Gentle undergrowth texture
  mountain: 0.22,  // Slightly more visible rock striations
  snow: 0.12,      // Very subtle - snow is mostly uniform
  water: 0.10,     // Minimal - just brightness noise, not pattern
  path: 0.25,      // More visible for worn/trampled look
  rock: 0.25,      // Visible cracks and texture
  sand: 0.15,      // Gentle ripple patterns
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

  // Build separate geometries per material kind with appropriate UVs
  const geometriesPerKind = useMemo(() => {
    const size = world.gridSize;
    
    // First pass: compute heights and collect cells per material
    const cellsByKind: Record<MaterialKind, { x: number; y: number; cell: TerrainCell; height: number }[]> = {
      ground: [], forest: [], mountain: [], snow: [], water: [], path: [], rock: [], sand: [],
    };
    
    // Compute normals for slope detection
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
    
    // Helper: compute slope at a point (0 = flat, 1 = vertical)
    const getSlope = (x: number, y: number): number => {
      const h = heights[y]?.[x] ?? 0;
      const hL = heights[y]?.[x - 1] ?? h;
      const hR = heights[y]?.[x + 1] ?? h;
      const hU = heights[y - 1]?.[x] ?? h;
      const hD = heights[y + 1]?.[x] ?? h;
      const dx = (hR - hL) / 2;
      const dy = (hD - hU) / 2;
      const slopeMag = Math.sqrt(dx * dx + dy * dy);
      return Math.min(1, slopeMag / 5); // Normalize: slope of 5 units = max
    };
    
    // Build one geometry per material kind
    const geos: Map<MaterialKind, THREE.BufferGeometry> = new Map();
    
    for (const kind of MATERIAL_KINDS) {
      const cells = cellsByKind[kind];
      if (cells.length === 0) continue;
      
      const uvScale = UV_SCALES[kind];
      const influence = TEXTURE_INFLUENCE[kind];
      const baseColor = FALLBACK_COLORS[kind];
      
      // Each cell = 2 triangles = 6 vertices (non-indexed for per-vertex colors)
      const vertCount = cells.length * 6;
      const positions = new Float32Array(vertCount * 3);
      const colors = new Float32Array(vertCount * 3);
      const uvs = new Float32Array(vertCount * 2);
      
      let vi = 0;
      for (const { x, y, cell, height } of cells) {
        // Get neighboring heights for quad
        const h00 = height;
        const h10 = heights[y]?.[x + 1] ?? height;
        const h01 = heights[y + 1]?.[x] ?? height;
        const h11 = heights[y + 1]?.[x + 1] ?? height;
        
        // Compute slope-based attenuation (reduce texture on steep slopes)
        const slope = getSlope(x, y);
        const slopeAttenuation = 1 - slope * 0.7; // Steep = 30% texture visibility
        
        // Effective texture influence for this cell
        const effectiveInfluence = influence * slopeAttenuation;
        
        // Vertex color: base color modulated by micro-variation and slope
        // This will be multiplied with texture in shader (texture acts as luminance modulator)
        const microVar = getMicroVariation(x, y, world.seed);
        const elevLight = 0.65 + Math.pow(cell.elevation, 0.7) * 0.5 + microVar;
        
        // Store effective influence in alpha-like manner via color intensity
        // Higher effectiveInfluence = texture matters more, so brighten base slightly
        const colorMult = 1 + effectiveInfluence * 0.3;
        const r = Math.min(1, baseColor.r * elevLight * colorMult);
        const g = Math.min(1, baseColor.g * elevLight * colorMult);
        const b = Math.min(1, baseColor.b * elevLight * colorMult);
        
        // World-aligned UVs with material-specific scale
        const worldAbsX = x + worldX * size;
        const worldAbsZ = y + worldY * size;
        const u0 = worldAbsX * uvScale;
        const v0 = worldAbsZ * uvScale;
        const u1 = (worldAbsX + 1) * uvScale;
        const v1 = (worldAbsZ + 1) * uvScale;
        
        // Triangle 1: (x,y) -> (x,y+1) -> (x+1,y)
        // Vertex 0
        positions[vi * 3] = x;
        positions[vi * 3 + 1] = h00;
        positions[vi * 3 + 2] = y;
        colors[vi * 3] = r; colors[vi * 3 + 1] = g; colors[vi * 3 + 2] = b;
        uvs[vi * 2] = u0; uvs[vi * 2 + 1] = v0;
        vi++;
        
        // Vertex 1
        positions[vi * 3] = x;
        positions[vi * 3 + 1] = h01;
        positions[vi * 3 + 2] = y + 1;
        colors[vi * 3] = r; colors[vi * 3 + 1] = g; colors[vi * 3 + 2] = b;
        uvs[vi * 2] = u0; uvs[vi * 2 + 1] = v1;
        vi++;
        
        // Vertex 2
        positions[vi * 3] = x + 1;
        positions[vi * 3 + 1] = h10;
        positions[vi * 3 + 2] = y;
        colors[vi * 3] = r; colors[vi * 3 + 1] = g; colors[vi * 3 + 2] = b;
        uvs[vi * 2] = u1; uvs[vi * 2 + 1] = v0;
        vi++;
        
        // Triangle 2: (x,y+1) -> (x+1,y+1) -> (x+1,y)
        // Vertex 3
        positions[vi * 3] = x;
        positions[vi * 3 + 1] = h01;
        positions[vi * 3 + 2] = y + 1;
        colors[vi * 3] = r; colors[vi * 3 + 1] = g; colors[vi * 3 + 2] = b;
        uvs[vi * 2] = u0; uvs[vi * 2 + 1] = v1;
        vi++;
        
        // Vertex 4
        positions[vi * 3] = x + 1;
        positions[vi * 3 + 1] = h11;
        positions[vi * 3 + 2] = y + 1;
        colors[vi * 3] = r; colors[vi * 3 + 1] = g; colors[vi * 3 + 2] = b;
        uvs[vi * 2] = u1; uvs[vi * 2 + 1] = v1;
        vi++;
        
        // Vertex 5
        positions[vi * 3] = x + 1;
        positions[vi * 3 + 1] = h10;
        positions[vi * 3 + 2] = y;
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

  // Create materials per kind - texture modulates vertex color, not replaces it
  const materialsPerKind = useMemo(() => {
    const mats: Map<MaterialKind, THREE.Material> = new Map();
    
    for (const kind of MATERIAL_KINDS) {
      if (!geometriesPerKind.has(kind)) continue;
      
      const isWater = kind === 'water';
      const influence = TEXTURE_INFLUENCE[kind];
      
      // Check if we have a texture for this kind
      const tex = texturesEnabled && isReady ? textures.get(kind) : null;
      
      if (tex) {
        // Configure texture for smooth tiling (not nearest - reduces striping)
        tex.wrapS = THREE.RepeatWrapping;
        tex.wrapT = THREE.RepeatWrapping;
        tex.minFilter = THREE.LinearMipmapLinearFilter;
        tex.magFilter = THREE.LinearFilter;
        tex.anisotropy = 4;
        tex.needsUpdate = true;
        
        // Use vertex colors WITH texture multiplication
        // Vertex colors carry the base terrain color; texture modulates it
        // The material.color tints the texture; we use a gray to reduce texture contrast
        // This makes texture act like "paper grain" - felt, not seen
        const tintStrength = 0.5 + (1 - influence) * 0.5; // Higher influence = more texture color
        const tint = new THREE.Color(tintStrength, tintStrength, tintStrength);
        
        mats.set(kind, new THREE.MeshStandardMaterial({
          map: tex,
          color: tint,
          vertexColors: true, // Multiply texture with vertex colors!
          side: THREE.DoubleSide,
          roughness: isWater ? 0.25 : 0.85,
          metalness: isWater ? 0.15 : 0.05,
        }));
      } else {
        // Fallback: vertex colors only
        mats.set(kind, new THREE.MeshStandardMaterial({
          vertexColors: true,
          side: THREE.DoubleSide,
          roughness: isWater ? 0.25 : 0.85,
          metalness: isWater ? 0.15 : 0.05,
        }));
      }
    }
    
    return mats;
  }, [texturesEnabled, isReady, textures, geometriesPerKind]);

  // Render one mesh per material kind
  return (
    <group position={[0, 0, 0]}>
      {MATERIAL_KINDS.map((kind) => {
        const geo = geometriesPerKind.get(kind);
        const mat = materialsPerKind.get(kind);
        if (!geo || !mat) return null;
        return (
          <mesh key={kind} geometry={geo} material={mat} />
        );
      })}
    </group>
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
