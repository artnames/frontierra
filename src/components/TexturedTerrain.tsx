// Textured Terrain - 3D terrain mesh with procedural textures from @nexart/ui-renderer
// Replaces flat vertex colors with rich, deterministic textures.
// CRITICAL: All textures are deterministic - same inputs = same output.

import { useMemo, useRef, useEffect } from 'react';
import * as THREE from 'three';
import { WorldData, TerrainCell, getElevationAt } from '@/lib/worldData';
import { 
  WORLD_HEIGHT_SCALE, 
  getWaterLevel, 
  RIVER_DEPTH_OFFSET, 
  PATH_HEIGHT_OFFSET
} from '@/lib/worldConstants';
import { useWorldTextures } from '@/hooks/useWorldTextures';
import { MaterialKind, getMaterialKind } from '@/lib/materialRegistry';
import { WORLD_A_ID } from '@/lib/worldContext';

interface TexturedTerrainMeshProps {
  world: WorldData;
  worldX?: number;
  worldY?: number;
  texturesEnabled?: boolean;
}

// Get material index for each tile type (0-7 for texture array)
const MATERIAL_INDEX: Record<MaterialKind, number> = {
  ground: 0,
  forest: 1,
  mountain: 2,
  snow: 3,
  water: 4,
  path: 5,
  rock: 6,
  sand: 7
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
  sand: { r: 0.76, g: 0.62, b: 0.38 }
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
  seed: number
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
    return { r: (0.62 + microVar) * brightness * ao, g: (0.52 + microVar) * brightness * ao, b: (0.38 + microVar * 0.5) * brightness * ao };
  }

  const kind = getMaterialKind(type, elevation, moisture);
  const fallback = FALLBACK_COLORS[kind] || FALLBACK_COLORS.ground;
  
  return {
    r: (fallback.r + microVar) * brightness * ao,
    g: (fallback.g + microVar) * brightness * ao,
    b: (fallback.b + microVar) * brightness * ao
  };
}

export function TexturedTerrainMesh({ 
  world, 
  worldX = 0, 
  worldY = 0,
  texturesEnabled = true 
}: TexturedTerrainMeshProps) {
  const meshRef = useRef<THREE.Mesh>(null);
  
  // Load procedural textures
  const { textures, isReady } = useWorldTextures({
    worldX,
    worldY,
    seed: world.seed,
    vars: world.vars,
    enabled: texturesEnabled
  });
  
  const heightScale = WORLD_HEIGHT_SCALE;
  const waterLevel = getWaterLevel(world.vars);
  const waterHeight = waterLevel * heightScale;
  const riverDepth = waterHeight - RIVER_DEPTH_OFFSET;
  const pathMaxHeight = waterHeight + PATH_HEIGHT_OFFSET;
  
  // Build geometry with UVs and vertex colors
  const { geometry, materialIndices } = useMemo(() => {
    const size = world.gridSize;
    const geometry = new THREE.PlaneGeometry(size, size, size - 1, size - 1);
    geometry.rotateX(-Math.PI / 2);
    
    const positions = geometry.attributes.position;
    const colors = new Float32Array(positions.count * 3);
    const uvs = new Float32Array(positions.count * 2);
    const materialIndices = new Float32Array(positions.count);
    
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
        
        // Vertex colors for fallback/blending
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
        
        // UV coordinates - tile each cell with world-space offset for variety
        const tileScale = 4; // Repeat texture every 4 tiles
        uvs[i * 2] = (x + worldX * size) / tileScale;
        uvs[i * 2 + 1] = (flippedY + worldY * size) / tileScale;
        
        // Material kind for shader-based blending
        const kind = getMaterialKind(cell.type, cell.elevation, cell.moisture);
        materialIndices[i] = MATERIAL_INDEX[kind] ?? 0;
      }
    }
    
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geometry.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
    geometry.setAttribute('materialIndex', new THREE.BufferAttribute(materialIndices, 1));
    geometry.computeVertexNormals();
    
    return { geometry, materialIndices };
  }, [world, heightScale, waterHeight, riverDepth, pathMaxHeight, worldX, worldY]);
  
  // Create material - textures OR vertex colors, never both (multiplying causes dark/black)
  const material = useMemo(() => {
    // If textures disabled or not ready, use vertex colors only
    if (!texturesEnabled || !isReady) {
      return new THREE.MeshStandardMaterial({
        vertexColors: true,
        side: THREE.DoubleSide,
        roughness: 0.85,
        metalness: 0.05
      });
    }
    
    // Get primary terrain texture (ground as base)
    const groundTexture = textures.get('ground');
    
    if (!groundTexture) {
      // Fallback to vertex colors if texture failed
      return new THREE.MeshStandardMaterial({
        vertexColors: true,
        side: THREE.DoubleSide,
        roughness: 0.85,
        metalness: 0.05
      });
    }
    
    // Use texture ONLY (no vertex colors) - this prevents black multiplication
    return new THREE.MeshStandardMaterial({
      map: groundTexture,
      vertexColors: false, // CRITICAL: Don't multiply with vertex colors
      side: THREE.DoubleSide,
      roughness: 0.85,
      metalness: 0.05
    });
  }, [textures, isReady, texturesEnabled]);
  
  // Update material when textures change
  useEffect(() => {
    if (meshRef.current && material) {
      meshRef.current.material = material;
    }
  }, [material]);
  
  return (
    <mesh 
      ref={meshRef} 
      geometry={geometry} 
      position={[world.gridSize / 2, 0, world.gridSize / 2]}
    >
      <primitive object={material} attach="material" />
    </mesh>
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
