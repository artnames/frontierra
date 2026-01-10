// Sky Dome - 3D Celestial Sphere in World Space
// Renders sun, moon, and stars as world-space objects
// Camera independent - only follows position, not rotation

import { useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { 
  getTimeOfDay, 
  skyGradient, 
  getSunAngle, 
  isNight,
  generateStars,
  getStarVisibility,
  TimeOfDayContext 
} from '@/lib/timeOfDay';
import { WORLD_A_ID } from '@/lib/worldContext';

interface SkyDomeProps {
  worldX?: number;
  worldY?: number;
  sessionOffset?: number;
}

const SKY_RADIUS = 500;
const SUN_DISTANCE = SKY_RADIUS * 0.95;

// Parse hex color to THREE.Color
function hexToColor(hex: string): THREE.Color {
  return new THREE.Color(hex);
}

// Sky dome mesh that follows camera position only
function SkySphereMesh({ zenithColor, horizonColor }: { zenithColor: string; horizonColor: string }) {
  const meshRef = useRef<THREE.Mesh>(null);
  const { camera } = useThree();
  
  // Create gradient material
  const material = useMemo(() => {
    const zenith = hexToColor(zenithColor);
    const horizon = hexToColor(horizonColor);
    
    return new THREE.ShaderMaterial({
      uniforms: {
        zenithColor: { value: zenith },
        horizonColor: { value: horizon }
      },
      vertexShader: `
        varying vec3 vWorldPosition;
        void main() {
          vec4 worldPosition = modelMatrix * vec4(position, 1.0);
          vWorldPosition = worldPosition.xyz;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform vec3 zenithColor;
        uniform vec3 horizonColor;
        varying vec3 vWorldPosition;
        
        void main() {
          vec3 direction = normalize(vWorldPosition);
          float t = pow(1.0 - max(0.0, direction.y), 1.5);
          vec3 color = mix(zenithColor, horizonColor, t);
          gl_FragColor = vec4(color, 1.0);
        }
      `,
      side: THREE.BackSide,
      depthWrite: false
    });
  }, [zenithColor, horizonColor]);
  
  // Update colors when they change
  useMemo(() => {
    material.uniforms.zenithColor.value = hexToColor(zenithColor);
    material.uniforms.horizonColor.value = hexToColor(horizonColor);
  }, [material, zenithColor, horizonColor]);
  
  // Follow camera position only, not rotation
  useFrame(() => {
    if (meshRef.current) {
      meshRef.current.position.copy(camera.position);
      // Keep rotation fixed - sky doesn't rotate with camera
      meshRef.current.rotation.set(0, 0, 0);
    }
  });
  
  return (
    <mesh ref={meshRef} renderOrder={-1000}>
      <sphereGeometry args={[SKY_RADIUS, 32, 32]} />
      <primitive object={material} attach="material" />
    </mesh>
  );
}

// Sun mesh - billboard that faces camera
function SunMesh({ angle, color, isNightTime }: { angle: number; color: string; isNightTime: boolean }) {
  const meshRef = useRef<THREE.Mesh>(null);
  const glowRef = useRef<THREE.Mesh>(null);
  const { camera } = useThree();
  
  // Compute sun position on the sky arc
  const sunPosition = useMemo(() => {
    // Sun rises in east (negative X), sets in west (positive X)
    // Arc goes from east to west through south
    const x = Math.cos(angle) * SUN_DISTANCE;
    const y = Math.sin(angle) * SUN_DISTANCE * 0.8; // Slightly flatten the arc
    const z = -SUN_DISTANCE * 0.3; // Offset south
    return new THREE.Vector3(x, y, z);
  }, [angle]);
  
  const sunColor = useMemo(() => hexToColor(color), [color]);
  const sunSize = isNightTime ? 15 : 25;
  const glowSize = isNightTime ? 40 : 80;
  
  // Update position relative to camera
  useFrame(() => {
    if (meshRef.current && glowRef.current) {
      const worldPos = sunPosition.clone().add(camera.position);
      meshRef.current.position.copy(worldPos);
      glowRef.current.position.copy(worldPos);
      
      // Billboard - always face camera
      meshRef.current.lookAt(camera.position);
      glowRef.current.lookAt(camera.position);
    }
  });
  
  // Only render if above horizon
  if (angle <= 0 || angle >= Math.PI) {
    return null;
  }
  
  return (
    <>
      {/* Glow */}
      <mesh ref={glowRef} renderOrder={-999}>
        <circleGeometry args={[glowSize, 32]} />
        <meshBasicMaterial 
          color={sunColor} 
          transparent 
          opacity={isNightTime ? 0.15 : 0.25}
          depthWrite={false}
        />
      </mesh>
      
      {/* Core */}
      <mesh ref={meshRef} renderOrder={-998}>
        <circleGeometry args={[sunSize, 32]} />
        <meshBasicMaterial 
          color={isNightTime ? '#e8e8f0' : '#fffef0'} 
          depthWrite={false}
        />
      </mesh>
    </>
  );
}

// Star field on the sky dome
function StarField({ 
  stars, 
  visibility 
}: { 
  stars: { x: number; y: number; size: number; brightness: number }[];
  visibility: number;
}) {
  const pointsRef = useRef<THREE.Points>(null);
  const { camera } = useThree();
  
  const [positions, sizes, colors] = useMemo(() => {
    const pos = new Float32Array(stars.length * 3);
    const siz = new Float32Array(stars.length);
    const col = new Float32Array(stars.length * 3);
    
    stars.forEach((star, i) => {
      // Map star coordinates to sphere surface
      // x: 0-1 maps to longitude (full circle)
      // y: 0-0.7 maps to latitude (upper hemisphere)
      const theta = star.x * Math.PI * 2; // Longitude
      const phi = (1 - star.y) * Math.PI * 0.5; // Latitude (0 = zenith, π/2 = horizon)
      
      const r = SKY_RADIUS * 0.98;
      pos[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      pos[i * 3 + 1] = r * Math.cos(phi); // Y is up
      pos[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta);
      
      siz[i] = star.size * 2;
      
      // Slight color variation (bluish white to warm white)
      const warmth = star.brightness * 0.3;
      col[i * 3] = 0.9 + warmth * 0.1;
      col[i * 3 + 1] = 0.9 + warmth * 0.05;
      col[i * 3 + 2] = 1.0;
    });
    
    return [pos, siz, col];
  }, [stars]);
  
  // Follow camera position
  useFrame(() => {
    if (pointsRef.current) {
      pointsRef.current.position.copy(camera.position);
    }
  });
  
  if (visibility <= 0.01) {
    return null;
  }
  
  return (
    <points ref={pointsRef} renderOrder={-997}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          count={stars.length}
          array={positions}
          itemSize={3}
        />
        <bufferAttribute
          attach="attributes-size"
          count={stars.length}
          array={sizes}
          itemSize={1}
        />
      </bufferGeometry>
      <pointsMaterial
        size={3}
        sizeAttenuation={false}
        color="#ffffff"
        transparent
        opacity={visibility * 0.8}
        depthWrite={false}
      />
    </points>
  );
}

export function SkyDome({ 
  worldX = 0, 
  worldY = 0, 
  sessionOffset = 0 
}: SkyDomeProps) {
  // Build time context
  const timeContext = useMemo<TimeOfDayContext>(() => ({
    worldId: WORLD_A_ID,
    worldX,
    worldY,
    sessionOffset
  }), [worldX, worldY, sessionOffset]);
  
  // Compute time values - these update each frame via useFrame in children
  const timeOfDay = useMemo(() => getTimeOfDay(timeContext), [timeContext]);
  const colors = useMemo(() => skyGradient(timeOfDay), [timeOfDay]);
  const sunAngle = useMemo(() => getSunAngle(timeOfDay), [timeOfDay]);
  const night = useMemo(() => isNight(timeOfDay), [timeOfDay]);
  const stars = useMemo(() => generateStars(timeContext, 200), [timeContext]);
  const starVisibility = useMemo(() => getStarVisibility(timeOfDay), [timeOfDay]);
  
  return (
    <group>
      {/* Sky gradient dome */}
      <SkySphereMesh zenithColor={colors.zenith} horizonColor={colors.horizon} />
      
      {/* Stars (visible at night) */}
      <StarField stars={stars} visibility={starVisibility} />
      
      {/* Sun or Moon */}
      <SunMesh angle={sunAngle} color={colors.sunMoon} isNightTime={night} />
    </group>
  );
}
