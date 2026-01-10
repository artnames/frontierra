// Time of Day HUD - Visual indicator of deterministic time

import { useMemo } from 'react';
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
}

export function TimeOfDayHUD({ worldX, worldY, sessionOffset = 0 }: TimeOfDayHUDProps) {
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
          <span className="text-muted-foreground uppercase tracking-wider text-[10px]">
            {label}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-muted-foreground">TIME:</span>
          <span className="data-value font-mono">{timeString}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-muted-foreground">CYCLE:</span>
          <div className="w-16 h-1.5 bg-muted rounded-full overflow-hidden">
            <div 
              className={`h-full rounded-full transition-all ${night ? 'bg-blue-400' : twilight ? 'bg-orange-400' : 'bg-yellow-400'}`}
              style={{ width: `${timeOfDay * 100}%` }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
