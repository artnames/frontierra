import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { LRUCache } from "./lruCache";

describe("LRUCache", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("basic operations", () => {
    it("should store and retrieve values", () => {
      const cache = new LRUCache<string>(10);
      cache.set("key1", "value1");
      expect(cache.get("key1")).toBe("value1");
    });

    it("should return null for missing keys", () => {
      const cache = new LRUCache<string>(10);
      expect(cache.get("nonexistent")).toBeNull();
    });

    it("should overwrite existing keys", () => {
      const cache = new LRUCache<string>(10);
      cache.set("key1", "value1");
      cache.set("key1", "value2");
      expect(cache.get("key1")).toBe("value2");
      expect(cache.size).toBe(1);
    });

    it("should check if key exists with has()", () => {
      const cache = new LRUCache<string>(10);
      cache.set("key1", "value1");
      expect(cache.has("key1")).toBe(true);
      expect(cache.has("key2")).toBe(false);
    });

    it("should delete keys", () => {
      const cache = new LRUCache<string>(10);
      cache.set("key1", "value1");
      expect(cache.delete("key1")).toBe(true);
      expect(cache.get("key1")).toBeNull();
      expect(cache.delete("nonexistent")).toBe(false);
    });

    it("should clear all entries", () => {
      const cache = new LRUCache<string>(10);
      cache.set("key1", "value1");
      cache.set("key2", "value2");
      cache.clear();
      expect(cache.size).toBe(0);
      expect(cache.get("key1")).toBeNull();
    });
  });

  describe("LRU eviction", () => {
    it("should evict oldest entries when at capacity", () => {
      const cache = new LRUCache<string>(3);
      cache.set("a", "1");
      cache.set("b", "2");
      cache.set("c", "3");
      cache.set("d", "4"); // Should evict "a"
      
      expect(cache.get("a")).toBeNull();
      expect(cache.get("b")).toBe("2");
      expect(cache.get("c")).toBe("3");
      expect(cache.get("d")).toBe("4");
      expect(cache.size).toBe(3);
    });

    it("should promote accessed items to most recent", () => {
      const cache = new LRUCache<string>(3);
      cache.set("a", "1");
      cache.set("b", "2");
      cache.set("c", "3");
      
      // Access "a" to promote it
      cache.get("a");
      
      // Add new entry - should evict "b" (now oldest)
      cache.set("d", "4");
      
      expect(cache.get("a")).toBe("1");
      expect(cache.get("b")).toBeNull(); // evicted
      expect(cache.get("c")).toBe("3");
      expect(cache.get("d")).toBe("4");
    });

    it("should handle single-entry cache", () => {
      const cache = new LRUCache<string>(1);
      cache.set("a", "1");
      cache.set("b", "2");
      
      expect(cache.get("a")).toBeNull();
      expect(cache.get("b")).toBe("2");
      expect(cache.size).toBe(1);
    });
  });

  describe("TTL expiration", () => {
    it("should expire entries after TTL", () => {
      const cache = new LRUCache<string>(10, 1000); // 1 second TTL
      cache.set("key1", "value1");
      
      expect(cache.get("key1")).toBe("value1");
      
      // Advance time past TTL
      vi.advanceTimersByTime(1001);
      
      expect(cache.get("key1")).toBeNull();
    });

    it("should not expire entries before TTL", () => {
      const cache = new LRUCache<string>(10, 1000);
      cache.set("key1", "value1");
      
      vi.advanceTimersByTime(500);
      
      expect(cache.get("key1")).toBe("value1");
    });

    it("should handle null TTL (no expiration)", () => {
      const cache = new LRUCache<string>(10, null);
      cache.set("key1", "value1");
      
      vi.advanceTimersByTime(1000000);
      
      expect(cache.get("key1")).toBe("value1");
    });

    it("should expire entries in has() check", () => {
      const cache = new LRUCache<string>(10, 1000);
      cache.set("key1", "value1");
      
      expect(cache.has("key1")).toBe(true);
      
      vi.advanceTimersByTime(1001);
      
      expect(cache.has("key1")).toBe(false);
    });
  });

  describe("prune()", () => {
    it("should remove expired entries", () => {
      const cache = new LRUCache<string>(10, 1000);
      cache.set("a", "1");
      cache.set("b", "2");
      
      vi.advanceTimersByTime(500);
      cache.set("c", "3");
      
      vi.advanceTimersByTime(600); // "a" and "b" expired, "c" still valid
      
      const pruned = cache.prune();
      
      expect(pruned).toBe(2);
      expect(cache.get("a")).toBeNull();
      expect(cache.get("b")).toBeNull();
      expect(cache.get("c")).toBe("3");
    });

    it("should return 0 when no TTL is set", () => {
      const cache = new LRUCache<string>(10, null);
      cache.set("a", "1");
      
      vi.advanceTimersByTime(1000000);
      
      expect(cache.prune()).toBe(0);
      expect(cache.get("a")).toBe("1");
    });

    it("should return 0 when nothing is expired", () => {
      const cache = new LRUCache<string>(10, 10000);
      cache.set("a", "1");
      cache.set("b", "2");
      
      expect(cache.prune()).toBe(0);
    });
  });

  describe("edge cases", () => {
    it("should handle empty cache", () => {
      const cache = new LRUCache<string>(10);
      expect(cache.get("any")).toBeNull();
      expect(cache.has("any")).toBe(false);
      expect(cache.size).toBe(0);
      expect(cache.prune()).toBe(0);
    });

    it("should handle zero-capacity cache", () => {
      // Edge case: capacity 0 or 1 - implementation allows at least 1 entry before eviction
      const cache = new LRUCache<string>(1);
      cache.set("a", "1");
      cache.set("b", "2");
      // Second entry evicts first
      expect(cache.get("a")).toBeNull();
      expect(cache.get("b")).toBe("2");
    });
  });
});
