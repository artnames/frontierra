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
  const [useNexArt, setUseNexArt] = useState(true);
  const [lastGenerated, setLastGenerated] = useState<string>('');

  const generateWorld = useCallback(async () => {
    const paramsKey = JSON.stringify(params);
    if (paramsKey === lastGenerated && !error) return;
    
    setIsGenerating(true);
    setError(null);
    
    if (useNexArt) {
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
        
        // Fall back to built-in renderer
        if (canvasRef.current) {
          drawFallbackWorld(canvasRef.current, params);
        }
      }
    } else {
      // Use fallback directly
      if (canvasRef.current) {
        drawFallbackWorld(canvasRef.current, params);
      }
    }
    
    setLastGenerated(paramsKey);
    setIsGenerating(false);
    onGenerate?.();
  }, [params, lastGenerated, error, useNexArt, onGenerate]);

  useEffect(() => {
    generateWorld();
  }, [generateWorld]);

  const toggleRenderer = () => {
    setUseNexArt(!useNexArt);
    setError(null);
    setLastGenerated(''); // Force re-render
  };

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
            <span className="text-xs text-muted-foreground">GENERATING...</span>
          </div>
        </div>
      )}
      
      {error && (
        <div className="absolute bottom-2 left-2 right-2 px-3 py-2 bg-card/95 border border-border rounded text-xs space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-data-highlight">FALLBACK MODE</span>
            <button 
              onClick={toggleRenderer}
              className="text-primary hover:text-primary/80 text-[10px] underline"
            >
              {useNexArt ? 'Use Fallback' : 'Try NexArt'}
            </button>
          </div>
          <div className="text-muted-foreground truncate" title={error}>
            {error}
          </div>
        </div>
      )}
    </div>
  );
}

