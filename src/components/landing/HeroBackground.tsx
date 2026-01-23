// Cinematic Hero Background - CSS-based atmospheric effects
// Layered gradients, topographic pattern, subtle vignette

import { useEffect, useRef } from 'react';

export function HeroBackground() {
  return (
    <div className="fixed inset-0 pointer-events-none overflow-hidden">
      {/* Deep navy base with layered radial gradients */}
      <div 
        className="absolute inset-0"
        style={{
          background: `
            radial-gradient(ellipse 80% 50% at 50% 0%, hsl(180 60% 25% / 0.25) 0%, transparent 50%),
            radial-gradient(ellipse 60% 40% at 80% 20%, hsl(280 50% 30% / 0.15) 0%, transparent 45%),
            radial-gradient(ellipse 50% 35% at 20% 30%, hsl(35 80% 45% / 0.12) 0%, transparent 40%),
            hsl(220 25% 8%)
          `,
        }}
      />
      
      {/* Topographic contour pattern overlay */}
      <div 
        className="absolute inset-0 opacity-[0.04]"
        style={{
          backgroundImage: `
            repeating-linear-gradient(
              45deg,
              transparent,
              transparent 2px,
              hsl(var(--primary) / 0.5) 2px,
              hsl(var(--primary) / 0.5) 3px
            ),
            repeating-linear-gradient(
              -45deg,
              transparent,
              transparent 2px,
              hsl(var(--primary) / 0.3) 2px,
              hsl(var(--primary) / 0.3) 3px
            )
          `,
          backgroundSize: '30px 30px',
        }}
      />
      
      {/* Subtle grid overlay */}
      <div 
        className="absolute inset-0 opacity-[0.02]"
        style={{
          backgroundImage: `
            linear-gradient(hsl(var(--primary) / 0.4) 1px, transparent 1px),
            linear-gradient(90deg, hsl(var(--primary) / 0.4) 1px, transparent 1px)
          `,
          backgroundSize: '80px 80px',
        }}
      />
      
      {/* Vignette overlay */}
      <div 
        className="absolute inset-0"
        style={{
          background: 'radial-gradient(ellipse at center, transparent 30%, hsl(220 25% 6% / 0.8) 100%)',
        }}
      />
      
      {/* Top glow accent */}
      <div 
        className="absolute -top-32 left-1/2 -translate-x-1/2 w-[1000px] h-[500px]"
        style={{
          background: 'radial-gradient(ellipse at center, hsl(var(--primary) / 0.15) 0%, transparent 60%)',
        }}
      />
    </div>
  );
}

// Optional: Lightweight animated canvas for ambient noise
export function AmbientCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    let animationId: number;
    let time = 0;
    
    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    
    resize();
    window.addEventListener('resize', resize);
    
    const draw = () => {
      time += 0.002;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      
      // Draw subtle animated contour lines
      ctx.strokeStyle = 'hsla(170, 80%, 50%, 0.03)';
      ctx.lineWidth = 1;
      
      const centerX = canvas.width / 2;
      const centerY = canvas.height * 0.4;
      
      for (let i = 0; i < 8; i++) {
        const radius = 100 + i * 60 + Math.sin(time + i * 0.5) * 20;
        ctx.beginPath();
        ctx.ellipse(centerX, centerY, radius * 1.5, radius, 0, 0, Math.PI * 2);
        ctx.stroke();
      }
      
      animationId = requestAnimationFrame(draw);
    };
    
    draw();
    
    return () => {
      cancelAnimationFrame(animationId);
      window.removeEventListener('resize', resize);
    };
  }, []);
  
  return (
    <canvas 
      ref={canvasRef}
      className="fixed inset-0 pointer-events-none opacity-50"
      aria-hidden="true"
    />
  );
}
