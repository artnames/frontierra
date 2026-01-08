import { useCallback, useState, useMemo, useEffect } from 'react';
import { Eye, Grid3X3, Copy, Check, Shuffle, Settings, ChevronLeft, ChevronRight } from 'lucide-react';
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
  ReplayFrame,
  generateReplayPath
} from '@/lib/worldContract';
import { WorldExplorer } from '@/components/WorldExplorer';
import { WorldCanvas } from '@/components/WorldCanvas';
import { WorldContractPanel } from '@/components/WorldContractPanel';
import { ReplayControls } from '@/components/ReplayControls';
import { ActionSystem } from '@/components/ActionSystem';
import { useToast } from '@/hooks/use-toast';
import { useSearchParams } from 'react-router-dom';

type ViewMode = 'isometric' | 'firstperson';
type SidebarTab = 'parameters' | 'contract' | 'actions' | 'replay';

const Index = () => {
  const [viewMode, setViewMode] = useState<ViewMode>('firstperson');
  const [copied, setCopied] = useState(false);
  const [showSidebar, setShowSidebar] = useState(true);
  const [sidebarTab, setSidebarTab] = useState<SidebarTab>('contract');
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

  // Parse actions from URL
  const [actions, setActions] = useState<WorldAction[]>(() => {
    const actionsParam = searchParams.get('actions');
    return actionsParam ? parseActions(actionsParam) : [];
  });
  
  // Generate world for contract panel
  const world = useMemo(() => generateWorldData(params.seed, params.vars), [params.seed, params.vars]);

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
      <header className={`border-b ${isInvalid ? 'border-destructive bg-destructive/10' : 'border-border bg-card/80'} backdrop-blur-sm flex-shrink-0`}>
        <div className="px-4 py-2 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div>
              <h1 className="font-display text-lg font-bold text-foreground glow-text">
                Deterministic World Explorer
              </h1>
              <p className="text-xs text-muted-foreground">
                Seed: <span className="text-primary font-mono">{params.seed}</span>
                {actions.length > 0 && (
                  <span className="ml-2">
                    Actions: <span className="text-accent font-mono">{actions.length}</span>
                  </span>
                )}
              </p>
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
                variant={viewMode === 'isometric' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setViewMode('isometric')}
                className="gap-1.5 h-7 text-xs"
                disabled={isReplaying}
              >
                <Grid3X3 className="w-3.5 h-3.5" />
                Isometric
              </Button>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowSidebar(!showSidebar)}
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
      <main className="flex-1 flex overflow-hidden">
        {/* World View */}
        <div className="flex-1 relative">
          {viewMode === 'firstperson' ? (
            <WorldExplorer 
              seed={params.seed} 
              vars={params.vars}
              initialActions={actions}
              onActionsChange={setActions}
              onPositionUpdate={handlePositionUpdate}
              deterministicTest={deterministicTest}
              isReplaying={isReplaying}
              replayFrame={replayFrame}
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-background grid-pattern p-4">
              <WorldCanvas params={params} onGenerate={handleGenerate} />
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
          <aside className="w-80 border-l border-border bg-card flex flex-col flex-shrink-0 overflow-hidden">
            {/* Tab Navigation */}
            <div className="flex border-b border-border bg-secondary/30">
              {(['contract', 'actions', 'replay', 'parameters'] as SidebarTab[]).map(tab => (
                <button
                  key={tab}
                  onClick={() => setSidebarTab(tab)}
                  className={`flex-1 py-2 text-[10px] uppercase tracking-wider transition-colors
                    ${sidebarTab === tab 
                      ? 'text-primary border-b-2 border-primary bg-card' 
                      : 'text-muted-foreground hover:text-foreground'}`}
                >
                  {tab}
                </button>
              ))}
            </div>
            
            {/* Tab Content */}
            <div className="flex-1 overflow-y-auto p-3">
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
                  disabled={isReplaying}
                />
              )}
              
              {sidebarTab === 'actions' && viewMode === 'isometric' && (
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
