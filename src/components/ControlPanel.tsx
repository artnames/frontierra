import { useState } from 'react';
import { Copy, Check, RefreshCw, Shuffle, Music, Volume2 } from 'lucide-react';
import { WorldParams, VAR_LABELS } from '@/lib/worldGenerator';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { useVisualSettings } from '@/hooks/useVisualSettings';

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
  const { 
    materialRichness, 
    toggleMaterialRichness, 
    showVegetation, 
    toggleVegetation,
    musicEnabled,
    toggleMusic,
    sfxEnabled,
    toggleSfx,
    masterVolume,
    setMasterVolume
  } = useVisualSettings();

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
        
        {/* Visual Settings */}
        <div className="space-y-3 pt-2 border-t border-border">
          <div className="data-label">Visual Settings</div>
          
          <div className="flex items-center justify-between gap-3">
            <div className="space-y-0.5">
              <Label htmlFor="material-richness" className="text-sm font-medium cursor-pointer">
                Material richness
              </Label>
              <p className="text-xs text-muted-foreground">
                Detailed terrain textures.
              </p>
            </div>
            <Switch
              id="material-richness"
              checked={materialRichness}
              onCheckedChange={toggleMaterialRichness}
            />
          </div>
          
          <div className="flex items-center justify-between gap-3">
            <div className="space-y-0.5">
              <Label htmlFor="show-vegetation" className="text-sm font-medium cursor-pointer">
                Vegetation
              </Label>
              <p className="text-xs text-muted-foreground">
                Trees, flowers, and plants.
              </p>
            </div>
            <Switch
              id="show-vegetation"
              checked={showVegetation}
              onCheckedChange={toggleVegetation}
            />
          </div>
        </div>
        
        {/* Audio Settings */}
        <div className="space-y-3 pt-2 border-t border-border">
          <div className="data-label flex items-center gap-2">
            <Volume2 className="w-3.5 h-3.5" />
            Audio Settings
          </div>
          
          <div className="flex items-center justify-between gap-3">
            <div className="space-y-0.5">
              <Label htmlFor="music-enabled" className="text-sm font-medium cursor-pointer flex items-center gap-1.5">
                <Music className="w-3.5 h-3.5" />
                Ambient Music
              </Label>
              <p className="text-xs text-muted-foreground">
                Cinematic background music.
              </p>
            </div>
            <Switch
              id="music-enabled"
              checked={musicEnabled}
              onCheckedChange={toggleMusic}
            />
          </div>
          
          <div className="flex items-center justify-between gap-3">
            <div className="space-y-0.5">
              <Label htmlFor="sfx-enabled" className="text-sm font-medium cursor-pointer">
                Environment SFX
              </Label>
              <p className="text-xs text-muted-foreground">
                Wind, water, and nature sounds.
              </p>
            </div>
            <Switch
              id="sfx-enabled"
              checked={sfxEnabled}
              onCheckedChange={toggleSfx}
            />
          </div>
          
          <div className="space-y-1.5">
            <div className="flex justify-between items-center">
              <Label className="text-xs text-muted-foreground">Master Volume</Label>
              <span className="text-xs font-mono text-foreground">{Math.round(masterVolume * 100)}%</span>
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
