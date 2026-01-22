// River Contour Mesh Builder
// Converts marching squares contours into Three.js geometry
// Uses existing water height logic for Y positioning

import * as THREE from "three";
import { WorldData, TerrainCell } from "@/lib/worldData";
import {
  marchingSquares,
  smoothPolylineChaikin,
  buildRiverMaskField,
  dilateRiverMask,
  blurRiverMask,
} from "@/lib/marchingSquares";
import {
  WORLD_HEIGHT_SCALE,
  RIVER_WATER_ABOVE_BED,
  computeRiverCarveDepth,
  toRow,
} from "@/lib/worldConstants";

type Point = [number, number];

/**
 * Triangulate a simple polygon using ear clipping
 * Returns array of triangle indices
 */
function triangulatePolygon(points: Point[]): number[] {
  if (points.length < 3) return [];

  // Use Three.js ShapeUtils for triangulation
  const shape = new THREE.Shape();
  shape.moveTo(points[0][0], points[0][1]);
  for (let i = 1; i < points.length; i++) {
    shape.lineTo(points[i][0], points[i][1]);
  }
  shape.closePath();

  // Get triangulated faces
  const shapeGeo = new THREE.ShapeGeometry(shape);
  const indices: number[] = [];
  const posAttr = shapeGeo.attributes.position;

  // ShapeGeometry creates its own vertices, we need to map back
  // Instead, use ShapeUtils directly
  shapeGeo.dispose();

  // Direct triangulation using Three's internal utilities
  const contour = points.map(p => new THREE.Vector2(p[0], p[1]));
  try {
    const faces = THREE.ShapeUtils.triangulateShape(contour, []);
    for (const [a, b, c] of faces) {
      indices.push(a, b, c);
    }
  } catch {
    // Fallback: simple fan triangulation for convex-ish shapes
    for (let i = 1; i < points.length - 1; i++) {
      indices.push(0, i, i + 1);
    }
  }

  return indices;
}

/**
 * Compute water height at a grid position using existing river carve logic
 * 
 * COORDINATE SYSTEM (must match SmoothTerrainMesh exactly):
 * - SmoothTerrainMesh: for loop y=0..size, places vertex at Z=y, samples terrain[size-1-y][x]
 * - buildRiverMaskField: for loop y=0..size, fy=size-1-y, samples terrain[fy][x], writes mask[y*size+x]
 * - marchingSquares: produces contour points (px, py) in mask coordinate space
 * 
 * Therefore: contour point (px, py) corresponds to:
 * - Render position: X=px, Z=py (same as terrain mesh)
 * - Terrain array: terrain[size-1-py][px]
 */
function computeWaterHeightAt(
  world: WorldData,
  contourX: number,  // X from contour (same as render X and grid X)
  contourY: number   // Y from contour = render Z coordinate
): number {
  const size = world.gridSize;
  
  // Clamp to valid grid range
  const gridX = Math.max(0, Math.min(size - 1, Math.floor(contourX)));
  const gridY = Math.max(0, Math.min(size - 1, Math.floor(contourY)));
  
  // Convert render Y to terrain array row index using shared helper
  const terrainRowIndex = toRow(gridY, size);
  
  const row = world.terrain[terrainRowIndex];
  if (!row) return 0;
  
  const cell = row[gridX];
  if (!cell) return 0;

  const SURFACE_LIFT = 0.15; // Match the lift in EnhancedWaterPlane
  const bankClearance = 0.02;
  
  // Base height (elevation already has curve applied)
  const baseH = cell.elevation * WORLD_HEIGHT_SCALE;
  
  // Use same parameters as terrain mesh:
  // - x = gridX (same)
  // - y = gridY (render Y, for noise calculation)  
  // - flippedY = terrainRowIndex (for terrain array access)
  const carve = computeRiverCarveDepth(
    world.terrain,
    gridX,
    gridY,           // render Y (same as terrain mesh)
    terrainRowIndex, // flipped index for terrain array
    true,            // isRiverCell - we're sampling river positions
    world.seed
  );
  
  const bedHeight = baseH - carve;
  const waterSurface = bedHeight + RIVER_WATER_ABOVE_BED;
  const surface = Math.min(waterSurface, baseH - bankClearance);
  
  return surface + SURFACE_LIFT;
}

/**
 * Sample water height with bilinear interpolation for smoother results
 */
function sampleWaterHeightBilinear(
  world: WorldData,
  x: number,
  y: number
): number {
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const fx = x - x0;
  const fy = y - y0;
  
  const h00 = computeWaterHeightAt(world, x0, y0);
  const h10 = computeWaterHeightAt(world, x0 + 1, y0);
  const h01 = computeWaterHeightAt(world, x0, y0 + 1);
  const h11 = computeWaterHeightAt(world, x0 + 1, y0 + 1);
  
  const h0 = h00 * (1 - fx) + h10 * fx;
  const h1 = h01 * (1 - fx) + h11 * fx;
  
  return h0 * (1 - fy) + h1 * fy;
}

