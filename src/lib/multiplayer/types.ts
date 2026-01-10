// Deterministic Multiplayer World Types
// Only stores world parameters - all terrain is derived at runtime via NexArt
// World A: 10×10 grid (100 lands) with shared macro geography

import { WorldContext, WORLD_GRID_WIDTH, WORLD_GRID_HEIGHT } from '@/lib/worldContext';

export interface PlayerLand {
  player_id: string;
  seed: number;
  vars: number[];  // Always 10 elements, 0-100
  pos_x: number;   // Grid position in world topology (0-9 for World A)
  pos_y: number;
  created_at?: string;
  updated_at?: string;
}

export interface WorldTopology {
  lands: Map<string, PlayerLand>;  // Key: "x,y" grid position
  gridWidth: number;   // Always 10 for World A
  gridHeight: number;  // Always 10 for World A
}

// World A constants
export const WORLD_A_GRID_WIDTH = WORLD_GRID_WIDTH;   // 10
export const WORLD_A_GRID_HEIGHT = WORLD_GRID_HEIGHT; // 10

export type EdgeDirection = 'north' | 'south' | 'east' | 'west';

export interface EdgeCrossing {
  direction: EdgeDirection;
  fromLand: PlayerLand;
  toLand: PlayerLand | null;  // null = empty/unowned land
  entryPosition: { x: number; z: number };  // Mirrored position on new land
}

// Grid size of each NexArt land (64x64 pixels → scaled to 3D)
export const LAND_GRID_SIZE = 64;

// 3D world scale factor
export const LAND_WORLD_SCALE = 1;  // Each pixel = 1 unit in 3D

// Get the opposite edge direction for repositioning
export function getOppositeDirection(dir: EdgeDirection): EdgeDirection {
  switch (dir) {
    case 'north': return 'south';
    case 'south': return 'north';
    case 'east': return 'west';
    case 'west': return 'east';
  }
}

// Calculate entry position when crossing an edge
// The entry position must be far enough from the edge to avoid re-triggering a transition
export function calculateEntryPosition(
  exitPosition: { x: number; z: number },
  direction: EdgeDirection,
  landSize: number = LAND_GRID_SIZE
): { x: number; z: number } {
  const safeMargin = 5;  // Must be larger than detection margin (1.0) to prevent loop
  
  switch (direction) {
    case 'north':
      // Exited north edge, enter from south edge of new land
      return { x: exitPosition.x, z: landSize - safeMargin };
    case 'south':
      // Exited south edge, enter from north edge of new land
      return { x: exitPosition.x, z: safeMargin };
    case 'east':
      // Exited east edge, enter from west edge of new land
      return { x: safeMargin, z: exitPosition.z };
    case 'west':
      // Exited west edge, enter from east edge of new land
      return { x: landSize - safeMargin, z: exitPosition.z };
  }
}

// Get neighbor grid position from current position and direction
export function getNeighborPosition(
  currentX: number,
  currentY: number,
  direction: EdgeDirection
): { x: number; y: number } {
  switch (direction) {
    case 'north': return { x: currentX, y: currentY - 1 };
    case 'south': return { x: currentX, y: currentY + 1 };
    case 'east': return { x: currentX + 1, y: currentY };
    case 'west': return { x: currentX - 1, y: currentY };
  }
}