// Deterministic fallback visualization when NexArt is unavailable
function drawFallbackWorld(canvas: HTMLCanvasElement, params: WorldParams) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  
  const { seed, vars } = params;
  
  // Seeded PRNG (Mulberry32)
  const mulberry32 = (a: number) => {
    return () => {
      let t = a += 0x6D2B79F5;
      t = Math.imul(t ^ t >>> 15, t | 1);
      t ^= t + Math.imul(t ^ t >>> 7, t | 61);
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  };
  
  // Simple noise function
  const noise2D = (x: number, y: number, s: number) => {
    const rng = mulberry32(Math.floor(x * 1000) + Math.floor(y * 7919) + s);
    return rng();
  };
  
  // Smoother noise with interpolation
  const smoothNoise = (x: number, y: number, s: number) => {
    const xi = Math.floor(x);
    const yi = Math.floor(y);
    const xf = x - xi;
    const yf = y - yi;
    
    const n00 = noise2D(xi, yi, s);
    const n10 = noise2D(xi + 1, yi, s);
    const n01 = noise2D(xi, yi + 1, s);
    const n11 = noise2D(xi + 1, yi + 1, s);
    
    const nx0 = n00 * (1 - xf) + n10 * xf;
    const nx1 = n01 * (1 - xf) + n11 * xf;
    
    return nx0 * (1 - yf) + nx1 * yf;
  };
  
  // Clear canvas
  ctx.fillStyle = 'hsl(220, 20%, 6%)';
  ctx.fillRect(0, 0, 512, 512);
  
  // Grid parameters
  const gridSize = 32;
  const tileW = 16;
  const tileH = 8;
  const offsetX = 256;
  const offsetY = 80;
  
  // Map variables
  const terrainScale = vars[3] / 100 * 0.1 + 0.02;
  const waterLevel = vars[4] / 100 * 0.4 + 0.2;
  const forestDensity = vars[5] / 100;
  const mountainMult = vars[6] / 100 * 1.5 + 0.5;
  const hueShift = (vars[7] - 50) * 0.6;
  const roughness = vars[8] / 100 * 1.5 + 0.5;
  const landmarkDensity = vars[9] / 100 * 0.15;
  
  const objX = Math.floor(vars[1] / 100 * (gridSize - 4)) + 2;
  const objY = Math.floor(vars[2] / 100 * (gridSize - 4)) + 2;
  const objType = Math.floor(vars[0] / 100 * 5);
  
  // Pre-compute terrain
  const terrain: { elevation: number; isWater: boolean; isForest: boolean; isMountain: boolean }[][] = [];
  
  for (let y = 0; y < gridSize; y++) {
    terrain[y] = [];
    for (let x = 0; x < gridSize; x++) {
      let elev = 0;
      elev += smoothNoise(x * terrainScale * 10, y * terrainScale * 10, seed) * 1.0;
      elev += smoothNoise(x * terrainScale * 20, y * terrainScale * 20, seed + 1000) * 0.5 * roughness;
      elev += smoothNoise(x * terrainScale * 40, y * terrainScale * 40, seed + 2000) * 0.25 * roughness;
      elev = elev / (1.0 + 0.5 * roughness + 0.25 * roughness);
      
      const isWater = elev < waterLevel;
      const forestNoise = smoothNoise(x * 0.3 + 100, y * 0.3, seed + 3000);
      const isForest = !isWater && forestNoise < forestDensity * elev;
      const isMountain = elev > (1 - waterLevel) * mountainMult * 0.4 + 0.4;
      
      terrain[y][x] = { elevation: elev, isWater, isForest, isMountain };
    }
  }
  
  // Draw tiles
  for (let y = 0; y < gridSize; y++) {
    for (let x = 0; x < gridSize; x++) {
      const tile = terrain[y][x];
      const isoX = (x - y) * tileW / 2 + offsetX;
      const isoY = (x + y) * tileH / 2 + offsetY;
      const heightOffset = tile.isWater ? 0 : tile.elevation * 20 * mountainMult;
      
      let h: number, s: number, l: number;
      
      if (tile.isWater) {
        h = 200 + hueShift;
        s = 70;
        l = 35 + tile.elevation * 15;
      } else if (tile.isMountain) {
        h = 220 + hueShift;
        s = 10;
        l = 40 + tile.elevation * 25;
      } else if (tile.isForest) {
        h = 120 + hueShift;
        s = 50;
        l = 25 + tile.elevation * 20;
      } else {
        h = 30 + hueShift;
        s = 40;
        l = 25 + tile.elevation * 25;
      }
      
      // Draw tile top
      ctx.fillStyle = `hsl(${h}, ${s}%, ${l}%)`;
      ctx.beginPath();
      ctx.moveTo(isoX, isoY - heightOffset);
      ctx.lineTo(isoX + tileW / 2, isoY + tileH / 2 - heightOffset);
      ctx.lineTo(isoX, isoY + tileH - heightOffset);
      ctx.lineTo(isoX - tileW / 2, isoY + tileH / 2 - heightOffset);
      ctx.closePath();
      ctx.fill();
      
      // Draw sides if elevated
      if (heightOffset > 2 && !tile.isWater) {
        // Left side
        ctx.fillStyle = `hsl(${h}, ${s}%, ${l * 0.7}%)`;
        ctx.beginPath();
        ctx.moveTo(isoX - tileW / 2, isoY + tileH / 2 - heightOffset);
        ctx.lineTo(isoX, isoY + tileH - heightOffset);
        ctx.lineTo(isoX, isoY + tileH);
        ctx.lineTo(isoX - tileW / 2, isoY + tileH / 2);
        ctx.closePath();
        ctx.fill();
        
        // Right side
        ctx.fillStyle = `hsl(${h}, ${s}%, ${l * 0.5}%)`;
        ctx.beginPath();
        ctx.moveTo(isoX + tileW / 2, isoY + tileH / 2 - heightOffset);
        ctx.lineTo(isoX, isoY + tileH - heightOffset);
        ctx.lineTo(isoX, isoY + tileH);
        ctx.lineTo(isoX + tileW / 2, isoY + tileH / 2);
        ctx.closePath();
        ctx.fill();
      }
      
      // Draw landmarks
      const landmarkNoise = smoothNoise(x * 0.5 + 200, y * 0.5 + 200, seed + 4000);
      if (!tile.isWater && !tile.isMountain && landmarkNoise < landmarkDensity) {
        const lx = isoX;
        const ly = isoY - heightOffset - 4;
        const landmarkType = Math.floor(landmarkNoise * 100) % 3;
        
        if (landmarkType === 0) {
          // Tree
          ctx.fillStyle = `hsl(${120 + hueShift}, 60%, 25%)`;
          ctx.beginPath();
          ctx.moveTo(lx, ly - 10);
          ctx.lineTo(lx - 3, ly);
          ctx.lineTo(lx + 3, ly);
          ctx.closePath();
          ctx.fill();
          ctx.fillStyle = `hsl(${30 + hueShift}, 50%, 30%)`;
          ctx.fillRect(lx - 1, ly, 2, 3);
        } else if (landmarkType === 1) {
          // Rock
          ctx.fillStyle = 'hsl(0, 0%, 50%)';
          ctx.beginPath();
          ctx.ellipse(lx, ly, 3, 2, 0, 0, Math.PI * 2);
          ctx.fill();
        } else {
          // Bush
          ctx.fillStyle = `hsl(${100 + hueShift}, 50%, 35%)`;
          ctx.beginPath();
          ctx.ellipse(lx, ly, 4, 2.5, 0, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      
      // Draw user object
      if (x === objX && y === objY && !tile.isWater) {
        const ox = isoX;
        const oy = isoY - heightOffset - 8;
        
        // Glow
        ctx.fillStyle = 'hsla(170, 80%, 50%, 0.3)';
        ctx.beginPath();
        ctx.ellipse(ox, oy + 8, 10, 5, 0, 0, Math.PI * 2);
        ctx.fill();
        
        if (objType === 0) {
          // Tower
          ctx.fillStyle = `hsl(${50 + hueShift}, 60%, 70%)`;
          ctx.fillRect(ox - 4, oy - 12, 8, 16);
          ctx.fillStyle = `hsl(${50 + hueShift}, 70%, 80%)`;
          ctx.beginPath();
          ctx.moveTo(ox, oy - 20);
          ctx.lineTo(ox - 6, oy - 12);
          ctx.lineTo(ox + 6, oy - 12);
          ctx.closePath();
          ctx.fill();
        } else if (objType === 1) {
          // Crystal
          ctx.fillStyle = 'hsl(280, 70%, 70%)';
          ctx.beginPath();
          ctx.moveTo(ox, oy - 16);
          ctx.lineTo(ox - 4, oy - 4);
          ctx.lineTo(ox - 2, oy + 4);
          ctx.lineTo(ox + 2, oy + 4);
          ctx.lineTo(ox + 4, oy - 4);
          ctx.closePath();
          ctx.fill();
        } else if (objType === 2) {
          // Monument
          ctx.fillStyle = 'hsl(40, 30%, 60%)';
          ctx.fillRect(ox - 5, oy - 8, 10, 12);
          ctx.fillStyle = 'hsl(40, 25%, 70%)';
          ctx.fillRect(ox - 6, oy - 10, 12, 3);
          ctx.fillStyle = 'hsl(170, 80%, 50%)';
          ctx.beginPath();
          ctx.arc(ox, oy - 2, 3, 0, Math.PI * 2);
          ctx.fill();
        } else if (objType === 3) {
          // Flag
          ctx.fillStyle = 'hsl(30, 40%, 40%)';
          ctx.fillRect(ox - 1, oy - 18, 2, 22);
          ctx.fillStyle = 'hsl(0, 80%, 60%)';
          ctx.beginPath();
          ctx.moveTo(ox + 1, oy - 18);
          ctx.lineTo(ox + 10, oy - 14);
          ctx.lineTo(ox + 10, oy - 8);
          ctx.lineTo(ox + 1, oy - 12);
          ctx.closePath();
          ctx.fill();
        } else {
          // Beacon
          ctx.fillStyle = 'hsl(60, 20%, 50%)';
          ctx.fillRect(ox - 4, oy - 4, 8, 8);
          ctx.fillStyle = 'hsl(170, 90%, 80%)';
          ctx.beginPath();
          ctx.arc(ox, oy - 8, 4, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }
  }
  
  // Grid overlay
  ctx.strokeStyle = 'hsla(180, 100%, 95%, 0.1)';
  ctx.lineWidth = 0.5;
  for (let i = 0; i <= gridSize; i++) {
    ctx.beginPath();
    ctx.moveTo((0 - i) * tileW / 2 + offsetX, (0 + i) * tileH / 2 + offsetY);
    ctx.lineTo((gridSize - i) * tileW / 2 + offsetX, (gridSize + i) * tileH / 2 + offsetY);
    ctx.stroke();
    
    ctx.beginPath();
    ctx.moveTo((i - 0) * tileW / 2 + offsetX, (i + 0) * tileH / 2 + offsetY);
    ctx.lineTo((i - gridSize) * tileW / 2 + offsetX, (i + gridSize) * tileH / 2 + offsetY);
    ctx.stroke();
  }
  
  // Info overlay
  ctx.fillStyle = 'rgba(0, 0, 0, 0.85)';
  ctx.beginPath();
  ctx.roundRect(8, 8, 170, 28, 2);
  ctx.fill();
  
  ctx.fillStyle = 'hsl(170, 80%, 50%)';
  ctx.font = '11px "JetBrains Mono", monospace';
  ctx.fillText(`SEED: ${seed}`, 14, 26);
  
  ctx.fillStyle = 'hsl(50, 90%, 55%)';
  ctx.fillText('DETERMINISTIC', 95, 26);
}