/**
 * Build smooth river geometry from contours
 * 
 * COORDINATE ALIGNMENT with SmoothTerrainMesh:
 * - Terrain mesh: y loop 0..size → vertex at (x, height, y) → samples terrain[size-1-y][x]
 * - River mask: y loop 0..size → fy=size-1-y → samples terrain[fy][x] → writes mask[y*size+x]
 * - Marching squares: extracts contours in mask space (px, py)
 * - Result: contour (px, py) → render (X=px, Z=py) → perfectly aligned with terrain
 */
export function buildSmoothRiverGeometry(
  world: WorldData,
  worldX: number,
  worldY: number
): THREE.BufferGeometry {
  const DEV = import.meta.env.DEV;
  
  if (!world?.terrain || world.terrain.length === 0 || !world.gridSize) {
    return new THREE.BufferGeometry();
  }

  const size = world.gridSize;

  // Step 1: Build river mask
  // The mask is built with y=0..size where mask[y*size+x] corresponds to terrain[size-1-y][x]
  // So mask y=0 is terrain row (size-1), mask y=(size-1) is terrain row 0
  let mask = buildRiverMaskField(world.terrain, size);
  
  if (DEV) {
    let min = Infinity, max = -Infinity, sum = 0, count = 0;
    for (let i = 0; i < mask.length; i++) {
      const v = mask[i];
      if (v > 0) {
        min = Math.min(min, v);
        max = Math.max(max, v);
        sum += v;
        count++;
      }
    }
    console.debug(`[riverContourMesh] Mask stats: min=${min.toFixed(2)}, max=${max.toFixed(2)}, avg=${count > 0 ? (sum/count).toFixed(2) : 'N/A'}, nonzero=${count}`);
  }
  
  // Step 2: Dilate to fill gaps
  mask = dilateRiverMask(mask, size, size, 2);
  
  // Step 3: Triple blur for smooth contours
  mask = blurRiverMask(mask, size, size);
  mask = blurRiverMask(mask, size, size);
  mask = blurRiverMask(mask, size, size);

  // Step 4: Extract contours - these are in MASK space (y goes 0 to size)
  const contours = marchingSquares(mask, size, size, 0.15);
  
  if (DEV) {
    console.debug(`[riverContourMesh] Contours extracted: ${contours.length} polylines`);
  }
  
  if (contours.length === 0) {
    if (DEV) {
      console.warn('[riverContourMesh] No contours extracted - river may be invisible');
    }
    return new THREE.BufferGeometry();
  }

  // Step 5: Smooth contours
  const smoothContours = contours.map(c => smoothPolylineChaikin(c, 4, true));

  // Step 6: Build geometry
  // CRITICAL: Contour points [px, py] are in mask space
  // To match terrain render: X stays the same, Z = py (mask y directly maps to render Z)
  // Because terrain uses: positions[z] = y (where y is the loop variable, 0..size)
  // And mask is built with: y loop 0..size, accessing terrain[size-1-y]
  // This means mask y=0 corresponds to render Z=0 (both start at the same corner)
  
  const positions: number[] = [];
  const uvs: number[] = [];
  const edges: number[] = [];
  const indices: number[] = [];

  for (const contour of smoothContours) {
    if (contour.length < 3) continue;

    const contourVertexStart = positions.length / 3;
    
    // Compute center for edge distance
    let cx = 0, cy = 0;
    for (const [px, py] of contour) {
      cx += px;
      cy += py;
    }
    cx /= contour.length;
    cy /= contour.length;
    
    let maxDist = 0;
    for (const [px, py] of contour) {
      const d = Math.sqrt((px - cx) ** 2 + (py - cy) ** 2);
      if (d > maxDist) maxDist = d;
    }
    maxDist = Math.max(maxDist, 0.5);
    
    for (const [px, py] of contour) {
      // px = X coordinate (same for both systems)
      // py = mask Y coordinate = render Z coordinate (both 0..size from same corner)
      const renderX = px;
      const renderZ = py;
      
      // Sample water height - need to convert to terrain array indexing
      const waterY = sampleWaterHeightBilinear(world, px, py);
      
      positions.push(renderX, waterY, renderZ);
      uvs.push(
        (renderX + worldX * (size - 1)) * 0.12,
        (renderZ + worldY * (size - 1)) * 0.12
      );
      
      // Edge attribute
      const dist = Math.sqrt((px - cx) ** 2 + (py - cy) ** 2);
      const edgeVal = 0.6 + 0.4 * (1.0 - dist / maxDist);
      edges.push(edgeVal);
    }

    // Triangulate the contour
    const triIndices = triangulatePolygon(contour);
    
    for (const idx of triIndices) {
      indices.push(contourVertexStart + idx);
    }
  }

  if (positions.length === 0) {
    return new THREE.BufferGeometry();
  }

  if (DEV) {
    console.debug(`[riverContourMesh] Final geometry: ${positions.length / 3} vertices, ${indices.length / 3} triangles`);
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
 * Check if contour-based river mesh is viable for this world
 * Returns true if there are river cells to render
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
 * Count total river cells in the world terrain grid
 * Used for debug overlay statistics
 */
export function countRiverCellsInWorld(world: WorldData): number {
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
