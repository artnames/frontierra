// Deterministic World Contract & Verification System
// Provides hashing, action storage, and replay capabilities

import { WorldData, TerrainCell } from './worldData';

// ============================================
// WORLD HASH - Cryptographic terrain fingerprint
// ============================================

export function computeWorldHash(world: WorldData): string {
  // Create a deterministic string from world data
  const terrainString = world.terrain
    .flat()
    .map((cell: TerrainCell) => 
      `${cell.x},${cell.y}:${cell.elevation.toFixed(4)}:${cell.type}`
    )
    .join('|');
  
  const objectString = `OBJ:${world.plantedObject.x},${world.plantedObject.y},${world.plantedObject.z.toFixed(2)},${world.plantedObject.type}`;
  const spawnString = `SPAWN:${world.spawnPoint.x},${world.spawnPoint.y},${world.spawnPoint.z.toFixed(2)},${world.spawnPoint.rotationY.toFixed(4)}`;
  
  const fullString = `SEED:${world.seed}|VARS:${world.vars.join(',')}|${terrainString}|${objectString}|${spawnString}`;
  
  // Simple hash function (djb2)
  let hash = 5381;
  for (let i = 0; i < fullString.length; i++) {
    hash = ((hash << 5) + hash) ^ fullString.charCodeAt(i);
    hash = hash >>> 0; // Convert to unsigned
  }
  
  // Return as hex string
  return hash.toString(16).padStart(8, '0').toUpperCase();
}

// ============================================
// ACTION SYSTEM - Irreversible deterministic actions
// ============================================

export type ActionType = 'plant_beacon' | 'claim_tile' | 'drop_marker';

export interface WorldAction {
  type: ActionType;
  gridX: number;
  gridY: number;
  timestamp?: number; // Optional - for ordering, NOT randomness
}

export interface ActionResult {
  success: boolean;
  message: string;
  hash: string; // Result hash for verification
}

// Compute action result deterministically
export function executeAction(
  world: WorldData, 
  action: WorldAction,
  existingActions: WorldAction[]
): ActionResult {
  const { type, gridX, gridY } = action;
  
  // Bounds check
  if (gridX < 0 || gridX >= world.gridSize || gridY < 0 || gridY >= world.gridSize) {
    return {
      success: false,
      message: 'OUT_OF_BOUNDS',
      hash: '00000000'
    };
  }
  
  const cell = world.terrain[gridY]?.[gridX];
  if (!cell) {
    return {
      success: false,
      message: 'CELL_NOT_FOUND',
      hash: '00000000'
    };
  }
  
  // Check if tile is valid for action
  if (cell.type === 'water') {
    return {
      success: false,
      message: 'CANNOT_ACT_ON_WATER',
      hash: '00000000'
    };
  }
  
  // Check if action already exists at this location
  const existingAtLocation = existingActions.find(
    a => a.gridX === gridX && a.gridY === gridY
  );
  
  if (existingAtLocation) {
    return {
      success: false,
      message: 'TILE_ALREADY_CLAIMED',
      hash: '00000000'
    };
  }
  
  // Only one action allowed per world
  if (existingActions.length > 0) {
    return {
      success: false,
      message: 'ACTION_LIMIT_REACHED',
      hash: '00000000'
    };
  }
  
  // Compute deterministic result hash
  const resultString = `${world.seed}:${type}:${gridX}:${gridY}:${cell.elevation.toFixed(4)}`;
  let hash = 5381;
  for (let i = 0; i < resultString.length; i++) {
    hash = ((hash << 5) + hash) ^ resultString.charCodeAt(i);
    hash = hash >>> 0;
  }
  
  return {
    success: true,
    message: 'ACTION_EXECUTED',
    hash: hash.toString(16).padStart(8, '0').toUpperCase()
  };
}

// Serialize actions for URL storage
export function serializeActions(actions: WorldAction[]): string {
  if (actions.length === 0) return '';
  return actions
    .map(a => `${a.type}:${a.gridX}:${a.gridY}`)
    .join(';');
}

