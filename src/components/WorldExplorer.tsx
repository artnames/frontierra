// World Explorer - 3D First-Person View of NexArt World
// Uses debounced NexArt generation with atomic world swap

import { useState, useCallback, useEffect } from "react";
import { Canvas } from "@react-three/fiber";
import { WorldData, distanceToObject, isWorldValid, getElevationAt } from "@/lib/worldData";
import { useNexArtWorld } from "@/hooks/useNexArtWorld";
import { WorldAction, ReplayFrame, DeterminismTest } from "@/lib/worldContract";
import {
  useFirstPersonControls,
  setCameraToEditorView,
  setCameraToExploreView,
  setMobileMovement,
} from "@/hooks/useFirstPersonControls";
import { PlantedObject, GridOverlay, Bridges } from "@/components/WorldRenderer";
import { EnhancedAtmosphere } from "@/components/EnhancedAtmosphere";
import { SceneSetup } from "@/components/SceneSetup";
import { TexturedTerrainMesh, SimpleTerrainMesh } from "@/components/TexturedTerrain";
import { SmoothTerrainMesh } from "@/components/SmoothTerrainMesh";
import { EnhancedWaterPlane } from "@/components/EnhancedWaterPlane";
import { ForestTrees } from "@/components/ForestTrees";
import { PlacedBeaconMesh } from "@/components/ActionSystem";
import { SkyDome } from "@/components/SkyDome";
import { TimeOfDayHUD } from "@/components/TimeOfDayHUD";
import { PostFXZelda } from "@/components/postfx/PostFXZelda";
import { DiscoveryToast } from "@/components/DiscoveryToast";
import { MobileControls } from "@/components/MobileControls";
import { useAmbientAudio } from "@/hooks/useAmbientAudio";
import { useVisualSettings } from "@/hooks/useVisualSettings";
import { useIsMobile } from "@/hooks/use-mobile";
import * as THREE from "three";
import { useThree, useFrame } from "@react-three/fiber";

export type InteractionMode = "explore" | "editor";

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
  // Graphics settings
  fogEnabled?: boolean;
  microDetailEnabled?: boolean;
  shadowsEnabled?: boolean;
  smoothShading?: boolean;
  waterAnimation?: boolean;
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
  showVegetation = true,
  fogEnabled = true,
  microDetailEnabled = true,
  shadowsEnabled = true,
  smoothShading = true,
  waterAnimation = true,
}: FirstPersonSceneProps) {
  const [isDiscovered, setIsDiscovered] = useState(false);

  const handlePositionChange = useCallback(
    (x: number, y: number, z: number) => {
      onPositionChange(x, y, z);

      const distance = distanceToObject(world, x, y);
      const wasDiscovered = isDiscovered;
      const nowDiscovered = distance < 3;

      if (nowDiscovered !== wasDiscovered) {
        setIsDiscovered(nowDiscovered);
        onDiscovery(nowDiscovered);
      }
    },
    [world, isDiscovered, onPositionChange, onDiscovery],
  );

  useFirstPersonControls({
    world,
    onPositionChange: handlePositionChange,
    enabled: !isReplaying,
    allowVerticalMovement: interactionMode === "editor", // Explore mode = ground-locked
  });

  return (
    <>
      {/* Scene configuration - renderer, tone mapping, shadows */}
      <SceneSetup worldX={worldX} worldY={worldY} shadowsEnabled={shadowsEnabled} />

      {/* 3D Sky dome - world space, camera independent */}
      <SkyDome worldX={worldX} worldY={worldY} />

      {/* Enhanced atmosphere with FogExp2 and improved lighting */}
      <EnhancedAtmosphere worldX={worldX} worldY={worldY} fogEnabled={fogEnabled} shadowsEnabled={shadowsEnabled} />

      {/* Terrain - use smooth shading mesh when enabled, otherwise textured/simple */}
      {smoothShading ? (
        <SmoothTerrainMesh world={world} worldX={worldX} worldY={worldY} microDetailEnabled={microDetailEnabled} />
      ) : useTextures ? (
        <TexturedTerrainMesh
          world={world}
          worldX={worldX}
          worldY={worldY}
          texturesEnabled={true}
          microDetailEnabled={microDetailEnabled}
        />
      ) : (
        <SimpleTerrainMesh
          world={world}
          microDetailEnabled={microDetailEnabled}
          fogEnabled={fogEnabled}
          worldX={worldX}
          worldY={worldY}
        />
      )}

      {/* Enhanced water with fresnel + animation */}
      <EnhancedWaterPlane world={world} worldX={worldX} worldY={worldY} animated={waterAnimation} />
      <Bridges world={world} />
      {showVegetation && (
        <ForestTrees
          world={world}
          useRichMaterials={useTextures}
          worldX={worldX}
          worldY={worldY}
          shadowsEnabled={shadowsEnabled}
        />
      )}
      <PlantedObject world={world} isDiscovered={isDiscovered} />
      {/* Grid overlay hidden by default in explore mode */}
      {interactionMode === "editor" && <GridOverlay world={world} />}

      {actions.map((action, i) => (
        <PlacedBeaconMesh key={i} action={action} world={world} />
      ))}

      {isReplaying && replayFrame && <ReplayCamera frame={replayFrame} />}
    </>
  );
}

