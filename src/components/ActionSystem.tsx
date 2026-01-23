import { useState, useCallback, useRef } from "react";
import { Crosshair, MapPin } from "lucide-react";
import { WorldData, getElevationAt, isWalkable } from "@/lib/worldData";
import { WorldAction, executeAction } from "@/lib/worldContract";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";

interface ActionSystemProps {
  world: WorldData;
  playerPosition: { x: number; y: number };
  actions: WorldAction[];
  onActionExecute: (action: WorldAction) => void;
  onActionReset?: () => void;
  disabled?: boolean;
}

export function ActionSystem({
  world,
  playerPosition,
  actions,
  onActionExecute,
  onActionReset,
  disabled,
}: ActionSystemProps) {
  const { toast } = useToast();
  const [isPlacing, setIsPlacing] = useState(false);

  const gridX = Math.floor(playerPosition.x);
  const gridY = Math.floor(playerPosition.y);

  // Guard against incomplete world data
  const isWorldReady = world && world.terrain && world.terrain.length > 0 && world.gridSize > 0;

  // COORDINATE FIX: Flip Y to match Three.js world Z
  const flippedY = isWorldReady ? world.gridSize - 1 - gridY : 0;
  const cell = isWorldReady ? world.terrain[flippedY]?.[gridX] : null;

  const canPlace = cell && cell.type !== "water" && actions.length === 0;

  const handlePlaceLandmark = useCallback(() => {
    if (!canPlace || !isWorldReady) return;

    const action: WorldAction = {
      type: "plant_beacon", // Keep internal type for compatibility
      gridX,
      gridY,
    };

    // Execute to verify it would succeed
    const result = executeAction(world, action, actions);

    if (result.success) {
      onActionExecute(action);
      setIsPlacing(false);
      toast({
        title: "Landmark Placed",
        description: `Location: (${gridX}, ${gridY}) - VARs updated`,
      });
    } else {
      toast({
        title: "Action Failed",
        description: result.message,
        variant: "destructive",
      });
    }
  }, [canPlace, isWorldReady, gridX, gridY, world, actions, onActionExecute, toast]);

  const hasPlacedAction = actions.length > 0;

  return (
    <div className="terminal-panel p-3 space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <MapPin className="w-4 h-4 text-primary" />
          <span className="text-xs font-display uppercase tracking-wider text-muted-foreground">Actions</span>
        </div>
        <span className={`text-[10px] uppercase ${hasPlacedAction ? "text-muted-foreground" : "text-accent"}`}>
          {hasPlacedAction ? "USED" : "1 AVAILABLE"}
        </span>
      </div>

      {/* Current position */}
      <div className="text-[10px] space-y-1">
        <div className="flex justify-between">
          <span className="text-muted-foreground">Current Tile:</span>
          <span className="font-mono text-secondary-foreground">
            ({gridX}, {gridY})
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">Terrain:</span>
          <span className={`font-mono uppercase ${cell?.type === "water" ? "text-destructive" : "text-accent"}`}>
            {cell?.type || "UNKNOWN"}
          </span>
        </div>
      </div>

      {/* Action button */}
      <Button
        variant={hasPlacedAction ? "outline" : "default"}
        size="sm"
        onClick={handlePlaceLandmark}
        disabled={disabled || !canPlace || hasPlacedAction}
        className="w-full gap-1.5 text-xs"
      >
        <Crosshair className="w-3.5 h-3.5" />
        {hasPlacedAction ? "Landmark Already Placed" : "Place Landmark Here"}
      </Button>

      {/* Placed action info */}
      {hasPlacedAction && (
        <div className="bg-secondary/50 rounded p-2 text-[9px]">
          <div className="flex justify-between items-center mb-1">
            <span className="text-muted-foreground">PLACED LANDMARK:</span>
            {onActionReset && (
              <Button
                variant="ghost"
                size="sm"
                onClick={onActionReset}
                disabled={disabled}
                className="h-5 px-1.5 text-[9px] text-destructive hover:text-destructive"
              >
                Reset
              </Button>
            )}
          </div>
          <div className="font-mono space-y-0.5">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Location:</span>
              <span className="text-secondary-foreground">
                ({actions[0].gridX}, {actions[0].gridY})
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Rules */}
      <div className="text-[9px] text-muted-foreground border-t border-border pt-2">
        <p className="text-primary mb-1">Rules:</p>
        <ul className="list-disc list-inside space-y-0.5">
          <li>One landmark per world</li>
          <li>Cannot place on water</li>
          <li>Updates Landmark X/Y VARs</li>
          <li>Anyone with URL sees same landmark</li>
        </ul>
      </div>
    </div>
  );
}

// PlacedBeaconMesh removed - landmark placement now updates VARs directly,
// and the PlantedObject component in WorldRenderer handles rendering the landmark
// at the position derived from VAR[1] and VAR[2]. This eliminates duplication.
