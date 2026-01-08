import { useCallback, useState } from 'react';
import { Eye, Grid3X3, Copy, Check, Shuffle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Slider } from '@/components/ui/slider';
import { useWorldParams } from '@/hooks/useWorldParams';
import { VAR_LABELS } from '@/lib/worldGenerator';
import { WorldExplorer } from '@/components/WorldExplorer';
import { WorldCanvas } from '@/components/WorldCanvas';
import { useToast } from '@/hooks/use-toast';

type ViewMode = 'isometric' | 'firstperson';

const Index = () => {
  const [viewMode, setViewMode] = useState<ViewMode>('firstperson');
  const [copied, setCopied] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const { toast } = useToast();
  
  const {
    params,
    setSeed,
    setVar,
    getShareUrl,
    applyToUrl,
    randomizeSeed
  } = useWorldParams();

  const handleGenerate = useCallback(() => {
    applyToUrl();
  }, [applyToUrl]);

  const handleCopyLink = async () => {
    const url = getShareUrl();
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      toast({
        title: 'Link copied!',
        description: 'Deterministic world URL copied to clipboard',
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

  return (
    <div className="h-screen bg-background flex flex-col overflow-hidden">
      {/* Compact Header */}
      <header className="border-b border-border bg-card/80 backdrop-blur-sm flex-shrink-0">
        <div className="px-4 py-2 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div>
              <h1 className="font-display text-lg font-bold text-foreground glow-text">
                Deterministic World Explorer
              </h1>
              <p className="text-xs text-muted-foreground">
                NexArt-powered • Seed: <span className="text-primary">{params.seed}</span>
              </p>
            </div>
            
            {/* View Mode Toggle */}
            <div className="hidden sm:flex items-center gap-1 bg-secondary rounded p-1">
              <Button
                variant={viewMode === 'firstperson' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setViewMode('firstperson')}
                className="gap-1.5 h-7 text-xs"
              >
                <Eye className="w-3.5 h-3.5" />
                First Person
              </Button>
              <Button
                variant={viewMode === 'isometric' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setViewMode('isometric')}
                className="gap-1.5 h-7 text-xs"
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
              onClick={() => setShowControls(!showControls)}
              className="text-xs"
            >
              {showControls ? 'Hide' : 'Show'} Controls
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
            <WorldExplorer seed={params.seed} vars={params.vars} />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-background grid-pattern p-4">
              <WorldCanvas params={params} onGenerate={handleGenerate} />
            </div>
          )}
          
          {/* Mobile View Toggle */}
          <div className="absolute bottom-4 right-4 sm:hidden">
            <div className="flex items-center gap-1 bg-card/90 backdrop-blur-sm rounded p-1 border border-border">
              <Button
                variant={viewMode === 'firstperson' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setViewMode('firstperson')}
                className="h-8 w-8 p-0"
              >
                <Eye className="w-4 h-4" />
              </Button>
              <Button
                variant={viewMode === 'isometric' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setViewMode('isometric')}
                className="h-8 w-8 p-0"
              >
                <Grid3X3 className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>

        {/* Control Panel */}
        {showControls && (
          <aside className="w-72 border-l border-border bg-card flex flex-col flex-shrink-0 overflow-hidden">
            <div className="terminal-header px-3 py-2">
              <div className="terminal-dot bg-primary animate-pulse-glow" />
              <div className="terminal-dot bg-accent" />
              <div className="terminal-dot bg-muted-foreground" />
              <span className="ml-2 text-xs text-muted-foreground font-display uppercase tracking-wider">
                Parameters
              </span>
            </div>
            
            <div className="flex-1 overflow-y-auto p-3 space-y-4">
              {/* Seed Control */}
              <div className="space-y-1.5">
                <label className="data-label text-[10px]">Seed</label>
                <div className="flex gap-1.5">
                  <Input
                    type="number"
                    value={params.seed}
                    onChange={handleSeedInput}
                    className="bg-secondary border-border font-mono text-sm h-8"
                  />
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={randomizeSeed}
                    className="shrink-0 h-8 w-8"
                    title="Randomize seed"
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
                    />
                  </div>
                ))}
              </div>
            </div>
            
            {/* Action Button */}
            <div className="p-3 border-t border-border">
              <Button 
                onClick={handleGenerate}
                className="w-full gap-2 bg-primary hover:bg-primary/90 text-primary-foreground font-display text-sm"
              >
                Generate World
              </Button>
            </div>
          </aside>
        )}
      </main>

      {/* Status Bar */}
      <footer className="border-t border-border bg-card/50 flex-shrink-0">
        <div className="px-4 py-1.5 flex items-center justify-between text-[10px]">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse" />
              <span className="text-muted-foreground">DETERMINISTIC</span>
            </div>
            <div className="hidden sm:flex items-center gap-1.5">
              <span className="text-muted-foreground">SEED:</span>
              <span className="data-value">{params.seed}</span>
            </div>
            <div className="hidden md:flex items-center gap-1.5">
              <span className="text-muted-foreground">VIEW:</span>
              <span className="text-secondary-foreground uppercase">{viewMode}</span>
            </div>
          </div>
          
          <div className="flex items-center gap-1.5">
            <span className="text-muted-foreground">NexArt v1.5</span>
            <span className="text-primary">●</span>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Index;
