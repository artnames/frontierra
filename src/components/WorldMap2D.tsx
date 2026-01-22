// 2D World Map - Direct visualization of NexArt RGBA channels
// NEW ENCODING: RGB = Tile Type, Alpha = Elevation
// CRITICAL: Uses SAME canonical generator AND SAME seed as 3D to ensure parity

import { useEffect, useRef, useState, useMemo } from 'react';
import { Check, Share2 } from 'lucide-react';
import { WorldParams } from '@/lib/worldGenerator';
import { normalizeNexArtInput } from '@/lib/nexartWorld';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';

interface WorldMap2DProps {
  params: WorldParams;
  getShareUrl: () => string;
  isMultiplayer?: boolean;
  worldX?: number;
  worldY?: number;
}

const NEXART_TIMEOUT_MS = 10000;

// Tile type legend (matches RGB colors in NexArt)
// NOTE: Bridge removed from system
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
  params, 
  getShareUrl,
  isMultiplayer = false,
  worldX,
  worldY
}: WorldMap2DProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastGenerated, setLastGenerated] = useState<string>('');
  const [pixelHash, setPixelHash] = useState<string>('');
  const [copied, setCopied] = useState(false);
  const { toast } = useToast();

  // Normalize inputs
  const input = useMemo(() => normalizeNexArtInput({
    seed: params.seed,
    vars: params.vars,
    mode: 'static'
  }), [params.seed, params.vars]);

  // Include context in genKey to regenerate when it changes
  const genKey = `${input.seed}:${input.vars.join(',')}:${worldX ?? ''}:${worldY ?? ''}`;

  useEffect(() => {
    if (genKey === lastGenerated) return;

    let cancelled = false;

    const runGeneration = async () => {
      setIsGenerating(true);
      setError(null);

      try {
        const { executeCodeMode } = await import('@nexart/codemode-sdk');
        
        const timeoutPromise = new Promise<never>((_, reject) => {
          setTimeout(() => reject(new Error('NexArt execution timeout')), NEXART_TIMEOUT_MS);
        });

        // Use CANONICAL source selector - SAME as 3D explorer
        const { getCanonicalWorldLayoutSource } = await import('@/lib/generatorCanonical');
        
        // Default worldX/worldY to 0 if not provided (Solo mode)
        const effectiveWorldX = worldX ?? 0;
        const effectiveWorldY = worldY ?? 0;
        
        const canonicalResult = getCanonicalWorldLayoutSource({
          isMultiplayer,
          seed: input.seed,
          vars: input.vars,
          worldX: effectiveWorldX,
          worldY: effectiveWorldY
        });

        // No coordinate injection needed - the Solo generator doesn't use WORLD_X/WORLD_Y

        // SEED: Use raw seed directly (the WORLD_LAYOUT_SOURCE generator doesn't use WORLD_X/WORLD_Y)
        // This matches the 3D pipeline which also uses raw seed for consistency
        const executionSeed = input.seed;

        const executionPromise = executeCodeMode({
          source: canonicalResult.source,
          width: 64,
          height: 64,
          seed: executionSeed,
          vars: input.vars,
          mode: input.mode,
        });

        const result = await Promise.race([executionPromise, timeoutPromise]);

        if (cancelled) return;

        if (canvasRef.current && result.image) {
          const ctx = canvasRef.current.getContext('2d');
          if (!ctx) throw new Error('No canvas context');

          const url = URL.createObjectURL(result.image);
          const img = new Image();
          
          img.onload = async () => {
            if (cancelled) {
              URL.revokeObjectURL(url);
              return;
            }

            // Draw at native 64x64 resolution
            ctx.imageSmoothingEnabled = false;
            ctx.clearRect(0, 0, 64, 64);
            ctx.drawImage(img, 0, 0, 64, 64);
            
            // Extract pixel data for color visualization
            const imageData = ctx.getImageData(0, 0, 64, 64);
            const coloredData = visualizePixelData(imageData);
            ctx.putImageData(coloredData, 0, 0);
            
            // Compute hash
            const hash = computeHash(imageData.data);
            setPixelHash(hash);
            
            URL.revokeObjectURL(url);
            setLastGenerated(genKey);
            setIsGenerating(false);
          };
          
          img.onerror = () => {
            URL.revokeObjectURL(url);
            if (cancelled) return;
            setError('Failed to load NexArt output');
            setLastGenerated(genKey);
            setIsGenerating(false);
          };
          
          img.src = url;
          return;
        }

        setError('No image returned from NexArt');
        setLastGenerated(genKey);
      } catch (err) {
        if (cancelled) return;
        const message = err instanceof Error ? err.message : String(err);
        setError(message);
        setLastGenerated(genKey);
      } finally {
        if (!cancelled) {
          setIsGenerating(false);
        }
      }
    };

    runGeneration();

    return () => { cancelled = true; };
  }, [genKey, input, lastGenerated]);

  // Visualization: RGB is already tile color, just apply elevation shading
  function visualizePixelData(imageData: ImageData): ImageData {
    const data = imageData.data;
    const output = new ImageData(64, 64);
    const out = output.data;

    for (let i = 0; i < data.length; i += 4) {
      const r = data[i];     // Tile color R
      const g = data[i + 1]; // Tile color G
      const b = data[i + 2]; // Tile color B
      const a = data[i + 3]; // Elevation (0-255)

      // Apply subtle elevation-based brightness adjustment
      const elevFactor = 0.7 + (a / 255) * 0.4;
      
      out[i] = Math.min(255, Math.round(r * elevFactor));
      out[i + 1] = Math.min(255, Math.round(g * elevFactor));
      out[i + 2] = Math.min(255, Math.round(b * elevFactor));
      out[i + 3] = 255;
    }

    return output;
  }

  function computeHash(pixels: Uint8ClampedArray): string {
    let hash = 5381;
    for (let i = 0; i < pixels.length; i += 4) {
      hash = ((hash << 5) + hash) ^ pixels[i];
      hash = ((hash << 5) + hash) ^ pixels[i + 1];
      hash = ((hash << 5) + hash) ^ pixels[i + 2];
      hash = ((hash << 5) + hash) ^ pixels[i + 3];
      hash = hash >>> 0;
    }
    return hash.toString(16).padStart(8, '0').toUpperCase();
  }

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
          
          {isGenerating && (
            <div className="absolute inset-0 flex items-center justify-center bg-background/80">
              <div className="flex flex-col items-center gap-2">
                <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                <span className="text-xs text-muted-foreground">Verifying world...</span>
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
        
        {/* Hash */}
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
