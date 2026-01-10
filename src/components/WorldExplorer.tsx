// World Explorer - 3D First-Person View of NexArt World
// Uses debounced NexArt generation with atomic world swap

import { useState, useCallback, useEffect } from 'react';
import { Canvas } from '@react-three/fiber';
import { WorldData, distanceToObject, isWorldValid, getElevationAt } from '@/lib/worldData';
import { useNexArtWorld } from '@/hooks/useNexArtWorld';
import { 
  WorldAction, 
  ReplayFrame,
  DeterminismTest,
} from '@/lib/worldContract';
import { useFirstPersonControls, setCameraToEditorView, setCameraToExploreView } from '@/hooks/useFirstPersonControls';
import { 
  TerrainMesh, 
  PlantedObject, 
  GridOverlay, 
  WaterPlane,
  Atmosphere,
  Bridges,
  TimeAwareWaterPlane
} from '@/components/WorldRenderer';
import { TexturedTerrainMesh } from '@/components/TexturedTerrain';
import { ForestTrees } from '@/components/ForestTrees';
import { PlacedBeaconMesh } from '@/components/ActionSystem';
import { SkyDome } from '@/components/SkyDome';
import { TimeOfDayHUD } from '@/components/TimeOfDayHUD';
import { DiscoveryToast } from '@/components/DiscoveryToast';
import { useAmbientAudio } from '@/hooks/useAmbientAudio';
import { useVisualSettings } from '@/hooks/useVisualSettings';
import * as THREE from 'three';
import { useThree, useFrame } from '@react-three/fiber';

export type InteractionMode = 'explore' | 'editor';

interface FirstPersonSceneProps {
  world: WorldData;
  actions: WorldAction[];
  onPositionChange: (x: number, y: number, z: number) => void;
  onDiscovery: (discovered: boolean) => void;
  replayFrame?: ReplayFrame | null;
  isReplaying: boolean;
  interactionMode: InteractionMode;
  worldX?: number;
  worldY?: number;
  useTextures?: boolean;
  showVegetation?: boolean;
}