function ReplayCamera({ frame }: { frame: ReplayFrame }) {
  const { camera } = useThree();

  useFrame(() => {
    camera.position.set(frame.position.x, frame.position.z, frame.position.y);
    const euler = new THREE.Euler(0, frame.rotation, 0, "YXZ");
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
  isOwnLand?: boolean; // If true, player is on their own land (suppress discovery toast)
  mappingVersion?: "v1" | "v2"; // V2 enables archetype-aware generation
  microOverrides?: Map<number, number>; // Manual overrides for V2 micro vars
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
  interactionMode = "explore",
  onModeChange,
  worldContext,
  showDebugHUD = false,
  isOwnLand = true,
  mappingVersion = "v1",
  microOverrides,
}: WorldExplorerProps) {
  const worldX = worldContext?.worldX ?? 0;
  const worldY = worldContext?.worldY ?? 0;
  const [position, setPosition] = useState({ x: 0, y: 0, z: 0 });
  const [isDiscovered, setIsDiscovered] = useState(false);
  const [showDiscoveryBanner, setShowDiscoveryBanner] = useState(false);
  const [actions, setActions] = useState<WorldAction[]>(initialActions);

  // Mobile detection
  const isMobile = useIsMobile();

  // Handle mobile joystick movement
  const handleMobileMove = useCallback((forward: boolean, backward: boolean, left: boolean, right: boolean) => {
    setMobileMovement(forward, backward, left, right);
  }, []);

  // Visual settings (localStorage only, no server sync)
  const {
    materialRichness,
    showVegetation,
    musicEnabled,
    sfxEnabled,
    masterVolume,
    fogEnabled,
    microDetailEnabled,
    shadowsEnabled,
    smoothShading,
    waterAnimation,
  } = useVisualSettings();

  // Use debounced NexArt generation hook with V2 support
  const { world, isLoading, isVerifying, error } = useNexArtWorld({
    seed,
    vars,
    debounceMs: 300,
    worldContext,
    mappingVersion,
    microOverrides,
  });

  // Track previous mode to detect changes
  const [prevMode, setPrevMode] = useState<InteractionMode>(interactionMode);

  // Handle mode changes - set camera position accordingly
  // Only trigger when mode actually changes, not on every world update
  useEffect(() => {
    if (world && interactionMode !== prevMode) {
      setPrevMode(interactionMode);
      if (interactionMode === "editor") {
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

  const handlePositionChange = useCallback(
    (x: number, y: number, z: number) => {
      const pos = { x, y, z };
      setPosition(pos);
      onPositionUpdate?.(pos);
    },
    [onPositionUpdate],
  );

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
    masterVolume,
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
          <div className="text-3xl font-display font-bold text-destructive mb-3">⚠ WORLD CANNOT BE VERIFIED</div>
          <div className="text-sm text-muted-foreground mb-4">
            NexArt execution failed. The world cannot be generated or validated.
          </div>
          <div className="text-xs text-destructive/70 font-mono p-3 bg-destructive/10 rounded mb-4">
            {error || "Unknown error"}
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
              <div className="text-3xl font-display font-bold text-destructive mb-2">⚠ WORLD INVALID</div>
              <div className="text-sm text-destructive/80">Determinism broken — hash mismatch detected</div>
            </div>
          </div>
        </div>
      )}

      {/* 3D Canvas - sky dome rendered inside */}
      <Canvas
        camera={{ fov: 45, near: 0.01, far: 1000 }}
        gl={{ antialias: false }}
        shadows={shadowsEnabled}
        style={{ position: "absolute", inset: 0 }}
        onCreated={({ gl }) => {
          // Cinematic tone mapping for game-like look
          gl.outputColorSpace = THREE.SRGBColorSpace;
          gl.toneMapping = THREE.ACESFilmicToneMapping;
          gl.toneMappingExposure = 1.25;
        }}
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
          fogEnabled={fogEnabled}
          microDetailEnabled={microDetailEnabled}
          shadowsEnabled={shadowsEnabled}
          smoothShading={smoothShading}
          waterAnimation={waterAnimation}
        />

        {/* Post-processing: Zelda-inspired stylized look */}
        <PostFXZelda enabled={true} aoEnabled={true} bloomEnabled={true} vignetteEnabled={true} />
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
      {!isReplaying && (interactionMode === "editor" || showDebugHUD) && (
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
      {!isReplaying && interactionMode === "editor" && (
        <div className="absolute bottom-4 left-4 terminal-panel p-3 pointer-events-none opacity-70">
          <div className="text-xs text-muted-foreground space-y-1">
            <div>
              <span className="text-primary">WASD</span> — Move
            </div>
            <div>
              <span className="text-primary">Mouse drag</span> — Look
            </div>
            <div>
              <span className="text-primary">Space/Shift</span> — Up/Down
            </div>
          </div>
        </div>
      )}

      {/* Discovery Toast - quiet text on new land (only when visiting others) */}
      {!isReplaying && <DiscoveryToast worldX={worldX} worldY={worldY} isOwnLand={isOwnLand} />}

      {/* Discovery Banner */}
      {showDiscoveryBanner && !isReplaying && (
        <div
          className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 
                      terminal-panel p-6 text-center transition-all duration-500
                      ${isDiscovered ? "opacity-100 scale-100" : "opacity-0 scale-95"}`}
        >
          <div className="text-2xl font-display font-bold text-primary glow-text mb-2">DISCOVERED</div>
          <div className="text-sm text-muted-foreground">
            Object Type:{" "}
            <span className="text-accent">
              {["Tower", "Crystal", "Monument", "Flag", "Beacon"][world.plantedObject.type]}
            </span>
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

      {/* Mobile Controls - Virtual Joystick */}
      {isMobile && !isReplaying && interactionMode === "explore" && (
        <div className="absolute bottom-6 left-6 z-20">
          <MobileControls onMove={handleMobileMove} />
        </div>
      )}
    </div>
  );
}
