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
  
  // Height scale for converting 0-1 elevation to world units
  const heightScale = 15;
  const waterThreshold = (world.vars[4] ?? 30) / 100 * 0.20 + 0.28;
  
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
        // Height DIRECTLY from continuous elevation (Red channel)
        // No categorical adjustments - pure heightfield interpretation
        positions.setY(i, cell.elevation * heightScale);
        
        // Color derived from elevation + moisture (continuous gradient)
        const { r, g, b } = getContinuousTerrainColor(cell.elevation, cell.moisture, waterThreshold);
        
        colors[i * 3] = r;
        colors[i * 3 + 1] = g;
        colors[i * 3 + 2] = b;
      }
    }
    
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geometry.computeVertexNormals();
    
    return { geometry };
  }, [world, heightScale, waterThreshold]);
  
  return (
    <mesh ref={meshRef} geometry={geometry} position={[world.gridSize / 2, 0, world.gridSize / 2]}>
      <meshLambertMaterial vertexColors side={THREE.DoubleSide} />
    </mesh>
  );
}

// Continuous color gradient based on elevation and moisture
// No categorical "biome painting" - pure gradient interpretation
function getContinuousTerrainColor(
  elevation: number, 
  moisture: number, 
  waterThreshold: number
): { r: number; g: number; b: number } {
  
  // Water gradient (deep to shallow)
  if (elevation < waterThreshold) {
    const depth = elevation / waterThreshold;
    return {
      r: 0.08 + depth * 0.12,
      g: 0.25 + depth * 0.18,
      b: 0.45 + depth * 0.15
    };
  }
  
  // Land: continuous gradient from lowlands to peaks
  const landFraction = (elevation - waterThreshold) / (1 - waterThreshold);
  
  // Coastal/lowland (green-brown based on moisture)
  if (landFraction < 0.25) {
    const t = landFraction / 0.25;
    const moistureInfluence = moisture * 0.4;
    return {
      r: 0.28 - moistureInfluence * 0.1 + t * 0.08,
      g: 0.35 + moistureInfluence * 0.15 + t * 0.05,
      b: 0.18 + moistureInfluence * 0.05
    };
  }
  
  // Midlands/hills (transition zone)
  if (landFraction < 0.55) {
    const t = (landFraction - 0.25) / 0.30;
    const moistureInfluence = moisture * 0.3;
    return {
      r: 0.36 - moistureInfluence * 0.08 + t * 0.12,
      g: 0.40 + moistureInfluence * 0.1 - t * 0.05,
      b: 0.22 + t * 0.08
    };
  }
  
  // Highlands/mountains (rock and snow gradient)
  const t = (landFraction - 0.55) / 0.45;
  const snowLine = 0.75;
  
  if (t > snowLine) {
    // Snow caps
    const snowT = (t - snowLine) / (1 - snowLine);
    return {
      r: 0.65 + snowT * 0.30,
      g: 0.68 + snowT * 0.27,
      b: 0.72 + snowT * 0.23
    };
  }
  
  // Rocky mountain
  return {
    r: 0.42 + t * 0.20,
    g: 0.40 + t * 0.22,
    b: 0.38 + t * 0.28
  };
}

// ============================================
// LANDMARKS - From NexArt Alpha channel
// ============================================

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
            x,
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

// Landmark types:
// 0 = Ruins (crumbling stone walls)
// 1 = Crystal cluster (glowing gems)
// 2 = Ancient Tree (massive twisted tree)
// 3 = Stone Circle (standing stones)
// 4 = Obelisk (tall carved pillar)

