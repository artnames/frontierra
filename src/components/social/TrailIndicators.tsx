// Trail Indicators - Shows edge crossing activity
// Subtle visual hints that others travel through

import { cn } from '@/lib/utils';
import { Footprints } from 'lucide-react';

interface TrailIndicatorsProps {
  counts: {
    north: number;
    south: number;
    east: number;
    west: number;
  };
  className?: string;
}

export function TrailIndicators({ counts, className }: TrailIndicatorsProps) {
  const hasTraffic = counts.north > 0 || counts.south > 0 || counts.east > 0 || counts.west > 0;
  
  if (!hasTraffic) return null;

  // Calculate intensity (0-1) based on trail count
  const getIntensity = (count: number) => Math.min(count / 10, 1);
  
  return (
    <div className={cn("pointer-events-none", className)}>
      {/* North edge */}
      {counts.north > 0 && (
        <div 
          className="absolute top-0 left-1/2 -translate-x-1/2 flex flex-col items-center gap-1"
          style={{ opacity: 0.3 + getIntensity(counts.north) * 0.5 }}
        >
          <div 
            className="h-1 bg-gradient-to-b from-accent/60 to-transparent rounded-full"
            style={{ width: `${20 + counts.north * 5}px` }}
          />
          <span className="text-[9px] text-accent/80 font-mono">{counts.north}</span>
        </div>
      )}
      
      {/* South edge */}
      {counts.south > 0 && (
        <div 
          className="absolute bottom-0 left-1/2 -translate-x-1/2 flex flex-col-reverse items-center gap-1"
          style={{ opacity: 0.3 + getIntensity(counts.south) * 0.5 }}
        >
          <div 
            className="h-1 bg-gradient-to-t from-accent/60 to-transparent rounded-full"
            style={{ width: `${20 + counts.south * 5}px` }}
          />
          <span className="text-[9px] text-accent/80 font-mono">{counts.south}</span>
        </div>
      )}
      
      {/* East edge */}
      {counts.east > 0 && (
        <div 
          className="absolute right-0 top-1/2 -translate-y-1/2 flex flex-row-reverse items-center gap-1"
          style={{ opacity: 0.3 + getIntensity(counts.east) * 0.5 }}
        >
          <div 
            className="w-1 bg-gradient-to-l from-accent/60 to-transparent rounded-full"
            style={{ height: `${20 + counts.east * 5}px` }}
          />
          <span className="text-[9px] text-accent/80 font-mono">{counts.east}</span>
        </div>
      )}
      
      {/* West edge */}
      {counts.west > 0 && (
        <div 
          className="absolute left-0 top-1/2 -translate-y-1/2 flex flex-row items-center gap-1"
          style={{ opacity: 0.3 + getIntensity(counts.west) * 0.5 }}
        >
          <div 
            className="w-1 bg-gradient-to-r from-accent/60 to-transparent rounded-full"
            style={{ height: `${20 + counts.west * 5}px` }}
          />
          <span className="text-[9px] text-accent/80 font-mono">{counts.west}</span>
        </div>
      )}
      
      {/* Central indicator */}
      <div className="absolute bottom-2 left-2 flex items-center gap-1 text-[10px] text-muted-foreground/60">
        <Footprints className="w-3 h-3" />
        <span>Others travel this way</span>
      </div>
    </div>
  );
}
