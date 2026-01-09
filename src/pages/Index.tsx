import { useCallback, useState, useMemo, useEffect } from 'react';
import { Eye, Map, Copy, Check, Shuffle, Settings, ChevronLeft, Users, Globe, Compass, Pencil } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Slider } from '@/components/ui/slider';
import { useWorldParams } from '@/hooks/useWorldParams';
import { VAR_LABELS } from '@/lib/worldGenerator';
import { generateWorldData } from '@/lib/worldData';
import { 
  WorldAction, 
  DeterminismTest, 
  runDeterminismTest,
  serializeActions,
  parseActions,
  ReplayFrame
} from '@/lib/worldContract';
import { WorldExplorer, InteractionMode } from '@/components/WorldExplorer';
import { WorldMap2D } from '@/components/WorldMap2D';
import { WorldContractPanel } from '@/components/WorldContractPanel';
import { ReplayControls } from '@/components/ReplayControls';
import { ActionSystem } from '@/components/ActionSystem';
import { MultiplayerHUD } from '@/components/MultiplayerHUD';
import { WorldAMap } from '@/components/WorldAMap';
import { useMultiplayerWorld } from '@/hooks/useMultiplayerWorld';
import { useToast } from '@/hooks/use-toast';
import { useSearchParams } from 'react-router-dom';

type ViewMode = 'map' | 'firstperson';
type SidebarTab = 'parameters' | 'contract' | 'actions' | 'replay' | 'worldmap';
type WorldMode = 'solo' | 'multiplayer';

