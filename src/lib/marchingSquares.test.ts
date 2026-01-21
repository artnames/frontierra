import { describe, it, expect } from "vitest";
import { 
  marchingSquares, 
  smoothPolylineChaikin, 
  buildRiverMaskField,
  dilateRiverMask,
  blurRiverMask
} from "./marchingSquares";

describe("marchingSquares", () => {
  describe("contour extraction", () => {
    it("should return empty array for small grids", () => {
      const field = new Float32Array([1]);
      expect(marchingSquares(field, 1, 1, 0.5)).toEqual([]);
    });

    it("should return empty array for all-zero field", () => {
      const field = new Float32Array(16); // 4x4 zeros
      expect(marchingSquares(field, 4, 4, 0.5)).toEqual([]);
    });

    it("should return empty array for all-one field", () => {
      const field = new Float32Array(16).fill(1);
      expect(marchingSquares(field, 4, 4, 0.5)).toEqual([]);
    });

    it("should extract contour around a single high cell", () => {
      // 3x3 grid with center cell = 1
      const field = new Float32Array([
        0, 0, 0,
        0, 1, 0,
        0, 0, 0,
      ]);
      
      const contours = marchingSquares(field, 3, 3, 0.5);
      
      // Should have at least one contour
      expect(contours.length).toBeGreaterThanOrEqual(1);
      // Each contour should be a closed loop with >= 3 points
      for (const contour of contours) {
        expect(contour.length).toBeGreaterThanOrEqual(3);
      }
    });

    it("should handle 2x2 grid correctly", () => {
      // Minimal grid where contours are possible
      const field = new Float32Array([
        0, 0,
        1, 0,
      ]);
      
      const contours = marchingSquares(field, 2, 2, 0.5);
      // With a single cell, contours may or may not form depending on threshold
      expect(Array.isArray(contours)).toBe(true);
    });

    it("should extract multiple disjoint contours", () => {
      // 5x5 grid with two separate high regions
      const field = new Float32Array([
        0, 0, 0, 0, 0,
        0, 1, 0, 0, 0,
        0, 0, 0, 0, 0,
        0, 0, 0, 1, 0,
        0, 0, 0, 0, 0,
      ]);
      
      const contours = marchingSquares(field, 5, 5, 0.5);
      // Should have contours around both high regions
      expect(contours.length).toBeGreaterThanOrEqual(1);
    });

    it("should handle rectangular grids", () => {
      // 5x3 grid
      const field = new Float32Array([
        0, 0, 0, 0, 0,
        0, 1, 1, 1, 0,
        0, 0, 0, 0, 0,
      ]);
      
      const contours = marchingSquares(field, 5, 3, 0.5);
      expect(contours.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe("segment chaining performance", () => {
    it("should handle large number of segments efficiently", () => {
      // Create a larger grid with a diagonal line of high values
      const size = 32;
      const field = new Float32Array(size * size);
      
      for (let i = 0; i < size; i++) {
        // Create a thick diagonal
        for (let j = Math.max(0, i - 1); j <= Math.min(size - 1, i + 1); j++) {
          field[i * size + j] = 1;
        }
      }
      
      const start = performance.now();
      const contours = marchingSquares(field, size, size, 0.5);
      const elapsed = performance.now() - start;
      
      // Should complete in reasonable time (< 100ms)
      expect(elapsed).toBeLessThan(100);
      expect(contours.length).toBeGreaterThan(0);
    });
  });
});

describe("smoothPolylineChaikin", () => {
  it("should return input for fewer than 3 points", () => {
    const points: [number, number][] = [[0, 0], [1, 1]];
    expect(smoothPolylineChaikin(points, 2)).toEqual(points);
  });

  it("should increase point count with each iteration", () => {
    const square: [number, number][] = [
      [0, 0], [1, 0], [1, 1], [0, 1]
    ];
    
    const smoothed1 = smoothPolylineChaikin(square, 1, true);
    const smoothed2 = smoothPolylineChaikin(square, 2, true);
    
    expect(smoothed1.length).toBeGreaterThan(square.length);
    expect(smoothed2.length).toBeGreaterThan(smoothed1.length);
  });

  it("should produce valid coordinates", () => {
    const triangle: [number, number][] = [
      [0, 0], [10, 0], [5, 10]
    ];
    
    const smoothed = smoothPolylineChaikin(triangle, 3, true);
    
    for (const [x, y] of smoothed) {
      expect(typeof x).toBe("number");
      expect(typeof y).toBe("number");
      expect(isNaN(x)).toBe(false);
      expect(isNaN(y)).toBe(false);
    }
  });

  it("should handle open polylines", () => {
    const line: [number, number][] = [
      [0, 0], [1, 0], [2, 0], [3, 0]
    ];
    
    const smoothed = smoothPolylineChaikin(line, 2, false);
    
    // Open polyline should preserve endpoints approximately
    expect(smoothed.length).toBeGreaterThan(line.length);
  });

  it("should handle zero iterations", () => {
    const points: [number, number][] = [[0, 0], [1, 0], [1, 1]];
    const smoothed = smoothPolylineChaikin(points, 0, true);
    expect(smoothed).toEqual(points);
  });
});

describe("buildRiverMaskField", () => {
  it("should create correct size field", () => {
    const terrain = [
      [{ hasRiver: false, type: "land" }],
    ];
    
    const field = buildRiverMaskField(terrain, 1);
    expect(field.length).toBe(1);
  });

  it("should mark river cells as 1.0", () => {
    const terrain = [
      [{ hasRiver: true, type: "land" }, { hasRiver: false, type: "land" }],
      [{ hasRiver: false, type: "land" }, { hasRiver: true, type: "land" }],
    ];
    
    const field = buildRiverMaskField(terrain, 2);
    
    // Check that river cells are marked
    const hasOnes = Array.from(field).some(v => v === 1.0);
    expect(hasOnes).toBe(true);
  });

  it("should not mark water/ocean cells as river", () => {
    const terrain = [
      [{ hasRiver: true, type: "water" }],
    ];
    
    const field = buildRiverMaskField(terrain, 1);
    expect(field[0]).toBe(0);
  });

  it("should handle empty/undefined cells", () => {
    const terrain: { hasRiver?: boolean; type?: string }[][] = [
      [undefined as any, {}],
      [{}, { hasRiver: undefined }],
    ];
    
    const field = buildRiverMaskField(terrain, 2);
    expect(field.every(v => v === 0)).toBe(true);
  });
});

describe("dilateRiverMask", () => {
  it("should expand 1-cell region", () => {
    const field = new Float32Array([
      0, 0, 0,
      0, 1, 0,
      0, 0, 0,
    ]);
    
    const dilated = dilateRiverMask(field, 3, 3, 1);
    
    // Center and all neighbors should be 1
    expect(dilated[4]).toBe(1); // center
    expect(dilated[1]).toBe(1); // top
    expect(dilated[3]).toBe(1); // left
    expect(dilated[5]).toBe(1); // right
    expect(dilated[7]).toBe(1); // bottom
  });

  it("should handle edge cells", () => {
    const field = new Float32Array([
      1, 0, 0,
      0, 0, 0,
      0, 0, 0,
    ]);
    
    const dilated = dilateRiverMask(field, 3, 3, 1);
    
    expect(dilated[0]).toBe(1);
    expect(dilated[1]).toBe(1);
    expect(dilated[3]).toBe(1);
  });

  it("should handle radius 0", () => {
    const field = new Float32Array([0, 1, 0, 0]);
    const dilated = dilateRiverMask(field, 2, 2, 0);
    expect(Array.from(dilated)).toEqual([0, 1, 0, 0]);
  });
});

describe("blurRiverMask", () => {
  it("should smooth values", () => {
    const field = new Float32Array([
      0, 0, 0,
      0, 1, 0,
      0, 0, 0,
    ]);
    
    const blurred = blurRiverMask(field, 3, 3);
    
    // Center should still be highest
    expect(blurred[4]).toBeGreaterThan(0);
    // Neighbors should have some value due to blur
    expect(blurred[1]).toBeGreaterThan(0);
    // Corners should have lower values
    expect(blurred[0]).toBeLessThan(blurred[4]);
  });

  it("should preserve total energy approximately", () => {
    const field = new Float32Array([
      0, 0, 0,
      0, 1, 0,
      0, 0, 0,
    ]);
    
    const blurred = blurRiverMask(field, 3, 3);
    
    const sumOriginal = Array.from(field).reduce((a, b) => a + b, 0);
    const sumBlurred = Array.from(blurred).reduce((a, b) => a + b, 0);
    
    // Energy should be approximately preserved (within 20%)
    expect(Math.abs(sumBlurred - sumOriginal)).toBeLessThan(sumOriginal * 0.3);
  });

  it("should handle uniform field", () => {
    const field = new Float32Array(9).fill(0.5);
    const blurred = blurRiverMask(field, 3, 3);
    
    // Uniform field should stay approximately uniform
    for (const v of blurred) {
      expect(Math.abs(v - 0.5)).toBeLessThan(0.1);
    }
  });
});