// Parse actions from URL
export function parseActions(str: string): WorldAction[] {
  if (!str) return [];
  return str.split(';').map(part => {
    const [type, x, y] = part.split(':');
    return {
      type: type as ActionType,
      gridX: parseInt(x, 10),
      gridY: parseInt(y, 10)
    };
  }).filter(a => !isNaN(a.gridX) && !isNaN(a.gridY));
}

// ============================================
// REPLAY SYSTEM
// ============================================

export interface ReplayState {
  isReplaying: boolean;
  currentStep: number;
  totalSteps: number;
  phase: 'spawn' | 'move' | 'action' | 'complete';
}

export interface ReplayFrame {
  position: { x: number; y: number; z: number };
  rotation: number;
  action?: WorldAction;
}

// Generate deterministic replay path from spawn to object
export function generateReplayPath(world: WorldData, action?: WorldAction): ReplayFrame[] {
  const frames: ReplayFrame[] = [];
  const { spawnPoint, plantedObject } = world;
  
  // Start at spawn
  let x = spawnPoint.x;
  let y = spawnPoint.y;
  let z = spawnPoint.z;
  
  const targetX = plantedObject.x;
  const targetY = plantedObject.y;
  
  // Simple linear interpolation path
  const steps = 60; // ~2 seconds at 30fps
  
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const px = x + (targetX - x) * t;
    const py = y + (targetY - y) * t;
    
    // Calculate rotation to face direction of movement
    const rotation = Math.atan2(targetX - x, targetY - y);
    
    // Get terrain height at position
    const gridX = Math.floor(px);
    const gridY = Math.floor(py);
    const cell = world.terrain[gridY]?.[gridX];
    const pz = cell ? cell.elevation * 20 + 2 : z;
    
    frames.push({
      position: { x: px, y: py, z: pz },
      rotation
    });
  }
  
  // Add action frame if provided
  if (action) {
    frames.push({
      position: frames[frames.length - 1].position,
      rotation: frames[frames.length - 1].rotation,
      action
    });
  }
  
  return frames;
}

// ============================================
// DETERMINISM STRESS TEST
// ============================================

export interface DeterminismTest {
  isValid: boolean;
  expectedHash: string;
  actualHash: string;
  breakType?: 'math_random' | 'date' | 'none';
}

// Inject non-determinism for testing
export function computeHashWithBreak(
  world: WorldData, 
  breakType: 'math_random' | 'date' | 'none'
): string {
  if (breakType === 'none') {
    return computeWorldHash(world);
  }
  
  // Inject non-deterministic value
  let entropy: number;
  if (breakType === 'math_random') {
    entropy = Math.random() * 1000000;
  } else {
    entropy = Date.now();
  }
  
  // Compute corrupted hash
  const baseHash = computeWorldHash(world);
  const corruptedString = `${baseHash}:BREAK:${entropy.toFixed(0)}`;
  
  let hash = 5381;
  for (let i = 0; i < corruptedString.length; i++) {
    hash = ((hash << 5) + hash) ^ corruptedString.charCodeAt(i);
    hash = hash >>> 0;
  }
  
  return hash.toString(16).padStart(8, '0').toUpperCase();
}

export function runDeterminismTest(
  world: WorldData, 
  breakType: 'math_random' | 'date' | 'none'
): DeterminismTest {
  const expectedHash = computeWorldHash(world);
  const actualHash = computeHashWithBreak(world, breakType);
  
  return {
    isValid: expectedHash === actualHash,
    expectedHash,
    actualHash,
    breakType
  };
}

// ============================================
// PROTOCOL METADATA
// ============================================

export const PROTOCOL_INFO = {
  name: 'NexArt Code Mode',
  version: '1.2.0',
  sdk: '1.5.1',
  phase: 3,
  enforcement: 'HARD',
  determinism: 'GUARANTEED'
};
