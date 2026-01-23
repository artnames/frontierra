// ResourceHUD - DEV-only memory/resource monitoring overlay
// Shows JS heap, Three.js GPU resources, texture cache, audio elements
// Gate with import.meta.env.DEV and ?debug=1

import { useEffect, useState, useRef } from "react";
import { useThree } from "@react-three/fiber";
import { getTextureCacheSize } from "@/lib/materialRegistry";
import { getCacheStats } from "@/lib/worldCache";

interface ResourceStats {
  jsHeapUsed: number | null;
  jsHeapTotal: number | null;
  threeTextures: number;
  threeGeometries: number;
  threeRenderCalls: number;
  threeTriangles: number;
  textureCacheSize: number;
  audioElements: number;
  worldCacheSize: number;
  nexartCacheSize: number;
  timestamp: number;
}

// Helper to count active audio elements in the DOM
function countAudioElements(): number {
  if (typeof document === "undefined") return 0;
  return document.querySelectorAll("audio").length;
}

// Helper to count NexArt cache entries
function getNexartCacheSize(): number {
  if (typeof window === "undefined") return 0;
  const cache = (window as any).__nexartCache;
  return cache ? Object.keys(cache).length : 0;
}

// Inner component that has access to Three.js context
function ResourceHUDInner() {
  const { gl } = useThree();
  const [stats, setStats] = useState<ResourceStats | null>(null);
  const [history, setHistory] = useState<ResourceStats[]>([]);
  const intervalRef = useRef<number | null>(null);

  useEffect(() => {
    const updateStats = () => {
      const perf = (performance as unknown as { memory?: { usedJSHeapSize: number; totalJSHeapSize: number } }).memory;
      
      const newStats: ResourceStats = {
        jsHeapUsed: perf ? perf.usedJSHeapSize / (1024 * 1024) : null,
        jsHeapTotal: perf ? perf.totalJSHeapSize / (1024 * 1024) : null,
        threeTextures: gl.info.memory.textures,
        threeGeometries: gl.info.memory.geometries,
        threeRenderCalls: gl.info.render.calls,
        threeTriangles: gl.info.render.triangles,
        textureCacheSize: getTextureCacheSize(),
        audioElements: countAudioElements(),
        worldCacheSize: getCacheStats().size,
        nexartCacheSize: getNexartCacheSize(),
        timestamp: Date.now(),
      };

      setStats(newStats);
      setHistory((prev) => {
        const updated = [...prev, newStats].slice(-20); // Keep last 20 samples
        return updated;
      });

      // Log to console every 5 samples
      if (history.length % 5 === 0 && history.length > 0) {
        console.debug("[ResourceHUD]", {
          heap: newStats.jsHeapUsed?.toFixed(0) + "MB",
          textures: newStats.threeTextures,
          geometries: newStats.threeGeometries,
          textureCache: newStats.textureCacheSize,
          audio: newStats.audioElements,
        });
      }
    };

    // Update every 5 seconds
    updateStats();
    intervalRef.current = window.setInterval(updateStats, 5000);

    return () => {
      if (intervalRef.current !== null) {
        clearInterval(intervalRef.current);
      }
    };
  }, [gl, history.length]);

  if (!stats) return null;

  // Calculate trends
  const heapTrend = history.length >= 2 && stats.jsHeapUsed !== null
    ? stats.jsHeapUsed - (history[0]?.jsHeapUsed ?? 0)
    : 0;
  const textureTrend = history.length >= 2
    ? stats.threeTextures - (history[0]?.threeTextures ?? 0)
    : 0;
  const geometryTrend = history.length >= 2
    ? stats.threeGeometries - (history[0]?.threeGeometries ?? 0)
    : 0;

  const isLeaking = (heapTrend ?? 0) > 100 || textureTrend > 10 || geometryTrend > 20;

  return (
    <div
      style={{
        position: "fixed",
        bottom: "80px",
        left: "12px",
        background: isLeaking ? "rgba(180, 40, 40, 0.9)" : "rgba(0, 0, 0, 0.85)",
        color: "#0f0",
        fontFamily: "monospace",
        fontSize: "11px",
        padding: "8px 12px",
        borderRadius: "4px",
        zIndex: 10000,
        pointerEvents: "none",
        minWidth: "180px",
        border: isLeaking ? "1px solid #f44" : "1px solid #333",
      }}
    >
      <div style={{ fontWeight: "bold", marginBottom: "4px", color: isLeaking ? "#ff8" : "#0f0" }}>
        DEV Resources {isLeaking ? "⚠ LEAK?" : "✓"}
      </div>
      {stats.jsHeapUsed !== null && (
        <div>
          Heap: {stats.jsHeapUsed.toFixed(0)}MB / {stats.jsHeapTotal?.toFixed(0)}MB
          {heapTrend !== 0 && (
            <span style={{ color: heapTrend > 50 ? "#f88" : "#8f8" }}>
              {" "}({heapTrend > 0 ? "+" : ""}{heapTrend.toFixed(0)})
            </span>
          )}
        </div>
      )}
      <div>
        GPU Tex: {stats.threeTextures}
        {textureTrend !== 0 && (
          <span style={{ color: textureTrend > 5 ? "#f88" : "#8f8" }}>
            {" "}({textureTrend > 0 ? "+" : ""}{textureTrend})
          </span>
        )}
      </div>
      <div>
        GPU Geo: {stats.threeGeometries}
        {geometryTrend !== 0 && (
          <span style={{ color: geometryTrend > 10 ? "#f88" : "#8f8" }}>
            {" "}({geometryTrend > 0 ? "+" : ""}{geometryTrend})
          </span>
        )}
      </div>
      <div>Render: {stats.threeRenderCalls} calls, {(stats.threeTriangles / 1000).toFixed(0)}k tris</div>
      <div>Tex Cache: {stats.textureCacheSize}/50</div>
      <div>World Cache: {stats.worldCacheSize}/2</div>
      <div>NexArt Cache: {stats.nexartCacheSize}/5</div>
      <div>Audio: {stats.audioElements}</div>
      <div style={{ fontSize: "9px", color: "#888", marginTop: "4px" }}>
        Samples: {history.length}/20
      </div>
    </div>
  );
}

