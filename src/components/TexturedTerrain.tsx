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

// Custom shader for texture-modulated vertex colors
// This is the KEY fix: vertex colors are multiplied by texture luminance in fragment shader
function createTexturedMaterial(
  texture: THREE.Texture | null,
  influence: number,
  isWater: boolean
): THREE.ShaderMaterial {
  const vertexShader = `
    varying vec2 vUv;
    varying vec3 vColor;
    varying vec3 vNormal;
    varying vec3 vWorldPosition;
    
    void main() {
      vUv = uv;
      vColor = color;
      vNormal = normalize(normalMatrix * normal);
      vec4 worldPos = modelMatrix * vec4(position, 1.0);
      vWorldPosition = worldPos.xyz;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `;

  const fragmentShader = `
    uniform sampler2D map;
    uniform float textureInfluence;
    uniform vec3 lightDirection;
    uniform vec3 ambientColor;
    uniform vec3 lightColor;
    uniform vec3 fogColor;
    uniform float fogNear;
    uniform float fogFar;
    uniform bool useFog;
    
    varying vec2 vUv;
    varying vec3 vColor;
    varying vec3 vNormal;
    varying vec3 vWorldPosition;
    
    void main() {
      // Sample texture and convert to luminance (grayscale)
      vec4 texColor = texture2D(map, vUv);
      float texLuminance = dot(texColor.rgb, vec3(0.299, 0.587, 0.114));
      
      // Modulate base vertex color with texture luminance
      // Formula: finalColor = baseColor * mix(1.0, texLuminance, influence)
      // This makes texture act like paper grain - felt, not seen
      float modulator = mix(1.0, texLuminance, textureInfluence);
      vec3 baseColor = vColor * modulator;
      
      // Simple directional lighting (Lambert)
      float NdotL = max(dot(vNormal, lightDirection), 0.0);
      vec3 diffuse = baseColor * lightColor * NdotL;
      vec3 ambient = baseColor * ambientColor;
      vec3 finalColor = ambient + diffuse;
      
      // Apply fog if enabled
      if (useFog) {
        float depth = gl_FragCoord.z / gl_FragCoord.w;
        float fogFactor = smoothstep(fogNear, fogFar, depth);
        finalColor = mix(finalColor, fogColor, fogFactor);
      }
      
      // Output with gamma correction for sRGB
      finalColor = pow(finalColor, vec3(1.0 / 2.2));
      
      gl_FragColor = vec4(finalColor, 1.0);
    }
  `;

  // Create a 1x1 white texture as fallback if no texture provided
  const fallbackTexture = new THREE.DataTexture(
    new Uint8Array([255, 255, 255, 255]),
    1, 1,
    THREE.RGBAFormat
  );
  fallbackTexture.needsUpdate = true;

  const mat = new THREE.ShaderMaterial({
    vertexShader,
    fragmentShader,
    uniforms: {
      map: { value: texture || fallbackTexture },
      textureInfluence: { value: texture ? influence : 0.0 },
      lightDirection: { value: new THREE.Vector3(0.5, 0.8, 0.3).normalize() },
      ambientColor: { value: new THREE.Color(0.45, 0.45, 0.5) },
      lightColor: { value: new THREE.Color(0.9, 0.88, 0.85) },
      fogColor: { value: new THREE.Color(0.75, 0.85, 0.95) },
      fogNear: { value: 50.0 },
      fogFar: { value: 200.0 },
      useFog: { value: true },
    },
    vertexColors: true,
    side: THREE.DoubleSide,
  });

  // Disable tone mapping to keep colors consistent
  mat.toneMapped = false;

  return mat;
}

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

  // Create custom ShaderMaterials per kind
  const materialsPerKind = useMemo(() => {
    const mats: Map<MaterialKind, THREE.ShaderMaterial> = new Map();
    
    for (const kind of MATERIAL_KINDS) {
      if (!geometriesPerKind.has(kind)) continue;
      
      const isWater = kind === 'water';
      const influence = TEXTURE_INFLUENCE[kind];
      
      const tex = texturesEnabled && isReady ? textures.get(kind) : null;
      
      if (tex) {
        tex.wrapS = THREE.RepeatWrapping;
        tex.wrapT = THREE.RepeatWrapping;
        tex.minFilter = THREE.LinearMipmapLinearFilter;
        tex.magFilter = THREE.LinearFilter;
        tex.anisotropy = 4;
        tex.needsUpdate = true;
      }
      
      mats.set(kind, createTexturedMaterial(tex, influence, isWater));
    }
    
    return mats;
  }, [texturesEnabled, isReady, textures, geometriesPerKind]);

  return (
    <group position={[0, 0, 0]}>
      {MATERIAL_KINDS.map((kind) => {
        const geo = geometriesPerKind.get(kind);
        const mat = materialsPerKind.get(kind);
        if (!geo || !mat) return null;
        return <mesh key={kind} geometry={geo} material={mat} />;
      })}
    </group>
  );
}


// Simple fallback terrain (vertex colors only) for when textures are disabled
// Uses the same explicit vertex positioning as TexturedTerrainMesh for alignment
export function SimpleTerrainMesh({ world }: { world: WorldData }) {
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
    <mesh ref={meshRef} geometry={geometry} position={[0, 0, 0]}>
      <meshStandardMaterial vertexColors side={THREE.DoubleSide} roughness={0.85} metalness={0.05} />
    </mesh>
  );
}
