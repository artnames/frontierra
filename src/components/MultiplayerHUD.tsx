// Multiplayer HUD - Shows land info and neighbor map

import { PlayerLand, LAND_GRID_SIZE } from '@/lib/multiplayer/types';

interface MultiplayerHUDProps {
  currentLand: PlayerLand | null;
  neighborLands: PlayerLand[];
  playerPosition: { x: number; z: number };
  isTransitioning?: boolean;
  onVisitLand?: (x: number, y: number) => void;
}

export function MultiplayerHUD({
  currentLand,
  neighborLands,
  playerPosition,
  isTransitioning,
  onVisitLand
}: MultiplayerHUDProps) {
  if (!currentLand) return null;
  
  // Build 3x3 grid of current land + neighbors
  const gridCells: (PlayerLand | null)[][] = [
    [null, null, null],
    [null, currentLand, null],
    [null, null, null]
  ];
  
  for (const neighbor of neighborLands) {
    const dx = neighbor.pos_x - currentLand.pos_x;
    const dy = neighbor.pos_y - currentLand.pos_y;
    if (Math.abs(dx) <= 1 && Math.abs(dy) <= 1) {
      gridCells[dy + 1][dx + 1] = neighbor;
    }
  }
  
  return (
    <div className="absolute top-4 right-4 bg-background/90 backdrop-blur-sm rounded-lg p-3 shadow-lg border border-border/50 min-w-[200px]">
      {/* Land Info */}
      <div className="mb-3 pb-2 border-b border-border/30">
        <div className="text-xs text-muted-foreground">Current Land</div>
        <div className="font-mono text-sm">
          Seed: {currentLand.seed}
        </div>
        <div className="font-mono text-xs text-muted-foreground">
          Grid: ({currentLand.pos_x}, {currentLand.pos_y})
        </div>
      </div>
      
      {/* Mini Map */}
      <div className="mb-2">
        <div className="text-xs text-muted-foreground mb-1">Neighbor Map</div>
        <div className="grid grid-cols-3 gap-1">
          {gridCells.map((row, y) =>
            row.map((cell, x) => {
              const isCurrent = x === 1 && y === 1;
              const hasLand = cell !== null;
              
              return (
                <button
                  key={`${x}-${y}`}
                  onClick={() => {
                    if (hasLand && !isCurrent && onVisitLand) {
                      onVisitLand(cell!.pos_x, cell!.pos_y);
                    }
                  }}
                  disabled={!hasLand || isCurrent}
                  className={`
                    w-8 h-8 rounded text-xs font-mono transition-colors
                    ${isCurrent 
                      ? 'bg-primary text-primary-foreground ring-2 ring-primary/50' 
                      : hasLand 
                        ? 'bg-secondary hover:bg-secondary/80 cursor-pointer' 
                        : 'bg-muted/30 cursor-not-allowed'
                    }
                  `}
                  title={hasLand ? `Seed: ${cell!.seed}` : 'Empty'}
                >
                  {isCurrent ? '★' : hasLand ? '■' : '·'}
                </button>
              );
            })
          )}
        </div>
      </div>
      
      {/* Player Position */}
      <div className="text-xs text-muted-foreground">
        Position: ({Math.round(playerPosition.x)}, {Math.round(playerPosition.z)})
      </div>
      
      {/* Transition Indicator */}
      {isTransitioning && (
        <div className="mt-2 text-xs text-amber-500 animate-pulse">
          Crossing boundary...
        </div>
      )}
    </div>
  );
}
