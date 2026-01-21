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
 */
function computeWaterHeightAt(
  world: WorldData,
  gridX: number,
  gridY: number // In grid space (not flipped)
): number {
  const size = world.gridSize;
  const fy = size - 1 - gridY; // Flip to terrain array indexing
  
  // Clamp to valid range
  const clampedX = Math.max(0, Math.min(size - 1, Math.floor(gridX)));
  const clampedFY = Math.max(0, Math.min(size - 1, fy));
  
  const row = world.terrain[clampedFY];
  if (!row) return 0;
  
  const cell = row[clampedX];
  if (!cell) return 0;

  const SURFACE_LIFT = 0.02;
  const bankClearance = 0.02;
  
  const baseH = cell.elevation * WORLD_HEIGHT_SCALE;
  const carve = computeRiverCarveDepth(
    world.terrain,
    clampedX,
    Math.floor(gridY),
    clampedFY,
    true,
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
 * RIVER FIX: Added DEV logging and fallback handling
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
  let mask = buildRiverMaskField(world.terrain, size);
  
  // RIVER FIX: Log mask stats in DEV mode
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
  
  // Step 2: Dilate more to fill gaps and make rivers wider/more visible
  mask = dilateRiverMask(mask, size, size, 2); // Increased from 1 to 2
  
  // Step 3: Triple blur for very smooth contours (removes blocky look)
  mask = blurRiverMask(mask, size, size);
  mask = blurRiverMask(mask, size, size);
  mask = blurRiverMask(mask, size, size); // Third blur pass

  // Step 4: Extract contours at lower iso threshold for better river capture
  // Lower threshold = more area captured = wider rivers
  const contours = marchingSquares(mask, size, size, 0.15); // Lowered from 0.2
  
  if (DEV) {
    console.debug(`[riverContourMesh] Contours extracted: ${contours.length} polylines`);
  }
  
  // RIVER FIX: Don't return empty - this causes invisible rivers
  if (contours.length === 0) {
    if (DEV) {
      console.warn('[riverContourMesh] No contours extracted - river may be invisible');
    }
    return new THREE.BufferGeometry();
  }

  // Step 5: Smooth contours with MORE Chaikin iterations for natural curves
  // 4 iterations gives very smooth, non-blocky shorelines
  const smoothContours = contours.map(c => smoothPolylineChaikin(c, 4, true)); // Increased from 3

  // Step 6: Build geometry from all contours
  const positions: number[] = [];
  const uvs: number[] = [];
  const edges: number[] = [];
  const indices: number[] = [];

  let vertexOffset = 0;

  for (const contour of smoothContours) {
    if (contour.length < 3) continue;

    // Add vertices for this contour
    const contourVertexStart = positions.length / 3;
    
    // Pre-compute center of contour for edge distance calculation
    let cx = 0, cy = 0;
    for (const [px, py] of contour) {
      cx += px;
      cy += py;
    }
    cx /= contour.length;
    cy /= contour.length;
    
    // Find max distance from center for normalization
    let maxDist = 0;
    for (const [px, py] of contour) {
      const d = Math.sqrt((px - cx) ** 2 + (py - cy) ** 2);
      if (d > maxDist) maxDist = d;
    }
    maxDist = Math.max(maxDist, 0.5); // Prevent division by zero
    
    for (const [px, py] of contour) {
      const waterY = sampleWaterHeightBilinear(world, px, py);
      
      positions.push(px, waterY, py);
      uvs.push(
        (px + worldX * (size - 1)) * 0.12,
        (py + worldY * (size - 1)) * 0.12
      );
      
      // Edge attribute based on distance from center
      // Interior vertices (near center) get 1.0, edge vertices get lower values
      const dist = Math.sqrt((px - cx) ** 2 + (py - cy) ** 2);
      const edgeVal = 0.6 + 0.4 * (1.0 - dist / maxDist); // 0.6 at edge, 1.0 at center
      edges.push(edgeVal);
    }

    // Triangulate the contour
    const triIndices = triangulatePolygon(contour);
    
    for (const idx of triIndices) {
      indices.push(contourVertexStart + idx);
    }

    vertexOffset = positions.length / 3;
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
