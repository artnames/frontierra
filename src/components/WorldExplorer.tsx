import { useState, useCallback, useMemo, useEffect } from 'react';
import { Canvas } from '@react-three/fiber';
import { WorldData, generateWorldData, distanceToObject } from '@/lib/worldData';
import { useFirstPersonControls } from '@/hooks/useFirstPersonControls';
import { 
  TerrainMesh, 
  Landmarks, 
  PlantedObject, 
  GridOverlay, 
  WaterPlane,
  Atmosphere 
} from '@/components/WorldRenderer';

interface FirstPersonSceneProps {
  world: WorldData;
  onPositionChange: (x: number, y: number, z: number) => void;
  onDiscovery: (discovered: boolean) => void;
}

function FirstPersonScene({ world, onPositionChange, onDiscovery }: FirstPersonSceneProps) {
  const [isDiscovered, setIsDiscovered] = useState(false);
  
  const handlePositionChange = useCallback((x: number, y: number, z: number) => {
    onPositionChange(x, y, z);
    
    // Check proximity to planted object
    const distance = distanceToObject(world, x, y);
    const wasDiscovered = isDiscovered;
    const nowDiscovered = distance < 3;
    
    if (nowDiscovered !== wasDiscovered) {
      setIsDiscovered(nowDiscovered);
      onDiscovery(nowDiscovered);
    }
  }, [world, isDiscovered, onPositionChange, onDiscovery]);
  
  useFirstPersonControls({ world, onPositionChange: handlePositionChange });
  
  return (
    <>
      <Atmosphere />
      <TerrainMesh world={world} />
      <WaterPlane world={world} />
      <Landmarks world={world} />
      <PlantedObject world={world} isDiscovered={isDiscovered} />
      <GridOverlay world={world} />
    </>
  );
}

interface WorldExplorerProps {
  seed: number;
  vars: number[];
}

export function WorldExplorer({ seed, vars }: WorldExplorerProps) {
  const [position, setPosition] = useState({ x: 0, y: 0, z: 0 });
  const [isDiscovered, setIsDiscovered] = useState(false);
  const [showDiscoveryBanner, setShowDiscoveryBanner] = useState(false);
  
  // Generate world data deterministically
  const world = useMemo(() => generateWorldData(seed, vars), [seed, vars]);
  
  // Handle discovery animation
  useEffect(() => {
    if (isDiscovered && !showDiscoveryBanner) {
      setShowDiscoveryBanner(true);
    }
  }, [isDiscovered, showDiscoveryBanner]);
  
  const handlePositionChange = useCallback((x: number, y: number, z: number) => {
    setPosition({ x, y, z });
  }, []);
  
  const handleDiscovery = useCallback((discovered: boolean) => {
    setIsDiscovered(discovered);
  }, []);
  
  return (
    <div className="relative w-full h-full">
      <Canvas
        camera={{ fov: 75, near: 0.1, far: 200 }}
        gl={{ antialias: true, alpha: false }}
        style={{ background: '#0a1520' }}
      >
        <FirstPersonScene 
          world={world} 
          onPositionChange={handlePositionChange}
          onDiscovery={handleDiscovery}
        />
      </Canvas>
      
      {/* HUD Overlay */}
      <div className="absolute top-4 left-4 terminal-panel p-3 pointer-events-none">
        <div className="text-xs space-y-1">
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground">POS:</span>
            <span className="data-value font-mono">
              ({position.x.toFixed(1)}, {position.y.toFixed(1)})
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground">ALT:</span>
            <span className="data-value font-mono">{position.z.toFixed(1)}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground">OBJ:</span>
            <span className="text-secondary-foreground font-mono">
              ({world.plantedObject.x.toFixed(0)}, {world.plantedObject.y.toFixed(0)})
            </span>
          </div>
        </div>
      </div>
      
      {/* Controls hint */}
      <div className="absolute bottom-4 left-4 terminal-panel p-3 pointer-events-none">
        <div className="text-xs text-muted-foreground space-y-1">
          <div><span className="text-primary">WASD</span> — Move</div>
          <div><span className="text-primary">Mouse drag</span> — Look</div>
          <div><span className="text-primary">Space/Shift</span> — Up/Down</div>
        </div>
      </div>
      
      {/* Discovery Banner */}
      {showDiscoveryBanner && (
        <div 
          className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 
                      terminal-panel p-6 text-center transition-all duration-500
                      ${isDiscovered ? 'opacity-100 scale-100' : 'opacity-0 scale-95'}`}
        >
          <div className="text-2xl font-display font-bold text-primary glow-text mb-2">
            DISCOVERED
          </div>
          <div className="text-sm text-muted-foreground">
            Object Type: <span className="text-accent">{['Tower', 'Crystal', 'Monument', 'Flag', 'Beacon'][world.plantedObject.type]}</span>
          </div>
          <div className="text-xs text-muted-foreground mt-2">
            Location: ({world.plantedObject.x}, {world.plantedObject.y})
          </div>
        </div>
      )}
      
      {/* Proximity indicator */}
      {!isDiscovered && (
        <div className="absolute top-4 right-4 terminal-panel p-3 pointer-events-none">
          <div className="text-xs">
            <span className="text-muted-foreground">DISTANCE TO OBJECT:</span>
            <div className="data-value text-lg font-mono mt-1">
              {distanceToObject(world, position.x, position.y).toFixed(1)}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
