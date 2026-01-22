// Marching Squares + Chaikin Smoothing for contour-based river mesh
// DETERMINISTIC: No Math.random, uses seed-based logic where needed

import { toRow } from './worldConstants';

type Point = [number, number];
type Polyline = Point[];

/**
 * Marching Squares contour extraction
 * Extracts iso-contours from a 2D scalar field
 * 
 * @param field - Float32Array of values (row-major, y*w + x)
 * @param w - Field width
 * @param h - Field height
 * @param iso - Iso-value threshold (typically 0.5)
 * @returns Array of closed polylines in grid coordinates
 */
export function marchingSquares(
  field: Float32Array,
  w: number,
  h: number,
  iso: number
): Polyline[] {
  if (w < 2 || h < 2) return [];

  // Edge table for marching squares (16 cases)
  // Each case defines which edges to connect
  // Format: Array of [edge1, edge2] pairs per case
  const edgeTable: [number, number][][] = [
    [],                   // 0000 - no edges
    [[3, 0]],             // 0001
    [[0, 1]],             // 0010
    [[3, 1]],             // 0011
    [[1, 2]],             // 0100
    [[3, 0], [1, 2]],     // 0101 - ambiguous (saddle)
    [[0, 2]],             // 0110
    [[3, 2]],             // 0111
    [[2, 3]],             // 1000
    [[2, 0]],             // 1001
    [[0, 1], [2, 3]],     // 1010 - ambiguous (saddle)
    [[2, 1]],             // 1011
    [[1, 3]],             // 1100
    [[1, 0]],             // 1101
    [[0, 3]],             // 1110
    [],                   // 1111 - no edges
  ];

  // Sample field value with bounds checking
  const sample = (x: number, y: number): number => {
    if (x < 0 || x >= w || y < 0 || y >= h) return 0;
    return field[y * w + x];
  };

  // Linear interpolation for edge crossing position
  const lerp = (v1: number, v2: number): number => {
    if (Math.abs(v2 - v1) < 0.0001) return 0.5;
    return (iso - v1) / (v2 - v1);
  };

  // Get edge point (edges are: 0=top, 1=right, 2=bottom, 3=left)
  const getEdgePoint = (cx: number, cy: number, edge: number, v: number[]): Point => {
    switch (edge) {
      case 0: return [cx + lerp(v[0], v[1]), cy]; // top
      case 1: return [cx + 1, cy + lerp(v[1], v[2])]; // right
      case 2: return [cx + lerp(v[3], v[2]), cy + 1]; // bottom
      case 3: return [cx, cy + lerp(v[0], v[3])]; // left
      default: return [cx + 0.5, cy + 0.5];
    }
  };

  // Collect all edge segments
  type Segment = [Point, Point];
  const segments: Segment[] = [];

  for (let cy = 0; cy < h - 1; cy++) {
    for (let cx = 0; cx < w - 1; cx++) {
      // Sample corners (TL, TR, BR, BL)
      const v = [
        sample(cx, cy),
        sample(cx + 1, cy),
        sample(cx + 1, cy + 1),
        sample(cx, cy + 1),
      ];

      // Compute case index
      let caseIndex = 0;
      if (v[0] >= iso) caseIndex |= 1;
      if (v[1] >= iso) caseIndex |= 2;
      if (v[2] >= iso) caseIndex |= 4;
      if (v[3] >= iso) caseIndex |= 8;

      const edges = edgeTable[caseIndex];
      for (const [e1, e2] of edges) {
        const p1 = getEdgePoint(cx, cy, e1, v);
        const p2 = getEdgePoint(cx, cy, e2, v);
        segments.push([p1, p2]);
      }
    }
  }

  if (segments.length === 0) return [];

  // Chain segments into polylines
  return chainSegments(segments);
}

/**
 * Create a spatial hash key for a point
 * Uses fixed precision to handle floating point comparison
 */
function pointKey(pt: Point, epsilon: number = 0.001): string {
  // Round to nearest epsilon to handle floating point comparison
  const precision = 1 / epsilon;
  const x = Math.round(pt[0] * precision);
  const y = Math.round(pt[1] * precision);
  return `${x}:${y}`;
}

/**
 * Build spatial index for O(1) segment lookups by endpoint
 * Returns a map from point key to list of { segmentIndex, isEnd }
 */
function buildSpatialIndex(segments: [Point, Point][]): Map<string, { idx: number; isEnd: boolean }[]> {
  const index = new Map<string, { idx: number; isEnd: boolean }[]>();
  
  for (let i = 0; i < segments.length; i++) {
    const [start, end] = segments[i];
    const startKey = pointKey(start);
    const endKey = pointKey(end);
    
    // Add start point
    if (!index.has(startKey)) {
      index.set(startKey, []);
    }
    index.get(startKey)!.push({ idx: i, isEnd: false });
    
    // Add end point
    if (!index.has(endKey)) {
      index.set(endKey, []);
    }
    index.get(endKey)!.push({ idx: i, isEnd: true });
  }
  
  return index;
}

/**
 * Chain disconnected segments into continuous polylines
 * Uses spatial hash for O(1) endpoint lookups instead of O(n) linear scan
 */
