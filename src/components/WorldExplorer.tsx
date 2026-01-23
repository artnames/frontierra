// World Explorer - 3D First-Person View of NexArt World
// CRITICAL: Renders from shared artifact passed down from Index.tsx
// NO internal generation - uses same artifact as 2D view

import { useState, useCallback, useEffect, useMemo, useRef } from "react";
import { Canvas, useThree, useFrame } from "@react-three/fiber";
import { WorldData, distanceToObject } from "@/lib/worldData";
import { cleanupRenderer } from "@/lib/rendererCleanup";
import { WorldAction, ReplayFrame, DeterminismTest } from "@/lib/worldContract";
import {
  useFirstPersonControls,
  setCameraToEditorView,
  setCameraToExploreView,
  setMobileMovement,
} from "@/hooks/useFirstPersonControls";
import { PlantedObject, GridOverlay } from "@/components/WorldRenderer";
import { EnhancedAtmosphere } from "@/components/EnhancedAtmosphere";
import { SceneSetup } from "@/components/SceneSetup";
import { TexturedTerrainMesh, SimpleTerrainMesh } from "@/components/TexturedTerrain";
import { SmoothTerrainMesh } from "@/components/SmoothTerrainMesh";
import { EnhancedWaterPlane } from "@/components/EnhancedWaterPlane";
import { ForestTrees } from "@/components/ForestTrees";
// PlacedBeaconMesh removed - landmark uses PlantedObject directly via VARs
import { SkyDome } from "@/components/SkyDome";
import { TimeOfDayHUD } from "@/components/TimeOfDayHUD";
import { PostFXZelda } from "@/components/postfx/PostFXZelda";
import { ResourceHUD } from "@/components/ResourceHUD";
import { DiscoveryToast } from "@/components/DiscoveryToast";
import { MobileControls } from "@/components/MobileControls";
import { useAmbientAudio } from "@/hooks/useAmbientAudio";
import { useVisualSettings } from "@/hooks/useVisualSettings";
import { useQualityProfile, mergeQualityWithUserSettings } from "@/hooks/useQualityProfile";
import { useIsMobile } from "@/hooks/use-mobile";
import { CanonicalWorldArtifact } from "@/lib/generateCanonicalWorld";
import * as THREE from "three";

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
  fogEnabled?: boolean;
  microDetailEnabled?: boolean;
  shadowsEnabled?: boolean;
  smoothShading?: boolean;
  waterAnimation?: boolean;
  outlineEnabled?: boolean;
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
  outlineEnabled = false,
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
    allowVerticalMovement: interactionMode === "editor",
  });

  return (
    <>
      <SceneSetup worldX={worldX} worldY={worldY} shadowsEnabled={shadowsEnabled} />
      <SkyDome worldX={worldX} worldY={worldY} />
      <EnhancedAtmosphere worldX={worldX} worldY={worldY} fogEnabled={fogEnabled} shadowsEnabled={shadowsEnabled} />

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

      <EnhancedWaterPlane world={world} worldX={worldX} worldY={worldY} animated={waterAnimation} />

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
      {interactionMode === "editor" && <GridOverlay world={world} />}

      {/* Landmark is rendered by PlantedObject based on VAR[1]/VAR[2] coordinates */}
      {/* No separate beacon mesh needed - action updates VARs which move the PlantedObject */}

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

// MEMORY FIX: Component to cleanup renderer caches on world change
function RendererCleanupOnWorldChange({ worldKey }: { worldKey: string }) {
  const { gl } = useThree();
  const prevWorldKeyRef = useRef<string>('');
  
  useEffect(() => {
    // Only cleanup when world actually changes
    if (prevWorldKeyRef.current !== '' && prevWorldKeyRef.current !== worldKey) {
      // Delay cleanup to next frame to ensure old resources are unmounted
      requestAnimationFrame(() => {
        cleanupRenderer(gl);
      });
    }
    prevWorldKeyRef.current = worldKey;
  }, [worldKey, gl]);
  
  return null;
}

interface WorldExplorerProps {
  // Accept canonical artifact from Index.tsx - NO internal generation
  artifact: CanonicalWorldArtifact | null;
  isLoading?: boolean;
  initialActions?: WorldAction[];
  onActionsChange?: (actions: WorldAction[]) => void;
  onPositionUpdate?: (pos: { x: number; y: number; z: number }) => void;
  onDiscoveryTrigger?: () => void;
  deterministicTest?: DeterminismTest | null;
  isReplaying?: boolean;
  replayFrame?: ReplayFrame | null;
  interactionMode?: InteractionMode;
  onModeChange?: (mode: InteractionMode) => void;
  worldContext?: { worldX: number; worldY: number };
  showDebugHUD?: boolean;
  isOwnLand?: boolean;
}

export function WorldExplorer({
  artifact,
  isLoading = false,
  initialActions = [],
  onActionsChange,
  onPositionUpdate,
  onDiscoveryTrigger,
  deterministicTest,
  isReplaying = false,
  replayFrame,
  interactionMode = "explore",
  onModeChange,
  worldContext,
  showDebugHUD = false,
  isOwnLand = true,
}: WorldExplorerProps) {
  const worldX = worldContext?.worldX ?? artifact?.inputsUsed.worldX ?? 0;
  const worldY = worldContext?.worldY ?? artifact?.inputsUsed.worldY ?? 0;

  const [position, setPosition] = useState({ x: 0, y: 0, z: 0 });
  const [isDiscovered, setIsDiscovered] = useState(false);
  const [showDiscoveryBanner, setShowDiscoveryBanner] = useState(false);
  const [actions, setActions] = useState<WorldAction[]>(initialActions);

  const isMobile = useIsMobile();
  const qualityProfile = useQualityProfile();

  const handleMobileMove = useCallback((forward: boolean, backward: boolean, left: boolean, right: boolean) => {
    setMobileMovement(forward, backward, left, right);
  }, []);

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
    postfxBloomEnabled,
    postfxVignetteEnabled,
    postfxOutlineEnabled,
    postfxNoiseEnabled,
  } = useVisualSettings();

  // Merge user settings with quality profile (quality profile can force features off)
  const effectiveSettings = useMemo(() => 
    mergeQualityWithUserSettings(qualityProfile, {
      shadowsEnabled,
      postfxBloomEnabled,
      waterAnimation,
      fogEnabled,
      microDetailEnabled,
    }), [qualityProfile, shadowsEnabled, postfxBloomEnabled, waterAnimation, fogEnabled, microDetailEnabled]);

  // Use world from artifact - NO internal generation
  const world = artifact?.worldData ?? null;
  const error = artifact?.error;

  const [prevMode, setPrevMode] = useState<InteractionMode>(interactionMode);

  useEffect(() => {
    if (world && interactionMode !== prevMode) {
      setPrevMode(interactionMode);
      if (interactionMode === "editor") setCameraToEditorView(world);
      else setCameraToExploreView(world);
    }
  }, [interactionMode, prevMode, world]);

  useEffect(() => {
    if (isDiscovered && !showDiscoveryBanner) setShowDiscoveryBanner(true);
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
    // Trigger discovery game callback when object is newly discovered
    if (discovered && onDiscoveryTrigger) {
      onDiscoveryTrigger();
    }
  }, [onDiscoveryTrigger]);

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

  // FIX #2: Only show "INVALID" overlay when user explicitly ran determinism test AND it failed
  // Don't treat determinism test state as fatal error - it's a dev tool
  const userRanDeterminismTest = deterministicTest && deterministicTest.breakType !== 'none';
  // NOTE: artifact.error is optional (undefined when ok). Using `error !== null` would
  // incorrectly mark the world invalid even when error is undefined.
  const isInvalid = Boolean(userRanDeterminismTest && !deterministicTest.isValid);

  // Check if world data is fully loaded and valid
  const isWorldReady = world && world.terrain && world.terrain.length > 0 && world.gridSize > 0;

  // Show blocking overlay ONLY on initial load (no previous world to show)
  // Once we have a world, keep it visible while regenerating
  if (isLoading && !isWorldReady) {
    return (
      <div className="relative w-full h-full flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          <span className="text-sm text-muted-foreground">GENERATING VIA NEXART...</span>
        </div>
      </div>
    );
  }

  if (error || !isWorldReady) {
    return (
      <div className="relative w-full h-full flex items-center justify-center bg-destructive/10">
        <div className="terminal-panel p-8 border-destructive bg-background/95 text-center max-w-md">
          <div className="text-3xl font-display font-bold text-destructive mb-3">⚠ WORLD CANNOT BE VERIFIED</div>
          <div className="text-sm text-muted-foreground mb-4">
            NexArt execution failed. The world cannot be generated or validated.
          </div>
          <div className="text-xs text-destructive/70 font-mono p-3 bg-destructive/10 rounded mb-4">
            {error || "World data incomplete"}
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
      {/* Subtle regenerating indicator - shows in corner while world updates */}
      {isLoading && isWorldReady && (
        <div className="absolute top-4 left-4 z-30 flex items-center gap-2 px-3 py-1.5 bg-background/80 backdrop-blur-sm rounded-full border border-border/50">
          <div className="w-3 h-3 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          <span className="text-xs text-muted-foreground">Regenerating...</span>
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

      <Canvas
        camera={{ fov: 45, near: 0.01, far: 1000 }}
        gl={{ antialias: qualityProfile.antialiasEnabled }}
        dpr={qualityProfile.devicePixelRatioCap}
        shadows={effectiveSettings.shadowsEnabled}
        style={{ position: "absolute", inset: 0 }}
        onCreated={({ gl }) => {
          gl.outputColorSpace = THREE.SRGBColorSpace;
          gl.toneMapping = THREE.NoToneMapping;
        }}
      >
        {/* Put all meshes (and InstancedMesh) on layer 1 for Outline selectionLayer */}
        <group
          onUpdate={(g) => {
            g.traverse((o: any) => {
              if (o?.isMesh || o?.isInstancedMesh) o.layers.enable(1);
            });
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
            fogEnabled={effectiveSettings.fogEnabled}
            microDetailEnabled={effectiveSettings.microDetailEnabled}
            shadowsEnabled={effectiveSettings.shadowsEnabled}
            smoothShading={smoothShading}
            waterAnimation={effectiveSettings.waterAnimationEnabled}
            outlineEnabled={postfxOutlineEnabled}
          />
        </group>

        {/* MEMORY FIX: Cleanup renderer caches when world changes */}
        <RendererCleanupOnWorldChange worldKey={world ? `${world.seed}_${(world.vars || []).join(',')}` : ''} />

        <PostFXZelda
          enabled={effectiveSettings.postFxEnabled}
          strength="zelda"
          outlineEnabled={postfxOutlineEnabled}
          bloomEnabled={postfxBloomEnabled}
          vignetteEnabled={postfxVignetteEnabled}
          noiseEnabled={postfxNoiseEnabled}
        />
        
        {/* DEV-only resource monitoring (visible with ?debug=1) */}
        <ResourceHUD />
      </Canvas>

      {!isReplaying && <DiscoveryToast worldX={worldX} worldY={worldY} isOwnLand={isOwnLand} />}

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

      {!isReplaying && (
        <div className="absolute top-4 right-4 z-10 flex flex-col gap-2">
          <TimeOfDayHUD worldX={worldX} worldY={worldY} />
        </div>
      )}

      {isMobile && !isReplaying && interactionMode === "explore" && (
        <div className="absolute bottom-6 left-6 z-20">
          <MobileControls onMove={handleMobileMove} />
        </div>
      )}
    </div>
  );
}
