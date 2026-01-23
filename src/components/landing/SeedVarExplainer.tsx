// Seed + VAR Interactive Explainer
// UI-only onboarding component - does NOT connect to generation

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Slider } from '@/components/ui/slider';
import { Shuffle, ChevronDown, ChevronUp, Sparkles, Hash, Sliders } from 'lucide-react';

const VAR_PREVIEWS = [
  { id: 'terrain', label: 'Terrain', color: 'hsl(var(--world-ground))' },
  { id: 'rivers', label: 'Rivers', color: 'hsl(var(--world-water))' },
  { id: 'forests', label: 'Forests', color: 'hsl(var(--world-forest))' },
  { id: 'biomes', label: 'Biomes', color: 'hsl(var(--accent))' },
  { id: 'contrast', label: 'Contrast', color: 'hsl(var(--primary))' },
];

export function SeedVarExplainer() {
  const [seed, setSeed] = useState('42');
  const [vars, setVars] = useState([50, 50, 50, 50, 50]);
  const [expanded, setExpanded] = useState(false);
  
  const randomizeSeed = () => {
    setSeed(String(Math.floor(Math.random() * 99999)));
  };
  
  const updateVar = (index: number, value: number) => {
    setVars(prev => {
      const next = [...prev];
      next[index] = value;
      return next;
    });
  };
  
  return (
    <section className="w-full max-w-2xl mx-auto px-4">
      <div className="bg-card/40 backdrop-blur-md border border-border/50 rounded-2xl p-6 sm:p-8">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-xl bg-primary/15 flex items-center justify-center">
            <Sparkles className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-foreground font-sans">Deterministic Worlds</h3>
            <p className="text-sm text-muted-foreground">Same Seed + VAR → Same world, always</p>
          </div>
        </div>
        
        {/* Seed Input */}
        <div className="mb-6">
          <label className="flex items-center gap-2 text-xs uppercase tracking-wider text-muted-foreground mb-2">
            <Hash className="w-3.5 h-3.5" />
            Seed
          </label>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Input
                type="text"
                value={seed}
                onChange={(e) => setSeed(e.target.value.replace(/\D/g, '').slice(0, 5))}
                placeholder="Enter seed..."
                className="bg-background/50 border-border/50 h-11 text-lg font-mono pr-12"
              />
            </div>
            <Button
              variant="outline"
              size="icon"
              onClick={randomizeSeed}
              className="h-11 w-11 shrink-0 hover:bg-primary/10 hover:border-primary/50 transition-all"
              aria-label="Randomize seed"
            >
              <Shuffle className="w-4 h-4" />
            </Button>
          </div>
        </div>
        
        {/* VAR Sliders */}
        <div className="mb-6">
          <label className="flex items-center gap-2 text-xs uppercase tracking-wider text-muted-foreground mb-4">
            <Sliders className="w-3.5 h-3.5" />
            Parameters (VAR)
          </label>
          <div className="space-y-4">
            {VAR_PREVIEWS.map((v, i) => (
              <div key={v.id} className="group">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-sm text-muted-foreground group-hover:text-foreground transition-colors">
                    {v.label}
                  </span>
                  <span className="text-xs font-mono text-primary/70">{vars[i]}</span>
                </div>
                <Slider
                  value={[vars[i]]}
                  onValueChange={([val]) => updateVar(i, val)}
                  max={100}
                  step={1}
                  className="cursor-pointer"
                />
              </div>
            ))}
          </div>
        </div>
        
        {/* Caption */}
        <p className="text-center text-sm text-muted-foreground mb-4">
          These parameters shape the world you'll enter.
        </p>
        
        {/* Learn More Expander */}
        <button
          onClick={() => setExpanded(!expanded)}
          className="w-full flex items-center justify-center gap-2 py-3 text-sm text-primary/80 hover:text-primary transition-colors border-t border-border/30"
          aria-expanded={expanded}
        >
          {expanded ? 'Hide details' : 'Learn more'}
          {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>
        
        {expanded && (
          <div className="pt-4 space-y-4 text-sm text-muted-foreground animate-fade-in">
            <div className="flex gap-3">
              <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                <Hash className="w-4 h-4 text-primary" />
              </div>
              <div>
                <span className="font-medium text-foreground">Seed</span>
                <p className="mt-1">The identity of the world. Each seed creates a unique landscape that anyone can revisit.</p>
              </div>
            </div>
            <div className="flex gap-3">
              <div className="w-8 h-8 rounded-lg bg-accent/10 flex items-center justify-center shrink-0 mt-0.5">
                <Sliders className="w-4 h-4 text-accent" />
              </div>
              <div>
                <span className="font-medium text-foreground">VAR</span>
                <p className="mt-1">Your parameters that shape style and biome balance — terrain height, river density, forest coverage, and more.</p>
              </div>
            </div>
            <div className="flex gap-3">
              <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                <Sparkles className="w-4 h-4 text-primary" />
              </div>
              <div>
                <span className="font-medium text-foreground">Determinism</span>
                <p className="mt-1">Same Seed + VAR always produces the exact same world. Reproducible, verifiable, eternal.</p>
              </div>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
