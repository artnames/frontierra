import { useEffect, useRef, useState, useMemo } from 'react';
import { WorldParams, WORLD_SOURCE } from '@/lib/worldGenerator';
import { normalizeNexArtInput } from '@/lib/nexartWorld';

interface WorldCanvasProps {
  params: WorldParams;
  onGenerate?: () => void;
}

const NEXART_TIMEOUT_MS = 10000;

export function WorldCanvas({ params, onGenerate }: WorldCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastGenerated, setLastGenerated] = useState<string>('');

  // Normalize inputs ONCE and create stable key
  const input = useMemo(() => normalizeNexArtInput({
    seed: params.seed,
    vars: params.vars,
    mode: 'static'
  }), [params.seed, params.vars]);

  // Stable dependency key - string, not object reference
  const genKey = `${input.seed}:${input.vars.join(',')}:${input.mode}`;

  useEffect(() => {
    // Skip if already generated this exact key
    if (genKey === lastGenerated) return;

    let cancelled = false;
    console.log('[NexArt] Starting generation:', genKey);

    const runGeneration = async () => {
      setIsGenerating(true);
      setError(null);

      try {
        const { executeCodeMode } = await import('@nexart/codemode-sdk');
        
        // Timeout gate - never hang forever
        const timeoutPromise = new Promise<never>((_, reject) => {
          setTimeout(() => reject(new Error('NexArt execution timeout (10s)')), NEXART_TIMEOUT_MS);
        });

        const executionPromise = executeCodeMode({
          source: WORLD_SOURCE,
          width: 512,
          height: 512,
          seed: input.seed,
          vars: input.vars,
          mode: input.mode,
        });

        const result = await Promise.race([executionPromise, timeoutPromise]);

        if (cancelled) return;
        console.log('[NexArt] Generation complete:', genKey);

        // The SDK returns result.image as a PNG Blob for static mode
        if (canvasRef.current && result.image) {
          const ctx = canvasRef.current.getContext('2d');
          if (ctx) {
            const url = URL.createObjectURL(result.image);
            const img = new Image();
            
            img.onload = () => {
              if (cancelled) {
                URL.revokeObjectURL(url);
                return;
              }
              ctx.clearRect(0, 0, 512, 512);
              ctx.drawImage(img, 0, 0);
              URL.revokeObjectURL(url);
              setLastGenerated(genKey);
              setIsGenerating(false);
              onGenerate?.();
            };
            
            img.onerror = () => {
              URL.revokeObjectURL(url);
              if (cancelled) return;
              setError('World cannot be verified — failed to load generated image.');
              setLastGenerated(genKey);
              setIsGenerating(false);
            };
            
            img.src = url;
            return;
          }
        }

        // No valid result
        if (!cancelled) {
          setError('World cannot be verified — no image returned.');
          setLastGenerated(genKey);
        }
      } catch (err) {
        if (cancelled) return;
        const message = err instanceof Error ? err.message : String(err);
        console.error('[NexArt] Generation failed:', message);
        setError(`World cannot be verified — ${message}`);
        setLastGenerated(genKey);
      } finally {
        if (!cancelled) {
          setIsGenerating(false);
        }
      }
    };

    runGeneration();

    return () => {
      cancelled = true;
    };
  }, [genKey, input, lastGenerated, onGenerate]);

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
