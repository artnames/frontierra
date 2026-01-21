// Mobile Landscape Gate - Forces landscape orientation on mobile
// Shows rotate overlay in portrait, prevents Canvas mount to save GPU

import { useState, useEffect, ReactNode } from 'react';
import { RotateCcw, Smartphone } from 'lucide-react';

interface MobileLandscapeGateProps {
  children: ReactNode;
  /** Force bypass the gate (for testing) */
  bypass?: boolean;
}

function useOrientationAndMobile() {
  const [state, setState] = useState(() => ({
    isMobile: false,
    isPortrait: false,
    isReady: false,
  }));

  useEffect(() => {
    const checkState = () => {
      const hasTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
      const mobileUA = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
      const smallScreen = window.innerWidth < 1024;
      const isMobile = (hasTouch && smallScreen) || mobileUA;
      
      // Portrait = height > width
      const isPortrait = window.innerHeight > window.innerWidth;
      
      setState({
        isMobile,
        isPortrait,
        isReady: true,
      });
    };

    checkState();

    // Listen for orientation changes and resize
    window.addEventListener('resize', checkState);
    window.addEventListener('orientationchange', checkState);

    // Also listen to matchMedia for orientation
    const portraitMQ = window.matchMedia('(orientation: portrait)');
    const handleMQChange = () => checkState();
    portraitMQ.addEventListener('change', handleMQChange);

    return () => {
      window.removeEventListener('resize', checkState);
      window.removeEventListener('orientationchange', checkState);
      portraitMQ.removeEventListener('change', handleMQChange);
    };
  }, []);

  return state;
}

export function MobileLandscapeGate({ children, bypass = false }: MobileLandscapeGateProps) {
  const { isMobile, isPortrait, isReady } = useOrientationAndMobile();

  // Show nothing until we've detected orientation (prevents flash)
  if (!isReady) {
    return (
      <div className="fixed inset-0 bg-background flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  // If bypass or desktop or mobile+landscape, render children
  if (bypass || !isMobile || !isPortrait) {
    return <>{children}</>;
  }

  // Mobile + Portrait: Show rotate overlay, DO NOT render children (saves GPU)
  return (
    <div className="fixed inset-0 bg-background z-[9999] flex flex-col items-center justify-center p-6 text-center">
      {/* Animated rotate icon */}
      <div className="relative mb-8">
        <Smartphone className="w-16 h-16 text-muted-foreground animate-pulse" />
        <RotateCcw className="absolute -right-3 -bottom-3 w-8 h-8 text-primary animate-spin" style={{ animationDuration: '3s' }} />
      </div>

      <h1 className="text-2xl font-display font-bold text-foreground mb-3">
        Rotate Your Phone
      </h1>
      
      <p className="text-muted-foreground max-w-xs">
        Frontierra works best in landscape mode. Please rotate your device to continue exploring.
      </p>

      <div className="mt-8 flex items-center gap-2 text-xs text-muted-foreground/60">
        <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
        <span>Waiting for landscape orientation...</span>
      </div>
    </div>
  );
}
