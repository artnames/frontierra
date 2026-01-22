import { useCallback, useState, useMemo, useEffect, lazy, Suspense } from "react";
import {
  Eye,
  Map,
  Copy,
  Check,
  Shuffle,
  Settings,
  ChevronLeft,
  Users,
  Globe,
  Compass,
  Pencil,
  LogIn,
  LogOut,
  Menu,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useIsMobile } from "@/hooks/use-mobile";
import frontierraLogoHeader from "@/assets/frontierra-logo-header.png";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { useWorldParams } from "@/hooks/useWorldParams";
import { useAuth } from "@/hooks/useAuth";
import { useVisualSettings } from "@/hooks/useVisualSettings";
import { VAR_LABELS } from "@/lib/worldGenerator";
import { generateWorldDataAsync, WorldData } from "@/lib/worldData";
import {
  WorldAction,
  DeterminismTest,
  runDeterminismTest,
  serializeActions,
  parseActions,
  ReplayFrame,
} from "@/lib/worldContract";
import type { InteractionMode } from "@/components/WorldExplorer";
import { deriveSoloWorldContext } from "@/lib/worldContext";
import { setCameraForLandTransition } from "@/hooks/useFirstPersonControls";
import { ReplayControls } from "@/components/ReplayControls";
import { MultiplayerHUD } from "@/components/MultiplayerHUD";
import { UnclaimedLandModal } from "@/components/UnclaimedLandModal";
import { ClaimLandModal } from "@/components/ClaimLandModal";
import { DiscoveryPointsHUD } from "@/components/DiscoveryPointsHUD";
import { MobileLandscapeGate } from "@/components/MobileLandscapeGate";
import { WelcomeScreen, useWelcomeScreen } from "@/components/WelcomeScreen";
import { useMultiplayerWorld } from "@/hooks/useMultiplayerWorld";
import { useDiscoveryGame } from "@/hooks/useDiscoveryGame";
import { useToast } from "@/hooks/use-toast";
import { useSearchParams } from "react-router-dom";
import { GeneratorProofOverlay, BuildStamp } from "@/components/GeneratorProofOverlay";
import { useGeneratorProof } from "@/hooks/useGeneratorProof";

// Lazy load sidebar components to reduce main-thread work
const WorldContractPanel = lazy(() => import("@/components/WorldContractPanel").then(m => ({ default: m.WorldContractPanel })));
const ActionSystem = lazy(() => import("@/components/ActionSystem").then(m => ({ default: m.ActionSystem })));
const WorldAMap = lazy(() => import("@/components/WorldAMap").then(m => ({ default: m.WorldAMap })));
const SocialPanel = lazy(() => import("@/components/social/SocialPanel").then(m => ({ default: m.SocialPanel })));

// Lazy load heavy 3D components to reduce TTI
const WorldExplorer = lazy(() => import("@/components/WorldExplorer").then(m => ({ default: m.WorldExplorer })));
const WorldMap2D = lazy(() => import("@/components/WorldMap2D").then(m => ({ default: m.WorldMap2D })));

// Lightweight loading placeholder for 3D view
const WorldLoader = () => (
  <div className="w-full h-full flex items-center justify-center bg-background">
    <div className="flex flex-col items-center gap-3">
      <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      <p className="text-sm text-muted-foreground">Loading world...</p>
    </div>
  </div>
);

type ViewMode = "map" | "firstperson";
type SidebarTab = "parameters" | "contract" | "actions" | "worldmap" | "social";
type WorldMode = "solo" | "multiplayer";

