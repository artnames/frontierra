// Debug Overlay - Shows BUILD_ID, pixelHash, tile counts
// Enable with ?debug=1 URL parameter

import { BUILD_ID, TileCounts } from '@/lib/generateCanonicalWorld';
import { GeneratorMode } from '@/lib/generatorCanonical';

interface DebugOverlayProps {
  pixelHash: string;
  pixelHash2D?: string; // From WorldMap2D if available
  counts: TileCounts;
  mode: GeneratorMode;
  sourceHash: string;
  isMultiplayer: boolean;
  waterLevel: number;
}

export function DebugOverlay({
  pixelHash,
  pixelHash2D,
  counts,
  mode,
  sourceHash,
  isMultiplayer,
  waterLevel,
}: DebugOverlayProps) {
  const hasHashMismatch = pixelHash2D && pixelHash2D !== pixelHash;
  
  const getModeLabel = () => {
    switch (mode) {
      case 'v1_unified': return 'V1 Unified';
      default: return mode;
    }
  };
  
  return (
    <div 
      className="fixed top-2 left-2 z-50 text-xs font-mono p-3 rounded pointer-events-none select-none max-w-[300px] space-y-2"
      style={{ 
        backgroundColor: 'hsl(var(--background) / 0.95)', 
        color: 'hsl(var(--foreground))',
        border: hasHashMismatch ? '2px solid hsl(var(--destructive))' : '1px solid hsl(var(--border))'
      }}
    >
      {/* Build ID - Most important for cache verification */}
      <div className="flex gap-2 items-center">
        <span className="font-bold" style={{ color: 'hsl(var(--primary))' }}>🔧 BUILD</span>
        <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ backgroundColor: 'hsl(var(--accent))' }}>
          {BUILD_ID}
        </span>
      </div>
      
      {/* Hash mismatch warning */}
      {hasHashMismatch && (
        <div className="p-2 rounded" style={{ backgroundColor: 'hsl(var(--destructive) / 0.2)' }}>
          <div className="font-bold" style={{ color: 'hsl(var(--destructive))' }}>
            ⚠️ 2D/3D HASH MISMATCH
          </div>
          <div className="text-[10px]">
            <div>3D: {pixelHash}</div>
            <div>2D: {pixelHash2D}</div>
          </div>
        </div>
      )}
      
      {/* Generator Info */}
      <div className="space-y-1 pt-1" style={{ borderTop: '1px solid hsl(var(--border))' }}>
        <div className="flex justify-between">
          <span style={{ color: 'hsl(var(--muted-foreground))' }}>Mode:</span>
          <span style={{ color: 'hsl(var(--chart-2))' }}>{getModeLabel()}</span>
        </div>
        <div className="flex justify-between">
          <span style={{ color: 'hsl(var(--muted-foreground))' }}>Hash:</span>
          <span style={{ color: 'hsl(var(--chart-1))' }}>{pixelHash.slice(0, 8)}</span>
        </div>
        <div className="flex justify-between">
          <span style={{ color: 'hsl(var(--muted-foreground))' }}>Source:</span>
          <span style={{ color: 'hsl(var(--chart-4))' }}>{sourceHash.slice(0, 8)}</span>
        </div>
        <div className="flex justify-between">
          <span style={{ color: 'hsl(var(--muted-foreground))' }}>MP:</span>
          <span>{isMultiplayer ? 'Yes' : 'No'}</span>
        </div>
        <div className="flex justify-between">
          <span style={{ color: 'hsl(var(--muted-foreground))' }}>Water:</span>
          <span style={{ color: 'hsl(var(--chart-2))' }}>{waterLevel.toFixed(3)}</span>
        </div>
      </div>
      
      {/* Tile Counts */}
      <div className="space-y-1 pt-1" style={{ borderTop: '1px solid hsl(var(--border))' }}>
        <div className="font-bold" style={{ color: 'hsl(var(--primary))' }}>
          📊 Tile Counts
        </div>
        <div className="grid grid-cols-2 gap-x-4 gap-y-0.5 text-[10px]">
          <div className="flex justify-between">
            <span>💧 Water:</span>
            <span>{counts.water}</span>
          </div>
          <div className="flex justify-between">
            <span>🌊 River:</span>
            <span style={{ color: counts.river > 0 ? 'hsl(var(--chart-1))' : 'inherit' }}>{counts.river}</span>
          </div>
          <div className="flex justify-between">
            <span>🛤️ Path:</span>
            <span>{counts.path}</span>
          </div>
          <div className="flex justify-between">
            <span>🌲 Forest:</span>
            <span>{counts.forest}</span>
          </div>
          <div className="flex justify-between">
            <span>⛰️ Mountain:</span>
            <span>{counts.mountain}</span>
          </div>
          <div className="flex justify-between">
            <span>🟫 Ground:</span>
            <span>{counts.ground}</span>
          </div>
          <div className="flex justify-between">
            <span>⭐ Object:</span>
            <span>{counts.object}</span>
          </div>
          <div className="flex justify-between font-bold">
            <span>Total:</span>
            <span>{counts.total}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// Footer build stamp - small unobtrusive build ID indicator
export function BuildStamp() {
  return (
    <div 
      className="fixed bottom-1 right-1 z-40 text-[9px] font-mono px-1.5 py-0.5 rounded pointer-events-none select-none"
      style={{ 
        backgroundColor: 'hsl(var(--background) / 0.7)', 
        color: 'hsl(var(--muted-foreground))',
        border: '1px solid hsl(var(--border) / 0.5)'
      }}
    >
      v{BUILD_ID}
    </div>
  );
}

// Hook to check if debug mode is enabled
export function useDebugMode(): boolean {
  if (typeof window === 'undefined') return false;
  const params = new URLSearchParams(window.location.search);
  return params.get('debug') === '1';
}
