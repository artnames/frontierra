// 2D World Map - Direct visualization of NexArt RGBA channels
// Shows the canonical pixel data with color-coded legend

import { useEffect, useRef, useState, useMemo } from 'react';
import { Copy, Check, Share2 } from 'lucide-react';
import { WorldParams, WORLD_LAYOUT_SOURCE } from '@/lib/worldGenerator';
import { normalizeNexArtInput } from '@/lib/nexartWorld';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';

interface WorldMap2DProps {
  params: WorldParams;
  getShareUrl: () => string;
}

const NEXART_TIMEOUT_MS = 10000;

// Legend items matching the Blue channel encoding
const LEGEND_ITEMS = [
  { label: 'Water', color: '#1a4a6a', range: '0–50' },
  { label: 'Ground', color: '#5a7a4a', range: '51–100' },
  { label: 'Forest', color: '#2a5a2a', range: '101–150' },
  { label: 'Mountain', color: '#7a7a8a', range: '151–200' },
  { label: 'Path', color: '#a08050', range: '201–230' },
  { label: 'Bridge', color: '#6b4423', range: '231–255' },
];

const FEATURE_LEGEND = [
  { label: 'Landmark', color: '#ff6b6b', desc: 'Alpha 250–254' },
  { label: 'River', color: '#4ecdc4', desc: 'Alpha 245–249' },
  { label: 'Object', color: '#ffd93d', desc: 'Alpha = 1' },
];

export function WorldMap2D({ params, getShareUrl }: WorldMap2DProps) {
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

  const genKey = `${input.seed}:${input.vars.join(',')}`;

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

        const executionPromise = executeCodeMode({
          source: WORLD_LAYOUT_SOURCE,
          width: 64,
          height: 64,
          seed: input.seed,
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

  // Color visualization - interprets RGBA encoding for display
  function visualizePixelData(imageData: ImageData): ImageData {
    const data = imageData.data;
    const output = new ImageData(64, 64);
    const out = output.data;

    for (let i = 0; i < data.length; i += 4) {
      const r = data[i];     // Elevation
      const g = data[i + 1]; // Moisture
      const b = data[i + 2]; // Biome
      const a = data[i + 3]; // Features

      let outR: number, outG: number, outB: number;

      // Color based on Blue channel (biome)
      if (b <= 50) {
        // Water - blue tones
        const depth = r / 255;
        outR = 26 + depth * 30;
        outG = 74 + depth * 40;
        outB = 106 + depth * 30;
      } else if (b <= 100) {
        // Ground - earthy tones
        const elev = r / 255;
        const moist = g / 255;
        outR = 90 + elev * 40 - moist * 20;
        outG = 122 + moist * 30;
        outB = 74 + moist * 20;
      } else if (b <= 150) {
        // Forest - green tones
        const moist = g / 255;
        outR = 34 + moist * 20;
        outG = 90 + moist * 40;
        outB = 34 + moist * 20;
      } else if (b <= 200) {
        // Mountain - gray/rocky
        const elev = r / 255;
        outR = 100 + elev * 40;
        outG = 100 + elev * 40;
        outB = 110 + elev * 30;
      } else if (b <= 230) {
        // Path - tan/brown
        outR = 160;
        outG = 128;
        outB = 80;
      } else {
        // Bridge - dark brown
        outR = 107;
        outG = 68;
        outB = 35;
      }

      // Overlay features from Alpha channel
      if (a >= 250 && a <= 254) {
        // Landmark - red marker
        outR = 255;
        outG = 107;
        outB = 107;
      } else if (a >= 245 && a <= 249) {
        // River - cyan
        outR = 78;
        outG = 205;
        outB = 196;
      } else if (a === 1) {
        // Planted object - yellow marker
        outR = 255;
        outG = 217;
        outB = 61;
      }

      out[i] = outR;
      out[i + 1] = outG;
      out[i + 2] = outB;
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
        
        {/* Biome Legend */}
        <div className="space-y-2">
          <div className="data-label">Biome (Blue Channel)</div>
          <div className="grid grid-cols-2 gap-1.5">
            {LEGEND_ITEMS.map((item) => (
              <div key={item.label} className="flex items-center gap-2 text-xs">
                <div 
                  className="w-3 h-3 rounded-sm border border-border flex-shrink-0" 
                  style={{ backgroundColor: item.color }}
                />
                <span className="text-foreground">{item.label}</span>
                <span className="text-muted-foreground ml-auto">{item.range}</span>
              </div>
            ))}
          </div>
        </div>
        
        {/* Feature Legend */}
        <div className="space-y-2">
          <div className="data-label">Features (Alpha Channel)</div>
          <div className="space-y-1.5">
            {FEATURE_LEGEND.map((item) => (
              <div key={item.label} className="flex items-center gap-2 text-xs">
                <div 
                  className="w-3 h-3 rounded-full border border-border flex-shrink-0" 
                  style={{ backgroundColor: item.color }}
                />
                <span className="text-foreground">{item.label}</span>
                <span className="text-muted-foreground ml-auto">{item.desc}</span>
              </div>
            ))}
          </div>
        </div>
        
        {/* Channel Info */}
        <div className="space-y-2">
          <div className="data-label">RGBA Encoding</div>
          <div className="text-xs space-y-1 text-muted-foreground">
            <div><span className="text-red-400">R</span> = Elevation (0–255)</div>
            <div><span className="text-green-400">G</span> = Moisture (0–255)</div>
            <div><span className="text-blue-400">B</span> = Biome Class</div>
            <div><span className="text-purple-400">A</span> = Feature Mask</div>
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
