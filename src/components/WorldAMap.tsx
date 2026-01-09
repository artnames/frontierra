// World A Map - 10×10 Grid Visualization
// Shows all lands in the shared continent with ownership status

import { useMemo, useState, useEffect, useCallback } from 'react';
import { PlayerLand, WORLD_A_GRID_WIDTH, WORLD_A_GRID_HEIGHT } from '@/lib/multiplayer/types';
import { getLandsInArea, createLand, getLandByPlayerId } from '@/lib/multiplayer/landRegistry';
import { cn } from '@/lib/utils';
import { MapPin, User, Eye, Loader2, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

interface WorldAMapProps {
  currentLand: PlayerLand | null;
  playerId: string | null;
  onVisitLand?: (x: number, y: number) => void;
  onLandClaimed?: (land: PlayerLand) => void;
  className?: string;
}

export function WorldAMap({ 
  currentLand, 
  playerId,
  onVisitLand,
  onLandClaimed,
  className 
}: WorldAMapProps) {
  const [allLands, setAllLands] = useState<PlayerLand[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isClaiming, setIsClaiming] = useState(false);
  const [hoveredCell, setHoveredCell] = useState<{ x: number; y: number } | null>(null);

  // Fetch all lands in World A on mount
  useEffect(() => {
    async function fetchLands() {
      setIsLoading(true);
      const lands = await getLandsInArea(0, 0, WORLD_A_GRID_WIDTH - 1, WORLD_A_GRID_HEIGHT - 1);
      setAllLands(lands);
      setIsLoading(false);
    }
    fetchLands();
  }, [currentLand]); // Refetch when current land changes

  // Check if player already owns a land
  const playerOwnedLand = useMemo(() => {
    if (!playerId) return null;
    return allLands.find(land => land.player_id === playerId) || null;
  }, [allLands, playerId]);

  // Build a map of position -> land for quick lookup
  const landMap = useMemo(() => {
    const map = new Map<string, PlayerLand>();
    for (const land of allLands) {
      map.set(`${land.pos_x},${land.pos_y}`, land);
    }
    return map;
  }, [allLands]);

  // Generate the 10x10 grid
  const grid = useMemo(() => {
    const cells: { x: number; y: number; land: PlayerLand | null }[] = [];
    for (let y = 0; y < WORLD_A_GRID_HEIGHT; y++) {
      for (let x = 0; x < WORLD_A_GRID_WIDTH; x++) {
        cells.push({
          x,
          y,
          land: landMap.get(`${x},${y}`) || null
        });
      }
    }
    return cells;
  }, [landMap]);

  // Claim an empty cell
  const handleClaimLand = useCallback(async (x: number, y: number) => {
    if (!playerId) {
      toast.error('You must be logged in to claim land');
      return;
    }

    // Double-check player doesn't already own land
    const existingLand = await getLandByPlayerId(playerId);
    if (existingLand) {
      toast.error('You already own a land! Each player can only claim one.');
      return;
    }

    setIsClaiming(true);
    try {
      const randomSeed = Math.floor(Math.random() * 100000);
      const randomVars = Array(10).fill(0).map(() => Math.floor(Math.random() * 100));
      
      const newLand = await createLand(playerId, randomSeed, randomVars, x, y);
      
      if (newLand) {
        toast.success(`Land claimed at (${x}, ${y})!`);
        setAllLands(prev => [...prev, newLand]);
        onLandClaimed?.(newLand);
      } else {
        toast.error('Failed to claim land. Position may already be taken.');
      }
    } catch (error) {
      console.error('[WorldAMap] Claim error:', error);
      toast.error('Failed to claim land');
    } finally {
      setIsClaiming(false);
    }
  }, [playerId, onLandClaimed]);

  const handleCellClick = (x: number, y: number, land: PlayerLand | null) => {
    if (land && onVisitLand) {
      onVisitLand(x, y);
    }
  };

  const getCellStatus = (cell: { x: number; y: number; land: PlayerLand | null }) => {
    const isCurrent = currentLand?.pos_x === cell.x && currentLand?.pos_y === cell.y;
    const isOwnLand = cell.land?.player_id === playerId;
    const isOwned = !!cell.land;
    
    return { isCurrent, isOwnLand, isOwned };
  };

  // Check if user can claim (logged in + no existing land)
  const canClaim = !!playerId && !playerOwnedLand;

  if (isLoading) {
    return (
      <div className={cn("flex items-center justify-center p-8", className)}>
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        <span className="ml-2 text-sm text-muted-foreground">Loading World A...</span>
      </div>
    );
  }

  return (
    <div className={cn("space-y-3", className)}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-display text-sm font-semibold text-foreground">
            World A Continent
          </h3>
          <p className="text-xs text-muted-foreground">
            {allLands.length} / {WORLD_A_GRID_WIDTH * WORLD_A_GRID_HEIGHT} lands claimed
          </p>
        </div>
        {currentLand && (
          <div className="text-xs text-muted-foreground">
            Current: <span className="font-mono text-primary">({currentLand.pos_x}, {currentLand.pos_y})</span>
          </div>
        )}
      </div>

      {/* Ownership status */}
      {playerId && (
        <div className="text-xs p-2 rounded bg-secondary/50">
          {playerOwnedLand ? (
            <span className="text-primary">
              Your land: <span className="font-mono">({playerOwnedLand.pos_x}, {playerOwnedLand.pos_y})</span>
            </span>
          ) : (
            <span className="text-muted-foreground">
              Click an empty cell to claim your land
            </span>
          )}
        </div>
      )}

      {/* 10x10 Grid */}
      <div 
        className="grid gap-[2px] bg-border p-2 rounded-lg"
        style={{ 
          gridTemplateColumns: `repeat(${WORLD_A_GRID_WIDTH}, 1fr)`
        }}
      >
        {grid.map((cell) => {
          const { isCurrent, isOwnLand, isOwned } = getCellStatus(cell);
          const isHovered = hoveredCell?.x === cell.x && hoveredCell?.y === cell.y;
          const canClaimThis = canClaim && !isOwned;
          
          return (
            <button
              key={`${cell.x},${cell.y}`}
              onClick={() => {
                if (canClaimThis) {
                  handleClaimLand(cell.x, cell.y);
                } else {
                  handleCellClick(cell.x, cell.y, cell.land);
                }
              }}
              onMouseEnter={() => setHoveredCell({ x: cell.x, y: cell.y })}
              onMouseLeave={() => setHoveredCell(null)}
              disabled={(!isOwned && !canClaimThis) || isClaiming}
              className={cn(
                "relative w-6 h-6 rounded-sm transition-all duration-150",
                "flex items-center justify-center text-[8px] font-mono",
                // Base states with solid visible colors
                !isOwned && !canClaimThis && "bg-muted/60 border border-border/50 cursor-not-allowed",
                !isOwned && canClaimThis && "bg-accent/20 border border-accent/50 hover:bg-accent/40 cursor-pointer",
                isOwned && !isCurrent && !isOwnLand && "bg-secondary border border-border hover:bg-secondary/80 cursor-pointer",
                isOwnLand && !isCurrent && "bg-primary/40 border border-primary/60 hover:bg-primary/50 cursor-pointer",
                isCurrent && "bg-accent border-2 border-accent-foreground",
                // Hover highlight
                isHovered && (isOwned || canClaimThis) && "scale-110 z-10 shadow-lg",
                // Claiming state
                isClaiming && "opacity-50"
              )}
              title={
                isOwned 
                  ? `Land (${cell.x}, ${cell.y}) - ${isOwnLand ? 'Your land' : 'Owned'}`
                  : canClaimThis
                    ? `Claim (${cell.x}, ${cell.y})`
                    : `Empty (${cell.x}, ${cell.y})`
              }
            >
              {isCurrent && (
                <MapPin className="w-3 h-3 text-accent-foreground" />
              )}
              {!isCurrent && isOwnLand && (
                <User className="w-2.5 h-2.5 text-primary-foreground" />
              )}
              {!isCurrent && !isOwnLand && isOwned && isHovered && (
                <Eye className="w-2.5 h-2.5 text-foreground" />
              )}
              {!isOwned && canClaimThis && isHovered && (
                <Plus className="w-3 h-3 text-accent-foreground" />
              )}
            </button>
          );
        })}
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-3 text-[10px] text-muted-foreground">
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-sm bg-accent border-2 border-accent-foreground" />
          <span>Current</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-sm bg-primary/40 border border-primary/60" />
          <span>Your Land</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-sm bg-secondary border border-border" />
          <span>Owned</span>
        </div>
        {canClaim && (
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-sm bg-accent/20 border border-accent/50" />
            <span>Claimable</span>
          </div>
        )}
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-sm bg-muted/60 border border-border/50" />
          <span>Empty</span>
        </div>
      </div>

      {/* Hovered Cell Info */}
      {hoveredCell && (
        <div className="p-2 bg-secondary/50 rounded text-xs">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">
              Position: <span className="font-mono text-foreground">({hoveredCell.x}, {hoveredCell.y})</span>
            </span>
            {landMap.get(`${hoveredCell.x},${hoveredCell.y}`) ? (
              <span className="text-primary">Click to visit</span>
            ) : canClaim ? (
              <span className="text-accent">Click to claim</span>
            ) : null}
          </div>
          {landMap.get(`${hoveredCell.x},${hoveredCell.y}`) && (
            <div className="mt-1 text-muted-foreground">
              Seed: <span className="font-mono text-foreground">
                {landMap.get(`${hoveredCell.x},${hoveredCell.y}`)?.seed}
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
