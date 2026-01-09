import { useRef, useEffect, useCallback } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { WorldData, getElevationAt, isWalkable } from '@/lib/worldData';

interface FirstPersonControlsProps {
  world: WorldData;
  onPositionChange?: (x: number, z: number, y: number) => void; // x, z (ground), y (height)
  preservePosition?: boolean;
  enabled?: boolean;
  allowVerticalMovement?: boolean; // false = ground-locked explore mode
}

// Store position globally to persist across world regenerations
const globalCameraState = {
  position: null as THREE.Vector3 | null,
  manualHeight: null as number | null,
  yaw: 0,
  pitch: 0,
  initialized: false,
  lastWorldSeed: null as number | null
};

export function useFirstPersonControls({ world, onPositionChange, preservePosition = true, enabled = true, allowVerticalMovement = true }: FirstPersonControlsProps) {
  const { camera, gl } = useThree();
  const moveState = useRef({
    forward: false,
    backward: false,
    left: false,
    right: false,
    up: false,
    down: false
  });
  const rotationState = useRef({ yaw: 0, pitch: 0 });
  const isDragging = useRef(false);
  const lastMouse = useRef({ x: 0, y: 0 });
  const position = useRef(new THREE.Vector3());
  const manualHeightOffset = useRef(0); // Store manual height offset from terrain
  const isInitialized = useRef(false);

  // Initialize camera position only once, or when seed changes
  useEffect(() => {
    // Reset if seed changes (new world) or not yet initialized
    const seedChanged = globalCameraState.lastWorldSeed !== null && 
                        globalCameraState.lastWorldSeed !== world.seed;
    
    if (!isInitialized.current || seedChanged) {
      if (globalCameraState.initialized && preservePosition && globalCameraState.position && !seedChanged) {
        position.current.copy(globalCameraState.position);
        manualHeightOffset.current = globalCameraState.manualHeight ?? 0;
        rotationState.current.yaw = globalCameraState.yaw;
        rotationState.current.pitch = globalCameraState.pitch;
      } else {
        // Spawn: x,z are ground coords, y is height in Three.js
        const spawnX = world.spawnPoint.x;
        const spawnZ = world.spawnPoint.y; // world y -> Three.js z
        const terrainHeight = getElevationAt(world, spawnX, spawnZ);
        const eyeHeight = 0.7; // Lowered 60% from 1.8 for realistic tree scale
        
        position.current.set(spawnX, terrainHeight + eyeHeight, spawnZ);
        manualHeightOffset.current = 0;
        rotationState.current.yaw = world.spawnPoint.rotationY;
        rotationState.current.pitch = 0;
        
        globalCameraState.position = position.current.clone();
        globalCameraState.manualHeight = 0;
        globalCameraState.yaw = rotationState.current.yaw;
        globalCameraState.pitch = rotationState.current.pitch;
        globalCameraState.initialized = true;
        globalCameraState.lastWorldSeed = world.seed;
      }
      isInitialized.current = true;
    }
  }, [world, preservePosition]);

  // Keyboard controls
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }
      
      switch (e.code) {
        case 'KeyW':
        case 'ArrowUp':
          moveState.current.forward = true;
          e.preventDefault();
          break;
        case 'KeyS':
        case 'ArrowDown':
          moveState.current.backward = true;
          e.preventDefault();
          break;
        case 'KeyA':
        case 'ArrowLeft':
          moveState.current.left = true;
          e.preventDefault();
          break;
        case 'KeyD':
        case 'ArrowRight':
          moveState.current.right = true;
          e.preventDefault();
          break;
        case 'Space':
          moveState.current.up = true;
          e.preventDefault();
          break;
        case 'ShiftLeft':
        case 'ShiftRight':
          moveState.current.down = true;
          e.preventDefault();
          break;
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      switch (e.code) {
        case 'KeyW':
        case 'ArrowUp':
          moveState.current.forward = false;
          break;
        case 'KeyS':
        case 'ArrowDown':
          moveState.current.backward = false;
          break;
        case 'KeyA':
        case 'ArrowLeft':
          moveState.current.left = false;
          break;
        case 'KeyD':
        case 'ArrowRight':
          moveState.current.right = false;
          break;
        case 'Space':
          moveState.current.up = false;
          break;
        case 'ShiftLeft':
        case 'ShiftRight':
          moveState.current.down = false;
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown, { capture: true });
    window.addEventListener('keyup', handleKeyUp, { capture: true });

    return () => {
      window.removeEventListener('keydown', handleKeyDown, { capture: true });
      window.removeEventListener('keyup', handleKeyUp, { capture: true });
    };
  }, []);

  // Mouse controls
  useEffect(() => {
    const canvas = gl.domElement;

    const handleMouseDown = (e: MouseEvent) => {
      isDragging.current = true;
      lastMouse.current = { x: e.clientX, y: e.clientY };
      canvas.style.cursor = 'grabbing';
    };

    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging.current) return;

      const deltaX = e.clientX - lastMouse.current.x;
      const deltaY = e.clientY - lastMouse.current.y;

      rotationState.current.yaw -= deltaX * 0.003;
      rotationState.current.pitch -= deltaY * 0.003;
      rotationState.current.pitch = Math.max(-Math.PI / 2 + 0.1, Math.min(Math.PI / 2 - 0.1, rotationState.current.pitch));

      lastMouse.current = { x: e.clientX, y: e.clientY };
    };

    const handleMouseUp = () => {
      isDragging.current = false;
      canvas.style.cursor = 'grab';
    };

    // Touch controls
    const handleTouchStart = (e: TouchEvent) => {
      if (e.touches.length === 1) {
        isDragging.current = true;
        lastMouse.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
      }
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (!isDragging.current || e.touches.length !== 1) return;

      const deltaX = e.touches[0].clientX - lastMouse.current.x;
      const deltaY = e.touches[0].clientY - lastMouse.current.y;

      rotationState.current.yaw -= deltaX * 0.003;
      rotationState.current.pitch -= deltaY * 0.003;
      rotationState.current.pitch = Math.max(-Math.PI / 2 + 0.1, Math.min(Math.PI / 2 - 0.1, rotationState.current.pitch));

      lastMouse.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    };

    const handleTouchEnd = () => {
      isDragging.current = false;
    };

    canvas.style.cursor = 'grab';
    canvas.addEventListener('mousedown', handleMouseDown);
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    canvas.addEventListener('touchstart', handleTouchStart);
    window.addEventListener('touchmove', handleTouchMove);
    window.addEventListener('touchend', handleTouchEnd);

    return () => {
      canvas.removeEventListener('mousedown', handleMouseDown);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      canvas.removeEventListener('touchstart', handleTouchStart);
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('touchend', handleTouchEnd);
    };
  }, [gl]);

  // Update camera each frame
  useFrame((_, delta) => {
    if (!enabled) return;
    
    const speed = 8 * delta;
    const { forward, backward, left, right, up, down } = moveState.current;
    const { yaw, pitch } = rotationState.current;

    // Calculate movement direction in XZ plane (ground plane)
    const direction = new THREE.Vector3();
    
    // W/S = forward/backward along view direction
    if (forward) direction.z -= 1;
    if (backward) direction.z += 1;
    // A/D = strafe left/right
    if (left) direction.x -= 1;
    if (right) direction.x += 1;

    if (direction.length() > 0) {
      direction.normalize();
      
      // Rotate direction by yaw (horizontal rotation only)
      // (Three.js Y-axis rotation: x' = x*cos + z*sin, z' = -x*sin + z*cos)
      const moveX = direction.x * Math.cos(yaw) + direction.z * Math.sin(yaw);
      const moveZ = -direction.x * Math.sin(yaw) + direction.z * Math.cos(yaw);
      
      // New position on ground plane
      const newX = position.current.x + moveX * speed;
      const newZ = position.current.z + moveZ * speed;

      const inBounds =
        newX >= 0 &&
        newX <= world.gridSize - 0.001 &&
        newZ >= 0 &&
        newZ <= world.gridSize - 0.001;

      // In editor (allowVerticalMovement=true), we allow moving over water.
      const canMove = inBounds && (allowVerticalMovement || isWalkable(world, newX, newZ));

      if (canMove) {
        position.current.x = newX;
        position.current.z = newZ;

        // Update height based on terrain + manual offset
        const terrainHeight = getElevationAt(world, newX, newZ);
        position.current.y = terrainHeight + 0.7 + manualHeightOffset.current;
      } else if (inBounds) {
        // Explore mode: try sliding along obstacles (water edges)
        if (isWalkable(world, newX, position.current.z)) {
          position.current.x = newX;
          const terrainHeight = getElevationAt(world, newX, position.current.z);
          position.current.y = terrainHeight + 0.7 + manualHeightOffset.current;
        } else if (isWalkable(world, position.current.x, newZ)) {
          position.current.z = newZ;
          const terrainHeight = getElevationAt(world, position.current.x, newZ);
          position.current.y = terrainHeight + 0.7 + manualHeightOffset.current;
        }
      }
    }

    // Vertical movement (fly mode) - only if allowed
    if (allowVerticalMovement) {
      if (up) {
        manualHeightOffset.current += speed;
      }
      if (down) {
        manualHeightOffset.current = Math.max(-1, manualHeightOffset.current - speed);
        const terrainHeight = getElevationAt(world, position.current.x, position.current.z);
        position.current.y = Math.max(terrainHeight + 0.3, terrainHeight + 0.7 + manualHeightOffset.current);
      }
      
      // Apply current height with offset
      if (up || down) {
        const terrainHeight = getElevationAt(world, position.current.x, position.current.z);
        position.current.y = terrainHeight + 0.7 + manualHeightOffset.current;
      }
    } else {
      // Ground-locked mode - always snap to terrain
      manualHeightOffset.current = 0;
    }

    // Apply position and rotation to camera
    camera.position.copy(position.current);
    
    const euler = new THREE.Euler(pitch, yaw, 0, 'YXZ');
    camera.quaternion.setFromEuler(euler);

    // Save state globally for persistence
    globalCameraState.position = position.current.clone();
    globalCameraState.manualHeight = manualHeightOffset.current;
    globalCameraState.yaw = yaw;
    globalCameraState.pitch = pitch;

    // Notify parent: x (ground), z (ground), y (height)
    onPositionChange?.(position.current.x, position.current.z, position.current.y);
  });

  return position;
}

// Reset camera to spawn
export function resetCameraToSpawn() {
  globalCameraState.initialized = false;
  globalCameraState.manualHeight = null;
}

// Set camera to editor view (high corner looking down)
export function setCameraToEditorView(world: WorldData) {
  const gridSize = world.gridSize;
  // Position at corner, high up
  globalCameraState.position = new THREE.Vector3(gridSize * 0.9, 50, gridSize * 0.9);
  globalCameraState.manualHeight = 48; // High above terrain
  globalCameraState.yaw = -Math.PI * 0.75; // Looking toward center
  globalCameraState.pitch = -0.8; // Looking down
  globalCameraState.initialized = true;
  globalCameraState.lastWorldSeed = world.seed;
}

// Set camera to explore view (ground level at spawn)
export function setCameraToExploreView(world: WorldData) {
  globalCameraState.initialized = false;
  globalCameraState.manualHeight = 0;
  globalCameraState.lastWorldSeed = world.seed;
}
