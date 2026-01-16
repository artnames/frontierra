import { useState, useMemo } from 'react';
import { Copy, Check, RefreshCw, Shuffle, Music, Volume2, ChevronDown, Sparkles, Settings2 } from 'lucide-react';
import { WorldParams, VAR_LABELS } from '@/lib/worldGenerator';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { useVisualSettings } from '@/hooks/useVisualSettings';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  MACRO_VARS, 
  MICRO_VARS, 
  WORLD_PRESETS,
  randomizeMacroVars,
  type WorldPreset
} from '@/world';

interface ControlPanelProps {
  params: WorldParams;
  onSeedChange: (seed: number) => void;
  onVarChange: (index: number, value: number) => void;
  onGenerate: () => void;
  onRandomizeSeed: () => void;
  getShareUrl: () => string;
  mappingVersion?: 'v1' | 'v2';
  onMappingVersionChange?: (version: 'v1' | 'v2') => void;
}

export function ControlPanel({
  params,
  onSeedChange,
  onVarChange,
  onGenerate,
  onRandomizeSeed,
  getShareUrl,
  mappingVersion = 'v1',
  onMappingVersionChange
}: ControlPanelProps) {
  const [copied, setCopied] = useState(false);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [selectedPreset, setSelectedPreset] = useState<string>('');
  const { toast } = useToast();
  const { 
    // Graphics
    materialRichness,
    toggleMaterialRichness,
    fogEnabled,
    toggleFog,
    microDetailEnabled,
    toggleMicroDetail,
    shadowsEnabled,
    toggleShadows,
    smoothShading,
    toggleSmoothShading,
    waterAnimation,
    toggleWaterAnimation,
    // PostFX
    postfxBloomEnabled,
    togglePostfxBloom,
    postfxVignetteEnabled,
    togglePostfxVignette,
    postfxOutlineEnabled,
    togglePostfxOutline,
    postfxNoiseEnabled,
    togglePostfxNoise,
    // Audio
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

  const handlePresetSelect = (presetId: string) => {
    const preset = WORLD_PRESETS.find(p => p.id === presetId);
    if (preset) {
      setSelectedPreset(presetId);
      // Apply preset macro vars
      preset.macroVars.forEach((value, index) => {
        if (index < params.vars.length) {
          onVarChange(index, value);
        }
      });
      // Switch to v2 mapping for presets
      if (onMappingVersionChange) {
        onMappingVersionChange('v2');
      }
      toast({
        title: `${preset.name} applied`,
        description: preset.description,
      });
    }
  };

  const handleRandomizeVars = () => {
    // Use deterministic randomization based on current seed
    const randomized = randomizeMacroVars(params.seed);
    randomized.forEach((value, index) => {
      if (index < params.vars.length) {
        onVarChange(index, value);
      }
    });
    setSelectedPreset('');
    toast({
      title: 'Variables randomized',
      description: 'Deterministically generated new configuration',
    });
  };

  // Group vars by category for advanced panel
  const microVarsByGroup = useMemo(() => {
    const groups: Record<string, typeof MICRO_VARS> = {};
    MICRO_VARS.forEach(v => {
      if (!groups[v.group]) groups[v.group] = [];
      groups[v.group].push(v);
    });
    return groups;
  }, []);

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
        {/* Preset Selector */}
        <div className="space-y-2">
          <label className="data-label flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5" />
            World Preset
          </label>
          <Select value={selectedPreset} onValueChange={handlePresetSelect}>
            <SelectTrigger className="bg-secondary border-border">
              <SelectValue placeholder="Select a preset..." />
            </SelectTrigger>
            <SelectContent>
              {WORLD_PRESETS.map(preset => (
                <SelectItem key={preset.id} value={preset.id}>
                  <div className="flex flex-col">
                    <span className="font-medium">{preset.name}</span>
                    <span className="text-xs text-muted-foreground">{preset.description}</span>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

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
        
        {/* Macro Variable Sliders (Primary Controls) */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="data-label">Macro Variables</div>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleRandomizeVars}
              className="h-7 text-xs"
            >
              <Shuffle className="w-3 h-3 mr-1" />
              Randomize
            </Button>
          </div>
          
          {MACRO_VARS.slice(0, 10).map((macroVar, index) => (
            <div key={macroVar.id} className="space-y-1.5">
              <div className="flex justify-between items-center">
                <span className="text-xs text-muted-foreground">
                  VAR[{index}] <span className="text-secondary-foreground">— {macroVar.label}</span>
                </span>
                <span className="data-value text-sm">{params.vars[index] ?? macroVar.default}</span>
              </div>
              <Slider
                value={[params.vars[index] ?? macroVar.default]}
                onValueChange={([v]) => onVarChange(index, v)}
                min={macroVar.min}
                max={macroVar.max}
                step={1}
                className="w-full"
              />
            </div>
          ))}
        </div>

        {/* Mapping Version Toggle */}
        {onMappingVersionChange && (
          <div className="flex items-center justify-between gap-3 pt-2 border-t border-border">
            <div className="space-y-0.5">
              <Label className="text-sm font-medium">Enhanced Generation (v2)</Label>
              <p className="text-xs text-muted-foreground">
                Enables archetypes and structural variety
              </p>
            </div>
            <Switch
              checked={mappingVersion === 'v2'}
              onCheckedChange={(checked) => onMappingVersionChange(checked ? 'v2' : 'v1')}
            />
          </div>
        )}
        
        {/* Advanced Controls (Collapsible) */}
        <Collapsible open={advancedOpen} onOpenChange={setAdvancedOpen}>
          <CollapsibleTrigger asChild>
            <Button variant="ghost" className="w-full justify-between p-2 h-auto">
              <span className="flex items-center gap-2 text-sm">
                <Settings2 className="w-4 h-4" />
                Advanced Controls
              </span>
              <ChevronDown className={`w-4 h-4 transition-transform ${advancedOpen ? 'rotate-180' : ''}`} />
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent className="space-y-4 pt-4">
            {Object.entries(microVarsByGroup).map(([group, vars]) => (
              <div key={group} className="space-y-3">
                <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  {group}
                </div>
                {vars.map(microVar => (
                  <div key={microVar.id} className="space-y-1">
                    <div className="flex justify-between items-center">
                      <span className="text-xs text-muted-foreground">{microVar.label}</span>
                      <span className="text-xs font-mono text-foreground">{microVar.default}</span>
                    </div>
                    <Slider
                      value={[microVar.default]}
                      min={microVar.min}
                      max={microVar.max}
                      step={1}
                      className="w-full opacity-60"
                      disabled
                    />
                    <p className="text-[10px] text-muted-foreground/70">{microVar.description}</p>
                  </div>
                ))}
              </div>
            ))}
            <p className="text-xs text-muted-foreground italic">
              Micro vars are auto-derived from seed + macro vars in v2 mode.
            </p>
          </CollapsibleContent>
        </Collapsible>
        
        {/* Graphics Settings */}
        <div className="space-y-3 pt-2 border-t border-border">
          <div className="data-label flex items-center gap-2">
            <Settings2 className="w-3.5 h-3.5" />
            Graphics
          </div>

          <div className="flex items-center justify-between gap-3">
            <div className="space-y-0.5">
              <Label className="text-sm font-medium">Smooth Shading</Label>
              <p className="text-xs text-muted-foreground">
                Removes faceted/low-poly look from terrain.
              </p>
            </div>
            <Switch checked={smoothShading} onCheckedChange={toggleSmoothShading} />
          </div>

          <div className="flex items-center justify-between gap-3">
            <div className="space-y-0.5">
              <Label className="text-sm font-medium">Micro Detail</Label>
              <p className="text-xs text-muted-foreground">Subtle grain + roughness variation.</p>
            </div>
            <Switch checked={microDetailEnabled} onCheckedChange={toggleMicroDetail} />
          </div>

          <div className="flex items-center justify-between gap-3">
            <div className="space-y-0.5">
              <Label className="text-sm font-medium">Water Animation</Label>
              <p className="text-xs text-muted-foreground">Subtle wave movement.</p>
            </div>
            <Switch checked={waterAnimation} onCheckedChange={toggleWaterAnimation} />
          </div>

          <div className="flex items-center justify-between gap-3">
            <div className="space-y-0.5">
              <Label className="text-sm font-medium">Fog</Label>
              <p className="text-xs text-muted-foreground">Atmosphere + scale.</p>
            </div>
            <Switch checked={fogEnabled} onCheckedChange={toggleFog} />
          </div>

          <div className="flex items-center justify-between gap-3">
            <div className="space-y-0.5">
              <Label className="text-sm font-medium">Shadows</Label>
              <p className="text-xs text-muted-foreground">Contact depth (may cost FPS).</p>
            </div>
            <Switch checked={shadowsEnabled} onCheckedChange={toggleShadows} />
          </div>

          <div className="flex items-center justify-between gap-3">
            <div className="space-y-0.5">
              <Label className="text-sm font-medium">Rich Materials</Label>
              <p className="text-xs text-muted-foreground">
                PBR textures (disable for better perf).
              </p>
            </div>
            <Switch checked={materialRichness} onCheckedChange={toggleMaterialRichness} />
          </div>
        </div>

        {/* PostFX Settings */}
        <div className="space-y-3 pt-2 border-t border-border">
          <div className="data-label flex items-center gap-2">
            <Sparkles className="w-3.5 h-3.5" />
            Post-Processing
          </div>

          <div className="flex items-center justify-between gap-3">
            <div className="space-y-0.5">
              <Label className="text-sm font-medium">Bloom</Label>
              <p className="text-xs text-muted-foreground">Soft glow on bright areas.</p>
            </div>
            <Switch checked={postfxBloomEnabled} onCheckedChange={togglePostfxBloom} />
          </div>

          <div className="flex items-center justify-between gap-3">
            <div className="space-y-0.5">
              <Label className="text-sm font-medium">Vignette</Label>
              <p className="text-xs text-muted-foreground">Darkened edges for focus.</p>
            </div>
            <Switch checked={postfxVignetteEnabled} onCheckedChange={togglePostfxVignette} />
          </div>

          <div className="flex items-center justify-between gap-3">
            <div className="space-y-0.5">
              <Label className="text-sm font-medium">Outlines</Label>
              <p className="text-xs text-muted-foreground">Edge highlighting (Zelda-ish).</p>
            </div>
            <Switch checked={postfxOutlineEnabled} onCheckedChange={togglePostfxOutline} />
          </div>

          <div className="flex items-center justify-between gap-3">
            <div className="space-y-0.5">
              <Label className="text-sm font-medium">Film Grain</Label>
              <p className="text-xs text-muted-foreground">Subtle noise overlay.</p>
            </div>
            <Switch checked={postfxNoiseEnabled} onCheckedChange={togglePostfxNoise} />
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
