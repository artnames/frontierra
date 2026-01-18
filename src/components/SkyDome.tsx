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

// Sun mesh - multi-layered glow with natural falloff
function SunMesh({ angle, color, isNightTime }: { angle: number; color: string; isNightTime: boolean }) {
  const groupRef = useRef<THREE.Group>(null);
  const { camera } = useThree();
  
  // Compute sun position on the sky arc
  const sunPosition = useMemo(() => {
    // Sun rises in east (negative X), sets in west (positive X)
    const x = Math.cos(angle) * SUN_DISTANCE;
    const y = Math.sin(angle) * SUN_DISTANCE * 0.8;
    const z = -SUN_DISTANCE * 0.3;
    return new THREE.Vector3(x, y, z);
  }, [angle]);
  
  // Create gradient glow material for natural sun
  const glowMaterial = useMemo(() => {
    const baseColor = hexToColor(color);
    return new THREE.ShaderMaterial({
      uniforms: {
        sunColor: { value: baseColor },
        isNight: { value: isNightTime ? 1.0 : 0.0 }
      },
      vertexShader: `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform vec3 sunColor;
        uniform float isNight;
        varying vec2 vUv;
        
        void main() {
          vec2 center = vUv - 0.5;
          float dist = length(center) * 2.0;
          
          // Multi-layer glow falloff
          float core = 1.0 - smoothstep(0.0, 0.15, dist);
          float inner = (1.0 - smoothstep(0.1, 0.4, dist)) * 0.7;
          float outer = (1.0 - smoothstep(0.2, 1.0, dist)) * 0.3;
          
          float glow = core + inner + outer;
          
          // Core is white-hot, edges take sun color
          vec3 coreColor = mix(vec3(1.0, 1.0, 0.98), sunColor, smoothstep(0.0, 0.3, dist));
          
          // Moon is cooler, dimmer
          if (isNight > 0.5) {
            coreColor = mix(vec3(0.95, 0.95, 1.0), sunColor * 0.8, smoothstep(0.0, 0.25, dist));
            glow *= 0.6;
          }
          
          gl_FragColor = vec4(coreColor, glow);
        }
      `,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending
    });
  }, [color, isNightTime]);
  
  // Update uniforms
  useMemo(() => {
    glowMaterial.uniforms.sunColor.value = hexToColor(color);
    glowMaterial.uniforms.isNight.value = isNightTime ? 1.0 : 0.0;
  }, [glowMaterial, color, isNightTime]);
  
  const sunSize = isNightTime ? 50 : 100;
  
  // Update position relative to camera
  useFrame(() => {
    if (groupRef.current) {
      const worldPos = sunPosition.clone().add(camera.position);
      groupRef.current.position.copy(worldPos);
      groupRef.current.lookAt(camera.position);
    }
  });
  
  // Only render if above horizon
  if (angle <= 0 || angle >= Math.PI) {
    return null;
  }
  
  return (
    <group ref={groupRef}>
      <mesh renderOrder={-998}>
        <planeGeometry args={[sunSize, sunSize]} />
        <primitive object={glowMaterial} attach="material" />
      </mesh>
    </group>
  );
}

// Smooth star shader material - renders anti-aliased circles instead of pixelated squares
function createStarShaderMaterial(visibility: number): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: {
      uVisibility: { value: visibility }
    },
    vertexShader: `
      attribute float size;
      attribute vec3 starColor;
      varying vec3 vColor;
      
      void main() {
        vColor = starColor;
        vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
        gl_PointSize = size * 3.0;
        gl_Position = projectionMatrix * mvPosition;
      }
    `,
    fragmentShader: `
      uniform float uVisibility;
      varying vec3 vColor;
      
      void main() {
        // Create smooth circular star with soft glow
        vec2 center = gl_PointCoord - 0.5;
        float dist = length(center) * 2.0;
        
        // Smooth circular falloff (anti-aliased)
        float alpha = 1.0 - smoothstep(0.0, 1.0, dist);
        
        // Add subtle glow
        float glow = exp(-dist * 2.0) * 0.5;
        alpha = alpha + glow;
        
        alpha *= uVisibility * 0.9;
        
        if (alpha < 0.01) discard;
        
        gl_FragColor = vec4(vColor, alpha);
      }
    `,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending
  });
}

// Star field on the sky dome - uses smooth shader for anti-aliased rendering
function StarField({ 
  stars, 
  visibility 
}: { 
  stars: { x: number; y: number; size: number; brightness: number }[];
  visibility: number;
}) {
  const pointsRef = useRef<THREE.Points>(null);
  const { camera } = useThree();
  const materialRef = useRef<THREE.ShaderMaterial | null>(null);
  
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
  
  // Create or update material
  const material = useMemo(() => {
    const mat = createStarShaderMaterial(visibility);
    materialRef.current = mat;
    return mat;
  }, []);
  
  // Update visibility uniform
  useFrame(() => {
    if (pointsRef.current) {
      pointsRef.current.position.copy(camera.position);
    }
    if (materialRef.current) {
      materialRef.current.uniforms.uVisibility.value = visibility;
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
        <bufferAttribute
          attach="attributes-starColor"
          count={stars.length}
          array={colors}
          itemSize={3}
        />
      </bufferGeometry>
      <primitive object={material} attach="material" />
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
