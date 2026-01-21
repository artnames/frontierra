import { describe, it, expect } from "vitest";
import {
  getWaterSurfaceHeightAt,
  getTerrainHeightAt,
  getBridgeDeckHeightAt,
  getWalkableHeightAt,
  getRiverbedHeightAt,
  isOverWater,
  isOnBridge,
} from "./surfaceHeights";
import { RIVER_WATER_ABOVE_BED } from "./worldConstants";
import type { WorldData, TerrainCell } from "./worldData";

// Helper to create a minimal mock world
function createMockWorld(cells: Partial<TerrainCell>[][], vars: number[] = [50, 50, 50, 50, 50, 50, 50, 50, 50, 50]): WorldData {
  const gridSize = cells.length;
  const terrain: TerrainCell[][] = cells.map((row, y) =>
    row.map((cell, x) => ({
      x,
      y,
      elevation: cell.elevation ?? 0.3,
      moisture: cell.moisture ?? 0.5,
      type: cell.type ?? "ground",
      hasRiver: cell.hasRiver ?? false,
      isPath: cell.isPath ?? false,
      isBridge: cell.isBridge ?? false,
    }))
  );

  return {
    seed: 12345,
    vars,
    gridSize,
    terrain,
    plantedObject: { x: 0, y: 0, z: 0, type: 0 },
    spawnPoint: { x: 0, y: 0, z: 0, rotationY: 0 },
    nexartHash: "test",
    isNexArtVerified: true,
  };
}

describe("surfaceHeights", () => {
  describe("getTerrainHeightAt", () => {
    it("should return 0 for null/empty world", () => {
      expect(getTerrainHeightAt(null as any, 0, 0)).toBe(0);
      expect(getTerrainHeightAt({ terrain: [], gridSize: 0 } as any, 0, 0)).toBe(0);
    });

    it("should return 0 for out-of-bounds coordinates", () => {
      const world = createMockWorld([[{ elevation: 0.5 }]]);
      expect(getTerrainHeightAt(world, -1, 0)).toBe(0);
      expect(getTerrainHeightAt(world, 0, -1)).toBe(0);
      expect(getTerrainHeightAt(world, 10, 0)).toBe(0);
    });

    it("should return scaled elevation for valid cell", () => {
      const world = createMockWorld([[{ elevation: 0.5 }]]);
      const height = getTerrainHeightAt(world, 0, 0);
      expect(height).toBeGreaterThan(0);
    });
  });

  describe("getWaterSurfaceHeightAt", () => {
    it("should return null for non-water cells", () => {
      const world = createMockWorld([[{ type: "ground" }]]);
      expect(getWaterSurfaceHeightAt(world, 0, 0)).toBeNull();
    });

    it("should return height for water cells", () => {
      const world = createMockWorld([[{ type: "water", elevation: 0.2 }]]);
      const height = getWaterSurfaceHeightAt(world, 0, 0);
      expect(height).not.toBeNull();
      expect(height).toBeGreaterThan(0);
    });

    it("should return null for bridge cells (over water)", () => {
      const world = createMockWorld([[{ type: "bridge", isBridge: true }]]);
      expect(getWaterSurfaceHeightAt(world, 0, 0)).toBeNull();
    });
  });

  describe("water surface >= riverbed + offset", () => {
    it("river water surface should always be above riverbed by RIVER_WATER_ABOVE_BED", () => {
      // Create a 3x3 grid with river in center
      const world = createMockWorld([
        [{ type: "ground" }, { type: "ground" }, { type: "ground" }],
        [{ type: "ground" }, { type: "ground", hasRiver: true, elevation: 0.3 }, { type: "ground" }],
        [{ type: "ground" }, { type: "ground" }, { type: "ground" }],
      ]);

      // River is at (1, 1) in grid coords, but we need to account for Y-flip
      // In a 3x3 grid, flippedY for gridY=1 is 3-1-1 = 1
      const waterHeight = getWaterSurfaceHeightAt(world, 1, 1);
      const riverbedHeight = getRiverbedHeightAt(world, 1, 1);

      expect(waterHeight).not.toBeNull();
      expect(riverbedHeight).not.toBeNull();
      
      if (waterHeight !== null && riverbedHeight !== null) {
        const diff = waterHeight - riverbedHeight;
        expect(diff).toBeCloseTo(RIVER_WATER_ABOVE_BED, 2);
      }
    });

    it("ocean water surface should use global water level", () => {
      const world = createMockWorld([[{ type: "water", elevation: 0.1 }]]);
      const waterHeight = getWaterSurfaceHeightAt(world, 0, 0);
      expect(waterHeight).not.toBeNull();
      expect(waterHeight).toBeGreaterThan(0);
    });
  });

  describe("getBridgeDeckHeightAt", () => {
    it("should return null for non-bridge cells", () => {
      const world = createMockWorld([[{ type: "ground" }]]);
      expect(getBridgeDeckHeightAt(world, 0, 0)).toBeNull();
    });

    it("should return height for bridge cells", () => {
      const world = createMockWorld([[{ type: "bridge", isBridge: true, elevation: 0.3 }]]);
      const height = getBridgeDeckHeightAt(world, 0, 0);
      expect(height).not.toBeNull();
      expect(height).toBeGreaterThan(0);
    });
  });

  describe("getWalkableHeightAt", () => {
    it("should return terrain height for ground cells", () => {
      const world = createMockWorld([[{ type: "ground", elevation: 0.4 }]]);
      const walkable = getWalkableHeightAt(world, 0, 0);
      const terrain = getTerrainHeightAt(world, 0, 0);
      expect(walkable).toBe(terrain);
    });

    it("should return bridge height for bridge cells", () => {
      const world = createMockWorld([[{ type: "bridge", isBridge: true, elevation: 0.3 }]]);
      const walkable = getWalkableHeightAt(world, 0, 0);
      const bridge = getBridgeDeckHeightAt(world, 0, 0);
      const terrain = getTerrainHeightAt(world, 0, 0);
      
      expect(bridge).not.toBeNull();
      if (bridge !== null) {
        expect(walkable).toBe(Math.max(bridge, terrain));
      }
    });
  });

  describe("isOverWater", () => {
    it("should return true for water cells", () => {
      const world = createMockWorld([[{ type: "water" }]]);
      expect(isOverWater(world, 0, 0)).toBe(true);
    });

    it("should return true for river cells", () => {
      const world = createMockWorld([[{ type: "ground", hasRiver: true }]]);
      expect(isOverWater(world, 0, 0)).toBe(true);
    });

    it("should return false for bridge cells", () => {
      const world = createMockWorld([[{ type: "bridge", isBridge: true }]]);
      expect(isOverWater(world, 0, 0)).toBe(false);
    });

    it("should return false for ground cells", () => {
      const world = createMockWorld([[{ type: "ground" }]]);
      expect(isOverWater(world, 0, 0)).toBe(false);
    });
  });

  describe("isOnBridge", () => {
    it("should return true for bridge cells", () => {
      const world = createMockWorld([[{ type: "bridge", isBridge: true }]]);
      expect(isOnBridge(world, 0, 0)).toBe(true);
    });

    it("should return false for non-bridge cells", () => {
      const world = createMockWorld([[{ type: "ground" }]]);
      expect(isOnBridge(world, 0, 0)).toBe(false);
    });
  });
});