// Check if debug mode is enabled via URL param
function isDebugEnabled(): boolean {
  if (typeof window === "undefined") return false;
  const params = new URLSearchParams(window.location.search);
  return params.has("debug") || params.get("debug") === "1";
}

// Outer wrapper that gates on DEV + debug param
export function ResourceHUD() {
  if (!import.meta.env.DEV) return null;
  if (!isDebugEnabled()) return null;
  
  return <ResourceHUDInner />;
}

// Export for use outside of Three.js context (simpler version)
export function ResourceHUDSimple() {
  const [stats, setStats] = useState<Partial<ResourceStats> | null>(null);
  const intervalRef = useRef<number | null>(null);

  useEffect(() => {
    if (!import.meta.env.DEV || !isDebugEnabled()) return;

    const updateStats = () => {
      const perf = (performance as unknown as { memory?: { usedJSHeapSize: number; totalJSHeapSize: number } }).memory;
      
      setStats({
        jsHeapUsed: perf ? perf.usedJSHeapSize / (1024 * 1024) : null,
        jsHeapTotal: perf ? perf.totalJSHeapSize / (1024 * 1024) : null,
        textureCacheSize: getTextureCacheSize(),
        audioElements: countAudioElements(),
        worldCacheSize: getCacheStats().size,
        nexartCacheSize: getNexartCacheSize(),
        timestamp: Date.now(),
      });
    };

    updateStats();
    intervalRef.current = window.setInterval(updateStats, 5000);

    return () => {
      if (intervalRef.current !== null) {
        clearInterval(intervalRef.current);
      }
    };
  }, []);

  if (!import.meta.env.DEV || !isDebugEnabled() || !stats) return null;

  return (
    <div
      style={{
        position: "fixed",
        bottom: "80px",
        left: "12px",
        background: "rgba(0, 0, 0, 0.85)",
        color: "#0f0",
        fontFamily: "monospace",
        fontSize: "11px",
        padding: "8px 12px",
        borderRadius: "4px",
        zIndex: 10000,
        pointerEvents: "none",
        minWidth: "160px",
        border: "1px solid #333",
      }}
    >
      <div style={{ fontWeight: "bold", marginBottom: "4px" }}>DEV Resources</div>
      {stats.jsHeapUsed !== null && (
        <div>Heap: {stats.jsHeapUsed.toFixed(0)}MB / {stats.jsHeapTotal?.toFixed(0)}MB</div>
      )}
      <div>Tex Cache: {stats.textureCacheSize}/50</div>
      <div>World Cache: {stats.worldCacheSize}/2</div>
      <div>NexArt Cache: {stats.nexartCacheSize}/5</div>
      <div>Audio: {stats.audioElements}</div>
    </div>
  );
}
