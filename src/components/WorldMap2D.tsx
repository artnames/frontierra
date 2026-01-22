// 2D World Map - Direct visualization of canonical world artifact
// CRITICAL: Renders from shared artifact passed down from Index.tsx
// NO internal generation - uses same artifact as 3D view

import { useEffect, useRef, useState, useMemo } from 'react';
import { Check, Share2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { CanonicalWorldArtifact } from '@/lib/generateCanonicalWorld';

interface WorldMap2DProps {
  artifact: CanonicalWorldArtifact | null;
  getShareUrl: () => string;
  isLoading?: boolean;
}

// Tile type legend (matches RGB colors in NexArt)
const TILE_LEGEND = [
  { label: 'Water', color: '#1e4878', desc: 'Low elevation' },
  { label: 'Ground', color: '#9a8a64', desc: 'Base terrain' },
  { label: 'Forest', color: '#3c6432', desc: 'Vegetated areas' },
  { label: 'Mountain', color: '#8a8278', desc: 'High elevation' },
  { label: 'Path', color: '#b4966e', desc: 'Walkable routes' },
  { label: 'River', color: '#46a0b4', desc: 'Flowing water' },
  { label: 'Object', color: '#ffdc3c', desc: 'Placed items' },
];

export function WorldMap2D({ 
  artifact,
  getShareUrl,
  isLoading = false,
}: WorldMap2DProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [copied, setCopied] = useState(false);
  const { toast } = useToast();

  // Render artifact to canvas whenever it changes
  useEffect(() => {
    if (!artifact?.rgbaBuffer || !canvasRef.current) return;

    const ctx = canvasRef.current.getContext('2d');
    if (!ctx) return;

    // Create ImageData from the shared RGBA buffer
    const imageData = new ImageData(64, 64);
    
    // Apply elevation-based brightness adjustment for visualization
    for (let i = 0; i < artifact.rgbaBuffer.length; i += 4) {
      const r = artifact.rgbaBuffer[i];
      const g = artifact.rgbaBuffer[i + 1];
      const b = artifact.rgbaBuffer[i + 2];
      const a = artifact.rgbaBuffer[i + 3]; // Elevation (0-255)

      // Apply subtle elevation-based brightness adjustment
      const elevFactor = 0.7 + (a / 255) * 0.4;
      
      imageData.data[i] = Math.min(255, Math.round(r * elevFactor));
      imageData.data[i + 1] = Math.min(255, Math.round(g * elevFactor));
      imageData.data[i + 2] = Math.min(255, Math.round(b * elevFactor));
      imageData.data[i + 3] = 255; // Full opacity for display
    }

    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, 64, 64);
    ctx.putImageData(imageData, 0, 0);
  }, [artifact]);

  const handleCopyLink = async () => {
    const url = getShareUrl();
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      toast({
        title: 'Link copied!',
        description: 'Share URL copied to clipboard',
      });
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast({
        title: 'Copy failed',
        description: 'Could not copy to clipboard',
        variant: 'destructive'
      });
    }
  };

  const pixelHash = artifact?.pixelHash ?? '';
  const error = artifact?.error;

  return (
    <div className="terminal-panel flex flex-col h-full">
      <div className="terminal-header">
        <div className="terminal-dot bg-primary animate-pulse-glow" />
        <div className="terminal-dot bg-accent" />
        <div className="terminal-dot bg-muted-foreground" />
        <span className="ml-2 text-xs text-muted-foreground font-display uppercase tracking-wider">
          World Map — 64×64 RGBA
        </span>
      </div>
      
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Canvas - crisp pixel rendering */}
        <div className="relative aspect-square bg-secondary rounded border border-border overflow-hidden">
          <canvas
            ref={canvasRef}
            width={64}
            height={64}
            className="w-full h-full"
            style={{ imageRendering: 'pixelated' }}
          />
          
          {isLoading && (
            <div className="absolute inset-0 flex items-center justify-center bg-background/80">
              <div className="flex flex-col items-center gap-2">
                <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                <span className="text-xs text-muted-foreground">Generating world...</span>
              </div>
            </div>
          )}
          
          {error && (
            <div className="absolute inset-0 flex items-center justify-center bg-destructive/20 p-4">
              <div className="text-center">
                <div className="text-sm font-display font-bold text-destructive mb-1">
                  ⚠ WORLD CANNOT BE VERIFIED
                </div>
                <div className="text-xs text-destructive/70">{error}</div>
              </div>
            </div>
          )}
        </div>
        
        {/* Hash - SAME as 3D because it's from the shared artifact */}
        {pixelHash && (
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">Pixel Hash:</span>
            <span className="font-mono text-primary">{pixelHash}</span>
          </div>
        )}
        
        {/* Tile Type Legend */}
        <div className="space-y-2">
          <div className="data-label">Tile Types (RGB)</div>
          <div className="grid grid-cols-2 gap-1.5">
            {TILE_LEGEND.map((item) => (
              <div key={item.label} className="flex items-center gap-2 text-xs">
                <div 
                  className="w-3 h-3 rounded-sm border border-border flex-shrink-0" 
                  style={{ backgroundColor: item.color }}
                />
                <span className="text-foreground">{item.label}</span>
              </div>
            ))}
          </div>
        </div>
        
        {/* Channel Info */}
        <div className="space-y-2">
          <div className="data-label">RGBA Encoding</div>
          <div className="text-xs space-y-1 text-muted-foreground">
            <div><span className="text-red-400">RGB</span> = Tile Type (categorical)</div>
            <div><span className="text-purple-400">Alpha</span> = Elevation (0–255)</div>
          </div>
        </div>
      </div>
      
      {/* Share Button */}
      <div className="p-4 border-t border-border">
        <Button
          variant="outline"
          onClick={handleCopyLink}
          className="w-full gap-2"
        >
          {copied ? (
            <>
              <Check className="w-4 h-4" />
              Copied!
            </>
          ) : (
            <>
              <Share2 className="w-4 h-4" />
              Share World
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
