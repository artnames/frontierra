import { useEffect, useRef, useState, useCallback } from 'react';
import { WorldParams, WORLD_SOURCE } from '@/lib/worldGenerator';

interface WorldCanvasProps {
  params: WorldParams;
  onGenerate?: () => void;
}

export function WorldCanvas({ params, onGenerate }: WorldCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastGenerated, setLastGenerated] = useState<string>('');

  const generateWorld = useCallback(async () => {
    const paramsKey = JSON.stringify(params);
    if (paramsKey === lastGenerated && !error) return;
    
    setIsGenerating(true);
    setError(null);
    
    try {
      const { executeCodeMode } = await import('@nexart/codemode-sdk');
      
      const result = await executeCodeMode({
        source: WORLD_SOURCE,
        width: 512,
        height: 512,
        seed: params.seed,
        vars: params.vars,
        mode: 'static',
      });
      
      // The SDK returns result.image as a PNG Blob for static mode
      if (canvasRef.current && result.image) {
        const ctx = canvasRef.current.getContext('2d');
        if (ctx) {
          const url = URL.createObjectURL(result.image);
          const img = new Image();
          img.onload = () => {
            ctx.clearRect(0, 0, 512, 512);
            ctx.drawImage(img, 0, 0);
            URL.revokeObjectURL(url);
            setLastGenerated(paramsKey);
            setIsGenerating(false);
            onGenerate?.();
          };
          img.onerror = () => {
            URL.revokeObjectURL(url);
            throw new Error('Failed to load generated image');
          };
          img.src = url;
          return;
        }
      }
      
      throw new Error('NexArt did not return an image');
    } catch (err) {
      console.error('NexArt generation error:', err);
      const message = err instanceof Error ? err.message : 'Failed to generate world';
      setError(message);
      setIsGenerating(false);
      // NO FALLBACK - NexArt failure means world cannot be generated
    }
    
    setLastGenerated(paramsKey);
    setIsGenerating(false);
    onGenerate?.();
  }, [params, lastGenerated, error, onGenerate]);

  useEffect(() => {
    generateWorld();
  }, [generateWorld]);

  return (
    <div className="relative">
      <canvas
        ref={canvasRef}
        width={512}
        height={512}
        className="world-canvas w-full max-w-[512px] aspect-square bg-background"
      />
      
      {isGenerating && (
        <div className="absolute inset-0 flex items-center justify-center bg-background/80">
          <div className="flex flex-col items-center gap-2">
            <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            <span className="text-xs text-muted-foreground">GENERATING VIA NEXART...</span>
          </div>
        </div>
      )}
      
      {/* NexArt Failure - World Cannot Be Verified */}
      {error && (
        <div className="absolute inset-0 flex items-center justify-center bg-destructive/20">
          <div className="terminal-panel p-6 border-destructive bg-background/95 text-center max-w-sm">
            <div className="text-2xl font-display font-bold text-destructive mb-3">
              ⚠ WORLD CANNOT BE VERIFIED
            </div>
            <div className="text-sm text-muted-foreground mb-4">
              NexArt execution failed. The world layout cannot be generated or validated.
            </div>
            <div className="text-xs text-destructive/70 font-mono p-2 bg-destructive/10 rounded">
              {error}
            </div>
            <div className="text-xs text-muted-foreground mt-4">
              NexArt is required for world generation. No fallback available.
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
