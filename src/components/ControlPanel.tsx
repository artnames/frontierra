import { useState } from 'react';
import { Copy, Check, RefreshCw, Shuffle } from 'lucide-react';
import { WorldParams, VAR_LABELS } from '@/lib/worldGenerator';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Slider } from '@/components/ui/slider';
import { useToast } from '@/hooks/use-toast';

interface ControlPanelProps {
  params: WorldParams;
  onSeedChange: (seed: number) => void;
  onVarChange: (index: number, value: number) => void;
  onGenerate: () => void;
  onRandomizeSeed: () => void;
  getShareUrl: () => string;
}

export function ControlPanel({
  params,
  onSeedChange,
  onVarChange,
  onGenerate,
  onRandomizeSeed,
  getShareUrl
}: ControlPanelProps) {
  const [copied, setCopied] = useState(false);
  const { toast } = useToast();

  const handleCopyLink = async () => {
    const url = getShareUrl();
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      toast({
        title: 'Link copied!',
        description: 'Share URL copied to clipboard',
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
      onSeedChange(Math.max(0, value));
    }
  };

  return (
    <div className="terminal-panel flex flex-col h-full">
      <div className="terminal-header">
        <div className="terminal-dot bg-primary animate-pulse-glow" />
        <div className="terminal-dot bg-accent" />
        <div className="terminal-dot bg-muted-foreground" />
        <span className="ml-2 text-xs text-muted-foreground font-display uppercase tracking-wider">
          World Parameters
        </span>
      </div>
      
      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        {/* Seed Control */}
        <div className="space-y-2">
          <label className="data-label">Seed</label>
          <div className="flex gap-2">
            <Input
              type="number"
              value={params.seed}
              onChange={handleSeedInput}
              className="bg-secondary border-border font-mono"
            />
            <Button
              variant="outline"
              size="icon"
              onClick={onRandomizeSeed}
              className="shrink-0"
              title="Randomize seed"
            >
              <Shuffle className="w-4 h-4" />
            </Button>
          </div>
        </div>
        
        {/* Variable Sliders */}
        <div className="space-y-4">
          <div className="data-label">Variables [0-9]</div>
          
          {params.vars.map((value, index) => (
            <div key={index} className="space-y-1.5">
              <div className="flex justify-between items-center">
                <span className="text-xs text-muted-foreground">
                  VAR[{index}] <span className="text-secondary-foreground">— {VAR_LABELS[index]}</span>
                </span>
                <span className="data-value text-sm">{value}</span>
              </div>
              <Slider
                value={[value]}
                onValueChange={([v]) => onVarChange(index, v)}
                min={0}
                max={100}
                step={1}
                className="w-full"
              />
            </div>
          ))}
        </div>
      </div>
      
      {/* Action Buttons */}
      <div className="p-4 border-t border-border space-y-2">
        <Button 
          onClick={onGenerate}
          className="w-full gap-2 bg-primary hover:bg-primary/90 text-primary-foreground font-display"
        >
          <RefreshCw className="w-4 h-4" />
          Generate World
        </Button>
        
        <Button
          variant="outline"
          onClick={handleCopyLink}
          className="w-full gap-2"
        >
          {copied ? (
            <>
              <Check className="w-4 h-4" />
              Copied!
            </>
          ) : (
            <>
              <Copy className="w-4 h-4" />
              Copy Share Link
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