function chainSegments(segments: [Point, Point][]): Polyline[] {
  if (segments.length === 0) return [];
  
  const polylines: Polyline[] = [];
  const used = new Set<number>();
  
  // Build spatial index for O(1) lookups
  const spatialIndex = buildSpatialIndex(segments);

  // Find segment that starts or ends at given point using spatial index
  const findConnecting = (pt: Point, exclude: Set<number>): { idx: number; reverse: boolean } | null => {
    const key = pointKey(pt);
    const candidates = spatialIndex.get(key);
    if (!candidates) return null;
    
    for (const { idx, isEnd } of candidates) {
      if (exclude.has(idx)) continue;
      // If isEnd is true, the segment's END is at this point, so we DON'T reverse
      // If isEnd is false, the segment's START is at this point, so we also DON'T reverse
      // The reverse flag indicates whether we need to traverse the segment backwards
      return { idx, reverse: isEnd };
    }
    return null;
  };

  for (let startIdx = 0; startIdx < segments.length; startIdx++) {
    if (used.has(startIdx)) continue;

    const chain: Point[] = [];
    const localUsed = new Set<number>();

    // Start with this segment
    const [p1, p2] = segments[startIdx];
    chain.push(p1, p2);
    localUsed.add(startIdx);

    // Extend forward from end
    let current = p2;
    let maxIter = segments.length;
    while (maxIter-- > 0) {
      const next = findConnecting(current, localUsed);
      if (!next) break;
      localUsed.add(next.idx);
      const [s, e] = segments[next.idx];
      current = next.reverse ? s : e;
      chain.push(current);
    }

    // Extend backward from start
    current = p1;
    maxIter = segments.length;
    const prepend: Point[] = [];
    while (maxIter-- > 0) {
      const next = findConnecting(current, localUsed);
      if (!next) break;
      localUsed.add(next.idx);
      const [s, e] = segments[next.idx];
      current = next.reverse ? s : e;
      prepend.push(current);
    }

    // Combine: prepend (reversed) + chain
    const fullChain = [...prepend.reverse(), ...chain];

    // Mark all as used
    localUsed.forEach(idx => used.add(idx));

    if (fullChain.length >= 3) {
      polylines.push(fullChain);
    }
  }

  return polylines;
}

/**
 * Chaikin corner-cutting smoothing algorithm
 * Produces a smoother polyline by cutting corners iteratively
 * 
 * @param points - Input polyline
 * @param iterations - Number of smoothing iterations (2-3 recommended)
 * @param closed - Whether the polyline is closed (loop)
 * @returns Smoothed polyline
 */
export function smoothPolylineChaikin(
  points: Polyline,
  iterations: number = 2,
  closed: boolean = true
): Polyline {
  if (points.length < 3) return points;

  let current = [...points];

  for (let iter = 0; iter < iterations; iter++) {
    const next: Polyline = [];
    const n = current.length;

    for (let i = 0; i < n; i++) {
      const p0 = current[i];
      const p1 = current[(i + 1) % n];

      // Only process if we have a next point (or if closed)
      if (!closed && i === n - 1) {
        next.push(p0);
        break;
      }

      // Chaikin: Q = 0.75*P0 + 0.25*P1, R = 0.25*P0 + 0.75*P1
      const q: Point = [
        0.75 * p0[0] + 0.25 * p1[0],
        0.75 * p0[1] + 0.25 * p1[1],
      ];
      const r: Point = [
        0.25 * p0[0] + 0.75 * p1[0],
        0.25 * p0[1] + 0.75 * p1[1],
      ];

      next.push(q, r);
    }

    current = next;
  }

  return current;
}

/**
 * Build river mask field from world terrain
 * Returns a Float32Array where 1.0 = river, 0.0 = not river
 */
export function buildRiverMaskField(
  terrain: { hasRiver?: boolean; type?: string }[][],
  gridSize: number
): Float32Array {
  const field = new Float32Array(gridSize * gridSize);

  for (let y = 0; y < gridSize; y++) {
    // Use shared coordinate helper for consistency
    const fy = toRow(y, gridSize);
    const row = terrain[fy];
    if (!row) continue;

    for (let x = 0; x < gridSize; x++) {
      const cell = row[x];
      // River cells that aren't ocean
      const isRiver = cell?.hasRiver && cell.type !== 'water';
      field[y * gridSize + x] = isRiver ? 1.0 : 0.0;
    }
  }

  return field;
}

/**
 * Slightly dilate the river mask to prevent gaps
 * Uses a simple 3x3 maximum filter
 */
export function dilateRiverMask(
  field: Float32Array,
  w: number,
  h: number,
  radius: number = 1
): Float32Array {
  const result = new Float32Array(w * h);

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let maxVal = 0;
      for (let dy = -radius; dy <= radius; dy++) {
        for (let dx = -radius; dx <= radius; dx++) {
          const nx = x + dx;
          const ny = y + dy;
          if (nx >= 0 && nx < w && ny >= 0 && ny < h) {
            maxVal = Math.max(maxVal, field[ny * w + nx]);
          }
        }
      }
      result[y * w + x] = maxVal;
    }
  }

  return result;
}

/**
 * Apply Gaussian-like blur to soften the mask edges before contour extraction
 * This helps produce smoother contours
 */
export function blurRiverMask(
  field: Float32Array,
  w: number,
  h: number
): Float32Array {
  const result = new Float32Array(w * h);
  
  // 3x3 Gaussian-like kernel weights
  const kernel = [
    0.0625, 0.125, 0.0625,
    0.125,  0.25,  0.125,
    0.0625, 0.125, 0.0625,
  ];

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let sum = 0;
      let ki = 0;
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const nx = Math.max(0, Math.min(w - 1, x + dx));
          const ny = Math.max(0, Math.min(h - 1, y + dy));
          sum += field[ny * w + nx] * kernel[ki++];
        }
      }
      result[y * w + x] = sum;
    }
  }

  return result;
}
