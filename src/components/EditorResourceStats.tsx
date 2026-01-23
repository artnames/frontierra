// DEV-ONLY: Editor Resource Statistics Monitor
// Tracks memory-related resources to help identify leaks
// Only renders in development mode

import { useEffect, useState, useRef } from 'react';
import { getTextureCacheSize } from '@/lib/materialRegistry';

interface ResourceStats {
  textureCacheSize: number;
  timestamp: number;
}

export function EditorResourceStats() {
  const [stats, setStats] = useState<ResourceStats | null>(null);
  const [history, setHistory] = useState<number[]>([]);
  const mountedRef = useRef(false);
  const intervalRef = useRef<number | null>(null);

  useEffect(() => {
    // Guard against double-mount in StrictMode
    if (mountedRef.current) return;
    mountedRef.current = true;

    console.debug('[EditorResourceStats] Mounted - starting resource monitoring');

    const updateStats = () => {
      const newStats: ResourceStats = {
        textureCacheSize: getTextureCacheSize(),
        timestamp: Date.now(),
      };
      
      setStats(newStats);
      setHistory(prev => [...prev, newStats.textureCacheSize].slice(-12));

      console.debug(`[EditorResourceStats] TextureCache=${newStats.textureCacheSize}`);
    };

    updateStats();
    intervalRef.current = window.setInterval(updateStats, 5000);

    return () => {
      console.debug('[EditorResourceStats] Unmounted - cleanup executed');
      if (intervalRef.current !== null) {
        window.clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      mountedRef.current = false;
    };
  }, []);

  if (!import.meta.env.DEV) return null;
  if (!stats) return null;

  const isGrowing = history.length >= 3 && history[history.length - 1] > history[0] + 5;

  return (
    <div 
      className="fixed bottom-2 left-2 z-50 p-2 bg-background/90 border border-border rounded text-[10px] font-mono space-y-1"
      style={{ pointerEvents: 'none' }}
    >
      <div className="text-muted-foreground uppercase tracking-wider">DEV Resources</div>
      <div className={stats.textureCacheSize > 40 ? 'text-destructive' : 'text-foreground'}>
        Textures: {stats.textureCacheSize}/50
      </div>
      {isGrowing && (
        <div className="text-destructive font-bold">⚠ LEAK?</div>
      )}
    </div>
  );
}
