// Generator Proof Overlay
// Shows generator mode, source hash, BUILD_ID, and single canonical pixelHash
// SINGLE SOURCE OF TRUTH: 2D and 3D share the same artifact
// Visible with ?debug=1 URL param

import { GeneratorMode } from '@/lib/generatorCanonical';
import { BUILD_ID } from '@/lib/generateCanonicalWorld';

interface GeneratorProofOverlayProps {
  mode: GeneratorMode;
  sourceHash: string;
  isMultiplayer: boolean;
  waterLevel: number;
  biomeRichness: number;
  // River debug counters
  riverCellCount: number;
  riverVertices: number;
  riverIndices: number;
  // World coordinates for unified generation proof
  worldX?: number;
  worldY?: number;
  // SINGLE pixel hash from canonical artifact (shared by 2D and 3D)
  pixelHash?: string;
  // DEPRECATED: kept for backwards compatibility but should always match pixelHash
  pixelHash2D?: string;
}

export function GeneratorProofOverlay({
  mode,
  sourceHash,
  isMultiplayer,
  waterLevel,
  biomeRichness,
  riverCellCount,
  riverVertices,
  riverIndices,
  worldX = 0,
  worldY = 0,
  pixelHash,
  pixelHash2D
}: GeneratorProofOverlayProps) {
  // Check for hash mismatch between 2D and 3D
  const hasHashMismatch = pixelHash && pixelHash2D && pixelHash !== pixelHash2D;
  
  const getModeLabel = () => {
    switch (mode) {
      case 'v1_unified': return 'V1 Unified';
      default: return mode;
    }
  };
  
  const getModeColor = () => {
    switch (mode) {
      case 'v1_unified': return 'hsl(var(--chart-2))';
      default: return 'hsl(var(--foreground))';
    }
  };
  
  // River status
  const hasRiverData = riverCellCount > 0;
  const hasRiverGeometry = riverVertices > 0 && riverIndices > 0;
  const riverStatus = hasRiverGeometry 
    ? 'VISIBLE' 
    : hasRiverData 
      ? 'DATA OK, NO GEO' 
      : 'NONE';
  const riverColor = hasRiverGeometry 
    ? 'hsl(var(--chart-1))' 
    : hasRiverData 
      ? 'hsl(var(--chart-4))' 
      : 'hsl(var(--muted-foreground))';
  
  return (
    <div 
      className="fixed top-2 left-2 z-50 text-xs font-mono p-2 rounded pointer-events-none select-none max-w-[320px]"
      style={{ 
        backgroundColor: 'hsl(var(--background) / 0.95)', 
        color: 'hsl(var(--foreground))',
        border: hasHashMismatch ? '2px solid hsl(var(--destructive))' : '1px solid hsl(var(--border))'
      }}
    >
      {/* BUILD_ID - Critical for cache verification */}
      <div className="font-bold mb-1 flex items-center gap-2" style={{ color: 'hsl(var(--primary))' }}>
        <span>🔬 Generator Proof</span>
        <span className="text-[9px] px-1 py-0.5 rounded" style={{ backgroundColor: 'hsl(var(--accent))' }}>
          {BUILD_ID}
        </span>
      </div>
      
      {/* Hash Mismatch Warning */}
      {hasHashMismatch && (
        <div className="p-2 mb-2 rounded" style={{ backgroundColor: 'hsl(var(--destructive) / 0.2)' }}>
          <div className="font-bold" style={{ color: 'hsl(var(--destructive))' }}>
            ⚠️ 2D/3D HASH MISMATCH
          </div>
          <div className="text-[10px] mt-1">
            <div>3D: <span style={{ color: 'hsl(var(--chart-1))' }}>{pixelHash}</span></div>
            <div>2D: <span style={{ color: 'hsl(var(--chart-4))' }}>{pixelHash2D}</span></div>
          </div>
        </div>
      )}
      
      {/* Pixel Hashes - Side by side comparison */}
      <div className="mb-1 p-1.5 rounded" style={{ backgroundColor: 'hsl(var(--accent) / 0.3)' }}>
        <div className="flex justify-between items-center">
          <span style={{ color: 'hsl(var(--muted-foreground))' }}>3D Hash:</span>
          <span style={{ color: 'hsl(var(--chart-1))', fontWeight: 'bold' }}>
            {pixelHash || 'N/A'}
          </span>
        </div>
        <div className="flex justify-between items-center">
          <span style={{ color: 'hsl(var(--muted-foreground))' }}>2D Hash:</span>
          <span style={{ color: 'hsl(var(--chart-4))', fontWeight: 'bold' }}>
            {pixelHash2D || 'N/A'}
          </span>
        </div>
        {pixelHash && pixelHash2D && (
          <div className="flex justify-between items-center mt-1 pt-1" style={{ borderTop: '1px solid hsl(var(--border))' }}>
            <span style={{ color: 'hsl(var(--muted-foreground))' }}>Match:</span>
            <span style={{ color: pixelHash === pixelHash2D ? 'hsl(120, 60%, 50%)' : 'hsl(var(--destructive))', fontWeight: 'bold' }}>
              {pixelHash === pixelHash2D ? '✓ YES' : '✗ NO'}
            </span>
          </div>
        )}
      </div>
      
      {/* Generator Mode & Hash */}
      <div className="flex gap-2">
        <span style={{ color: 'hsl(var(--muted-foreground))' }}>Mode:</span>
        <span style={{ color: getModeColor() }}>{getModeLabel()}</span>
      </div>
      <div className="flex gap-2">
        <span style={{ color: 'hsl(var(--muted-foreground))' }}>Source:</span>
        <span style={{ color: 'hsl(var(--chart-2))' }}>{sourceHash.slice(0, 8)}</span>
      </div>
      
      {/* World Coordinates - Critical for parity verification */}
      <div className="flex gap-2">
        <span style={{ color: 'hsl(var(--muted-foreground))' }}>World:</span>
        <span style={{ color: 'hsl(var(--chart-3))' }}>({worldX}, {worldY})</span>
      </div>
      
      {/* Context */}
      <div className="flex gap-2">
        <span style={{ color: 'hsl(var(--muted-foreground))' }}>MP:</span>
        <span>{isMultiplayer ? 'Yes' : 'No'}</span>
      </div>
      
      {/* Water & Biome (key coupling check) */}
      <div className="mt-1 pt-1" style={{ borderTop: '1px solid hsl(var(--border))' }}>
        <div className="flex gap-2">
          <span style={{ color: 'hsl(var(--muted-foreground))' }}>Water:</span>
          <span style={{ color: 'hsl(var(--chart-2))' }}>{waterLevel.toFixed(3)}</span>
        </div>
        <div className="flex gap-2">
          <span style={{ color: 'hsl(var(--muted-foreground))' }}>Biome:</span>
          <span style={{ color: 'hsl(var(--chart-1))' }}>{biomeRichness.toFixed(2)}</span>
        </div>
      </div>
      
      {/* River Debug Counters */}
      <div className="mt-1 pt-1" style={{ borderTop: '1px solid hsl(var(--border))' }}>
        <div className="font-bold mb-0.5" style={{ color: 'hsl(var(--chart-2))' }}>
          🌊 River Debug
        </div>
        <div className="flex gap-2">
          <span style={{ color: 'hsl(var(--muted-foreground))' }}>Cells:</span>
          <span style={{ color: riverCellCount > 0 ? 'hsl(var(--chart-1))' : 'hsl(var(--muted-foreground))' }}>
            {riverCellCount}
          </span>
        </div>
        <div className="flex gap-2">
          <span style={{ color: 'hsl(var(--muted-foreground))' }}>Verts:</span>
          <span style={{ color: riverVertices > 0 ? 'hsl(var(--chart-1))' : 'hsl(var(--muted-foreground))' }}>
            {riverVertices}
          </span>
        </div>
        <div className="flex gap-2">
          <span style={{ color: 'hsl(var(--muted-foreground))' }}>Indices:</span>
          <span style={{ color: riverIndices > 0 ? 'hsl(var(--chart-1))' : 'hsl(var(--muted-foreground))' }}>
            {riverIndices}
          </span>
        </div>
        <div className="flex gap-2">
          <span style={{ color: 'hsl(var(--muted-foreground))' }}>Status:</span>
          <span style={{ color: riverColor }}>{riverStatus}</span>
        </div>
      </div>
    </div>
  );
}

// Small footer build stamp for non-debug mode
export function BuildStamp() {
  return (
    <span className="text-[9px] font-mono px-1 py-0.5 rounded" style={{ 
      backgroundColor: 'hsl(var(--accent) / 0.3)', 
      color: 'hsl(var(--muted-foreground))' 
    }}>
      v{BUILD_ID}
    </span>
  );
}
