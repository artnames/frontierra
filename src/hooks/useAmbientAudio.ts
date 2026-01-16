import { useRef, useEffect, useCallback } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { WorldData, getElevationAt, isWalkable } from "@/lib/worldData";

interface FirstPersonControlsProps {
  world: WorldData;
  onPositionChange?: (x: number, z: number, y: number) => void;
  preservePosition?: boolean;
  enabled?: boolean;
  allowVerticalMovement?: boolean;
}

const globalCameraState = {
  position: null as THREE.Vector3 | null,
  manualHeight: null as number | null,
  yaw: 0,
  pitch: 0,
  initialized: false,
  pendingTransition: null as { x: number; z: number } | null,
};

export const mobileMovement = {
  forward: false,
  backward: false,
  left: false,
  right: false,
};

export function setMobileMovement(forward: boolean, backward: boolean, left: boolean, right: boolean) {
  mobileMovement.forward = forward;
  mobileMovement.backward = backward;
  mobileMovement.left = left;
  mobileMovement.right = right;
}

// Helper to check if world is ready
function isWorldReady(world: WorldData | null): world is WorldData {
  return !!(world && world.terrain && world.terrain.length > 0 && world.gridSize > 0);
}

export function useFirstPersonControls({
  world,
  onPositionChange,
  preservePosition = true,
  enabled = true,
  allowVerticalMovement = true,
}: FirstPersonControlsProps) {
  const { camera, gl } = useThree();
  const moveState = useRef({
    forward: false,
    backward: false,
    left: false,
    right: false,
    up: false,
    down: false,
  });
  const rotationState = useRef({ yaw: 0, pitch: 0 });
  const isDragging = useRef(false);
  const lastMouse = useRef({ x: 0, y: 0 });
  const position = useRef(new THREE.Vector3());
  const manualHeightOffset = useRef(0);
  const isInitialized = useRef(false);

  // Initialize camera position only once
  useEffect(() => {
    // Guard against incomplete world data
    if (!isWorldReady(world)) return;

    // Check for pending land transition first
    if (globalCameraState.pendingTransition) {
      const { x, z } = globalCameraState.pendingTransition;
      const terrainHeight = getElevationAt(world, x, z);
      const eyeHeight = 0.7;

      position.current.set(x, terrainHeight + eyeHeight, z);
      manualHeightOffset.current = 0;

      globalCameraState.position = position.current.clone();
      globalCameraState.manualHeight = 0;
      globalCameraState.initialized = true;
      globalCameraState.pendingTransition = null;
      isInitialized.current = true;
      return;
    }

    if (!isInitialized.current) {
      if (globalCameraState.initialized && preservePosition && globalCameraState.position) {
        position.current.copy(globalCameraState.position);
        manualHeightOffset.current = globalCameraState.manualHeight ?? 0;
        rotationState.current.yaw = globalCameraState.yaw;
        rotationState.current.pitch = globalCameraState.pitch;
      } else {
        const spawnX = world.spawnPoint.x;
        const spawnZ = world.spawnPoint.y;
        const terrainHeight = getElevationAt(world, spawnX, spawnZ);
        const eyeHeight = 0.7;

        position.current.set(spawnX, terrainHeight + eyeHeight, spawnZ);
        manualHeightOffset.current = 0;
        rotationState.current.yaw = world.spawnPoint.rotationY;
        rotationState.current.pitch = 0;

        globalCameraState.position = position.current.clone();
        globalCameraState.manualHeight = 0;
        globalCameraState.yaw = rotationState.current.yaw;
        globalCameraState.pitch = rotationState.current.pitch;
        globalCameraState.initialized = true;
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
        case "KeyW":
        case "ArrowUp":
          moveState.current.forward = true;
          e.preventDefault();
          break;
        case "KeyS":
        case "ArrowDown":
          moveState.current.backward = true;
          e.preventDefault();
          break;
        case "KeyA":
        case "ArrowLeft":
          moveState.current.left = true;
          e.preventDefault();
          break;
        case "KeyD":
        case "ArrowRight":
          moveState.current.right = true;
          e.preventDefault();
          break;
        case "Space":
          moveState.current.up = true;
          e.preventDefault();
          break;
        case "ShiftLeft":
        case "ShiftRight":
          moveState.current.down = true;
          e.preventDefault();
          break;
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      switch (e.code) {
        case "KeyW":
        case "ArrowUp":
          moveState.current.forward = false;
          break;
        case "KeyS":
        case "ArrowDown":
          moveState.current.backward = false;
          break;
        case "KeyA":
        case "ArrowLeft":
          moveState.current.left = false;
          break;
        case "KeyD":
        case "ArrowRight":
          moveState.current.right = false;
          break;
        case "Space":
          moveState.current.up = false;
          break;
        case "ShiftLeft":
        case "ShiftRight":
          moveState.current.down = false;
          break;
      }
    };

    window.addEventListener("keydown", handleKeyDown, { capture: true });
    window.addEventListener("keyup", handleKeyUp, { capture: true });

    return () => {
      window.removeEventListener("keydown", handleKeyDown, { capture: true });
      window.removeEventListener("keyup", handleKeyUp, { capture: true });
    };
  }, []);

  // Mouse controls
  useEffect(() => {
    const canvas = gl.domElement;

    const handleMouseDown = (e: MouseEvent) => {
      isDragging.current = true;
      lastMouse.current = { x: e.clientX, y: e.clientY };
      canvas.style.cursor = "grabbing";
    };

    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging.current) return;

      const deltaX = e.clientX - lastMouse.current.x;
      const deltaY = e.clientY - lastMouse.current.y;

      rotationState.current.yaw -= deltaX * 0.003;
      rotationState.current.pitch -= deltaY * 0.003;
      rotationState.current.pitch = Math.max(
        -Math.PI / 2 + 0.1,
        Math.min(Math.PI / 2 - 0.1, rotationState.current.pitch),
      );

      lastMouse.current = { x: e.clientX, y: e.clientY };
    };

    const handleMouseUp = () => {
      isDragging.current = false;
      canvas.style.cursor = "grab";
    };

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
      rotationState.current.pitch = Math.max(
        -Math.PI / 2 + 0.1,
        Math.min(Math.PI / 2 - 0.1, rotationState.current.pitch),
      );

      lastMouse.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    };

    const handleTouchEnd = () => {
      isDragging.current = false;
    };

    canvas.style.cursor = "grab";
    canvas.addEventListener("mousedown", handleMouseDown);
    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    canvas.addEventListener("touchstart", handleTouchStart);
    window.addEventListener("touchmove", handleTouchMove);
    window.addEventListener("touchend", handleTouchEnd);

    return () => {
      canvas.removeEventListener("mousedown", handleMouseDown);
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
      canvas.removeEventListener("touchstart", handleTouchStart);
      window.removeEventListener("touchmove", handleTouchMove);
      window.removeEventListener("touchend", handleTouchEnd);
    };
  }, [gl]);

  useFrame((_, delta) => {
    // Guard against incomplete world data
    if (!enabled || !isWorldReady(world)) return;

    // Apply land transition position immediately
    if (globalCameraState.pendingTransition) {
      const { x, z } = globalCameraState.pendingTransition;
      const terrainHeight = getElevationAt(world, x, z);
      const eyeHeight = 0.7;

      position.current.set(x, terrainHeight + eyeHeight, z);
      manualHeightOffset.current = 0;

      globalCameraState.position = position.current.clone();
      globalCameraState.manualHeight = 0;
      globalCameraState.pendingTransition = null;
    }

    const speed = 3 * delta;
    const forward = moveState.current.forward || mobileMovement.forward;
    const backward = moveState.current.backward || mobileMovement.backward;
    const left = moveState.current.left || mobileMovement.left;
    const right = moveState.current.right || mobileMovement.right;
    const { up, down } = moveState.current;
    const { yaw, pitch } = rotationState.current;

    const direction = new THREE.Vector3();

    if (forward) direction.z -= 1;
    if (backward) direction.z += 1;
    if (left) direction.x -= 1;
    if (right) direction.x += 1;

    if (direction.length() > 0) {
      direction.normalize();

      const moveX = direction.x * Math.cos(yaw) + direction.z * Math.sin(yaw);
      const moveZ = -direction.x * Math.sin(yaw) + direction.z * Math.cos(yaw);

      const newX = position.current.x + moveX * speed;
      const newZ = position.current.z + moveZ * speed;

      const inBounds = newX >= 0 && newX <= world.gridSize - 0.001 && newZ >= 0 && newZ <= world.gridSize - 0.001;

      const canMove = inBounds && (allowVerticalMovement || isWalkable(world, newX, newZ));

      if (canMove) {
        position.current.x = newX;
        position.current.z = newZ;

        const terrainHeight = getElevationAt(world, newX, newZ);
        const prevTerrainHeight = getElevationAt(world, position.current.x, position.current.z);
        const slopeGradient = Math.abs(terrainHeight - prevTerrainHeight) / (speed || 0.1);
        const slopeBoost = Math.min(slopeGradient * 0.3, 0.5);
        const baseEyeHeight = 0.7;
        position.current.y = terrainHeight + baseEyeHeight + slopeBoost + manualHeightOffset.current;
      } else if (inBounds) {
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

    if (allowVerticalMovement) {
      if (up) {
        manualHeightOffset.current += speed;
      }
      if (down) {
        manualHeightOffset.current = Math.max(-1, manualHeightOffset.current - speed);
        const terrainHeight = getElevationAt(world, position.current.x, position.current.z);
        position.current.y = Math.max(terrainHeight + 0.3, terrainHeight + 0.7 + manualHeightOffset.current);
      }

      if (up || down) {
        const terrainHeight = getElevationAt(world, position.current.x, position.current.z);
        position.current.y = terrainHeight + 0.7 + manualHeightOffset.current;
      }
    } else {
      manualHeightOffset.current = 0;
      const terrainHeight = getElevationAt(world, position.current.x, position.current.z);

      const sampleDist = 0.5;
      const heightN = getElevationAt(world, position.current.x, position.current.z - sampleDist);
      const heightS = getElevationAt(world, position.current.x, position.current.z + sampleDist);
      const heightE = getElevationAt(world, position.current.x + sampleDist, position.current.z);
      const heightW = getElevationAt(world, position.current.x - sampleDist, position.current.z);

      const maxSlope = Math.max(
        Math.abs(heightN - terrainHeight),
        Math.abs(heightS - terrainHeight),
        Math.abs(heightE - terrainHeight),
        Math.abs(heightW - terrainHeight),
      );

      const slopeBoost = Math.min(maxSlope * 0.4, 0.6);
      const baseEyeHeight = 0.7;
      position.current.y = terrainHeight + baseEyeHeight + slopeBoost;
    }

    camera.position.copy(position.current);

    const euler = new THREE.Euler(pitch, yaw, 0, "YXZ");
    camera.quaternion.setFromEuler(euler);

    globalCameraState.position = position.current.clone();
    globalCameraState.manualHeight = manualHeightOffset.current;
    globalCameraState.yaw = yaw;
    globalCameraState.pitch = pitch;

    onPositionChange?.(position.current.x, position.current.z, position.current.y);
  });

  return position;
}

export function resetCameraToSpawn() {
  globalCameraState.initialized = false;
  globalCameraState.manualHeight = null;
}

export function setCameraToEditorView(world: WorldData) {
  globalCameraState.position = new THREE.Vector3(0, 25, 0);
  globalCameraState.manualHeight = 25;
  globalCameraState.yaw = 0;
  globalCameraState.pitch = -Math.PI / 2;
  globalCameraState.initialized = true;
}

export function setCameraToExploreView(world: WorldData) {
  globalCameraState.initialized = false;
  globalCameraState.manualHeight = 0;
}

export function setCameraForLandTransition(x: number, z: number) {
  globalCameraState.pendingTransition = { x, z };
  globalCameraState.initialized = false;
}
