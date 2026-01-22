// River Cell Mesh Builder - DIRECT CELL-BASED approach
// Builds river geometry from exact terrain cells marked as river
// NO dilation, blur, or marching squares - guarantees perfect alignment with terrain
// Uses same coordinate system as SmoothTerrainMesh
// FIX: Water is FLAT - uses a single consistent water level per connected river segment

import * as THREE from "three";
import { WorldData } from "@/lib/worldData";
import {
  WORLD_HEIGHT_SCALE,
  RIVER_WATER_ABOVE_BED,
  computeRiverCarveDepth,
  toRow,
} from "@/lib/worldConstants";

// Surface lift above riverbed - must match water shader
const RIVER_SURFACE_LIFT = 0.12;

/**
 * Build river mesh from exact terrain cells
 * Uses IDENTICAL coordinate system as SmoothTerrainMesh:
 * - For loop y = 0..size (render Z coordinate)
 * - Position: (x, height, y)
 * - Terrain access: terrain[toRow(y, size)][x]
 * 
 * FIX: Water is FLAT - we compute one water level for the entire river
 * based on the MINIMUM riverbed height. This ensures water flows naturally
 * downhill and doesn't follow terrain undulations.
 */
export function buildRiverCellMesh(
  world: WorldData,
  worldX: number,
  worldY: number
): THREE.BufferGeometry {
  if (!world?.terrain || world.terrain.length === 0 || !world.gridSize) {
    return new THREE.BufferGeometry();
  }

  const size = world.gridSize;
  
  // PASS 1: Find ALL river cells and compute GLOBAL minimum riverbed height
  // This creates a flat water surface that settles at the lowest point
  const riverCells: Array<{ x: number; renderY: number; bedHeight: number }> = [];
  let globalMinBedHeight = Infinity;
  let globalMaxBedHeight = -Infinity;

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const flippedY = toRow(y, size);
      const cell = world.terrain[flippedY]?.[x];
      
      if (!cell?.hasRiver || cell.type === 'water') continue;
      
      const baseH = cell.elevation * WORLD_HEIGHT_SCALE;
      const carve = computeRiverCarveDepth(
        world.terrain,
        x,
        y,     // render Y for noise
        flippedY, // flipped index for terrain access
        true,  // isRiverCell
        world.seed
      );
      
      const bedHeight = baseH - carve;
      riverCells.push({ x, renderY: y, bedHeight });
      
      globalMinBedHeight = Math.min(globalMinBedHeight, bedHeight);
      globalMaxBedHeight = Math.max(globalMaxBedHeight, bedHeight);
    }
  }

  if (riverCells.length === 0) {
    return new THREE.BufferGeometry();
  }

  // FIX: Use a SINGLE flat water level for the entire river
  // The water surface is positioned at the average bed height + water above bed + lift
  // This creates realistic flat water that doesn't follow terrain bumps
  const avgBedHeight = (globalMinBedHeight + globalMaxBedHeight) / 2;
  const flatWaterHeight = avgBedHeight + RIVER_WATER_ABOVE_BED + RIVER_SURFACE_LIFT;

  const positions: number[] = [];
  const uvs: number[] = [];
  const edges: number[] = [];
  const indices: number[] = [];

  // Vertex deduplication (same as terrain mesh)
  const vertIndex = new Map<string, number>();
  
  // Now use FLAT water height for all vertices
  const getWaterHeight = (_x: number, _renderY: number): number => {
    return flatWaterHeight;
  };

  const ensureVertex = (x: number, y: number): number => {
    const key = `${x},${y}`;
    const existing = vertIndex.get(key);
    if (existing !== undefined) return existing;

    const h = getWaterHeight(x, y);
    const idx = positions.length / 3;
    
    positions.push(x, h, y);
    uvs.push(
      (x + worldX * (size - 1)) * 0.12,
      (y + worldY * (size - 1)) * 0.12
    );
    edges.push(1.0); // Will be adjusted for edge cells
    
    vertIndex.set(key, idx);
    return idx;
  };

  // Check if a cell is a river (not ocean)
  const isRiverAt = (renderY: number, x: number): boolean => {
    if (x < 0 || x >= size || renderY < 0 || renderY >= size) return false;
    const flippedY = toRow(renderY, size);
    const cell = world.terrain[flippedY]?.[x];
    return !!cell?.hasRiver && cell.type !== 'water';
  };

  // Build quads for each river cell
  // Use SAME loop structure as SmoothTerrainMesh for consistency
  for (let y = 0; y < size - 1; y++) {
    for (let x = 0; x < size - 1; x++) {
      const flippedY = toRow(y, size);
      const cell = world.terrain[flippedY]?.[x];
      
      if (!cell?.hasRiver || cell.type === 'water') continue;

      // Create quad vertices at cell corners
      const v00 = ensureVertex(x, y);
      const v10 = ensureVertex(x + 1, y);
      const v01 = ensureVertex(x, y + 1);
      const v11 = ensureVertex(x + 1, y + 1);

      // Two triangles per cell (same winding as terrain)
      indices.push(v00, v01, v10);
      indices.push(v01, v11, v10);

      // Check if this is an edge cell (for shading)
      const isInterior = 
        isRiverAt(y, x - 1) && isRiverAt(y, x + 1) &&
        isRiverAt(y - 1, x) && isRiverAt(y + 1, x);

      if (!isInterior) {
        // Mark edge vertices for foam/transparency
        edges[v00] = 0.7;
        edges[v10] = 0.7;
        edges[v01] = 0.7;
        edges[v11] = 0.7;
      }
    }
  }

  if (positions.length === 0) {
    return new THREE.BufferGeometry();
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  geo.setAttribute("aEdge", new THREE.Float32BufferAttribute(edges, 1));
  geo.setIndex(indices);
  geo.computeVertexNormals();

  return geo;
}

/**
 * Check if world has any river cells (not ocean)
 */
export function hasRiverCells(world: WorldData): boolean {
  if (!world?.terrain) return false;
  
  for (const row of world.terrain) {
    if (!row) continue;
    for (const cell of row) {
      if (cell?.hasRiver && cell.type !== 'water') {
        return true;
      }
    }
  }
  
  return false;
}

/**
 * Count river cells in world
 */
export function countRiverCells(world: WorldData): number {
  if (!world?.terrain) return 0;
  
  let count = 0;
  for (const row of world.terrain) {
    if (!row) continue;
    for (const cell of row) {
      if (cell?.hasRiver && cell.type !== 'water') {
        count++;
      }
    }
  }
  
  return count;
}
