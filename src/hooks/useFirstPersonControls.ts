import { useRef, useEffect, useCallback } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { WorldData, getElevationAt, isWalkable } from '@/lib/worldData';

interface FirstPersonControlsProps {
  world: WorldData;
  onPositionChange?: (x: number, y: number, z: number) => void;
  preservePosition?: boolean; // Don't reset on world change
}

// Store position globally to persist across world regenerations
const globalCameraState = {
  position: null as THREE.Vector3 | null,
  yaw: 0,
  pitch: 0,
  initialized: false
};

export function useFirstPersonControls({ world, onPositionChange, preservePosition = true }: FirstPersonControlsProps) {
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
  const isInitialized = useRef(false);

  // Initialize camera position only once, or when explicitly needed
  useEffect(() => {
    if (!isInitialized.current) {
      // First time - use spawn point or global state
      if (globalCameraState.initialized && preservePosition) {
        position.current.copy(globalCameraState.position!);
        rotationState.current.yaw = globalCameraState.yaw;
        rotationState.current.pitch = globalCameraState.pitch;
      } else {
        position.current.set(world.spawnPoint.x, world.spawnPoint.z, world.spawnPoint.y);
        rotationState.current.yaw = world.spawnPoint.rotationY;
        rotationState.current.pitch = 0;
        
        globalCameraState.position = position.current.clone();
        globalCameraState.yaw = rotationState.current.yaw;
        globalCameraState.pitch = rotationState.current.pitch;
        globalCameraState.initialized = true;
      }
      isInitialized.current = true;
    }
    // Don't reset when world changes - this preserves camera position
  }, [world, preservePosition]);

  // Keyboard controls - attach to window for global capture
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if typing in an input
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

    // Use capture phase to get events before other handlers
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
    const speed = 12 * delta; // Increased speed
    const { forward, backward, left, right, up, down } = moveState.current;
    const { yaw, pitch } = rotationState.current;

    // Calculate movement direction
    const direction = new THREE.Vector3();
    
    if (forward) direction.z -= 1;
    if (backward) direction.z += 1;
    if (left) direction.x -= 1;
    if (right) direction.x += 1;

    if (direction.length() > 0) {
      direction.normalize();
      
      // Rotate direction by yaw
      const moveX = direction.x * Math.cos(yaw) - direction.z * Math.sin(yaw);
      const moveZ = direction.x * Math.sin(yaw) + direction.z * Math.cos(yaw);
      
      // Calculate new position
      const newX = position.current.x + moveX * speed;
      const newZ = position.current.z + moveZ * speed;
      
      // Check if new position is walkable (less strict for better movement)
      if (isWalkable(world, newX, newZ)) {
        position.current.x = newX;
        position.current.z = newZ;
        
        // Update height based on terrain
        const terrainHeight = getElevationAt(world, newX, newZ);
        position.current.y = terrainHeight + 2; // Eye height
      } else {
        // Try sliding along obstacles
        if (isWalkable(world, newX, position.current.z)) {
          position.current.x = newX;
        } else if (isWalkable(world, position.current.x, newZ)) {
          position.current.z = newZ;
        }
      }
    }

    // Vertical movement (for flying/debugging)
    if (up) position.current.y += speed;
    if (down) position.current.y = Math.max(1, position.current.y - speed);

    // Apply position and rotation to camera
    camera.position.copy(position.current);
    
    // Create rotation from yaw and pitch
    const euler = new THREE.Euler(pitch, yaw, 0, 'YXZ');
    camera.quaternion.setFromEuler(euler);

    // Save state globally
    globalCameraState.position = position.current.clone();
    globalCameraState.yaw = yaw;
    globalCameraState.pitch = pitch;

    // Notify parent of position change
    onPositionChange?.(position.current.x, position.current.z, position.current.y);
  });

  return position;
}

// Reset camera to spawn (call when needed)
export function resetCameraToSpawn() {
  globalCameraState.initialized = false;
}
