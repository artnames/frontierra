import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { MapPin, Loader2, CheckCircle } from "lucide-react";
import { getLandsInArea, findAvailablePosition, createLand } from "@/lib/multiplayer/landRegistry";
import { PlayerLand, WORLD_A_GRID_WIDTH, WORLD_A_GRID_HEIGHT } from "@/lib/multiplayer/types";

interface ClaimLandModalProps {
  open: boolean;
  onClose: () => void;
  onClaimed: (land: PlayerLand) => void;
  playerId: string;
}

export function ClaimLandModal({ 
  open, 
  onClose, 
  onClaimed,
  playerId 
}: ClaimLandModalProps) {
  const [allLands, setAllLands] = useState<PlayerLand[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isClaiming, setIsClaiming] = useState(false);
  const [selectedPos, setSelectedPos] = useState<{ x: number; y: number } | null>(null);
  const [suggestedPos, setSuggestedPos] = useState<{ x: number; y: number } | null>(null);

  // Load all lands and find suggested position
  useEffect(() => {
    if (!open) return;
    
    const loadData = async () => {
      setIsLoading(true);
      try {
        const lands = await getLandsInArea(0, 0, WORLD_A_GRID_WIDTH - 1, WORLD_A_GRID_HEIGHT - 1);
        setAllLands(lands);
        
        const suggested = await findAvailablePosition();
        setSuggestedPos(suggested);
        setSelectedPos(suggested);
      } catch (error) {
        console.error("Failed to load lands:", error);
      } finally {
        setIsLoading(false);
      }
    };
    
    loadData();
  }, [open]);

  const occupiedPositions = new Set(allLands.map(l => `${l.pos_x},${l.pos_y}`));

  const handleClaim = async () => {
    if (!selectedPos) return;
    
    setIsClaiming(true);
    try {
      const randomSeed = Math.floor(Math.random() * 100000);
      const randomVars = Array(10).fill(0).map(() => Math.floor(Math.random() * 100));
      const newLand = await createLand(playerId, randomSeed, randomVars, selectedPos.x, selectedPos.y);
      
      if (newLand) {
        onClaimed(newLand);
      }
    } catch (error) {
      console.error("Failed to claim land:", error);
    } finally {
      setIsClaiming(false);
    }
  };

  const handleCellClick = (x: number, y: number) => {
    if (!occupiedPositions.has(`${x},${y}`)) {
      setSelectedPos({ x, y });
    }
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MapPin className="w-5 h-5 text-primary" />
            Claim Your Land
          </DialogTitle>
          <DialogDescription>
            You don't have a land yet. Select an empty spot on the World A map to claim as your own.
          </DialogDescription>
        </DialogHeader>
        
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-4">
            {/* Mini World Map */}
            <div className="grid gap-0.5 p-2 bg-secondary/30 rounded-lg" 
                 style={{ gridTemplateColumns: `repeat(${WORLD_A_GRID_WIDTH}, 1fr)` }}>
              {Array.from({ length: WORLD_A_GRID_HEIGHT }).map((_, y) =>
                Array.from({ length: WORLD_A_GRID_WIDTH }).map((_, x) => {
                  const isOccupied = occupiedPositions.has(`${x},${y}`);
                  const isSelected = selectedPos?.x === x && selectedPos?.y === y;
                  const isSuggested = suggestedPos?.x === x && suggestedPos?.y === y;
                  
                  return (
                    <button
                      key={`${x}-${y}`}
                      onClick={() => handleCellClick(x, y)}
                      disabled={isOccupied}
                      className={`
                        aspect-square rounded-sm text-[8px] font-mono transition-all
                        ${isOccupied 
                          ? 'bg-muted cursor-not-allowed opacity-50' 
                          : isSelected
                            ? 'bg-primary text-primary-foreground ring-2 ring-primary ring-offset-1 ring-offset-background'
                            : isSuggested
                              ? 'bg-accent/50 hover:bg-accent'
                              : 'bg-secondary hover:bg-accent/30'
                        }
                      `}
                      title={isOccupied ? 'Claimed' : `(${x}, ${y})`}
                    >
                      {isSelected && <CheckCircle className="w-3 h-3 mx-auto" />}
                    </button>
                  );
                })
              )}
            </div>
            
            <div className="flex items-center gap-4 text-xs text-muted-foreground">
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded-sm bg-muted opacity-50" />
                <span>Claimed</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded-sm bg-secondary" />
                <span>Available</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded-sm bg-primary" />
                <span>Selected</span>
              </div>
            </div>
            
            {selectedPos && (
              <p className="text-sm text-center">
                Selected position: <span className="font-mono text-primary">({selectedPos.x}, {selectedPos.y})</span>
              </p>
            )}
          </div>
        )}
        
        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button variant="outline" onClick={onClose} disabled={isClaiming}>
            Cancel
          </Button>
          <Button 
            onClick={handleClaim} 
            disabled={!selectedPos || isClaiming}
            className="gap-2"
          >
            {isClaiming ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Claiming...
              </>
            ) : (
              <>
                <MapPin className="w-4 h-4" />
                Claim Land
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}