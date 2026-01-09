// Deterministic Multiplayer World Types
// Only stores world parameters - all terrain is derived at runtime via NexArt

export interface PlayerLand {
  player_id: string;
  seed: number;
  vars: number[];  // Always 10 elements, 0-100
  pos_x: number;   // Grid position in world topology
  pos_y: number;
  created_at?: string;
  updated_at?: string;
}

export interface WorldTopology {
  lands: Map<string, PlayerLand>;  // Key: "x,y" grid position
  gridWidth: number;
  gridHeight: number;
}

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
export function calculateEntryPosition(
  exitPosition: { x: number; z: number },
  direction: EdgeDirection,
  landSize: number = LAND_GRID_SIZE
): { x: number; z: number } {
  const margin = 2;  // Small offset to prevent immediate re-crossing
  
  switch (direction) {
    case 'north':
      return { x: exitPosition.x, z: landSize - margin };
    case 'south':
      return { x: exitPosition.x, z: margin };
    case 'east':
      return { x: margin, z: exitPosition.z };
    case 'west':
      return { x: landSize - margin, z: exitPosition.z };
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
