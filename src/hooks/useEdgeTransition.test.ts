import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useEdgeTransition } from "./useEdgeTransition";

// Mock the multiplayer modules
vi.mock("@/lib/multiplayer/landRegistry", () => ({
  getLandAtPosition: vi.fn(),
}));

vi.mock("@/lib/multiplayer/socialRegistry", () => ({
  recordTrail: vi.fn(),
}));

import { getLandAtPosition } from "@/lib/multiplayer/landRegistry";

const mockGetLandAtPosition = getLandAtPosition as ReturnType<typeof vi.fn>;

// Helper to create a mock PlayerLand (using 'as any' to avoid coupling to type changes)
function createMockLand(overrides: Record<string, unknown> = {}) {
  return {
    player_id: "player1",
    pos_x: 5,
    pos_y: 5,
    seed: 12345,
    vars: [50, 50, 50, 50, 50, 50, 50, 50, 50, 50],
    discovery_points: 0,
    mapping_version: "v1" as const,
    display_name: null,
    micro_overrides: null,
    presence_ping_at: null,
    created_at: "",
    updated_at: "",
    ...overrides,
  } as any;
}

describe("useEdgeTransition", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("initialization", () => {
    it("should initialize with default state", () => {
      const { result } = renderHook(() => useEdgeTransition());
      
      expect(result.current.isTransitioning).toBe(false);
      expect(result.current.currentLand).toBeNull();
    });

    it("should expose required methods", () => {
      const { result } = renderHook(() => useEdgeTransition());
      
      expect(typeof result.current.setCurrentLand).toBe("function");
      expect(typeof result.current.handlePositionUpdate).toBe("function");
      expect(typeof result.current.transitionToLand).toBe("function");
    });
  });

  describe("setCurrentLand", () => {
    it("should update current land", () => {
      const { result } = renderHook(() => useEdgeTransition());
      const mockLand = createMockLand();
      
      act(() => {
        result.current.setCurrentLand(mockLand);
      });
      
      expect(result.current.currentLand).toEqual(mockLand);
    });

    it("should allow setting to null", () => {
      const { result } = renderHook(() => useEdgeTransition());
      const mockLand = createMockLand();
      
      act(() => {
        result.current.setCurrentLand(mockLand);
      });
      
      act(() => {
        result.current.setCurrentLand(null);
      });
      
      expect(result.current.currentLand).toBeNull();
    });
  });

  describe("edge detection", () => {
    it("should not detect edge when position is in center", () => {
      const onTransitionComplete = vi.fn();
      const { result } = renderHook(() => 
        useEdgeTransition({ onTransitionComplete })
      );
      
      const mockLand = createMockLand();
      
      act(() => {
        result.current.setCurrentLand(mockLand);
      });
      
      act(() => {
        result.current.handlePositionUpdate(32, 32); // Center of 64x64 grid
      });
      
      act(() => {
        vi.advanceTimersByTime(200);
      });
      
      expect(onTransitionComplete).not.toHaveBeenCalled();
    });

    it("should detect north edge crossing", async () => {
      const onTransitionStart = vi.fn();
      const neighborLand = createMockLand({ player_id: "player2", pos_y: 4, seed: 99999 });
      
      mockGetLandAtPosition.mockResolvedValue(neighborLand);
      
      const { result } = renderHook(() => 
        useEdgeTransition({ 
          playerId: "player1",
          onTransitionStart
        })
      );
      
      const currentLand = createMockLand();
      
      act(() => {
        result.current.setCurrentLand(currentLand);
      });
      
      act(() => {
        result.current.handlePositionUpdate(32, 0.5);
      });
      
      await act(async () => {
        vi.advanceTimersByTime(200);
        await Promise.resolve();
      });
      
      expect(onTransitionStart).toHaveBeenCalledWith(
        expect.objectContaining({ direction: "north" })
      );
    });
  });

  describe("debouncing", () => {
    it("should debounce rapid position updates", () => {
      const onTransitionStart = vi.fn();
      mockGetLandAtPosition.mockResolvedValue(null);
      
      const { result } = renderHook(() => 
        useEdgeTransition({ 
          playerId: "player1",
          onTransitionStart 
        })
      );
      
      const currentLand = createMockLand();
      
      act(() => {
        result.current.setCurrentLand(currentLand);
      });
      
      // Rapid updates
      for (let i = 0; i < 10; i++) {
        act(() => {
          result.current.handlePositionUpdate(32, i);
        });
        act(() => {
          vi.advanceTimersByTime(10);
        });
      }
      
      expect(onTransitionStart).not.toHaveBeenCalled();
    });
  });

  describe("transitionToLand", () => {
    it("should directly transition to specified land", async () => {
      const onTransitionComplete = vi.fn();
      
      const { result } = renderHook(() => 
        useEdgeTransition({ onTransitionComplete })
      );
      
      const targetLand = createMockLand({ player_id: "player2", pos_x: 10, pos_y: 10 });
      
      await act(async () => {
        await result.current.transitionToLand(targetLand);
      });
      
      expect(onTransitionComplete).toHaveBeenCalledWith(
        targetLand,
        expect.objectContaining({ x: expect.any(Number), z: expect.any(Number) }),
        undefined
      );
    });
  });
});
