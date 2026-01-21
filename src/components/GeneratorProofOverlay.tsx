// Generator Proof Overlay
// DEV-only overlay showing generator mode, source hash, and mapped values
// Makes it impossible to be on the wrong generator without noticing

import { GeneratorMode } from '@/lib/generatorCanonical';

const DEV = import.meta.env.DEV;

interface GeneratorProofOverlayProps {
  mode: GeneratorMode;
  sourceHash: string;
  mappingVersion: 'v1' | 'v2';
  isMultiplayer: boolean;
  waterLevel: number;
  biomeRichness: number;
  microVars: number[];
  // River debug counters
  riverCellCount: number;
  riverVertices: number;
  riverIndices: number;
}

export function GeneratorProofOverlay({
  mode,
  sourceHash,
  mappingVersion,
  isMultiplayer,
  waterLevel,
  biomeRichness,
  microVars,
  riverCellCount,
  riverVertices,
  riverIndices
}: GeneratorProofOverlayProps) {
  // Only show in DEV mode
  if (!DEV) return null;
  
  const getModeLabel = () => {
    switch (mode) {
      case 'v1_solo': return 'V1 Solo';
      case 'v1_worldA': return 'V1 World-A';
      case 'v2_refinement': return 'V2 Refine';
      default: return mode;
    }
  };
  
  const getModeColor = () => {
    switch (mode) {
      case 'v1_solo': return 'hsl(var(--chart-4))';
      case 'v1_worldA': return 'hsl(var(--chart-2))';
      case 'v2_refinement': return 'hsl(var(--chart-1))';
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
      <div className="font-bold mb-1" style={{ color: 'hsl(var(--primary))' }}>
        🔬 Generator Proof
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
      
      {/* Context */}
      <div className="flex gap-2">
        <span style={{ color: 'hsl(var(--muted-foreground))' }}>Ver:</span>
        <span>{mappingVersion.toUpperCase()}</span>
        <span style={{ color: 'hsl(var(--muted-foreground))' }}>|</span>
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
      
      {/* Micro Vars [0-2] */}
      {mappingVersion === 'v2' && microVars.length > 0 && (
        <div className="flex gap-2">
          <span style={{ color: 'hsl(var(--muted-foreground))' }}>MV[0-2]:</span>
          <span style={{ color: 'hsl(var(--chart-5))' }}>
            {microVars.map(v => v.toFixed(0)).join(', ')}
          </span>
        </div>
      )}
      
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
