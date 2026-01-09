import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { WorldData } from '@/lib/worldData';
import { WorldAction } from '@/lib/worldContract';

interface TerrainMeshProps {
  world: WorldData;
}

export function TerrainMesh({ world }: TerrainMeshProps) {
  const meshRef = useRef<THREE.Mesh>(null);
  
  const { geometry, colors } = useMemo(() => {
    const size = world.gridSize;
    const geometry = new THREE.PlaneGeometry(size, size, size - 1, size - 1);
    
    // Rotate to be horizontal
    geometry.rotateX(-Math.PI / 2);
    
    const positions = geometry.attributes.position;
    const colors = new Float32Array(positions.count * 3);
    
    for (let i = 0; i < positions.count; i++) {
      const x = Math.floor(i % size);
      const y = Math.floor(i / size);
      
      const cell = world.terrain[y]?.[x];
      if (cell) {
        // Set height
        positions.setY(i, cell.elevation * 20);
        
        // Set color based on terrain type
        let r: number, g: number, b: number;
        
        switch (cell.type) {
          case 'water':
            r = 0.2; g = 0.4; b = 0.6;
            break;
          case 'mountain':
            r = 0.4; g = 0.4; b = 0.45;
            break;
          case 'forest':
            r = 0.15; g = 0.35; b = 0.15;
            break;
          case 'path':
            r = 0.6; g = 0.5; b = 0.35; // Sandy/dirt path color - more visible
            break;
          case 'bridge':
            r = 0.45; g = 0.35; b = 0.25; // Wooden bridge color
            break;
          default: // ground
            r = 0.35; g = 0.3; b = 0.2;
        }
        
        // Add elevation-based variation
        const elevVar = cell.elevation * 0.15;
        colors[i * 3] = r + elevVar;
        colors[i * 3 + 1] = g + elevVar;
        colors[i * 3 + 2] = b + elevVar * 0.5;
      }
    }
    
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geometry.computeVertexNormals();
    
    return { geometry, colors };
  }, [world]);
  
  return (
    <mesh ref={meshRef} geometry={geometry} position={[world.gridSize / 2, 0, world.gridSize / 2]}>
      <meshLambertMaterial vertexColors side={THREE.DoubleSide} />
    </mesh>
  );
}

interface LandmarksProps {
  world: WorldData;
}

export function Landmarks({ world }: LandmarksProps) {
  const landmarks = useMemo(() => {
    const items: { x: number; y: number; z: number; type: number }[] = [];
    
    for (let y = 0; y < world.gridSize; y++) {
      for (let x = 0; x < world.gridSize; x++) {
        const cell = world.terrain[y][x];
        if (cell.hasLandmark) {
          items.push({
            x: x,
            y: cell.elevation * 20,
            z: y,
            type: cell.landmarkType
          });
        }
      }
    }
    
    return items;
  }, [world]);
  
  return (
    <group>
      {landmarks.map((landmark, i) => (
        <LandmarkObject key={i} {...landmark} />
      ))}
    </group>
  );
}

function LandmarkObject({ x, y, z, type }: { x: number; y: number; z: number; type: number }) {
  if (type === 0) {
    // Tree
    return (
      <group position={[x, y, z]}>
        <mesh position={[0, 0.3, 0]}>
          <cylinderGeometry args={[0.1, 0.15, 0.6, 6]} />
          <meshLambertMaterial color="#4a3728" />
        </mesh>
        <mesh position={[0, 1.2, 0]}>
          <coneGeometry args={[0.6, 1.5, 6]} />
          <meshLambertMaterial color="#1a4a1a" />
        </mesh>
      </group>
    );
  } else if (type === 1) {
    // Rock
    return (
      <mesh position={[x, y + 0.2, z]}>
        <dodecahedronGeometry args={[0.4, 0]} />
        <meshLambertMaterial color="#666666" />
      </mesh>
    );
  } else {
    // Bush
    return (
      <mesh position={[x, y + 0.25, z]}>
        <sphereGeometry args={[0.35, 8, 6]} />
        <meshLambertMaterial color="#2d5a2d" />
      </mesh>
    );
  }
}

interface BridgesProps {
  world: WorldData;
}

