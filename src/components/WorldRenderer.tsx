// World Renderer - 3D Projection of NexArt Canonical Layout
// CRITICAL: All rendering is derived from NexArt pixel data.
// No noise functions, no random, no independent generation.

import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { WorldData, TerrainCell } from '@/lib/worldData';

// ============================================
// TERRAIN MESH - Derived from NexArt elevation
// ============================================

interface TerrainMeshProps {
  world: WorldData;
}

export function TerrainMesh({ world }: TerrainMeshProps) {
  const meshRef = useRef<THREE.Mesh>(null);
  
  // Height scale matches worldData.ts (increased for dramatic terrain)
  const heightScale = 35;
  
  // Water level mapping: VAR[4] 0=0.15, 50=0.40, 100=0.65
  const waterLevel = (world.vars[4] ?? 50) / 100 * 0.50 + 0.15;
  const waterHeight = waterLevel * heightScale;
  
  // River depth below water level
  const riverDepth = waterHeight - 1.5;
  
  // Path height - slightly above water to be visible
  const pathMaxHeight = waterHeight + 0.8;
  
  const { geometry } = useMemo(() => {
    const size = world.gridSize;
    const geometry = new THREE.PlaneGeometry(size, size, size - 1, size - 1);
    
    geometry.rotateX(-Math.PI / 2);
    
    const positions = geometry.attributes.position;
    const colors = new Float32Array(positions.count * 3);
    
    for (let i = 0; i < positions.count; i++) {
      const x = Math.floor(i % size);
      const y = Math.floor(i / size);
      
      const cell = world.terrain[y]?.[x];
      if (cell) {
        // Base height from ALREADY CURVED elevation
        let height = cell.elevation * heightScale;
        
        // Rivers carve DOWN into terrain - visible depression
        if (cell.hasRiver) {
          height = Math.min(height, riverDepth);
        }
        
        // Paths flatten terrain for walkability - clamp to max path height
        if (cell.isPath && !cell.isBridge) {
          height = Math.min(height, pathMaxHeight);
        }
        
        positions.setY(i, height);
        
        // Color derived from tile type (RGB categorical) with enhanced shading
        const { r, g, b } = getTileColor(cell.type, cell.elevation, cell.moisture, cell.hasRiver, cell.isPath);
        
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

// Get tile color from categorical type (RGB) with perceptual shading
// Uses curved elevation for natural light distribution
// Color is based on NexArt tile type, not recalculated from elevation
function getTileColor(
  type: TerrainCell['type'], 
  elevation: number, // Already curved elevation from worldData
  moisture: number,
  hasRiver: boolean = false,
  isPath: boolean = false
): { r: number; g: number; b: number } {
  // Enhanced brightness curve - high elevations catch more light
  const baseBrightness = 0.65;
  const elevationLight = Math.pow(elevation, 0.7) * 0.5;
  const brightness = baseBrightness + elevationLight;
  
  // Ambient occlusion simulation - low areas slightly darker
  const ao = 0.9 + elevation * 0.1;
  
  // Rivers get distinct color regardless of underlying tile type
  if (hasRiver) {
    return {
      r: 0.18,
      g: 0.45,
      b: 0.55
    };
  }
  
  // Paths get distinct color for visibility
  if (isPath && type !== 'bridge') {
    return {
      r: 0.62 * brightness * ao,
      g: 0.52 * brightness * ao,
      b: 0.38 * brightness * ao
    };
  }
  
  switch (type) {
    case 'water':
      // Water stays dark and flat - minimal elevation influence
      const depth = Math.max(0, 1 - elevation * 2);
      return {
        r: 0.08 + depth * 0.04,
        g: 0.18 + depth * 0.06,
        b: 0.35 + depth * 0.1
      };
      
    case 'forest':
      // Darker forests with strong moisture influence
      const forestDark = 0.7 + elevation * 0.3;
      const moist = moisture * 0.4;
      return {
        r: (0.12 + moist * 0.02) * forestDark * ao,
        g: (0.32 + moist * 0.18) * forestDark * ao,
        b: (0.10 + moist * 0.05) * forestDark * ao
      };
      
    case 'mountain':
      // Enhanced mountain shading with dramatic height variation
      const isSnow = elevation > 0.65;
      const isHighSnow = elevation > 0.8;
      
      if (isHighSnow) {
        return {
          r: 0.95 * brightness,
          g: 0.97 * brightness,
          b: 1.0 * brightness
        };
      } else if (isSnow) {
        const snowMix = (elevation - 0.65) / 0.15;
        return {
          r: (0.45 + snowMix * 0.45) * brightness,
          g: (0.43 + snowMix * 0.50) * brightness,
          b: (0.42 + snowMix * 0.55) * brightness
        };
      }
      
      const rockHeight = elevation * 0.4;
      return {
        r: (0.32 + rockHeight) * brightness * ao,
        g: (0.30 + rockHeight) * brightness * ao,
        b: (0.28 + rockHeight) * brightness * ao
      };
      
    case 'path':
      return {
        r: 0.58 * brightness * ao,
        g: 0.48 * brightness * ao,
        b: 0.35 * brightness * ao
      };
      
    case 'bridge':
      return {
        r: 0.40 * brightness,
        g: 0.28 * brightness,
        b: 0.16 * brightness
      };
      
    case 'ground':
    default:
      const groundMoist = moisture * 0.3;
      return {
        r: (0.50 - groundMoist * 0.15) * brightness * ao,
        g: (0.44 + groundMoist * 0.12) * brightness * ao,
        b: (0.28 + groundMoist * 0.04) * brightness * ao
      };
  }
}

// ============================================
// BRIDGES - From NexArt Blue channel (bridge biome)
// ============================================

interface BridgesProps {
  world: WorldData;
}

export function Bridges({ world }: BridgesProps) {
  const heightScale = 35; // Match updated height scale
  const bridges = useMemo(() => {
    const items: { x: number; z: number; waterLevel: number }[] = [];
    // Water level mapping: VAR[4] 0=0.15, 50=0.40, 100=0.65
    const waterLevel = (world.vars[4] ?? 50) / 100 * 0.50 + 0.15;
    
    for (let y = 0; y < world.gridSize; y++) {
      for (let x = 0; x < world.gridSize; x++) {
        const cell = world.terrain[y][x];
        if (cell.type === 'bridge') {
          items.push({
            x,
            z: y,
            waterLevel: waterLevel * heightScale
          });
        }
      }
    }
    
    return items;
  }, [world]);
  
  return (
    <group>
      {bridges.map((bridge, i) => (
        <BridgePlank key={i} x={bridge.x} z={bridge.z} waterLevel={bridge.waterLevel} />
      ))}
    </group>
  );
}

function BridgePlank({ x, z, waterLevel }: { x: number; z: number; waterLevel: number }) {
  const bridgeHeight = waterLevel + 0.5;
  
  return (
    <group position={[x, bridgeHeight, z]}>
      <mesh>
        <boxGeometry args={[1.0, 0.15, 1.0]} />
        <meshLambertMaterial color="#6b4423" />
      </mesh>
      <mesh position={[0, -0.2, 0]}>
        <boxGeometry args={[0.15, 0.25, 0.8]} />
        <meshLambertMaterial color="#4a2a10" />
      </mesh>
    </group>
  );
}

// ============================================
// PLANTED OBJECT - From NexArt Alpha = 1
// ============================================

interface PlantedObjectProps {
  world: WorldData;
  isDiscovered: boolean;
}

export function PlantedObject({ world, isDiscovered }: PlantedObjectProps) {
  const { x, y, z, type } = world.plantedObject;
  const glowIntensity = isDiscovered ? 2 : 0.5;
  
  const ObjectMesh = () => {
    switch (type) {
      case 0: // Tower
        return (
          <group>
            <mesh position={[0, 1.5, 0]}>
              <boxGeometry args={[0.8, 3, 0.8]} />
              <meshStandardMaterial 
                color="#c4a35a" 
                emissive="#c4a35a" 
                emissiveIntensity={isDiscovered ? 0.3 : 0} 
              />
            </mesh>
            <mesh position={[0, 3.3, 0]}>
              <coneGeometry args={[0.6, 0.8, 4]} />
              <meshStandardMaterial 
                color="#d4b36a" 
                emissive="#d4b36a" 
                emissiveIntensity={isDiscovered ? 0.4 : 0} 
              />
            </mesh>
          </group>
        );
      case 1: // Crystal
        return (
          <mesh position={[0, 1.5, 0]} rotation={[0, Math.PI / 4, 0]}>
            <octahedronGeometry args={[1, 0]} />
            <meshStandardMaterial 
              color="#9966ff" 
              emissive="#9966ff" 
              emissiveIntensity={isDiscovered ? 0.5 : 0.1}
              transparent
              opacity={0.85}
            />
          </mesh>
        );
      case 2: // Monument
        return (
          <group>
            <mesh position={[0, 1, 0]}>
              <boxGeometry args={[1.2, 2, 1.2]} />
              <meshStandardMaterial 
                color="#7a7a8a" 
                emissive="#5ac4c4" 
                emissiveIntensity={isDiscovered ? 0.2 : 0} 
              />
            </mesh>
            <mesh position={[0, 2.3, 0]}>
              <sphereGeometry args={[0.4, 16, 16]} />
              <meshStandardMaterial 
                color="#5ac4c4" 
                emissive="#5ac4c4" 
                emissiveIntensity={isDiscovered ? 0.8 : 0.2} 
              />
            </mesh>
          </group>
        );
      case 3: // Flag
        return (
          <group>
            <mesh position={[0, 2, 0]}>
              <cylinderGeometry args={[0.05, 0.05, 4, 8]} />
              <meshLambertMaterial color="#5a4a3a" />
            </mesh>
            <mesh position={[0.4, 3.2, 0]}>
              <boxGeometry args={[0.8, 0.5, 0.05]} />
              <meshStandardMaterial 
                color="#cc3333" 
                emissive="#cc3333" 
                emissiveIntensity={isDiscovered ? 0.4 : 0} 
              />
            </mesh>
          </group>
        );
      default: // Beacon
        return (
          <group>
            <mesh position={[0, 0.6, 0]}>
              <cylinderGeometry args={[0.5, 0.6, 1.2, 8]} />
              <meshLambertMaterial color="#5a5a4a" />
            </mesh>
            <mesh position={[0, 1.5, 0]}>
              <sphereGeometry args={[0.5, 16, 16]} />
              <meshStandardMaterial 
                color="#5ac4c4" 
                emissive="#5ac4c4" 
                emissiveIntensity={isDiscovered ? 1 : 0.3} 
              />
            </mesh>
            {isDiscovered && (
              <pointLight position={[0, 1.5, 0]} color="#5ac4c4" intensity={5} distance={10} />
            )}
          </group>
        );
    }
  };
  
  return (
    <group position={[x, y, z]}>
      <mesh position={[0, 0.1, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[1.5, 32]} />
        <meshBasicMaterial 
          color="#5ac4c4" 
          transparent 
          opacity={isDiscovered ? 0.4 : 0.15} 
        />
      </mesh>
      
      <ObjectMesh />
      
      {isDiscovered && (
        <pointLight position={[0, 3, 0]} color="#5ac4c4" intensity={glowIntensity} distance={15} />
      )}
    </group>
  );
}

// ============================================
// GRID OVERLAY
// ============================================

interface GridOverlayProps {
  world: WorldData;
}

export function GridOverlay({ world }: GridOverlayProps) {
  const lines = useMemo(() => {
    const points: THREE.Vector3[] = [];
    const size = world.gridSize;
    const step = 4;
    
    for (let i = 0; i <= size; i += step) {
      points.push(new THREE.Vector3(0, 0.1, i));
      points.push(new THREE.Vector3(size, 0.1, i));
      points.push(new THREE.Vector3(i, 0.1, 0));
      points.push(new THREE.Vector3(i, 0.1, size));
    }
    
    return points;
  }, [world.gridSize]);
  
  const geometry = useMemo(() => {
    return new THREE.BufferGeometry().setFromPoints(lines);
  }, [lines]);
  
  return (
    <lineSegments geometry={geometry}>
      <lineBasicMaterial color="#3a5a5a" transparent opacity={0.3} />
    </lineSegments>
  );
}

// ============================================
// WATER PLANE
// ============================================

export function WaterPlane({ world }: { world: WorldData }) {
  const heightScale = 35;
  // Water level mapping: VAR[4] 0=0.15, 50=0.40, 100=0.65
  const waterLevel = (world.vars[4] ?? 50) / 100 * 0.50 + 0.15;
  
  // Calculate water plane height from actual water cells only
  // This ensures water stays in oceans/lakes and doesn't flood terrain
  const waterPlaneHeight = useMemo(() => {
    let waterCellCount = 0;
    let avgWaterElevation = 0;
    let maxNonWaterElevation = 0;
    
    for (const row of world.terrain) {
      for (const cell of row) {
        if (cell.type === 'water') {
          avgWaterElevation += cell.elevation;
          waterCellCount++;
        } else if (cell.type !== 'bridge') {
          // Track lowest non-water elevation for clamping
          if (maxNonWaterElevation === 0 || cell.elevation < maxNonWaterElevation) {
            maxNonWaterElevation = cell.elevation;
          }
        }
      }
    }
    
    if (waterCellCount === 0) {
      // No water in world - place plane below all terrain
      return maxNonWaterElevation * heightScale - 2;
    }
    
    avgWaterElevation = avgWaterElevation / waterCellCount;
    
    // Water plane at average water cell elevation
    // Clamped to never exceed the lowest non-water terrain
    const baseHeight = avgWaterElevation * heightScale;
    const maxHeight = maxNonWaterElevation * heightScale - 0.5;
    
    return Math.min(baseHeight, maxHeight);
  }, [world.terrain, heightScale]);
  
  return (
    <mesh 
      position={[world.gridSize / 2, waterPlaneHeight, world.gridSize / 2]} 
      rotation={[-Math.PI / 2, 0, 0]}
    >
      <planeGeometry args={[world.gridSize, world.gridSize]} />
      <meshStandardMaterial 
        color="#1a4a6a" 
        transparent 
        opacity={0.65}
        metalness={0.15}
        roughness={0.25}
      />
    </mesh>
  );
}

// ============================================
// ATMOSPHERE
// ============================================

export function Atmosphere() {
  return (
    <>
      <fog attach="fog" args={['#1a2a3a', 40, 150]} />
      <ambientLight intensity={0.35} />
      <directionalLight position={[60, 80, 30]} intensity={1.0} castShadow />
      <hemisphereLight args={['#88aacc', '#334455', 0.5]} />
    </>
  );
}
