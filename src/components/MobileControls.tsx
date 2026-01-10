import { useEffect, useRef, useCallback, useState } from 'react';
import { cn } from '@/lib/utils';

interface MobileControlsProps {
  onMove: (forward: boolean, backward: boolean, left: boolean, right: boolean) => void;
  className?: string;
}

export function MobileControls({ onMove, className }: MobileControlsProps) {
  const joystickRef = useRef<HTMLDivElement>(null);
  const knobRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [knobPosition, setKnobPosition] = useState({ x: 0, y: 0 });
  const touchIdRef = useRef<number | null>(null);

  const maxDistance = 35; // Max distance knob can move from center

  const handleJoystickInput = useCallback((deltaX: number, deltaY: number) => {
    // Normalize to -1 to 1 range
    const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
    const clampedDistance = Math.min(distance, maxDistance);
    
    let normalizedX = 0;
    let normalizedY = 0;
    
    if (distance > 0) {
      normalizedX = (deltaX / distance) * (clampedDistance / maxDistance);
      normalizedY = (deltaY / distance) * (clampedDistance / maxDistance);
    }
    
    // Update knob visual position
    setKnobPosition({
      x: normalizedX * maxDistance,
      y: normalizedY * maxDistance
    });
    
    // Threshold for movement activation
    const threshold = 0.3;
    
    const forward = normalizedY < -threshold;
    const backward = normalizedY > threshold;
    const left = normalizedX < -threshold;
    const right = normalizedX > threshold;
    
    onMove(forward, backward, left, right);
  }, [onMove]);

  const resetJoystick = useCallback(() => {
    setKnobPosition({ x: 0, y: 0 });
    onMove(false, false, false, false);
  }, [onMove]);

  useEffect(() => {
    const joystick = joystickRef.current;
    if (!joystick) return;

    const getJoystickCenter = () => {
      const rect = joystick.getBoundingClientRect();
      return {
        x: rect.left + rect.width / 2,
        y: rect.top + rect.height / 2
      };
    };

    const handleTouchStart = (e: TouchEvent) => {
      if (touchIdRef.current !== null) return; // Already tracking a touch
      
      const touch = e.changedTouches[0];
      touchIdRef.current = touch.identifier;
      setIsDragging(true);
      
      const center = getJoystickCenter();
      handleJoystickInput(touch.clientX - center.x, touch.clientY - center.y);
      
      e.preventDefault();
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (touchIdRef.current === null) return;
      
      // Find our tracked touch
      for (let i = 0; i < e.changedTouches.length; i++) {
        const touch = e.changedTouches[i];
        if (touch.identifier === touchIdRef.current) {
          const center = getJoystickCenter();
          handleJoystickInput(touch.clientX - center.x, touch.clientY - center.y);
          e.preventDefault();
          break;
        }
      }
    };

    const handleTouchEnd = (e: TouchEvent) => {
      if (touchIdRef.current === null) return;
      
      // Check if our tracked touch ended
      for (let i = 0; i < e.changedTouches.length; i++) {
        if (e.changedTouches[i].identifier === touchIdRef.current) {
          touchIdRef.current = null;
          setIsDragging(false);
          resetJoystick();
          e.preventDefault();
          break;
        }
      }
    };

    joystick.addEventListener('touchstart', handleTouchStart, { passive: false });
    window.addEventListener('touchmove', handleTouchMove, { passive: false });
    window.addEventListener('touchend', handleTouchEnd, { passive: false });
    window.addEventListener('touchcancel', handleTouchEnd, { passive: false });

    return () => {
      joystick.removeEventListener('touchstart', handleTouchStart);
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('touchend', handleTouchEnd);
      window.removeEventListener('touchcancel', handleTouchEnd);
    };
  }, [handleJoystickInput, resetJoystick]);

  return (
    <div className={cn("pointer-events-auto", className)}>
      {/* Joystick Base */}
      <div
        ref={joystickRef}
        className={cn(
          "w-24 h-24 rounded-full bg-black/30 backdrop-blur-sm border-2 border-white/20",
          "flex items-center justify-center touch-none select-none",
          isDragging && "border-primary/50"
        )}
      >
        {/* Joystick Knob */}
        <div
          ref={knobRef}
          className={cn(
            "w-10 h-10 rounded-full bg-white/40 backdrop-blur-sm border-2 border-white/50",
            "transition-colors",
            isDragging && "bg-primary/60 border-primary"
          )}
          style={{
            transform: `translate(${knobPosition.x}px, ${knobPosition.y}px)`
          }}
        />
      </div>
    </div>
  );
}
