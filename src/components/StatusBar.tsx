import { WorldParams } from '@/lib/worldGenerator';

interface StatusBarProps {
  params: WorldParams;
}

export function StatusBar({ params }: StatusBarProps) {
  const varsDisplay = params.vars.slice(0, 5).join(',') + '...';
  
  return (
    <div className="terminal-panel">
      <div className="px-4 py-2 flex items-center justify-between text-xs">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-accent animate-pulse" />
            <span className="text-muted-foreground">DETERMINISTIC</span>
          </div>
          <div className="hidden sm:flex items-center gap-2">
            <span className="text-muted-foreground">SEED:</span>
            <span className="data-value">{params.seed}</span>
          </div>
          <div className="hidden md:flex items-center gap-2">
            <span className="text-muted-foreground">VARS:</span>
            <span className="text-secondary-foreground font-mono">[{varsDisplay}]</span>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <span className="text-muted-foreground">NexArt</span>
          <span className="text-primary">●</span>
        </div>
      </div>
    </div>
  );
}
