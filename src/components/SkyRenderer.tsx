// Sky Renderer - Deterministic Day/Night Sky using @nexart/ui-renderer
// Renders behind the 3D world as a background layer

import { useEffect, useRef, useMemo } from 'react';
import { createSystem, previewSystem } from '@nexart/ui-renderer';
import { 
  getTimeOfDay, 
  skyGradient, 
  getSunAngle, 
  isNight, 
  generateStars,
  getStarVisibility,
  TimeOfDayContext 
} from '@/lib/timeOfDay';
import { WORLD_A_ID } from '@/lib/worldContext';

interface SkyRendererProps {
  worldX?: number;
  worldY?: number;
  sessionOffset?: number;
  className?: string;
}

export function SkyRenderer({ 
  worldX = 0, 
  worldY = 0, 
  sessionOffset = 0,
  className = ''
}: SkyRendererProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rendererRef = useRef<ReturnType<typeof previewSystem> | null>(null);
  
  // Build time context
  const timeContext = useMemo<TimeOfDayContext>(() => ({
    worldId: WORLD_A_ID,
    worldX,
    worldY,
    sessionOffset
  }), [worldX, worldY, sessionOffset]);
  
  // Compute deterministic time of day
  const timeOfDay = useMemo(() => getTimeOfDay(timeContext), [timeContext]);
  
  // Get sky colors
  const colors = useMemo(() => skyGradient(timeOfDay), [timeOfDay]);
  
  // Generate stars (deterministic)
  const stars = useMemo(() => generateStars(timeContext, 150), [timeContext]);
  const starVisibility = useMemo(() => getStarVisibility(timeOfDay), [timeOfDay]);
  
  // Sun/moon angle
  const celestialAngle = useMemo(() => getSunAngle(timeOfDay), [timeOfDay]);
  const night = useMemo(() => isNight(timeOfDay), [timeOfDay]);
  
  // Build the sky sketch source
  const skySource = useMemo(() => {
    // Convert colors to RGB values
    const parseHex = (hex: string) => {
      const h = hex.replace('#', '');
      return {
        r: parseInt(h.substring(0, 2), 16),
        g: parseInt(h.substring(2, 4), 16),
        b: parseInt(h.substring(4, 6), 16)
      };
    };
    
    const zenith = parseHex(colors.zenith);
    const horizon = parseHex(colors.horizon);
    const sunMoon = parseHex(colors.sunMoon);
    
    // Stars data for night sky
    const starsData = stars.slice(0, 100).map(s => 
      `{x:${s.x.toFixed(3)},y:${s.y.toFixed(3)},s:${s.size.toFixed(1)},b:${s.brightness.toFixed(2)}}`
    ).join(',');
    
    return `
      function setup() {
        noStroke();
        
        // Sky gradient (vertical)
        var zenithR = ${zenith.r};
        var zenithG = ${zenith.g};
        var zenithB = ${zenith.b};
        var horizonR = ${horizon.r};
        var horizonG = ${horizon.g};
        var horizonB = ${horizon.b};
        
        for (var y = 0; y < height; y++) {
          var t = y / height;
          var r = lerp(zenithR, horizonR, t);
          var g = lerp(zenithG, horizonG, t);
          var b = lerp(zenithB, horizonB, t);
          stroke(r, g, b);
          line(0, y, width, y);
        }
        noStroke();
        
        // Stars (only visible at night)
        var starVis = ${starVisibility.toFixed(2)};
        if (starVis > 0.01) {
          var stars = [${starsData}];
          for (var i = 0; i < stars.length; i++) {
            var star = stars[i];
            var alpha = star.b * starVis * 255;
            fill(255, 255, 255, alpha);
            ellipse(star.x * width, star.y * height, star.s, star.s);
          }
        }
        
        // Sun or Moon
        var angle = ${celestialAngle.toFixed(3)};
        var isNight = ${night ? 'true' : 'false'};
        
        // Only draw if above horizon
        if (angle > 0 && angle < PI) {
          var cx = width * (angle / PI);
          var cy = height * 0.3 - sin(angle) * height * 0.25;
          
          var sunR = ${sunMoon.r};
          var sunG = ${sunMoon.g};
          var sunB = ${sunMoon.b};
          
          if (isNight) {
            // Moon - smaller with subtle glow
            fill(sunR, sunG, sunB, 40);
            ellipse(cx, cy, 60, 60);
            fill(sunR, sunG, sunB, 80);
            ellipse(cx, cy, 40, 40);
            fill(sunR, sunG, sunB, 200);
            ellipse(cx, cy, 25, 25);
          } else {
            // Sun - larger with warm glow
            fill(sunR, sunG, sunB, 20);
            ellipse(cx, cy, 120, 120);
            fill(sunR, sunG, sunB, 40);
            ellipse(cx, cy, 80, 80);
            fill(sunR, sunG, sunB, 100);
            ellipse(cx, cy, 50, 50);
            fill(255, 255, 240, 255);
            ellipse(cx, cy, 30, 30);
          }
        }
        
        // Atmospheric haze at horizon
        for (var y = height * 0.7; y < height; y++) {
          var t = (y - height * 0.7) / (height * 0.3);
          var alpha = t * 0.15 * 255;
          fill(horizonR, horizonG, horizonB, alpha);
          rect(0, y, width, 1);
        }
      }
    `;
  }, [colors, stars, starVisibility, celestialAngle, night]);
  
  // Initialize and render
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    // Clean up previous renderer
    if (rendererRef.current) {
      rendererRef.current.destroy();
    }
    
    try {
      const system = createSystem({
        type: 'code',
        mode: 'static',
        width: 512,
        height: 384,
        seed: Math.abs((worldX * 1000 + worldY) % 100000),
        vars: [50, 50, 50, 50, 50, 50, 50, 50, 50, 50],
        source: skySource
      });
      
      const renderer = previewSystem(system, canvas, { showBadge: false });
      rendererRef.current = renderer;
      renderer.render();
    } catch (error) {
      console.error('[SkyRenderer] Failed to render sky:', error);
    }
    
    return () => {
      if (rendererRef.current) {
        rendererRef.current.destroy();
        rendererRef.current = null;
      }
    };
  }, [skySource, worldX, worldY]);
  
  return (
    <canvas 
      ref={canvasRef}
      className={`absolute inset-0 w-full h-full pointer-events-none ${className}`}
      style={{ 
        zIndex: -1,
        objectFit: 'cover'
      }}
    />
  );
}

// Hook for accessing time of day in other components
export function useTimeOfDay(worldX: number = 0, worldY: number = 0, sessionOffset: number = 0) {
  const context = useMemo<TimeOfDayContext>(() => ({
    worldId: WORLD_A_ID,
    worldX,
    worldY,
    sessionOffset
  }), [worldX, worldY, sessionOffset]);
  
  return useMemo(() => ({
    timeOfDay: getTimeOfDay(context),
    context
  }), [context]);
}
