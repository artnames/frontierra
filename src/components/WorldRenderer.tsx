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
  
  // Height scale for converting 0-1 elevation (from Alpha channel) to world units
  const heightScale = 25;
  
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
        // Height DIRECTLY from Alpha channel (continuous 0-1)
        positions.setY(i, cell.elevation * heightScale);
        
        // Color derived from tile type (RGB categorical) with elevation-based brightness
        const { r, g, b } = getTileColor(cell.type, cell.elevation, cell.moisture);
        
        colors[i * 3] = r;
        colors[i * 3 + 1] = g;
        colors[i * 3 + 2] = b;
      }
    }
    
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geometry.computeVertexNormals();
    
    return { geometry };
  }, [world, heightScale]);
  
  return (
    <mesh ref={meshRef} geometry={geometry} position={[world.gridSize / 2, 0, world.gridSize / 2]}>
      <meshLambertMaterial vertexColors side={THREE.DoubleSide} />
    </mesh>
  );
}

// Get tile color from categorical type (RGB) with elevation brightness modulation
// Color is based on NexArt tile type, not recalculated from elevation
function getTileColor(
  type: TerrainCell['type'], 
  elevation: number,
  moisture: number
): { r: number; g: number; b: number } {
  // Brightness based on elevation (from Alpha channel)
  const brightness = 0.8 + elevation * 0.4;
  
  switch (type) {
    case 'water':
      // Blue gradient based on elevation (depth)
      const depth = elevation;
      return {
        r: (0.12 + depth * 0.08) * brightness,
        g: (0.24 + depth * 0.16) * brightness,
        b: (0.45 + depth * 0.10) * brightness
      };
      
    case 'forest':
      // Green with moisture influence
      const moist = moisture * 0.3;
      return {
        r: (0.18 + moist * 0.05) * brightness,
        g: (0.40 + moist * 0.15) * brightness,
        b: (0.16 + moist * 0.08) * brightness
      };
      
    case 'mountain':
      // Gray/brown rock that lightens with height, snow at peaks
      const heightFactor = elevation * 0.3;
      const isSnow = elevation > 0.75;
      if (isSnow) {
        return {
          r: 0.92 * brightness,
          g: 0.95 * brightness,
          b: 0.98 * brightness
        };
      }
      return {
        r: (0.40 + heightFactor) * brightness,
        g: (0.38 + heightFactor) * brightness,
        b: (0.36 + heightFactor) * brightness
      };
      
    case 'path':
      // Light brown
      return {
        r: 0.65 * brightness,
        g: 0.55 * brightness,
        b: 0.40 * brightness
      };
      
    case 'bridge':
      // Dark brown wood
      return {
        r: 0.45 * brightness,
        g: 0.30 * brightness,
        b: 0.18 * brightness
      };
      
    case 'ground':
    default:
      // Tan/earthy with moisture variation
      const groundMoist = moisture * 0.2;
      return {
        r: (0.55 - groundMoist * 0.1) * brightness,
        g: (0.48 + groundMoist * 0.08) * brightness,
        b: (0.32 + groundMoist * 0.05) * brightness
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
  const heightScale = 25;
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
  const heightScale = 25;
  // Water level mapping: VAR[4] 0=0.15, 50=0.40, 100=0.65
  const waterLevel = (world.vars[4] ?? 50) / 100 * 0.50 + 0.15;
  
  return (
    <mesh 
      position={[world.gridSize / 2, waterLevel * heightScale - 0.5, world.gridSize / 2]} 
      rotation={[-Math.PI / 2, 0, 0]}
    >
      <planeGeometry args={[world.gridSize, world.gridSize]} />
      <meshStandardMaterial 
        color="#2a5a7a" 
        transparent 
        opacity={0.6}
        metalness={0.2}
        roughness={0.3}
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
      <fog attach="fog" args={['#1a2a3a', 30, 120]} />
      <ambientLight intensity={0.4} />
      <directionalLight position={[50, 50, 25]} intensity={0.8} castShadow />
      <hemisphereLight args={['#6688aa', '#445566', 0.4]} />
    </>
  );
}