function FirstPersonScene({ 
  world, 
  actions,
  onPositionChange, 
  onDiscovery,
  replayFrame,
  isReplaying,
  interactionMode,
  worldX = 0,
  worldY = 0,
  useTextures = true,
  showVegetation = true
}: FirstPersonSceneProps) {
  const [isDiscovered, setIsDiscovered] = useState(false);
  
  const handlePositionChange = useCallback((x: number, y: number, z: number) => {
    onPositionChange(x, y, z);
    
    const distance = distanceToObject(world, x, y);
    const wasDiscovered = isDiscovered;
    const nowDiscovered = distance < 3;
    
    if (nowDiscovered !== wasDiscovered) {
      setIsDiscovered(nowDiscovered);
      onDiscovery(nowDiscovered);
    }
  }, [world, isDiscovered, onPositionChange, onDiscovery]);
  
  useFirstPersonControls({ 
    world, 
    onPositionChange: handlePositionChange,
    enabled: !isReplaying,
    allowVerticalMovement: interactionMode === 'editor' // Explore mode = ground-locked
  });
  
  return (
    <>
      {/* 3D Sky dome - world space, camera independent */}
      <SkyDome worldX={worldX} worldY={worldY} />
      
      <Atmosphere worldX={worldX} worldY={worldY} />
      
      {/* Textured terrain when enabled, fallback to vertex colors */}
      {useTextures ? (
        <TexturedTerrainMesh
          world={world}
          worldX={worldX}
          worldY={worldY}
          texturesEnabled={true}
        />
      ) : (
        <TerrainMesh world={world} />
      )}
      
      <TimeAwareWaterPlane world={world} worldX={worldX} worldY={worldY} />
      <Bridges world={world} />
      {showVegetation && <ForestTrees world={world} />}
      <PlantedObject world={world} isDiscovered={isDiscovered} />
      {/* Grid overlay hidden by default in explore mode */}
      {interactionMode === 'editor' && <GridOverlay world={world} />}
      
      {actions.map((action, i) => (
        <PlacedBeaconMesh key={i} action={action} world={world} />
      ))}
      
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
  interactionMode?: InteractionMode;
  onModeChange?: (mode: InteractionMode) => void;
  worldContext?: { worldX: number; worldY: number };
  showDebugHUD?: boolean; // Control debug visibility
}

export function WorldExplorer({ 
  seed, 
  vars,
  initialActions = [],
  onActionsChange,
  onPositionUpdate,
  deterministicTest,
  isReplaying = false,
  replayFrame,
  interactionMode = 'explore',
  onModeChange,
  worldContext,
  showDebugHUD = false
}: WorldExplorerProps) {
  const worldX = worldContext?.worldX ?? 0;
  const worldY = worldContext?.worldY ?? 0;
  const [position, setPosition] = useState({ x: 0, y: 0, z: 0 });
  const [isDiscovered, setIsDiscovered] = useState(false);
  const [showDiscoveryBanner, setShowDiscoveryBanner] = useState(false);
  const [actions, setActions] = useState<WorldAction[]>(initialActions);
  
  // Visual settings (localStorage only, no server sync)
  const { materialRichness, showVegetation, musicEnabled, sfxEnabled, masterVolume } = useVisualSettings();
  
  // Use debounced NexArt generation hook
  const { world, isLoading, isVerifying, error } = useNexArtWorld({
    seed,
    vars,
    debounceMs: 300
  });
  
  // Track previous mode to detect changes
  const [prevMode, setPrevMode] = useState<InteractionMode>(interactionMode);
  
  // Handle mode changes - set camera position accordingly
  // Only trigger when mode actually changes, not on every world update
  useEffect(() => {
    if (world && interactionMode !== prevMode) {
      setPrevMode(interactionMode);
      if (interactionMode === 'editor') {
        setCameraToEditorView(world);
      } else {
        setCameraToExploreView(world);
      }
    }
  }, [interactionMode, prevMode, world]);
  
  useEffect(() => {
    if (isDiscovered && !showDiscoveryBanner) {
      setShowDiscoveryBanner(true);
    }
  }, [isDiscovered, showDiscoveryBanner]);
  
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
  
  // Ambient audio based on terrain and settings
  useAmbientAudio({
    world,
    playerPosition: { x: position.x, y: position.y },
    worldX,
    worldY,
    enabled: !isReplaying,
    musicEnabled,
    sfxEnabled,
    masterVolume
  });
  
  const isInvalid = (deterministicTest && !deterministicTest.isValid) || error !== null;
  
  // Loading state
  if (isLoading) {
    return (
      <div className="relative w-full h-full flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          <span className="text-sm text-muted-foreground">GENERATING VIA NEXART...</span>
        </div>
      </div>
    );
  }
  
  // NexArt failure - NO FALLBACK
  if (error || !world) {
    return (
      <div className="relative w-full h-full flex items-center justify-center bg-destructive/10">
        <div className="terminal-panel p-8 border-destructive bg-background/95 text-center max-w-md">
          <div className="text-3xl font-display font-bold text-destructive mb-3">
            ⚠ WORLD CANNOT BE VERIFIED
          </div>
          <div className="text-sm text-muted-foreground mb-4">
            NexArt execution failed. The world cannot be generated or validated.
          </div>
          <div className="text-xs text-destructive/70 font-mono p-3 bg-destructive/10 rounded mb-4">
            {error || 'Unknown error'}
          </div>
          <div className="text-xs text-muted-foreground">
            NexArt is the canonical world generator. No fallback available.
          </div>
        </div>
      </div>
    );
  }
  
  return (
    <div className="relative w-full h-full overflow-hidden bg-black">
      {/* Verifying overlay (non-blocking) */}
      {isVerifying && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-20 pointer-events-none">
          <div className="terminal-panel px-4 py-2 flex items-center gap-2 bg-background/90">
            <div className="w-3 h-3 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            <span className="text-xs text-muted-foreground">Verifying world...</span>
          </div>
        </div>
      )}
      
      {isInvalid && !error && (
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
      
      {/* 3D Canvas - sky dome rendered inside */}
      <Canvas
        camera={{ fov: 45, near: 0.1, far: 1000 }}
        gl={{ antialias: true }}
        style={{ position: 'absolute', inset: 0 }}
      >
        <FirstPersonScene 
          world={world} 
          actions={actions}
          onPositionChange={handlePositionChange}
          onDiscovery={handleDiscovery}
          replayFrame={replayFrame}
          isReplaying={isReplaying}
          interactionMode={interactionMode}
          worldX={worldX}
          worldY={worldY}
          useTextures={materialRichness}
          showVegetation={showVegetation}
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
      
      {/* Minimal Position HUD - only in editor mode or when showDebugHUD is true */}
      {!isReplaying && (interactionMode === 'editor' || showDebugHUD) && (
        <div className="absolute top-4 left-4 terminal-panel p-3 pointer-events-none opacity-80">
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
          </div>
        </div>
      )}
      
      {/* Minimal Controls hint - fade after a few seconds in explore mode */}
      {!isReplaying && interactionMode === 'editor' && (
        <div className="absolute bottom-4 left-4 terminal-panel p-3 pointer-events-none opacity-70">
          <div className="text-xs text-muted-foreground space-y-1">
            <div><span className="text-primary">WASD</span> — Move</div>
            <div><span className="text-primary">Mouse drag</span> — Look</div>
            <div><span className="text-primary">Space/Shift</span> — Up/Down</div>
          </div>
        </div>
      )}
      
      {/* Discovery Toast - quiet text on new land */}
      {!isReplaying && (
        <DiscoveryToast worldX={worldX} worldY={worldY} />
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
      
      {/* Time of Day + Proximity indicator */}
      {!isReplaying && (
        <div className="absolute top-4 right-4 z-10 flex flex-col gap-2">
          <TimeOfDayHUD worldX={worldX} worldY={worldY} />
          {!isDiscovered && (
            <div className="terminal-panel p-3 pointer-events-none">
              <div className="text-xs">
                <span className="text-muted-foreground">DISTANCE TO OBJECT:</span>
                <div className="data-value text-lg font-mono mt-1">
                  {distanceToObject(world, position.x, position.y).toFixed(1)}
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