export function Bridges({ world }: BridgesProps) {
  const bridges = useMemo(() => {
    const items: { x: number; z: number; waterLevel: number }[] = [];
    const waterLevel = (world.vars[4] ?? 30) / 100 * 0.35 + 0.15;
    
    for (let y = 0; y < world.gridSize; y++) {
      for (let x = 0; x < world.gridSize; x++) {
        const cell = world.terrain[y][x];
        if (cell.type === 'bridge') {
          items.push({
            x: x,
            z: y,
            waterLevel: waterLevel * 20
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
  const bridgeHeight = waterLevel + 0.3; // Slightly above water
  
  return (
    <group position={[x, bridgeHeight, z]}>
      {/* Main plank */}
      <mesh>
        <boxGeometry args={[0.95, 0.1, 0.95]} />
        <meshLambertMaterial color="#6b4423" />
      </mesh>
      {/* Side rails */}
      <mesh position={[-0.4, 0.15, 0]}>
        <boxGeometry args={[0.05, 0.2, 0.9]} />
        <meshLambertMaterial color="#5a3a1a" />
      </mesh>
      <mesh position={[0.4, 0.15, 0]}>
        <boxGeometry args={[0.05, 0.2, 0.9]} />
        <meshLambertMaterial color="#5a3a1a" />
      </mesh>
      {/* Support posts at corners */}
      <mesh position={[-0.4, -0.3, -0.4]}>
        <cylinderGeometry args={[0.04, 0.04, 0.5, 6]} />
        <meshLambertMaterial color="#4a2a10" />
      </mesh>
      <mesh position={[0.4, -0.3, -0.4]}>
        <cylinderGeometry args={[0.04, 0.04, 0.5, 6]} />
        <meshLambertMaterial color="#4a2a10" />
      </mesh>
      <mesh position={[-0.4, -0.3, 0.4]}>
        <cylinderGeometry args={[0.04, 0.04, 0.5, 6]} />
        <meshLambertMaterial color="#4a2a10" />
      </mesh>
      <mesh position={[0.4, -0.3, 0.4]}>
        <cylinderGeometry args={[0.04, 0.04, 0.5, 6]} />
        <meshLambertMaterial color="#4a2a10" />
      </mesh>
    </group>
  );
}

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
      {/* Base glow */}
      <mesh position={[0, 0.1, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[1.5, 32]} />
        <meshBasicMaterial 
          color="#5ac4c4" 
          transparent 
          opacity={isDiscovered ? 0.4 : 0.15} 
        />
      </mesh>
      
      <ObjectMesh />
      
      {/* Discovery light */}
      {isDiscovered && (
        <pointLight position={[0, 3, 0]} color="#5ac4c4" intensity={glowIntensity} distance={15} />
      )}
    </group>
  );
}

interface GridOverlayProps {
  world: WorldData;
}

export function GridOverlay({ world }: GridOverlayProps) {
  const lines = useMemo(() => {
    const points: THREE.Vector3[] = [];
    const size = world.gridSize;
    const step = 4; // Grid every 4 units
    
    for (let i = 0; i <= size; i += step) {
      // X lines
      points.push(new THREE.Vector3(0, 0.1, i));
      points.push(new THREE.Vector3(size, 0.1, i));
      // Z lines
      points.push(new THREE.Vector3(i, 0.1, 0));
      points.push(new THREE.Vector3(i, 0.1, size));
    }
    
    return points;
  }, [world.gridSize]);
  
  const geometry = useMemo(() => {
    const geo = new THREE.BufferGeometry().setFromPoints(lines);
    return geo;
  }, [lines]);
  
  return (
    <lineSegments geometry={geometry}>
      <lineBasicMaterial color="#3a5a5a" transparent opacity={0.3} />
    </lineSegments>
  );
}

// Water plane
export function WaterPlane({ world }: { world: WorldData }) {
  const waterLevel = (world.vars[4] ?? 30) / 100 * 0.35 + 0.15;
  
  return (
    <mesh 
      position={[world.gridSize / 2, waterLevel * 20 - 0.5, world.gridSize / 2]} 
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

// Fog/atmosphere
export function Atmosphere() {
  return (
    <>
      <fog attach="fog" args={['#1a2a3a', 20, 80]} />
      <ambientLight intensity={0.4} />
      <directionalLight position={[50, 50, 25]} intensity={0.8} castShadow />
      <hemisphereLight args={['#6688aa', '#445566', 0.4]} />
    </>
  );
}
