import { useState, useCallback, useEffect, useRef } from 'react';
import { Play, Pause, RotateCcw, Flag } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { WorldData } from '@/lib/worldData';
import { 
  WorldAction, 
  ReplayState, 
  ReplayFrame,
  generateReplayPath 
} from '@/lib/worldContract';

interface ReplayControlsProps {
  world: WorldData;
  actions: WorldAction[];
  isReplaying: boolean;
  onReplayStart: () => void;
  onReplayStop: () => void;
  onReplayFrame: (frame: ReplayFrame) => void;
  onReplayComplete: () => void;
}

export function ReplayControls({
  world,
  actions,
  isReplaying,
  onReplayStart,
  onReplayStop,
  onReplayFrame,
  onReplayComplete
}: ReplayControlsProps) {
  const [replayState, setReplayState] = useState<ReplayState>({
    isReplaying: false,
    currentStep: 0,
    totalSteps: 0,
    phase: 'spawn'
  });
  const framesRef = useRef<ReplayFrame[]>([]);
  const animationRef = useRef<number | null>(null);
  const startTimeRef = useRef<number>(0);
  
  // Generate replay path when world/actions change
  useEffect(() => {
    const action = actions[0]; // Only first action for now
    framesRef.current = generateReplayPath(world, action);
    setReplayState(prev => ({
      ...prev,
      totalSteps: framesRef.current.length
    }));
  }, [world, actions]);
  
  const runReplay = useCallback(() => {
    if (!isReplaying) return;
    
    const elapsed = Date.now() - startTimeRef.current;
    const frameIndex = Math.floor(elapsed / 33); // ~30fps
    
    if (frameIndex >= framesRef.current.length) {
      // Replay complete
      setReplayState(prev => ({ ...prev, phase: 'complete', currentStep: prev.totalSteps }));
      onReplayComplete();
      return;
    }
    
    const frame = framesRef.current[frameIndex];
    onReplayFrame(frame);
    
    // Determine phase
    let phase: ReplayState['phase'] = 'move';
    if (frameIndex === 0) phase = 'spawn';
    if (frame.action) phase = 'action';
    
    setReplayState(prev => ({
      ...prev,
      currentStep: frameIndex + 1,
      phase
    }));
    
    animationRef.current = requestAnimationFrame(runReplay);
  }, [isReplaying, onReplayFrame, onReplayComplete]);
  
  useEffect(() => {
    if (isReplaying) {
      startTimeRef.current = Date.now();
      setReplayState(prev => ({ ...prev, isReplaying: true, currentStep: 0, phase: 'spawn' }));
      animationRef.current = requestAnimationFrame(runReplay);
    } else {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
      setReplayState(prev => ({ ...prev, isReplaying: false }));
    }
    
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [isReplaying, runReplay]);
  
  const progress = replayState.totalSteps > 0 
    ? (replayState.currentStep / replayState.totalSteps) * 100 
    : 0;
  
  return (
    <div className="terminal-panel p-3 space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Flag className="w-4 h-4 text-primary" />
          <span className="text-xs font-display uppercase tracking-wider text-muted-foreground">
            Replay Mode
          </span>
        </div>
        <span className={`text-[10px] uppercase ${isReplaying ? 'text-accent' : 'text-muted-foreground'}`}>
          {isReplaying ? replayState.phase : 'READY'}
        </span>
      </div>
      
      {/* Progress bar */}
      <div className="h-1 bg-secondary rounded-full overflow-hidden">
        <div 
          className="h-full bg-primary transition-all duration-100"
          style={{ width: `${progress}%` }}
        />
      </div>
      
      {/* Frame counter */}
      <div className="flex items-center justify-between text-[10px]">
        <span className="text-muted-foreground">
          Frame: <span className="text-secondary-foreground font-mono">
            {replayState.currentStep}/{replayState.totalSteps}
          </span>
        </span>
        <span className="text-muted-foreground">
          Actions: <span className="text-secondary-foreground font-mono">{actions.length}</span>
        </span>
      </div>
      
      {/* Controls */}
      <div className="flex gap-2">
        <Button
          variant={isReplaying ? 'destructive' : 'default'}
          size="sm"
          onClick={isReplaying ? onReplayStop : onReplayStart}
          className="flex-1 gap-1.5 text-xs"
        >
          {isReplaying ? (
            <>
              <Pause className="w-3.5 h-3.5" />
              Stop
            </>
          ) : (
            <>
              <Play className="w-3.5 h-3.5" />
              Replay
            </>
          )}
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            onReplayStop();
            setReplayState(prev => ({ ...prev, currentStep: 0, phase: 'spawn' }));
          }}
          disabled={replayState.currentStep === 0}
          className="gap-1.5 text-xs"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          Reset
        </Button>
      </div>
      
      {/* Explanation */}
      <div className="text-[9px] text-muted-foreground border-t border-border pt-2 mt-2">
        <p>Replay reconstructs the world from stored parameters only:</p>
        <ul className="list-disc list-inside mt-1 space-y-0.5">
          <li>Seed + VAR array</li>
          <li>Action parameters (type, position)</li>
        </ul>
        <p className="mt-1 text-primary">No world state is stored — only instructions.</p>
      </div>
    </div>
  );
}
