import { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { Canvas } from '@react-three/fiber';
import { WorldData, generateWorldData, distanceToObject } from '@/lib/worldData';
import { 
  WorldAction, 
  ReplayFrame,
  DeterminismTest,
  runDeterminismTest,
  serializeActions,
  parseActions
} from '@/lib/worldContract';
import { useFirstPersonControls } from '@/hooks/useFirstPersonControls';
import { 
  TerrainMesh, 
  Landmarks, 
  PlantedObject, 
  GridOverlay, 
  WaterPlane,
  Atmosphere,
  Bridges
} from '@/components/WorldRenderer';
import { PlacedBeaconMesh } from '@/components/ActionSystem';
import * as THREE from 'three';
import { useThree, useFrame } from '@react-three/fiber';

interface FirstPersonSceneProps {
  world: WorldData;
  actions: WorldAction[];
  onPositionChange: (x: number, y: number, z: number) => void;
  onDiscovery: (discovered: boolean) => void;
  replayFrame?: ReplayFrame | null;
  isReplaying: boolean;
}

function FirstPersonScene({ 
  world, 
  actions,
  onPositionChange, 
  onDiscovery,
  replayFrame,
  isReplaying
}: FirstPersonSceneProps) {
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
  
  // Always call the hook - pass enabled flag to control behavior
  useFirstPersonControls({ 
    world, 
    onPositionChange: handlePositionChange,
    enabled: !isReplaying 
  });
  
  return (
    <>
      <Atmosphere />
      <TerrainMesh world={world} />
      <WaterPlane world={world} />
      <Bridges world={world} />
      <Landmarks world={world} />
      <PlantedObject world={world} isDiscovered={isDiscovered} />
      <GridOverlay world={world} />
      
      {/* Render placed beacons */}
      {actions.map((action, i) => (
        <PlacedBeaconMesh key={i} action={action} world={world} />
      ))}
      
      {/* Replay camera */}
      {isReplaying && replayFrame && (
        <ReplayCamera frame={replayFrame} />
      )}
    </>
  );
}

function ReplayCamera({ frame }: { frame: ReplayFrame }) {
  const { camera } = useThree();
  
  useFrame(() => {
    camera.position.set(frame.position.x, frame.position.z, frame.position.y);
    const euler = new THREE.Euler(0, frame.rotation, 0, 'YXZ');
    camera.quaternion.setFromEuler(euler);
  });
  
  return null;
}

interface WorldExplorerProps {
  seed: number;
  vars: number[];
  initialActions?: WorldAction[];
  onActionsChange?: (actions: WorldAction[]) => void;
  onPositionUpdate?: (pos: { x: number; y: number; z: number }) => void;
  deterministicTest?: DeterminismTest | null;
  isReplaying?: boolean;
  replayFrame?: ReplayFrame | null;
}

export function WorldExplorer({ 
  seed, 
  vars,
  initialActions = [],
  onActionsChange,
  onPositionUpdate,
  deterministicTest,
  isReplaying = false,
  replayFrame
}: WorldExplorerProps) {
  const [position, setPosition] = useState({ x: 0, y: 0, z: 0 });
  const [isDiscovered, setIsDiscovered] = useState(false);
  const [showDiscoveryBanner, setShowDiscoveryBanner] = useState(false);
  const [actions, setActions] = useState<WorldAction[]>(initialActions);
  
  // Generate world data deterministically
  const world = useMemo(() => generateWorldData(seed, vars), [seed, vars]);
  
  // Handle discovery animation
  useEffect(() => {
    if (isDiscovered && !showDiscoveryBanner) {
      setShowDiscoveryBanner(true);
    }
  }, [isDiscovered, showDiscoveryBanner]);
  
  // Sync actions with parent
  useEffect(() => {
    setActions(initialActions);
  }, [initialActions]);
  
  const handlePositionChange = useCallback((x: number, y: number, z: number) => {
    const pos = { x, y, z };
    setPosition(pos);
    onPositionUpdate?.(pos);
  }, [onPositionUpdate]);
  
  const handleDiscovery = useCallback((discovered: boolean) => {
    setIsDiscovered(discovered);
  }, []);
  
  const isInvalid = deterministicTest && !deterministicTest.isValid;
  
  return (
    <div className="relative w-full h-full">
      {/* Invalid world overlay */}
      {isInvalid && (
        <div className="absolute inset-0 z-20 pointer-events-none">
          <div className="absolute inset-0 bg-destructive/10 animate-pulse" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">
            <div className="terminal-panel p-6 border-destructive bg-destructive/20 text-center">
              <div className="text-3xl font-display font-bold text-destructive mb-2">
                ⚠ WORLD INVALID
              </div>
              <div className="text-sm text-destructive/80">
                Determinism broken — hash mismatch detected
              </div>
            </div>
          </div>
        </div>
      )}
      
      <Canvas
        camera={{ fov: 60, near: 0.1, far: 150 }}
        gl={{ antialias: true, alpha: false }}
        style={{ background: '#0a1520' }}
      >
        <FirstPersonScene 
          world={world} 
          actions={actions}
          onPositionChange={handlePositionChange}
          onDiscovery={handleDiscovery}
          replayFrame={replayFrame}
          isReplaying={isReplaying}
        />
      </Canvas>
      
      {/* Replay mode indicator */}
      {isReplaying && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-10">
          <div className="terminal-panel px-4 py-2 flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-accent animate-pulse" />
            <span className="text-xs text-accent font-display uppercase tracking-wider">
              Replay Mode — Camera Locked
            </span>
          </div>
        </div>
      )}
      
      {/* Position HUD */}
      {!isReplaying && (
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
      )}
      
      {/* Controls hint */}
      {!isReplaying && (
        <div className="absolute bottom-4 left-4 terminal-panel p-3 pointer-events-none">
          <div className="text-xs text-muted-foreground space-y-1">
            <div><span className="text-primary">WASD</span> — Move</div>
            <div><span className="text-primary">Mouse drag</span> — Look</div>
            <div><span className="text-primary">Space/Shift</span> — Up/Down</div>
          </div>
        </div>
      )}
      
      {/* Discovery Banner */}
      {showDiscoveryBanner && !isReplaying && (
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
      {!isDiscovered && !isReplaying && (
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