const Index = () => {
  const [viewMode, setViewMode] = useState<ViewMode>('firstperson');
  const [worldMode, setWorldMode] = useState<WorldMode>('solo');
  const [interactionMode, setInteractionMode] = useState<InteractionMode>('explore');
  const [copied, setCopied] = useState(false);
  const [showSidebar, setShowSidebar] = useState(false); // Default hidden in explore mode
  const [sidebarTab, setSidebarTab] = useState<SidebarTab>('worldmap');
  const [deterministicTest, setDeterministicTest] = useState<DeterminismTest | null>(null);
  const [isReplaying, setIsReplaying] = useState(false);
  const [replayFrame, setReplayFrame] = useState<ReplayFrame | null>(null);
  const [playerPosition, setPlayerPosition] = useState({ x: 32, y: 32, z: 0 });
  const { toast } = useToast();
  
  const [searchParams, setSearchParams] = useSearchParams();
  
  const {
    params,
    setSeed,
    setVar,
    getShareUrl,
    applyToUrl,
    randomizeSeed
  } = useWorldParams();

  // Multiplayer world management
  const multiplayer = useMultiplayerWorld({
    autoCreate: true
  });
  
  // Check if we're on someone else's land (multiplayer)
  const isOtherPlayerLand = useMemo(() => {
    if (worldMode !== 'multiplayer' || !multiplayer.currentLand) return false;
    return multiplayer.isVisitingOtherLand;
  }, [worldMode, multiplayer.currentLand, multiplayer.isVisitingOtherLand]);

  // Force explore mode when on someone else's land
  const effectiveInteractionMode: InteractionMode = isOtherPlayerLand ? 'explore' : interactionMode;

  // Ensure the panel opens when switching into editor mode (but don't auto-close in explore)
  useEffect(() => {
    if (effectiveInteractionMode === 'editor') {
      setShowSidebar(true);
    }
    // Don't auto-close in explore mode - let user control sidebar visibility
  }, [effectiveInteractionMode]);
  
  // Handle mode changes
  const handleInteractionModeChange = useCallback((mode: InteractionMode) => {
    if (isOtherPlayerLand && mode === 'editor') {
      toast({
        title: 'Cannot edit',
        description: "You can only explore on someone else's land",
        variant: 'destructive'
      });
      return;
    }
    
    setInteractionMode(mode);
    // Only auto-open sidebar when switching TO editor mode
    if (mode === 'editor') {
      setShowSidebar(true);
    }
  }, [isOtherPlayerLand, toast]);
  
  // Initialize multiplayer land on first load
  useEffect(() => {
    if (worldMode === 'multiplayer' && !multiplayer.currentLand && !multiplayer.isLoading) {
      multiplayer.initializePlayerLand();
    }
  }, [worldMode, multiplayer.currentLand, multiplayer.isLoading, multiplayer.initializePlayerLand]);

  // Parse actions from URL
  const [actions, setActions] = useState<WorldAction[]>(() => {
    const actionsParam = searchParams.get('actions');
    return actionsParam ? parseActions(actionsParam) : [];
  });
  
  // Use multiplayer world data when in multiplayer mode, else solo params
  const activeParams = worldMode === 'multiplayer' && multiplayer.currentLand
    ? { seed: multiplayer.currentLand.seed, vars: multiplayer.currentLand.vars }
    : params;
    
  // Generate world for contract panel
  const world = useMemo(() => generateWorldData(activeParams.seed, activeParams.vars), [activeParams.seed, activeParams.vars]);

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
        title: 'Link copied!',
        description: 'Deterministic world URL with actions copied',
      });
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      toast({
        title: 'Copy failed',
        description: 'Could not copy to clipboard',
        variant: 'destructive'
      });
    }
  };

  const handleSeedInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseInt(e.target.value, 10);
    if (!isNaN(value)) {
      setSeed(Math.max(0, value));
    }
  };
  
  const handleActionExecute = useCallback((action: WorldAction) => {
    const newActions = [...actions, action];
    setActions(newActions);
    
    // Update URL with action
    const varsStr = params.vars.join(',');
    const actionsStr = serializeActions(newActions);
    setSearchParams({ 
      seed: params.seed.toString(), 
      vars: varsStr,
      actions: actionsStr
    });
  }, [actions, params, setSearchParams]);
  
  const handleActionReset = useCallback(() => {
    setActions([]);
    // Update URL without actions
    const varsStr = params.vars.join(',');
    setSearchParams({ 
      seed: params.seed.toString(), 
      vars: varsStr
    });
    toast({
      title: 'Beacon Reset',
      description: 'You can now place a new beacon',
    });
  }, [params, setSearchParams, toast]);
  
  const handleDeterminismBreak = useCallback((breakType: 'math_random' | 'date' | 'none') => {
    const test = runDeterminismTest(world, breakType);
    setDeterministicTest(test);
    
    if (breakType !== 'none') {
      toast({
        title: 'Determinism Broken',
        description: `Injected ${breakType === 'math_random' ? 'Math.random()' : 'Date.now()'} — hash mismatch`,
        variant: 'destructive'
      });
    } else {
      toast({
        title: 'Determinism Restored',
        description: 'World hash verified',
      });
    }
  }, [world, toast]);
  
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
      title: 'Replay Complete',
      description: 'All stored instructions executed',
    });
  }, [toast]);
  
  const handlePositionUpdate = useCallback((pos: { x: number; y: number; z: number }) => {
    setPlayerPosition(pos);
  }, []);

  const isInvalid = deterministicTest && !deterministicTest.isValid;

  return (
    <div className={`h-screen bg-background flex flex-col overflow-hidden ${isInvalid ? 'border-4 border-destructive' : ''}`}>
      {/* Compact Header */}
      <header className={`relative z-50 border-b ${isInvalid ? 'border-destructive bg-destructive/10' : 'border-border bg-card/80'} backdrop-blur-sm flex-shrink-0`}>
        <div className="px-4 py-2 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div>
              <h1 className="font-display text-lg font-bold text-foreground glow-text">
                Deterministic World Explorer
              </h1>
              <p className="text-xs text-muted-foreground">
                {worldMode === 'multiplayer' && multiplayer.currentLand ? (
                  <>
                    Land: <span className="text-primary font-mono">{multiplayer.currentLand.seed}</span>
                    <span className="ml-2">
                      Grid: <span className="text-accent font-mono">
                        ({multiplayer.currentLand.pos_x}, {multiplayer.currentLand.pos_y})
                      </span>
                    </span>
                  </>
                ) : (
                  <>
                    Seed: <span className="text-primary font-mono">{activeParams.seed}</span>
                    {actions.length > 0 && (
                      <span className="ml-2">
                        Actions: <span className="text-accent font-mono">{actions.length}</span>
                      </span>
                    )}
                  </>
                )}
              </p>
            </div>
            
            {/* World Mode Toggle */}
            <div className="hidden md:flex items-center gap-1 bg-secondary/50 rounded p-1">
              <Button
                variant={worldMode === 'solo' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setWorldMode('solo')}
                className="gap-1.5 h-7 text-xs"
                disabled={isReplaying}
              >
                <Globe className="w-3.5 h-3.5" />
                Solo
              </Button>
              <Button
                variant={worldMode === 'multiplayer' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setWorldMode('multiplayer')}
                className="gap-1.5 h-7 text-xs"
                disabled={isReplaying}
              >
                <Users className="w-3.5 h-3.5" />
                Multiplayer
              </Button>
            </div>
            
            {/* View Mode Toggle */}
            <div className="hidden sm:flex items-center gap-1 bg-secondary rounded p-1">
              <Button
                variant={viewMode === 'firstperson' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setViewMode('firstperson')}
                className="gap-1.5 h-7 text-xs"
                disabled={isReplaying}
              >
                <Eye className="w-3.5 h-3.5" />
                First Person
              </Button>
              <Button
                variant={viewMode === 'map' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setViewMode('map')}
                className="gap-1.5 h-7 text-xs"
                disabled={isReplaying}
              >
                <Map className="w-3.5 h-3.5" />
                2D Map
              </Button>
            </div>
            
            {/* Interaction Mode Toggle */}
            <div className="hidden sm:flex items-center gap-1 bg-secondary rounded p-1">
              <Button
                variant={effectiveInteractionMode === 'explore' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => handleInteractionModeChange('explore')}
                className="gap-1.5 h-7 text-xs"
                disabled={isReplaying}
              >
                <Compass className="w-3.5 h-3.5" />
                Explore
              </Button>
              <Button
                variant={effectiveInteractionMode === 'editor' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => handleInteractionModeChange('editor')}
                className="gap-1.5 h-7 text-xs"
                disabled={isReplaying || isOtherPlayerLand}
                title={isOtherPlayerLand ? "Can't edit on someone else's land" : undefined}
              >
                <Pencil className="w-3.5 h-3.5" />
                Editor
              </Button>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onPointerDown={(e) => e.stopPropagation()}
              onClick={() => setShowSidebar((s) => !s)}
              className="text-xs gap-1"
            >
              <Settings className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">{showSidebar ? 'Hide' : 'Show'} Panel</span>
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleCopyLink}
              className="gap-1.5"
            >
              {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              <span className="hidden sm:inline">{copied ? 'Copied!' : 'Share'}</span>
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex overflow-hidden relative z-0">
        {/* World View */}
        <div className="flex-1 relative z-0">
          {viewMode === 'firstperson' ? (
            <WorldExplorer 
              seed={activeParams.seed} 
              vars={activeParams.vars}
              initialActions={actions}
              onActionsChange={setActions}
              onPositionUpdate={handlePositionUpdate}
              deterministicTest={deterministicTest}
              isReplaying={isReplaying}
              replayFrame={replayFrame}
              interactionMode={effectiveInteractionMode}
              onModeChange={handleInteractionModeChange}
            />
          ) : (
            <div className="w-full h-full flex bg-background">
              <div className="flex-1 flex items-center justify-center p-4">
                <WorldMap2D params={activeParams} getShareUrl={getShareUrl} />
              </div>
            </div>
          )}
          
          {/* Multiplayer HUD */}
          {worldMode === 'multiplayer' && viewMode === 'firstperson' && (
            <MultiplayerHUD
              currentLand={multiplayer.currentLand}
              neighborLands={multiplayer.neighborLands}
              playerPosition={multiplayer.playerPosition}
              isTransitioning={multiplayer.isTransitioning}
              onVisitLand={multiplayer.visitLand}
            />
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

        {/* Control Sidebar - Absolute positioned to overlay canvas */}
        {showSidebar && (
        <aside className="fixed top-[52px] right-0 bottom-0 w-80 border-l border-border bg-card/95 backdrop-blur-sm flex flex-col overflow-hidden z-[100] shadow-xl">
            {/* Tab Navigation */}
            <div className="flex border-b border-border bg-secondary/30">
              {/* Show worldmap tab only in multiplayer mode */}
              {(worldMode === 'multiplayer' 
                ? (['worldmap', 'contract', 'actions', 'replay', 'parameters'] as SidebarTab[])
                : (['contract', 'actions', 'replay', 'parameters'] as SidebarTab[])
              ).map(tab => (
                <button
                  key={tab}
                  onClick={() => setSidebarTab(tab)}
                  className={`flex-1 py-2 text-[10px] uppercase tracking-wider transition-colors
                    ${sidebarTab === tab 
                      ? 'text-primary border-b-2 border-primary bg-card' 
                      : 'text-muted-foreground hover:text-foreground'}`}
                >
                  {tab === 'worldmap' ? 'World A' : tab}
                </button>
              ))}
            </div>
            
            {/* Tab Content */}
            <div className="flex-1 overflow-y-auto p-3">
              {sidebarTab === 'worldmap' && worldMode === 'multiplayer' && (
                <WorldAMap
                  currentLand={multiplayer.currentLand}
                  playerId={multiplayer.playerId}
                  onVisitLand={multiplayer.visitLand}
                />
              )}
              
              {sidebarTab === 'contract' && (
                <WorldContractPanel
                  world={world}
                  actions={actions}
                  onDeterminismBreak={handleDeterminismBreak}
                  deterministicTest={deterministicTest}
                />
              )}
              
              {sidebarTab === 'actions' && viewMode === 'firstperson' && (
                <ActionSystem
                  world={world}
                  playerPosition={playerPosition}
                  actions={actions}
                  onActionExecute={handleActionExecute}
                  onActionReset={handleActionReset}
                  disabled={isReplaying}
                />
              )}
              
              {sidebarTab === 'actions' && viewMode === 'map' && (
                <div className="text-center text-muted-foreground text-sm py-8">
                  Switch to First Person view to execute actions
                </div>
              )}
              
              {sidebarTab === 'replay' && (
                <ReplayControls
                  world={world}
                  actions={actions}
                  isReplaying={isReplaying}
                  onReplayStart={handleReplayStart}
                  onReplayStop={handleReplayStop}
                  onReplayFrame={handleReplayFrame}
                  onReplayComplete={handleReplayComplete}
                />
              )}
              
              {sidebarTab === 'parameters' && (
                <div className="space-y-4">
                  {/* Seed Control */}
                  <div className="space-y-1.5">
                    <label className="data-label text-[10px]">Seed</label>
                    <div className="flex gap-1.5">
                      <Input
                        type="number"
                        value={params.seed}
                        onChange={handleSeedInput}
                        className="bg-secondary border-border font-mono text-sm h-8"
                        disabled={isReplaying}
                      />
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={randomizeSeed}
                        className="shrink-0 h-8 w-8"
                        title="Randomize seed"
                        disabled={isReplaying}
                      >
                        <Shuffle className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>
                  
                  {/* Variable Sliders */}
                  <div className="space-y-3">
                    <div className="data-label text-[10px]">Variables [0-9]</div>
                    
                    {params.vars.map((value, index) => (
                      <div key={index} className="space-y-1">
                        <div className="flex justify-between items-center text-[10px]">
                          <span className="text-muted-foreground">
                            [{index}] {VAR_LABELS[index]}
                          </span>
                          <span className="data-value">{value}</span>
                        </div>
                        <Slider
                          value={[value]}
                          onValueChange={([v]) => setVar(index, v)}
                          min={0}
                          max={100}
                          step={1}
                          className="w-full"
                          disabled={isReplaying}
                        />
                      </div>
                    ))}
                  </div>
                  
                  <Button 
                    onClick={handleGenerate}
                    className="w-full gap-2 bg-primary hover:bg-primary/90 text-primary-foreground font-display text-sm"
                    disabled={isReplaying}
                  >
                    Generate World
                  </Button>
                </div>
              )}
            </div>
          </aside>
        )}
      </main>

      {/* Status Bar */}
      <footer className={`border-t ${isInvalid ? 'border-destructive bg-destructive/10' : 'border-border bg-card/50'} flex-shrink-0`}>
        <div className="px-4 py-1.5 flex items-center justify-between text-[10px]">
          <div className="flex items-center gap-4">
            <div className={`flex items-center gap-1.5 ${isInvalid ? 'text-destructive' : ''}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${isInvalid ? 'bg-destructive' : 'bg-accent'} animate-pulse`} />
              <span className={isInvalid ? 'text-destructive font-bold' : 'text-muted-foreground'}>
                {isInvalid ? 'INVALID' : 'DETERMINISTIC'}
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
            <span className="text-muted-foreground">NexArt v1.5</span>
            <span className={isInvalid ? 'text-destructive' : 'text-primary'}>●</span>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Index;