function LandmarkObject({ x, y, z, type }: { x: number; y: number; z: number; type: number }) {
  if (type === 0) {
    // Ruins - crumbling stone walls and pillars
    return (
      <group position={[x, y, z]}>
        {/* Broken wall section */}
        <mesh position={[0, 0.4, 0]} rotation={[0, 0.3, 0.1]}>
          <boxGeometry args={[0.8, 0.8, 0.2]} />
          <meshLambertMaterial color="#7a7068" />
        </mesh>
        {/* Fallen pillar */}
        <mesh position={[0.3, 0.15, 0.3]} rotation={[0.4, 0.2, 1.4]}>
          <cylinderGeometry args={[0.12, 0.15, 0.7, 6]} />
          <meshLambertMaterial color="#8a8078" />
        </mesh>
        {/* Standing partial pillar */}
        <mesh position={[-0.35, 0.5, -0.1]}>
          <cylinderGeometry args={[0.1, 0.12, 1.0, 6]} />
          <meshLambertMaterial color="#6a6058" />
        </mesh>
        {/* Rubble */}
        <mesh position={[0.15, 0.1, -0.2]}>
          <dodecahedronGeometry args={[0.15, 0]} />
          <meshLambertMaterial color="#5a5048" />
        </mesh>
        <mesh position={[-0.2, 0.08, 0.25]}>
          <dodecahedronGeometry args={[0.12, 0]} />
          <meshLambertMaterial color="#6a6258" />
        </mesh>
      </group>
    );
  } else if (type === 1) {
    // Crystal cluster - glowing gem formation
    return (
      <group position={[x, y, z]}>
        {/* Central large crystal */}
        <mesh position={[0, 0.6, 0]} rotation={[0.1, 0, 0.15]}>
          <octahedronGeometry args={[0.4, 0]} />
          <meshStandardMaterial 
            color="#66aaff" 
            emissive="#4488dd" 
            emissiveIntensity={0.4}
            transparent
            opacity={0.85}
          />
        </mesh>
        {/* Side crystals */}
        <mesh position={[0.25, 0.35, 0.1]} rotation={[0.2, 0.5, 0.3]}>
          <octahedronGeometry args={[0.22, 0]} />
          <meshStandardMaterial 
            color="#88ccff" 
            emissive="#6699cc" 
            emissiveIntensity={0.3}
            transparent
            opacity={0.8}
          />
        </mesh>
        <mesh position={[-0.2, 0.3, -0.15]} rotation={[-0.15, -0.3, -0.2]}>
          <octahedronGeometry args={[0.18, 0]} />
          <meshStandardMaterial 
            color="#99ddff" 
            emissive="#77aacc" 
            emissiveIntensity={0.35}
            transparent
            opacity={0.8}
          />
        </mesh>
        <mesh position={[0.1, 0.25, -0.25]} rotation={[0.3, 0.1, 0.1]}>
          <octahedronGeometry args={[0.15, 0]} />
          <meshStandardMaterial 
            color="#aaeeff" 
            emissive="#88bbdd" 
            emissiveIntensity={0.3}
            transparent
            opacity={0.75}
          />
        </mesh>
        {/* Glow light */}
        <pointLight position={[0, 0.5, 0]} color="#66aaff" intensity={0.8} distance={4} />
      </group>
    );
  } else if (type === 2) {
    // Ancient Tree - massive gnarled tree
    return (
      <group position={[x, y, z]}>
        {/* Thick trunk */}
        <mesh position={[0, 0.6, 0]}>
          <cylinderGeometry args={[0.25, 0.4, 1.2, 8]} />
          <meshLambertMaterial color="#3d2817" />
        </mesh>
        {/* Root bulges */}
        <mesh position={[0.25, 0.15, 0.15]} rotation={[0.3, 0, 0.5]}>
          <cylinderGeometry args={[0.08, 0.15, 0.4, 5]} />
          <meshLambertMaterial color="#4a3520" />
        </mesh>
        <mesh position={[-0.2, 0.12, -0.2]} rotation={[-0.4, 0, -0.6]}>
          <cylinderGeometry args={[0.06, 0.12, 0.35, 5]} />
          <meshLambertMaterial color="#3a2515" />
        </mesh>
        {/* Main canopy */}
        <mesh position={[0, 1.8, 0]}>
          <sphereGeometry args={[0.9, 8, 6]} />
          <meshLambertMaterial color="#1a3a15" />
        </mesh>
        {/* Secondary foliage */}
        <mesh position={[0.4, 1.5, 0.3]}>
          <sphereGeometry args={[0.5, 6, 5]} />
          <meshLambertMaterial color="#254a20" />
        </mesh>
        <mesh position={[-0.35, 1.4, -0.25]}>
          <sphereGeometry args={[0.45, 6, 5]} />
          <meshLambertMaterial color="#1f4018" />
        </mesh>
        {/* Hanging vines */}
        <mesh position={[0.5, 1.0, 0]} rotation={[0, 0, 0.2]}>
          <cylinderGeometry args={[0.02, 0.02, 0.8, 4]} />
          <meshLambertMaterial color="#2a5a25" />
        </mesh>
      </group>
    );
  } else if (type === 3) {
    // Stone Circle - ancient standing stones
    return (
      <group position={[x, y, z]}>
        {/* Center altar stone */}
        <mesh position={[0, 0.15, 0]}>
          <boxGeometry args={[0.5, 0.3, 0.5]} />
          <meshLambertMaterial color="#5a5a58" />
        </mesh>
        {/* Standing stones in circle */}
        {[0, 1, 2, 3, 4].map((i) => {
          const angle = (i / 5) * Math.PI * 2;
          const radius = 0.7;
          const height = 0.6 + (i % 2) * 0.3;
          return (
            <mesh 
              key={i}
              position={[Math.cos(angle) * radius, height / 2, Math.sin(angle) * radius]}
              rotation={[0, -angle + 0.1, 0.05 * (i - 2)]}
            >
              <boxGeometry args={[0.15, height, 0.1]} />
              <meshLambertMaterial color={i % 2 === 0 ? "#6a6a68" : "#5a5855"} />
            </mesh>
          );
        })}
        {/* Mystical glow at center */}
        <mesh position={[0, 0.35, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <circleGeometry args={[0.3, 16]} />
          <meshBasicMaterial color="#558855" transparent opacity={0.3} />
        </mesh>
      </group>
    );
  } else {
    // Obelisk - tall carved stone pillar
    return (
      <group position={[x, y, z]}>
        {/* Base platform */}
        <mesh position={[0, 0.1, 0]}>
          <boxGeometry args={[0.6, 0.2, 0.6]} />
          <meshLambertMaterial color="#4a4a48" />
        </mesh>
        {/* Main pillar - tapered */}
        <mesh position={[0, 1.0, 0]}>
          <boxGeometry args={[0.25, 1.6, 0.25]} />
          <meshLambertMaterial color="#3a3a38" />
        </mesh>
        {/* Pyramid cap */}
        <mesh position={[0, 1.9, 0]}>
          <coneGeometry args={[0.2, 0.3, 4]} />
          <meshStandardMaterial 
            color="#c4a860" 
            emissive="#a08040" 
            emissiveIntensity={0.2}
          />
        </mesh>
        {/* Carved patterns (decorative rings) */}
        <mesh position={[0, 0.5, 0]}>
          <torusGeometry args={[0.18, 0.03, 6, 4]} />
          <meshLambertMaterial color="#5a5a58" />
        </mesh>
        <mesh position={[0, 1.3, 0]}>
          <torusGeometry args={[0.16, 0.025, 6, 4]} />
          <meshLambertMaterial color="#5a5a58" />
        </mesh>
      </group>
    );
  }
}

// ============================================
// BRIDGES - From NexArt Blue channel (bridge biome)
// ============================================

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
            x,
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

// ============================================
// ATMOSPHERE
// ============================================

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
