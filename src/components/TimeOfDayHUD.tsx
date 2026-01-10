// Time of Day HUD - Visual indicator of UTC-based global time
// All players see the same time worldwide

import { useMemo, useState, useEffect } from 'react';
import { Sun, Moon, Sunrise, Sunset } from 'lucide-react';
import { 
  getTimeOfDay, 
  isNight, 
  isTwilight, 
  TimeOfDayContext 
} from '@/lib/timeOfDay';
import { WORLD_A_ID } from '@/lib/worldContext';

interface TimeOfDayHUDProps {
  worldX: number;
  worldY: number;
  sessionOffset?: number;
  showDebug?: boolean; // New prop to control debug visibility
}

export function TimeOfDayHUD({ worldX, worldY, sessionOffset = 0, showDebug = false }: TimeOfDayHUDProps) {
  // Force re-render every second to update time
  const [, setTick] = useState(0);
  
  useEffect(() => {
    const interval = setInterval(() => setTick(t => t + 1), 1000);
    return () => clearInterval(interval);
  }, []);
  
  const timeContext = useMemo<TimeOfDayContext>(() => ({
    worldId: WORLD_A_ID,
    worldX,
    worldY,
    sessionOffset
  }), [worldX, worldY, sessionOffset]);
  
  const timeOfDay = useMemo(() => getTimeOfDay(timeContext), [timeContext]);
  const night = isNight(timeOfDay);
  const twilight = isTwilight(timeOfDay);
  
  // Determine time period and icon
  const { icon: Icon, label, color } = useMemo(() => {
    // timeOfDay: 0 = midnight, 0.25 = sunrise, 0.5 = noon, 0.75 = sunset
    if (timeOfDay >= 0.22 && timeOfDay < 0.28) {
      return { icon: Sunrise, label: 'Dawn', color: 'text-orange-400' };
    }
    if (timeOfDay >= 0.28 && timeOfDay < 0.72) {
      return { icon: Sun, label: 'Day', color: 'text-yellow-400' };
    }
    if (timeOfDay >= 0.72 && timeOfDay < 0.78) {
      return { icon: Sunset, label: 'Dusk', color: 'text-orange-500' };
    }
    return { icon: Moon, label: 'Night', color: 'text-blue-300' };
  }, [timeOfDay]);
  
  // Convert to 24h clock for display
  const hours = Math.floor(timeOfDay * 24);
  const minutes = Math.floor((timeOfDay * 24 - hours) * 60);
  const timeString = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
  
  return (
    <div className="terminal-panel p-3 pointer-events-none">
      <div className="text-xs space-y-2">
        <div className="flex items-center gap-2">
          <Icon className={`w-4 h-4 ${color}`} />
          <span className="text-foreground/80 font-medium">
            {label}
          </span>
          <span className="text-muted-foreground font-mono text-[10px]">
            {timeString}
          </span>
        </div>
        
        {/* Minimal cycle indicator */}
        <div className="w-full h-1 bg-muted rounded-full overflow-hidden">
          <div 
            className={`h-full rounded-full transition-all duration-1000 ${
              night ? 'bg-blue-400/60' : twilight ? 'bg-orange-400/70' : 'bg-yellow-400/80'
            }`}
            style={{ width: `${timeOfDay * 100}%` }}
          />
        </div>
        
        {/* Debug info - hidden by default */}
        {showDebug && (
          <div className="text-[9px] text-muted-foreground/60 pt-1 border-t border-border/50">
            20-min UTC cycle
          </div>
        )}
      </div>
    </div>
  );
}