const Index = () => {
  const [viewMode, setViewMode] = useState<ViewMode>("firstperson");
  const [worldMode, setWorldMode] = useState<WorldMode>("solo");
  const [interactionMode, setInteractionMode] = useState<InteractionMode>("explore");
  const [copied, setCopied] = useState(false);
  const [showSidebar, setShowSidebar] = useState(false);
  const [showMobileMenu, setShowMobileMenu] = useState(false);
  const [sidebarTab, setSidebarTab] = useState<SidebarTab>("worldmap");
  const [deterministicTest, setDeterministicTest] = useState<DeterminismTest | null>(null);
  const [isReplaying, setIsReplaying] = useState(false);
  const [replayFrame, setReplayFrame] = useState<ReplayFrame | null>(null);
  const [playerPosition, setPlayerPosition] = useState({ x: 32, y: 32, z: 0 });
  const [showClaimModal, setShowClaimModal] = useState(false);
  const [pendingMultiplayerSwitch, setPendingMultiplayerSwitch] = useState(false);
  const { toast } = useToast();
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  
  // Welcome screen for first-time visitors
  const { showWelcome, dismissWelcome } = useWelcomeScreen();

  // Authentication
  const { user, isAuthenticated, isLoading: isAuthLoading, signOut } = useAuth();

  // Visual settings (localStorage only)
  const { musicEnabled, toggleMusic, sfxEnabled, toggleSfx, masterVolume, setMasterVolume } = useVisualSettings();

  const [searchParams, setSearchParams] = useSearchParams();

  const {
    params,
    setSeed,
    setVar,
    getShareUrl,
    applyToUrl,
    randomizeSeed,
  } = useWorldParams();

  // Handle land transition - reposition camera at entry point
  const handleLandTransition = useCallback((entryPosition: { x: number; z: number }) => {
    setCameraForLandTransition(entryPosition.x, entryPosition.z);
  }, []);

  // Multiplayer world management - use authenticated user ID
  const multiplayer = useMultiplayerWorld({
    autoCreate: worldMode === "multiplayer" && isAuthenticated,
    initialPlayerId: user?.id,
    onLandTransition: handleLandTransition,
  });

  // Discovery game - only active in multiplayer mode
  const discoveryGame = useDiscoveryGame({
    playerId: user?.id ?? null,
    currentLand: worldMode === "multiplayer" ? multiplayer.currentLand : null,
    enabled: worldMode === "multiplayer" && isAuthenticated,
  });

  // Check if we're on someone else's land (multiplayer)
  const isOtherPlayerLand = useMemo(() => {
    if (worldMode !== "multiplayer" || !multiplayer.currentLand) return false;
    if (!user?.id) return false;
    return multiplayer.currentLand.player_id !== user.id;
  }, [worldMode, multiplayer.currentLand?.player_id, user?.id]);

  // Force explore mode when on someone else's land
  const effectiveInteractionMode: InteractionMode = isOtherPlayerLand ? "explore" : interactionMode;

  // Ensure the panel opens when switching into editor mode
  useEffect(() => {
    if (effectiveInteractionMode === "editor") {
      setShowSidebar(true);
    }
  }, [effectiveInteractionMode]);

  // Handle mode changes
  const handleInteractionModeChange = useCallback(
    (mode: InteractionMode) => {
      if (isOtherPlayerLand && mode === "editor") {
        toast({
          title: "Cannot edit",
          description: "You can only explore on someone else's land",
          variant: "destructive",
        });
        return;
      }

      setInteractionMode(mode);
      if (mode === "editor") {
        setShowSidebar(true);
      }
    },
    [isOtherPlayerLand, toast],
  );

  // Handle multiplayer switch
  const handleMultiplayerClick = useCallback(async () => {
    if (!isAuthenticated) {
      navigate("/auth");
      return;
    }

    if (!user?.id) return;

    setPendingMultiplayerSwitch(true);
    const existingLand = await import("@/lib/multiplayer/landRegistry").then((m) => m.getLandByPlayerId(user.id));

    if (existingLand) {
      setWorldMode("multiplayer");
      multiplayer.initializePlayerLand(user.id);
    } else {
      setShowClaimModal(true);
    }
    setPendingMultiplayerSwitch(false);
  }, [isAuthenticated, user?.id, navigate, multiplayer]);

  // Welcome screen handlers
  const handleWelcomeMultiplayer = useCallback(() => {
    dismissWelcome();
    handleMultiplayerClick();
  }, [dismissWelcome, handleMultiplayerClick]);

  const handleWelcomeSolo = useCallback(() => {
    dismissWelcome();
    setWorldMode("solo");
  }, [dismissWelcome]);

  // Handle land claimed from modal
  const handleLandClaimed = useCallback(
    (land: import("@/lib/multiplayer/types").PlayerLand) => {
      setShowClaimModal(false);
      setWorldMode("multiplayer");
      if (user?.id) {
        multiplayer.initializePlayerLand(user.id);
      }
      toast({
        title: "Land Claimed!",
        description: `You now own land at position (${land.pos_x}, ${land.pos_y})`,
      });
    },
    [user?.id, multiplayer, toast],
  );

  // Handle sign out
  const handleSignOut = useCallback(async () => {
    await signOut();
    setWorldMode("solo");
    toast({
      title: "Signed out",
      description: "You have been logged out",
    });
  }, [signOut, toast]);

  // Parse actions from URL
  const [actions, setActions] = useState<WorldAction[]>(() => {
    const actionsParam = searchParams.get("actions");
    return actionsParam ? parseActions(actionsParam) : [];
  });

  // Use multiplayer world data when in multiplayer mode, else solo params
  const activeParams =
    worldMode === "multiplayer" && multiplayer.currentLand
      ? { seed: multiplayer.currentLand.seed, vars: multiplayer.currentLand.vars }
      : params;

  // Generate world for contract panel - ASYNC VERSION
  const [world, setWorld] = useState<WorldData | null>(null);

  useEffect(() => {
    let cancelled = false;

    generateWorldDataAsync(activeParams.seed, activeParams.vars).then((data) => {
      if (!cancelled) {
        setWorld(data);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [activeParams.seed, activeParams.vars]);

  // Generator proof overlay data - derive worldX/worldY for unified generation proof
  const proofWorldCoords = useMemo(() => {
    if (worldMode === 'multiplayer' && multiplayer.currentLand) {
      return { worldX: multiplayer.currentLand.pos_x, worldY: multiplayer.currentLand.pos_y };
    }
    return deriveSoloWorldContext(activeParams.seed);
  }, [worldMode, multiplayer.currentLand, activeParams.seed]);
  
  const generatorProof = useGeneratorProof(
    world,
    worldMode === 'multiplayer',
    activeParams.seed,
    activeParams.vars,
    proofWorldCoords.worldX,
    proofWorldCoords.worldY
  );

  // Show overlay only with ?debug=1 URL param (not in dev mode by default)
  const showDebugOverlay = searchParams.get('debug') === '1';

  const handleGenerate = useCallback(() => {
    applyToUrl();
    setDeterministicTest(null);
  }, [applyToUrl]);

  const handleCopyLink = async () => {
    const baseUrl = getShareUrl();
    const actionsStr = serializeActions(actions);
    const url = actionsStr ? `${baseUrl}&actions=${actionsStr}` : baseUrl;

    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      toast({
        title: "Link copied!",
        description: "Deterministic world URL with actions copied",
      });
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      toast({
        title: "Copy failed",
        description: "Could not copy to clipboard",
        variant: "destructive",
      });
    }
  };

  const handleSeedInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseInt(e.target.value, 10);
    if (!isNaN(value)) {
      setSeed(Math.max(0, value));
    }
  };

  const handleActionExecute = useCallback(
    (action: WorldAction) => {
      const newActions = [...actions, action];
      setActions(newActions);

      // Sync beacon position to VAR[1] (Landmark X) and VAR[2] (Landmark Y)
      // Grid mapping: gridCoord = map(VAR, 0, 100, 4, GRID_SIZE-4)
      // Inverse: VAR = ((gridCoord - 4) / (GRID_SIZE - 8)) * 100
      const GRID_SIZE = 64;
      const newVar1 = Math.round(((action.gridX - 4) / (GRID_SIZE - 8)) * 100);
      const newVar2 = Math.round(((action.gridY - 4) / (GRID_SIZE - 8)) * 100);
      
      // Clamp to valid range [0, 100]
      const clampedVar1 = Math.max(0, Math.min(100, newVar1));
      const clampedVar2 = Math.max(0, Math.min(100, newVar2));
      
      // Update VARs to sync landmark position with beacon
      setVar(1, clampedVar1);
      setVar(2, clampedVar2);
      
      // Use updated vars array
      const updatedVars = [...params.vars];
      updatedVars[1] = clampedVar1;
      updatedVars[2] = clampedVar2;
      
      const varsStr = updatedVars.join(",");
      const actionsStr = serializeActions(newActions);
      setSearchParams({
        seed: params.seed.toString(),
        vars: varsStr,
        actions: actionsStr,
      });
    },
    [actions, params, setSearchParams, setVar],
  );

  const handleActionReset = useCallback(() => {
    setActions([]);
    const varsStr = params.vars.join(",");
    setSearchParams({
      seed: params.seed.toString(),
      vars: varsStr,
    });
    toast({
      title: "Beacon Reset",
      description: "You can now place a new beacon",
    });
  }, [params, setSearchParams, toast]);

  const handleDeterminismBreak = useCallback(
    (breakType: "math_random" | "date" | "none") => {
      if (!world) return;
      const test = runDeterminismTest(world, breakType);
      setDeterministicTest(test);

      if (breakType !== "none") {
        toast({
          title: "Determinism Broken",
          description: `Injected ${breakType === "math_random" ? "Math.random()" : "Date.now()"} — hash mismatch`,
          variant: "destructive",
        });
      } else {
        toast({
          title: "Determinism Restored",
          description: "World hash verified",
        });
      }
    },
    [world, toast],
  );

  const handleReplayStart = useCallback(() => {
    setIsReplaying(true);
  }, []);

  const handleReplayStop = useCallback(() => {
    setIsReplaying(false);
    setReplayFrame(null);
  }, []);

  const handleReplayFrame = useCallback((frame: ReplayFrame) => {
    setReplayFrame(frame);
  }, []);

  const handleReplayComplete = useCallback(() => {
    setIsReplaying(false);
    toast({
      title: "Replay Complete",
      description: "All stored instructions executed",
    });
  }, [toast]);

  const handlePositionUpdate = useCallback(
    (pos: { x: number; y: number; z: number }) => {
      setPlayerPosition(pos);
      if (worldMode === "multiplayer") {
        multiplayer.updatePlayerPosition(pos.x, pos.y);
      }
    },
    [worldMode, multiplayer.updatePlayerPosition],
  );

  const isInvalid = deterministicTest && !deterministicTest.isValid;

  return (
    <MobileLandscapeGate>
    <div
      className={`h-screen bg-background flex flex-col overflow-hidden touch-none ${isInvalid ? "border-4 border-destructive" : ""}`}
    >
      {/* Generator Proof Overlay - DEV only or ?debug=1 */}
      {showDebugOverlay && (
        <GeneratorProofOverlay
          mode={generatorProof.mode}
          sourceHash={generatorProof.sourceHash}
          isMultiplayer={generatorProof.isMultiplayer}
          waterLevel={generatorProof.waterLevel}
          biomeRichness={generatorProof.biomeRichness}
          riverCellCount={generatorProof.riverStats.riverCellCount}
          riverVertices={generatorProof.riverStats.riverVertices}
          riverIndices={generatorProof.riverStats.riverIndices}
          worldX={proofWorldCoords.worldX}
          worldY={proofWorldCoords.worldY}
          pixelHash={world?.nexartHash}
        />
      )}
      
      {/* Welcome Screen for first-time visitors */}
      {showWelcome && (
        <WelcomeScreen
          onSelectMultiplayer={handleWelcomeMultiplayer}
          onSelectSolo={handleWelcomeSolo}
          isAuthenticated={isAuthenticated}
        />
      )}
      {/* Compact Header */}
      <header
        className={`relative z-50 border-b ${isInvalid ? "border-destructive bg-destructive/10" : "border-border bg-card/80"} backdrop-blur-sm flex-shrink-0`}
      >
        <div className="px-3 sm:px-4 py-2 flex items-center justify-between">
          <div className="flex items-center gap-2 sm:gap-4">
            {/* Logo - always visible */}
            <div className="min-w-0 flex items-center gap-2">
              <img src={frontierraLogoHeader} alt="Frontierra" width="101" height="40" fetchPriority="high" className="h-8 sm:h-10 object-contain" />
              <p className="text-[10px] sm:text-xs text-muted-foreground truncate max-w-[100px] sm:max-w-none hidden sm:block">
                {worldMode === "multiplayer" && multiplayer.currentLand ? (
                  <>
                    <span className="text-primary font-mono">{multiplayer.currentLand.seed}</span>
                    <span className="hidden md:inline ml-2">
                      Grid:{" "}
                      <span className="text-accent font-mono">
                        ({multiplayer.currentLand.pos_x}, {multiplayer.currentLand.pos_y})
                      </span>
                    </span>
                  </>
                ) : (
                  <>
                    Seed: <span className="text-primary font-mono">{activeParams.seed}</span>
                  </>
                )}
              </p>
            </div>

            {/* Desktop Controls - hidden on mobile */}
            {/* World Mode Toggle */}
            <div className="hidden md:flex items-center gap-1 bg-secondary/50 rounded p-1">
              <Button
                variant={worldMode === "solo" ? "default" : "ghost"}
                size="sm"
                onClick={() => setWorldMode("solo")}
                className="gap-1.5 h-7 text-xs"
                disabled={isReplaying}
              >
                <Globe className="w-3.5 h-3.5" />
                Solo
              </Button>
              <Button
                variant={worldMode === "multiplayer" ? "default" : "ghost"}
                size="sm"
                onClick={handleMultiplayerClick}
                className="gap-1.5 h-7 text-xs"
                disabled={isReplaying || pendingMultiplayerSwitch}
              >
                <Users className="w-3.5 h-3.5" />
                {pendingMultiplayerSwitch ? "Loading..." : isAuthenticated ? "Multiplayer" : "Login"}
              </Button>
            </div>

            {/* View Mode Toggle - hidden on small screens */}
            <div className="hidden lg:flex items-center gap-1 bg-secondary rounded p-1">
              <Button
                variant={viewMode === "firstperson" ? "default" : "ghost"}
                size="sm"
                onClick={() => setViewMode("firstperson")}
                className="gap-1.5 h-7 text-xs"
                disabled={isReplaying}
              >
                <Eye className="w-3.5 h-3.5" />
                First Person
              </Button>
              <Button
                variant={viewMode === "map" ? "default" : "ghost"}
                size="sm"
                onClick={() => setViewMode("map")}
                className="gap-1.5 h-7 text-xs"
                disabled={isReplaying}
              >
                <Map className="w-3.5 h-3.5" />
                2D Map
              </Button>
            </div>

            {/* Interaction Mode Toggle - hidden on small screens */}
            <div className="hidden lg:flex items-center gap-1 bg-secondary rounded p-1">
              <Button
                variant={effectiveInteractionMode === "explore" ? "default" : "ghost"}
                size="sm"
                onClick={() => handleInteractionModeChange("explore")}
                className="gap-1.5 h-7 text-xs"
                disabled={isReplaying}
              >
                <Compass className="w-3.5 h-3.5" />
                Explore
              </Button>
              <Button
                variant={effectiveInteractionMode === "editor" ? "default" : "ghost"}
                size="sm"
                onClick={() => handleInteractionModeChange("editor")}
                className="gap-1.5 h-7 text-xs"
                disabled={isReplaying || isOtherPlayerLand}
                title={isOtherPlayerLand ? "Can't edit on someone else's land" : undefined}
              >
                <Pencil className="w-3.5 h-3.5" />
                Editor
              </Button>
            </div>
          </div>

          {/* Right side controls */}
          <div className="flex items-center gap-1 sm:gap-2">
            {/* Desktop-only buttons */}
            <Button
              variant="outline"
              size="sm"
              onPointerDown={(e) => e.stopPropagation()}
              onClick={() => setShowSidebar((s) => !s)}
              className="hidden sm:flex text-xs gap-1"
            >
              <Settings className="w-3.5 h-3.5" />
              <span className="hidden md:inline">{showSidebar ? "Hide" : "Show"} Panel</span>
            </Button>
            <Button variant="outline" size="sm" onClick={handleCopyLink} className="gap-1.5 px-2 sm:px-3">
              {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              <span className="hidden sm:inline">{copied ? "Copied!" : "Share"}</span>
            </Button>

            {/* Auth Button - simplified on mobile */}
            {isAuthenticated ? (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleSignOut}
                className="hidden sm:flex gap-1.5 text-muted-foreground hover:text-foreground"
                title={user?.email}
              >
                <LogOut className="w-3.5 h-3.5" />
                <span className="hidden md:inline">Sign Out</span>
              </Button>
            ) : (
              <Button variant="outline" size="sm" onClick={() => navigate("/auth")} className="hidden sm:flex gap-1.5">
                <LogIn className="w-3.5 h-3.5" />
                <span className="hidden md:inline">Login</span>
              </Button>
            )}

            {/* Mobile Menu Button */}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowMobileMenu(!showMobileMenu)}
              className="sm:hidden p-2"
            >
              <Menu className="w-5 h-5" />
            </Button>
          </div>
        </div>

        {/* Mobile Menu Dropdown */}
        {showMobileMenu && isMobile && (
          <div className="absolute top-full left-0 right-0 bg-card/95 backdrop-blur-sm border-b border-border z-50 p-3 space-y-3">
            {/* World Mode */}
            <div className="flex gap-2">
              <Button
                variant={worldMode === "solo" ? "default" : "outline"}
                size="sm"
                onClick={() => {
                  setWorldMode("solo");
                  setShowMobileMenu(false);
                }}
                className="flex-1 gap-1.5"
              >
                <Globe className="w-4 h-4" />
                Solo
              </Button>
              <Button
                variant={worldMode === "multiplayer" ? "default" : "outline"}
                size="sm"
                onClick={() => {
                  handleMultiplayerClick();
                  setShowMobileMenu(false);
                }}
                className="flex-1 gap-1.5"
                disabled={pendingMultiplayerSwitch}
              >
                <Users className="w-4 h-4" />
                {pendingMultiplayerSwitch ? "Loading..." : isAuthenticated ? "Multiplayer" : "Login"}
              </Button>
            </div>

            {/* View Mode */}
            <div className="flex gap-2">
              <Button
                variant={viewMode === "firstperson" ? "default" : "outline"}
                size="sm"
                onClick={() => {
                  setViewMode("firstperson");
                  setShowMobileMenu(false);
                }}
                className="flex-1 gap-1.5"
              >
                <Eye className="w-4 h-4" />
                3D View
              </Button>
              <Button
                variant={viewMode === "map" ? "default" : "outline"}
                size="sm"
                onClick={() => {
                  setViewMode("map");
                  setShowMobileMenu(false);
                }}
                className="flex-1 gap-1.5"
              >
                <Map className="w-4 h-4" />
                2D Map
              </Button>
            </div>

            {/* Auth */}
            {isAuthenticated ? (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  handleSignOut();
                  setShowMobileMenu(false);
                }}
                className="w-full gap-1.5"
              >
                <LogOut className="w-4 h-4" />
                Sign Out ({user?.email?.split("@")[0]})
              </Button>
            ) : (
              <Button variant="outline" size="sm" onClick={() => navigate("/auth")} className="w-full gap-1.5">
                <LogIn className="w-4 h-4" />
                Login / Sign Up
              </Button>
            )}
          </div>
        )}
      </header>

      {/* Main Content */}
      <main className="flex-1 flex overflow-hidden relative z-0">
        {/* World View */}
        <div className="flex-1 relative z-0">
          <Suspense fallback={<WorldLoader />}>
            {viewMode === "firstperson" ? (
              <WorldExplorer
                seed={activeParams.seed}
                vars={activeParams.vars}
                initialActions={actions}
                onActionsChange={setActions}
                onPositionUpdate={handlePositionUpdate}
                onDiscoveryTrigger={discoveryGame.handleDiscovery}
                deterministicTest={deterministicTest}
                isReplaying={isReplaying}
                replayFrame={replayFrame}
                interactionMode={effectiveInteractionMode}
                onModeChange={handleInteractionModeChange}
                worldContext={
                  worldMode === "multiplayer" && multiplayer.currentLand
                    ? {
                        worldX: multiplayer.currentLand.pos_x,
                        worldY: multiplayer.currentLand.pos_y,
                      }
                    : deriveSoloWorldContext(activeParams.seed)
                }
                isOwnLand={worldMode === "solo" || !isOtherPlayerLand}
              />
            ) : (
              <div className="w-full h-full flex bg-background">
                <div className="flex-1 flex items-center justify-center p-4">
                  <WorldMap2D 
                    params={activeParams} 
                    getShareUrl={getShareUrl}
                    isMultiplayer={worldMode === 'multiplayer'}
                    worldX={worldMode === 'multiplayer' && multiplayer.currentLand ? multiplayer.currentLand.pos_x : deriveSoloWorldContext(activeParams.seed).worldX}
                    worldY={worldMode === 'multiplayer' && multiplayer.currentLand ? multiplayer.currentLand.pos_y : deriveSoloWorldContext(activeParams.seed).worldY}
                  />
                </div>
              </div>
            )}
          </Suspense>

          {/* Land Transition Overlay */}
          {worldMode === "multiplayer" && multiplayer.isTransitioning && (
            <div className="absolute inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm transition-opacity duration-300">
              <div className="flex flex-col items-center gap-3">
                <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                <p className="text-sm font-medium text-foreground">Crossing boundary...</p>
                <p className="text-xs text-muted-foreground">Loading new land</p>
              </div>
            </div>
          )}

          {/* Unclaimed Land Modal */}
          {worldMode === "multiplayer" && multiplayer.unclaimedAttempt && (
            <UnclaimedLandModal
              open={true}
              onClose={multiplayer.dismissUnclaimedAttempt}
              direction={multiplayer.unclaimedAttempt.direction}
              gridPosition={multiplayer.unclaimedAttempt.gridPosition}
            />
          )}

          {/* Claim Land Modal */}
          {user?.id && (
            <ClaimLandModal
              open={showClaimModal}
              onClose={() => setShowClaimModal(false)}
              onClaimed={handleLandClaimed}
              playerId={user.id}
            />
          )}

          {/* Multiplayer HUD */}
          {worldMode === "multiplayer" && viewMode === "firstperson" && (
            <MultiplayerHUD
              currentLand={multiplayer.currentLand}
              neighborLands={multiplayer.neighborLands}
              playerPosition={multiplayer.playerPosition}
              isTransitioning={multiplayer.isTransitioning}
              onVisitLand={multiplayer.visitLand}
            />
          )}

          {/* Discovery Points HUD - show in multiplayer mode */}
          {worldMode === "multiplayer" && viewMode === "firstperson" && isAuthenticated && (
            <div className="absolute top-32 right-4 z-20">
              <DiscoveryPointsHUD
                points={discoveryGame.discoveryPoints}
                canDiscover={discoveryGame.canDiscoverCurrent}
                cooldownTimeRemaining={discoveryGame.cooldownTimeRemaining}
                lastResult={discoveryGame.lastDiscoveryResult}
                onResultDismiss={discoveryGame.clearLastResult}
                isOwnLand={!isOtherPlayerLand}
              />
            </div>
          )}

          {/* Sidebar toggle button (when hidden) */}
          {!showSidebar && (
            <button
              onClick={() => setShowSidebar(true)}
              className="absolute right-0 top-1/2 -translate-y-1/2 bg-card border border-border border-r-0 rounded-l p-2 hover:bg-secondary transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Control Sidebar */}
        {showSidebar && (
          <aside className="fixed top-[52px] right-0 bottom-0 w-80 border-l border-border bg-card/95 backdrop-blur-sm flex flex-col overflow-hidden z-[100] shadow-xl">
            {/* Tab Navigation */}
            <div className="flex border-b border-border bg-secondary/30">
              {(worldMode === "multiplayer"
                ? (["worldmap", "social", "contract", "actions", "parameters"] as SidebarTab[])
                : (["contract", "actions", "parameters"] as SidebarTab[])
              ).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setSidebarTab(tab)}
                  className={`flex-1 py-2 text-[10px] uppercase tracking-wider transition-colors
                    ${
                      sidebarTab === tab
                        ? "text-primary border-b-2 border-primary bg-card"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                >
                  {tab === "worldmap" ? "Map" : tab}
                </button>
              ))}
            </div>

            {/* Tab Content */}
            <div className="flex-1 overflow-y-auto p-3">
              <Suspense fallback={<div className="flex items-center justify-center py-8"><div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div>}>
                {sidebarTab === "worldmap" && worldMode === "multiplayer" && (
                  <WorldAMap
                    currentLand={multiplayer.currentLand}
                    playerId={user?.id ?? null}
                    onVisitLand={multiplayer.visitLand}
                    onLandClaimed={() => multiplayer.initializePlayerLand(user?.id)}
                  />
                )}

                {sidebarTab === "social" && worldMode === "multiplayer" && (
                  <SocialPanel playerId={user?.id ?? null} currentLand={multiplayer.currentLand} />
                )}

                {sidebarTab === "contract" && world && (
                  <WorldContractPanel
                    world={world}
                    actions={actions}
                    onDeterminismBreak={handleDeterminismBreak}
                    deterministicTest={deterministicTest}
                  />
                )}

                {sidebarTab === "actions" && viewMode === "firstperson" && world && (
                  <ActionSystem
                    world={world}
                    playerPosition={playerPosition}
                    actions={actions}
                    onActionExecute={handleActionExecute}
                    onActionReset={handleActionReset}
                    disabled={isReplaying}
                  />
                )}
              </Suspense>

              {sidebarTab === "actions" && viewMode === "map" && (
                <div className="text-center text-muted-foreground text-sm py-8">
                  Switch to First Person view to execute actions
                </div>
              )}

              {sidebarTab === "parameters" && (
                <div className="space-y-4">
                  {/* Seed Control */}
                  <div className="space-y-1.5">
                    <label className="data-label text-[10px]">Seed</label>
                    <div className="flex gap-1.5">
                      <Input
                        type="number"
                        value={activeParams.seed}
                        onChange={(e) => {
                          const value = parseInt(e.target.value, 10);
                          if (!isNaN(value)) {
                            if (worldMode === "multiplayer" && multiplayer.currentLand && !isOtherPlayerLand) {
                              multiplayer.updateLandParams({ seed: Math.max(0, value) });
                            } else {
                              setSeed(Math.max(0, value));
                            }
                          }
                        }}
                        className="bg-secondary border-border font-mono text-sm h-8"
                        disabled={isReplaying || (worldMode === "multiplayer" && isOtherPlayerLand)}
                      />
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={() => {
                          const newSeed = Math.floor(Math.random() * 100000);
                          if (worldMode === "multiplayer" && multiplayer.currentLand && !isOtherPlayerLand) {
                            multiplayer.updateLandParams({ seed: newSeed });
                          } else {
                            randomizeSeed();
                          }
                        }}
                        className="shrink-0 h-8 w-8"
                        title="Randomize seed"
                        disabled={isReplaying || (worldMode === "multiplayer" && isOtherPlayerLand)}
                      >
                        <Shuffle className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>

                  {/* Variable Sliders */}
                  <div className="space-y-3">
                    <div className="data-label text-[10px]">Variables [0-9]</div>

                    {activeParams.vars.map((value, index) => (
                      <div key={index} className="space-y-1">
                        <div className="flex justify-between items-center text-[10px]">
                          <span className="text-muted-foreground">
                            [{index}] {VAR_LABELS[index]}
                          </span>
                          <span className="data-value">{value}</span>
                        </div>
                        <Slider
                          value={[value]}
                          onValueChange={([v]) => {
                            if (worldMode === "multiplayer" && multiplayer.currentLand && !isOtherPlayerLand) {
                              const newVars = [...activeParams.vars];
                              newVars[index] = v;
                              multiplayer.updateLandParams({ vars: newVars });
                            } else {
                              setVar(index, v);
                            }
                          }}
                          min={0}
                          max={100}
                          step={1}
                          className="w-full"
                          disabled={isReplaying || (worldMode === "multiplayer" && isOtherPlayerLand)}
                        />
                      </div>
                    ))}
                  </div>

                  {worldMode !== "multiplayer" && (
                    <Button
                      onClick={handleGenerate}
                      className="w-full gap-2 bg-primary hover:bg-primary/90 text-primary-foreground font-display text-sm"
                      disabled={isReplaying}
                    >
                      Generate World
                    </Button>
                  )}

                  {worldMode === "multiplayer" && isOtherPlayerLand && (
                    <p className="text-xs text-muted-foreground text-center py-2">You can only edit your own land</p>
                  )}

                  {/* Audio Settings */}
                  <div className="pt-3 mt-3 border-t border-border space-y-3">
                    <div className="data-label text-[10px]">Audio</div>

                    <div className="flex items-center justify-between gap-2">
                      <div className="space-y-0.5 flex-1">
                        <Label htmlFor="music-enabled" className="text-xs font-medium cursor-pointer">
                          Cinematic music
                        </Label>
                        <p className="text-[10px] text-muted-foreground leading-tight">Background travel soundtrack.</p>
                      </div>
                      <Switch id="music-enabled" checked={musicEnabled} onCheckedChange={toggleMusic} />
                    </div>

                    <div className="flex items-center justify-between gap-2">
                      <div className="space-y-0.5 flex-1">
                        <Label htmlFor="sfx-enabled" className="text-xs font-medium cursor-pointer">
                          Environment SFX
                        </Label>
                        <p className="text-[10px] text-muted-foreground leading-tight">
                          Wind, water, and nature sounds.
                        </p>
                      </div>
                      <Switch id="sfx-enabled" checked={sfxEnabled} onCheckedChange={toggleSfx} />
                    </div>

                    <div className="space-y-1">
                      <div className="flex justify-between items-center text-[10px]">
                        <span className="text-muted-foreground">Volume</span>
                        <span className="data-value">{Math.round(masterVolume * 100)}%</span>
                      </div>
                      <Slider
                        value={[masterVolume * 100]}
                        onValueChange={([v]) => setMasterVolume(v / 100)}
                        min={0}
                        max={100}
                        step={5}
                        className="w-full"
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>
          </aside>
        )}
      </main>

      {/* Status Bar */}
      <footer
        className={`border-t ${isInvalid ? "border-destructive bg-destructive/10" : "border-border bg-card/50"} flex-shrink-0`}
      >
        <div className="px-4 py-1.5 flex items-center justify-between text-[10px]">
          <div className="flex items-center gap-4">
            <div className={`flex items-center gap-1.5 ${isInvalid ? "text-destructive" : ""}`}>
              <span
                className={`w-1.5 h-1.5 rounded-full ${isInvalid ? "bg-destructive" : "bg-accent"} animate-pulse`}
              />
              <span className={isInvalid ? "text-destructive font-bold" : "text-muted-foreground"}>
                {isInvalid ? "INVALID" : "DETERMINISTIC"}
              </span>
            </div>
            <div className="hidden sm:flex items-center gap-1.5">
              <span className="text-muted-foreground">SEED:</span>
              <span className="data-value">{params.seed}</span>
            </div>
            <div className="hidden md:flex items-center gap-1.5">
              <span className="text-muted-foreground">ACTIONS:</span>
              <span className="text-secondary-foreground">{actions.length}</span>
            </div>
            {isReplaying && (
              <div className="flex items-center gap-1.5 text-accent">
                <span className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse" />
                <span>REPLAYING</span>
              </div>
            )}
          </div>

          <div className="flex items-center gap-1.5">
            <BuildStamp />
            <span className="text-muted-foreground">NexArt v1.5</span>
            <span className={isInvalid ? "text-destructive" : "text-primary"}>●</span>
          </div>
        </div>
      </footer>
    </div>
    </MobileLandscapeGate>
  );
};

export default Index;
