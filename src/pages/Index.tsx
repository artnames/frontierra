import { useCallback } from 'react';
import { WorldCanvas } from '@/components/WorldCanvas';
import { ControlPanel } from '@/components/ControlPanel';
import { StatusBar } from '@/components/StatusBar';
import { useWorldParams } from '@/hooks/useWorldParams';

const Index = () => {
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

  return (
    <div className="min-h-screen bg-background grid-pattern flex flex-col">
      {/* Header */}
      <header className="border-b border-border bg-card/50 backdrop-blur-sm">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="font-display text-xl sm:text-2xl font-bold text-foreground glow-text">
                Deterministic World Explorer
              </h1>
              <p className="text-xs sm:text-sm text-muted-foreground mt-1">
                NexArt-powered procedural generation
              </p>
            </div>
            <div className="hidden sm:block text-right">
              <div className="text-xs text-muted-foreground">Version</div>
              <div className="text-sm text-primary font-mono">1.0.0</div>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 container mx-auto px-4 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-[1fr,360px] gap-6 h-full">
          {/* Canvas Area */}
          <div className="terminal-panel p-4 flex flex-col">
            <div className="terminal-header -mx-4 -mt-4 mb-4">
              <div className="terminal-dot bg-primary" />
              <div className="terminal-dot bg-accent" />
              <div className="terminal-dot bg-muted-foreground" />
              <span className="ml-2 text-xs text-muted-foreground font-display uppercase tracking-wider">
                World View — 512×512
              </span>
            </div>
            
            <div className="flex-1 flex items-center justify-center">
              <WorldCanvas 
                params={params} 
                onGenerate={handleGenerate}
              />
            </div>
            
            <div className="mt-4 pt-4 border-t border-border">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
                <div>
                  <span className="text-muted-foreground">Object Type</span>
                  <div className="data-value">{Math.floor(params.vars[0] / 20)}</div>
                </div>
                <div>
                  <span className="text-muted-foreground">Position</span>
                  <div className="data-value">
                    ({Math.floor(params.vars[1] / 100 * 28 + 2)}, {Math.floor(params.vars[2] / 100 * 28 + 2)})
                  </div>
                </div>
                <div>
                  <span className="text-muted-foreground">Terrain</span>
                  <div className="data-value">{params.vars[3]}%</div>
                </div>
                <div>
                  <span className="text-muted-foreground">Water</span>
                  <div className="data-value">{params.vars[4]}%</div>
                </div>
              </div>
            </div>
          </div>

          {/* Control Panel */}
          <div className="lg:h-[calc(100vh-180px)]">
            <ControlPanel
              params={params}
              onSeedChange={setSeed}
              onVarChange={setVar}
              onGenerate={handleGenerate}
              onRandomizeSeed={randomizeSeed}
              getShareUrl={getShareUrl}
            />
          </div>
        </div>
      </main>

      {/* Status Bar */}
      <footer className="border-t border-border">
        <div className="container mx-auto px-4">
          <StatusBar params={params} />
        </div>
      </footer>
    </div>
  );
};

export default Index;
