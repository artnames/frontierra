// Generator Proof Overlay
// DEV-only overlay showing generator mode, source hash, BUILD_ID, and mapped values
// Makes it impossible to be on the wrong generator without noticing

import { GeneratorMode } from '@/lib/generatorCanonical';
import { BUILD_ID } from '@/lib/worldPipeline';

const DEV = import.meta.env.DEV;

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
  // Pixel hash for parity verification
  pixelHash?: string;
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
  pixelHash
}: GeneratorProofOverlayProps) {
  // Only show in DEV mode or with ?debug=1
  if (!DEV) return null;
  
  const getModeLabel = () => {
    switch (mode) {
      case 'v1_solo': return 'V1 Solo';
      case 'v1_worldA': return 'V1 World-A';
      default: return mode;
    }
  };
  
  const getModeColor = () => {
    switch (mode) {
      case 'v1_solo': return 'hsl(var(--chart-4))';
      case 'v1_worldA': return 'hsl(var(--chart-2))';
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
      className="fixed top-2 left-2 z-50 text-xs font-mono p-2 rounded pointer-events-none select-none max-w-[280px]"
      style={{ 
        backgroundColor: 'hsl(var(--background) / 0.9)', 
        color: 'hsl(var(--foreground))',
        border: '1px solid hsl(var(--border))'
      }}
    >
      {/* BUILD_ID - Critical for cache verification */}
      <div className="font-bold mb-1 flex items-center gap-2" style={{ color: 'hsl(var(--primary))' }}>
        <span>🔬 Generator Proof</span>
        <span className="text-[9px] px-1 py-0.5 rounded" style={{ backgroundColor: 'hsl(var(--accent))' }}>
          {BUILD_ID}
        </span>
      </div>
      
      {/* Generator Mode & Hash */}
      <div className="flex gap-2">
        <span style={{ color: 'hsl(var(--muted-foreground))' }}>Mode:</span>
        <span style={{ color: getModeColor() }}>{getModeLabel()}</span>
      </div>
      <div className="flex gap-2">
        <span style={{ color: 'hsl(var(--muted-foreground))' }}>Hash:</span>
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
      
      {/* Pixel Hash - Must match between Solo/MP at same coords */}
      {pixelHash && (
        <div className="flex gap-2">
          <span style={{ color: 'hsl(var(--muted-foreground))' }}>PxHash:</span>
          <span style={{ color: 'hsl(var(--primary))' }}>{pixelHash.slice(0, 8)}</span>
        </div>
      )}
      
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
