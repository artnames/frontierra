// World Renderer - 3D Projection of NexArt Canonical Layout
// CRITICAL: All rendering is derived from NexArt pixel data.
// No noise functions, no random, no independent generation.

import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { WorldData, TerrainCell, getElevationAt } from '@/lib/worldData';
import { 
  WORLD_HEIGHT_SCALE, 
  getWaterLevel, 
  RIVER_DEPTH_OFFSET, 
  PATH_HEIGHT_OFFSET, 
  BRIDGE_FIXED_HEIGHT 
} from '@/lib/worldConstants';
import { 
  getTimeOfDay, 
  getLightingParams,
  isNight,
  isTwilight,
  TimeOfDayContext
} from '@/lib/timeOfDay';
import { WORLD_A_ID } from '@/lib/worldContext';

// ============================================
// TERRAIN MESH - Derived from NexArt elevation
// ============================================

interface TerrainMeshProps {
  world: WorldData;
}

export function TerrainMesh({ world }: TerrainMeshProps) {
  const meshRef = useRef<THREE.Mesh>(null);
  
  // Use shared height scale constant
  const heightScale = WORLD_HEIGHT_SCALE;
  
  // Water level from shared function
  const waterLevel = getWaterLevel(world.vars);
  const waterHeight = waterLevel * heightScale;
  
  // River depth below water level
  const riverDepth = waterHeight - RIVER_DEPTH_OFFSET;
  
  // Path height - slightly above water to be visible
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
      
      // COORDINATE FIX: Flip Y-axis to match P5.js [y][x] grid
      // P5.js: origin top-left, Y increases downward
      // Three.js PlaneGeometry: origin bottom-left, Y increases upward
      const flippedY = size - 1 - y;
      
      const cell = world.terrain[flippedY]?.[x];
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
        
        // Color derived from tile type (RGB categorical) with enhanced shading and micro-variation
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

// Deterministic micro-variation for organic feel
function getMicroVariation(x: number, y: number, seed: number): number {
  const n = Math.sin(x * 12.9898 + y * 78.233 + seed * 0.1) * 43758.5453;
  return (n - Math.floor(n)) * 0.15 - 0.075; // ±7.5% variation
}

// Get tile color from categorical type (RGB) with perceptual shading
// Uses curved elevation for natural light distribution
// Color is based on NexArt tile type, not recalculated from elevation
// Enhanced with micro-variation and elevation accents
function getTileColor(
  type: TerrainCell['type'], 
  elevation: number, // Already curved elevation from worldData
  moisture: number,
  hasRiver: boolean = false,
  isPath: boolean = false,
  x: number = 0, // Grid position for micro-variation
  y: number = 0,
  seed: number = 0
): { r: number; g: number; b: number } {
  // Micro-variation for organic feel - breaks flat color bands
  const microVar = getMicroVariation(x, y, seed);
  
  // Enhanced brightness curve - high elevations catch more light
  const baseBrightness = 0.65 + microVar;
  const elevationLight = Math.pow(elevation, 0.7) * 0.5;
  const brightness = baseBrightness + elevationLight;
  
  // Ambient occlusion simulation - low areas slightly darker
  const ao = 0.9 + elevation * 0.1;
  
  // Rivers get distinct color regardless of underlying tile type
  if (hasRiver) {
    return {
      r: 0.18 + microVar * 0.5,
      g: 0.45 + microVar * 0.5,
      b: 0.55 + microVar * 0.3
    };
  }
  
  // Paths get distinct color for visibility
  if (isPath && type !== 'bridge') {
    return {
      r: (0.62 + microVar) * brightness * ao,
      g: (0.52 + microVar) * brightness * ao,
      b: (0.38 + microVar * 0.5) * brightness * ao
    };
  }
  
  switch (type) {
    case 'water':
      // Water stays dark and flat - minimal elevation influence
      const depth = Math.max(0, 1 - elevation * 2);
      return {
        r: 0.08 + depth * 0.04 + microVar * 0.3,
        g: 0.18 + depth * 0.06 + microVar * 0.3,
        b: 0.35 + depth * 0.1 + microVar * 0.2
      };
      
    case 'forest':
      // Darker forests with strong moisture influence
      const forestDark = 0.7 + elevation * 0.3;
      const moist = moisture * 0.4;
      return {
        r: (0.12 + moist * 0.02 + microVar * 0.5) * forestDark * ao,
        g: (0.32 + moist * 0.18 + microVar) * forestDark * ao,
        b: (0.10 + moist * 0.05 + microVar * 0.3) * forestDark * ao
      };
      
    case 'mountain':
      // Enhanced mountain shading with dramatic height variation
      // Snow at high peaks (elevation > 0.65)
      const isSnow = elevation > 0.65;
      const isHighSnow = elevation > 0.8;
      
      if (isHighSnow) {
        // Brilliant white snow
        return {
          r: (0.95 + microVar * 0.2) * brightness,
          g: (0.97 + microVar * 0.15) * brightness,
          b: (1.0 + microVar * 0.1) * brightness
        };
      } else if (isSnow) {
        // Transition to snow
        const snowMix = (elevation - 0.65) / 0.15;
        return {
          r: (0.45 + snowMix * 0.45 + microVar) * brightness,
          g: (0.43 + snowMix * 0.50 + microVar) * brightness,
          b: (0.42 + snowMix * 0.55 + microVar * 0.5) * brightness
        };
      }
      
      // Rock with variation
      const rockHeight = elevation * 0.4;
      return {
        r: (0.32 + rockHeight + microVar) * brightness * ao,
        g: (0.30 + rockHeight + microVar) * brightness * ao,
        b: (0.28 + rockHeight + microVar * 0.5) * brightness * ao
      };
      
    case 'path':
      return {
        r: (0.58 + microVar) * brightness * ao,
        g: (0.48 + microVar) * brightness * ao,
        b: (0.35 + microVar * 0.5) * brightness * ao
      };
      
    case 'bridge':
      return {
        r: (0.40 + microVar) * brightness,
        g: (0.28 + microVar) * brightness,
        b: (0.16 + microVar * 0.5) * brightness
      };
      
    case 'ground':
    default:
      // Ground with wet shoreline near water (darker soil in lowlands)
      const groundMoist = moisture * 0.3;
      const lowlandDarken = elevation < 0.3 ? (0.3 - elevation) * 0.3 : 0;
      return {
        r: (0.50 - groundMoist * 0.15 - lowlandDarken + microVar) * brightness * ao,
        g: (0.44 + groundMoist * 0.12 - lowlandDarken * 0.5 + microVar) * brightness * ao,
        b: (0.28 + groundMoist * 0.04 + microVar * 0.5) * brightness * ao
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
  const bridges = useMemo(() => {
    const items: { x: number; z: number }[] = [];
    
    for (let y = 0; y < world.gridSize; y++) {
      for (let x = 0; x < world.gridSize; x++) {
        const cell = world.terrain[y][x];
        if (cell.type === 'bridge') {
          // COORDINATE FIX: Flip Y for Three.js positioning
          const flippedZ = world.gridSize - 1 - y;
          items.push({ x, z: flippedZ });
        }
      }
    }
    
    return items;
  }, [world]);
  
  return (
    <group>
      {bridges.map((bridge, i) => (
        <BridgePlank key={i} x={bridge.x} z={bridge.z} />
      ))}
    </group>
  );
}

function BridgePlank({ x, z }: { x: number; z: number }) {
  // Use fixed bridge height - just above water surface
  const bridgeHeight = BRIDGE_FIXED_HEIGHT;
  
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
  const { x, y: gridY, type } = world.plantedObject;
  const glowIntensity = isDiscovered ? 2 : 0.5;
  
  // Get proper elevation from terrain using getElevationAt
  // COORDINATE FIX: Use flipped Z coordinate for Three.js positioning
  const flippedZ = world.gridSize - 1 - gridY;
  const terrainY = getElevationAt(world, x, flippedZ);
  
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
    <group position={[x, terrainY, flippedZ]} scale={[0.3, 0.3, 0.3]}>
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
  const heightScale = WORLD_HEIGHT_SCALE;
  const waterLevel = getWaterLevel(world.vars);
  const waterThresholdHeight = waterLevel * heightScale;
  
  // Calculate water plane height based on actual water cells
  // Use waterThresholdHeight as the base, clamped to prevent flooding terrain
  const waterPlaneHeight = useMemo(() => {
    let minNonWaterElevation = Infinity;
    let avgWaterElevation = 0;
    let waterCellCount = 0;
    
    for (const row of world.terrain) {
      for (const cell of row) {
        if (cell.type === 'water') {
          avgWaterElevation += cell.elevation;
          waterCellCount++;
        } else if (cell.type !== 'bridge') {
          // Track minimum non-water elevation
          const cellHeight = cell.elevation * heightScale;
          if (cellHeight < minNonWaterElevation) {
            minNonWaterElevation = cellHeight;
          }
        }
      }
    }
    
    if (waterCellCount === 0) {
      // No water in world - place plane well below terrain
      return minNonWaterElevation - 2;
    }
    
    // Water plane at the VAR[4] threshold height
    // Clamped to never exceed the lowest non-water terrain (minus offset)
    const maxSafeHeight = minNonWaterElevation - 0.3;
    
    return Math.min(waterThresholdHeight, maxSafeHeight);
  }, [world.terrain, heightScale, waterThresholdHeight]);
  
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
// ATMOSPHERE - Time-of-Day Aware
// ============================================

interface AtmosphereProps {
  worldX?: number;
  worldY?: number;
}

export function Atmosphere({ worldX = 0, worldY = 0 }: AtmosphereProps) {
  // Get deterministic time of day
  const timeContext: TimeOfDayContext = useMemo(() => ({
    worldId: WORLD_A_ID,
    worldX,
    worldY
  }), [worldX, worldY]);
  
  const timeOfDay = useMemo(() => getTimeOfDay(timeContext), [timeContext]);
  const lighting = useMemo(() => getLightingParams(timeOfDay), [timeOfDay]);
  
  // Calculate sun position from angle
  const sunPosition = useMemo(() => {
    const angle = lighting.sunAngle;
    const radius = 80;
    const height = Math.sin(angle) * radius;
    const horizontal = Math.cos(angle) * radius;
    return [horizontal + 32, Math.max(10, height), 32] as [number, number, number];
  }, [lighting.sunAngle]);
  
  // Convert colors to Three.js format
  const fogColor = useMemo(() => 
    new THREE.Color(lighting.fogColor.r, lighting.fogColor.g, lighting.fogColor.b),
    [lighting.fogColor]
  );
  
  const sunColor = useMemo(() => 
    new THREE.Color(lighting.sunColor.r, lighting.sunColor.g, lighting.sunColor.b),
    [lighting.sunColor]
  );
  
  const ambientColor = useMemo(() => 
    new THREE.Color(lighting.ambientColor.r, lighting.ambientColor.g, lighting.ambientColor.b),
    [lighting.ambientColor]
  );
  
  const night = isNight(timeOfDay);
  const twilight = isTwilight(timeOfDay);
  
  // Hemisphere light colors
  const skyColor = useMemo(() => {
    if (night) return '#1a2040';
    if (twilight) return '#665588';
    return '#88aacc';
  }, [night, twilight]);
  
  const groundColor = useMemo(() => {
    if (night) return '#101520';
    if (twilight) return '#443344';
    return '#334455';
  }, [night, twilight]);
  
  return (
    <>
      <fog attach="fog" args={[fogColor, lighting.fogNear, lighting.fogFar]} />
      <ambientLight color={ambientColor} intensity={lighting.ambientIntensity} />
      <directionalLight 
        position={sunPosition} 
        color={sunColor}
        intensity={lighting.sunIntensity} 
        castShadow 
      />
      <hemisphereLight args={[skyColor, groundColor, night ? 0.2 : 0.5]} />
    </>
  );
}

// ============================================
// TIME-AWARE WATER PLANE
// ============================================

interface TimeAwareWaterPlaneProps {
  world: WorldData;
  worldX?: number;
  worldY?: number;
}

export function TimeAwareWaterPlane({ world, worldX = 0, worldY = 0 }: TimeAwareWaterPlaneProps) {
  const heightScale = WORLD_HEIGHT_SCALE;
  const waterLevel = getWaterLevel(world.vars);
  const waterThresholdHeight = waterLevel * heightScale;
  
  // Get time of day for water effects
  const timeContext: TimeOfDayContext = useMemo(() => ({
    worldId: WORLD_A_ID,
    worldX,
    worldY
  }), [worldX, worldY]);
  
  const timeOfDay = useMemo(() => getTimeOfDay(timeContext), [timeContext]);
  const night = isNight(timeOfDay);
  
  // Water appearance based on time
  const waterColor = useMemo(() => {
    if (night) return '#0a2535'; // Darker at night
    return '#1a4a6a';
  }, [night]);
  
  const waterOpacity = useMemo(() => {
    return night ? 0.75 : 0.65; // More opaque at night
  }, [night]);
  
  const waterMetalness = useMemo(() => {
    return night ? 0.35 : 0.15; // More reflective at night
  }, [night]);
  
  // Calculate water plane height
  const waterPlaneHeight = useMemo(() => {
    let minNonWaterElevation = Infinity;
    let waterCellCount = 0;
    
    for (const row of world.terrain) {
      for (const cell of row) {
        if (cell.type === 'water') {
          waterCellCount++;
        } else if (cell.type !== 'bridge') {
          const cellHeight = cell.elevation * heightScale;
          if (cellHeight < minNonWaterElevation) {
            minNonWaterElevation = cellHeight;
          }
        }
      }
    }
    
    if (waterCellCount === 0) {
      return minNonWaterElevation - 2;
    }
    
    const maxSafeHeight = minNonWaterElevation - 0.3;
    return Math.min(waterThresholdHeight, maxSafeHeight);
  }, [world.terrain, heightScale, waterThresholdHeight]);
  
  return (
    <mesh 
      position={[world.gridSize / 2, waterPlaneHeight, world.gridSize / 2]} 
      rotation={[-Math.PI / 2, 0, 0]}
    >
      <planeGeometry args={[world.gridSize, world.gridSize]} />
      <meshStandardMaterial 
        color={waterColor} 
        transparent 
        opacity={waterOpacity}
        metalness={waterMetalness}
        roughness={night ? 0.15 : 0.25}
      />
    </mesh>
  );
}
