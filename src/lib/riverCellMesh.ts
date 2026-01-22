// River Cell Mesh Builder - UNIFIED SURFACE approach
// Builds a single continuous water mesh from all river cells
// Expands the covered area and creates ONE unified surface to avoid patchy overlaps
// Uses same coordinate system as SmoothTerrainMesh
// FIX: Water is FLAT - uses a single consistent water level per connected river segment

import * as THREE from "three";
import { WorldData } from "@/lib/worldData";
import { WORLD_HEIGHT_SCALE, RIVER_WATER_ABOVE_BED, computeRiverCarveDepth, toRow } from "@/lib/worldConstants";

// Surface lift above riverbed - must match water shader
const RIVER_SURFACE_LIFT = 0.08;

// Width extension beyond river cells (in grid units)
// This makes water overlap riverbed edges for natural appearance
const RIVER_WIDTH_EXTENSION = 0.5;

/**
 * Build river mesh from terrain cells using UNIFIED surface approach
 * 
 * Instead of creating per-cell quads (which overlap and cause patchy appearance),
 * we first expand the river mask, then build ONE continuous surface.
 * 
 * Uses IDENTICAL coordinate system as SmoothTerrainMesh:
 * - For loop y = 0..size (render Z coordinate)
 * - Position: (x, height, y)
 * - Terrain access: terrain[toRow(y, size)][x]
 */
export function buildRiverCellMesh(world: WorldData, worldX: number, worldY: number): THREE.BufferGeometry {
  if (!world?.terrain || world.terrain.length === 0 || !world.gridSize) {
    return new THREE.BufferGeometry();
  }

  const size = world.gridSize;

  // PASS 1: Build binary river mask and find riverbed heights
  const riverMask: boolean[][] = [];
  const bedHeights: number[][] = [];
  let globalMinBedHeight = Infinity;
  let globalMaxBedHeight = -Infinity;
  let riverCellCount = 0;

  for (let y = 0; y < size; y++) {
    riverMask[y] = [];
    bedHeights[y] = [];
    for (let x = 0; x < size; x++) {
      const flippedY = toRow(y, size);
      const cell = world.terrain[flippedY]?.[x];

      if (cell?.hasRiver && cell.type !== "water") {
        riverMask[y][x] = true;
        riverCellCount++;

        const baseH = cell.elevation * WORLD_HEIGHT_SCALE;
        const carve = computeRiverCarveDepth(
          world.terrain,
          x,
          y,
          flippedY,
          true,
          world.seed,
        );
        const bedHeight = baseH - carve;
        bedHeights[y][x] = bedHeight;
        globalMinBedHeight = Math.min(globalMinBedHeight, bedHeight);
        globalMaxBedHeight = Math.max(globalMaxBedHeight, bedHeight);
      } else {
        riverMask[y][x] = false;
        bedHeights[y][x] = 0;
      }
    }
  }

  if (riverCellCount === 0) {
    return new THREE.BufferGeometry();
  }

  // PASS 2: Expand river mask by extension amount
  // This creates a dilated mask so water extends beyond riverbed edges
  const ext = RIVER_WIDTH_EXTENSION;
  const expandedMask: boolean[][] = [];
  
  for (let y = 0; y < size; y++) {
    expandedMask[y] = [];
    for (let x = 0; x < size; x++) {
      // Check if this cell is within extension distance of any river cell
      let isNearRiver = false;
      
      // Check nearby cells within extension radius (use ceiling for integer range)
      const range = Math.ceil(ext);
      for (let dy = -range; dy <= range && !isNearRiver; dy++) {
        for (let dx = -range; dx <= range && !isNearRiver; dx++) {
          const ny = y + dy;
          const nx = x + dx;
          if (ny >= 0 && ny < size && nx >= 0 && nx < size) {
            if (riverMask[ny][nx]) {
              // Check actual distance
              const dist = Math.sqrt(dx * dx + dy * dy);
              if (dist <= ext + 0.5) { // +0.5 to include cell centers
                isNearRiver = true;
              }
            }
          }
        }
      }
      
      expandedMask[y][x] = isNearRiver;
    }
  }

  // Compute flat water height from riverbed average
  const avgBedHeight = (globalMinBedHeight + globalMaxBedHeight) / 2;
  const flatWaterHeight = avgBedHeight + RIVER_WATER_ABOVE_BED + RIVER_SURFACE_LIFT;

  // PASS 3: Build UNIFIED mesh from expanded mask
  const positions: number[] = [];
  const uvs: number[] = [];
  const edges: number[] = [];
  const indices: number[] = [];
  const vertIndex = new Map<string, number>();

  const ensureVertex = (x: number, y: number, isEdge: boolean): number => {
    const key = `${x},${y}`;
    const existing = vertIndex.get(key);
    if (existing !== undefined) return existing;

    const idx = positions.length / 3;
    positions.push(x, flatWaterHeight, y);
    uvs.push((x + worldX * (size - 1)) * 0.12, (y + worldY * (size - 1)) * 0.12);
    edges.push(isEdge ? 0.3 : 1.0);

    vertIndex.set(key, idx);
    return idx;
  };

  // Check if expanded mask has water at position
  const hasWaterAt = (x: number, y: number): boolean => {
    if (x < 0 || x >= size || y < 0 || y >= size) return false;
    return expandedMask[y][x];
  };

  // Build quads for expanded mask (single layer, no overlaps)
  for (let y = 0; y < size - 1; y++) {
    for (let x = 0; x < size - 1; x++) {
      // Only create quad if this cell is in expanded mask
      if (!expandedMask[y][x]) continue;

      // Check all 4 corners of this cell
      const has00 = hasWaterAt(x, y);
      const has10 = hasWaterAt(x + 1, y);
      const has01 = hasWaterAt(x, y + 1);
      const has11 = hasWaterAt(x + 1, y + 1);

      // Only create quad if at least 3 corners have water (smooth edges)
      const cornerCount = (has00 ? 1 : 0) + (has10 ? 1 : 0) + (has01 ? 1 : 0) + (has11 ? 1 : 0);
      if (cornerCount < 3) continue;

      // Determine which corners are edge (for foam effect)
      const isEdge00 = !hasWaterAt(x - 1, y) || !hasWaterAt(x, y - 1);
      const isEdge10 = !hasWaterAt(x + 2, y) || !hasWaterAt(x + 1, y - 1);
      const isEdge01 = !hasWaterAt(x - 1, y + 1) || !hasWaterAt(x, y + 2);
      const isEdge11 = !hasWaterAt(x + 2, y + 1) || !hasWaterAt(x + 1, y + 2);

      const v00 = ensureVertex(x, y, isEdge00);
      const v10 = ensureVertex(x + 1, y, isEdge10);
      const v01 = ensureVertex(x, y + 1, isEdge01);
      const v11 = ensureVertex(x + 1, y + 1, isEdge11);

      // Two triangles per quad
      indices.push(v00, v01, v10);
      indices.push(v01, v11, v10);
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
      if (cell?.hasRiver && cell.type !== "water") {
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
      if (cell?.hasRiver && cell.type !== "water") {
        count++;
      }
    }
  }

  return count;
}
