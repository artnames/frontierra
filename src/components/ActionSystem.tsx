import { useState, useCallback, useRef } from 'react';
import { Crosshair, MapPin } from 'lucide-react';
import { WorldData, getElevationAt, isWalkable } from '@/lib/worldData';
import { WorldAction, executeAction } from '@/lib/worldContract';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';

interface ActionSystemProps {
  world: WorldData;
  playerPosition: { x: number; y: number };
  actions: WorldAction[];
  onActionExecute: (action: WorldAction) => void;
  disabled?: boolean;
}

export function ActionSystem({ 
  world, 
  playerPosition, 
  actions,
  onActionExecute,
  disabled 
}: ActionSystemProps) {
  const { toast } = useToast();
  const [isPlacing, setIsPlacing] = useState(false);
  
  const gridX = Math.floor(playerPosition.x);
  const gridY = Math.floor(playerPosition.y);
  const cell = world.terrain[gridY]?.[gridX];
  
  const canPlace = cell && cell.type !== 'water' && actions.length === 0;
  
  const handlePlaceBeacon = useCallback(() => {
    if (!canPlace) return;
    
    const action: WorldAction = {
      type: 'plant_beacon',
      gridX,
      gridY
    };
    
    // Execute to verify it would succeed
    const result = executeAction(world, action, actions);
    
    if (result.success) {
      onActionExecute(action);
      setIsPlacing(false);
      toast({
        title: 'Beacon Planted',
        description: `Location: (${gridX}, ${gridY}) | Hash: ${result.hash}`,
      });
    } else {
      toast({
        title: 'Action Failed',
        description: result.message,
        variant: 'destructive'
      });
    }
  }, [canPlace, gridX, gridY, world, actions, onActionExecute, toast]);
  
  const hasPlacedAction = actions.length > 0;
  
  return (
    <div className="terminal-panel p-3 space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <MapPin className="w-4 h-4 text-primary" />
          <span className="text-xs font-display uppercase tracking-wider text-muted-foreground">
            Actions
          </span>
        </div>
        <span className={`text-[10px] uppercase ${hasPlacedAction ? 'text-muted-foreground' : 'text-accent'}`}>
          {hasPlacedAction ? 'USED' : '1 AVAILABLE'}
        </span>
      </div>
      
      {/* Current position */}
      <div className="text-[10px] space-y-1">
        <div className="flex justify-between">
          <span className="text-muted-foreground">Current Tile:</span>
          <span className="font-mono text-secondary-foreground">({gridX}, {gridY})</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">Terrain:</span>
          <span className={`font-mono uppercase ${cell?.type === 'water' ? 'text-destructive' : 'text-accent'}`}>
            {cell?.type || 'UNKNOWN'}
          </span>
        </div>
      </div>
      
      {/* Action button */}
      <Button
        variant={hasPlacedAction ? 'outline' : 'default'}
        size="sm"
        onClick={handlePlaceBeacon}
        disabled={disabled || !canPlace || hasPlacedAction}
        className="w-full gap-1.5 text-xs"
      >
        <Crosshair className="w-3.5 h-3.5" />
        {hasPlacedAction ? 'Beacon Already Placed' : 'Plant Beacon Here'}
      </Button>
      
      {/* Placed action info */}
      {hasPlacedAction && (
        <div className="bg-secondary/50 rounded p-2 text-[9px]">
          <div className="text-muted-foreground mb-1">IRREVERSIBLE ACTION:</div>
          <div className="font-mono space-y-0.5">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Type:</span>
              <span className="text-primary">{actions[0].type}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Location:</span>
              <span className="text-secondary-foreground">({actions[0].gridX}, {actions[0].gridY})</span>
            </div>
          </div>
        </div>
      )}
      
      {/* Rules */}
      <div className="text-[9px] text-muted-foreground border-t border-border pt-2">
        <p className="text-primary mb-1">Rules:</p>
        <ul className="list-disc list-inside space-y-0.5">
          <li>One action per world</li>
          <li>Cannot place on water</li>
          <li>Result is deterministic</li>
          <li>Anyone with URL sees same beacon</li>
        </ul>
      </div>
    </div>
  );
}

// Visual beacon component for 3D scene
interface PlacedBeaconProps {
  action: WorldAction;
  world: WorldData;
}

export function PlacedBeaconMesh({ action, world }: PlacedBeaconProps) {
  const cell = world.terrain[action.gridY]?.[action.gridX];
  const elevation = cell ? cell.elevation * 20 : 0;
  
  return (
    <group position={[action.gridX, elevation, action.gridY]}>
      {/* Base */}
      <mesh position={[0, 0.3, 0]}>
        <cylinderGeometry args={[0.4, 0.5, 0.6, 8]} />
        <meshStandardMaterial color="#3a5a5a" />
      </mesh>
      
      {/* Pillar */}
      <mesh position={[0, 1.5, 0]}>
        <cylinderGeometry args={[0.15, 0.2, 2, 8]} />
        <meshStandardMaterial color="#4a6a6a" />
      </mesh>
      
      {/* Light orb */}
      <mesh position={[0, 2.8, 0]}>
        <sphereGeometry args={[0.3, 16, 16]} />
        <meshStandardMaterial 
          color="#5ac4c4" 
          emissive="#5ac4c4" 
          emissiveIntensity={1}
        />
      </mesh>
      
      {/* Point light */}
      <pointLight 
        position={[0, 2.8, 0]} 
        color="#5ac4c4" 
        intensity={3} 
        distance={15} 
      />
      
      {/* Ground glow */}
      <mesh position={[0, 0.05, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[1.5, 32]} />
        <meshBasicMaterial color="#5ac4c4" transparent opacity={0.3} />
      </mesh>
    </group>
  );
}
