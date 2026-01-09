// Feature Naming Panel - Name geographic features
// One-time naming of peaks, rivers, regions, landmarks

import { useState } from 'react';
import { cn } from '@/lib/utils';
import { Mountain, Waves, MapPin, Landmark, Check, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { WorldFeature } from '@/lib/multiplayer/socialRegistry';
import { FeatureType } from '@/hooks/useWorldFeatures';
import { toast } from 'sonner';

interface FeatureNamingPanelProps {
  landFeatures: WorldFeature[];
  playerId: string | null;
  isFeatureNamed: (type: FeatureType) => boolean;
  getFeatureName: (type: FeatureType) => string | null;
  onNameFeature: (type: FeatureType, name: string) => Promise<boolean>;
  className?: string;
}

const FEATURE_TYPES: { type: FeatureType; label: string; icon: typeof Mountain }[] = [
  { type: 'peak', label: 'Peak', icon: Mountain },
  { type: 'river', label: 'River', icon: Waves },
  { type: 'region', label: 'Region', icon: MapPin },
  { type: 'landmark', label: 'Landmark', icon: Landmark }
];

export function FeatureNamingPanel({
  landFeatures,
  playerId,
  isFeatureNamed,
  getFeatureName,
  onNameFeature,
  className
}: FeatureNamingPanelProps) {
  const [editingType, setEditingType] = useState<FeatureType | null>(null);
  const [name, setName] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const handleSubmit = async () => {
    if (!editingType || !name.trim()) return;
    
    setIsSaving(true);
    const success = await onNameFeature(editingType, name.trim());
    setIsSaving(false);
    
    if (success) {
      toast.success(`Named this ${editingType}: "${name.trim()}"`);
      setName('');
      setEditingType(null);
    } else {
      toast.error('Failed to name feature - it may already be named');
    }
  };

  if (!playerId) {
    return (
      <div className={cn("text-xs text-muted-foreground italic", className)}>
        Log in to name features in this land.
      </div>
    );
  }

  return (
    <div className={cn("space-y-3", className)}>
      <h4 className="text-sm font-medium text-foreground">
        Name Geographic Features
      </h4>
      <p className="text-xs text-muted-foreground">
        Be the first to name a feature. Names are permanent.
      </p>

      <div className="grid grid-cols-2 gap-2">
        {FEATURE_TYPES.map(({ type, label, icon: Icon }) => {
          const existingName = getFeatureName(type);
          const isNamed = isFeatureNamed(type);
          
          return (
            <div key={type} className="space-y-1">
              {isNamed ? (
                <div className="flex items-center gap-2 p-2 rounded bg-secondary/50 border border-border/50">
                  <Icon className="w-4 h-4 text-primary" />
                  <div className="flex-1 min-w-0">
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wide">
                      {label}
                    </p>
                    <p className="text-xs font-medium text-foreground truncate">
                      {existingName}
                    </p>
                  </div>
                  <Check className="w-3 h-3 text-primary" />
                </div>
              ) : editingType === type ? (
                <div className="p-2 rounded bg-accent/10 border border-accent/30 space-y-2">
                  <div className="flex items-center gap-2">
                    <Icon className="w-4 h-4 text-accent" />
                    <span className="text-xs text-foreground">{label}</span>
                  </div>
                  <Input
                    placeholder={`Name this ${label.toLowerCase()}...`}
                    value={name}
                    onChange={(e) => setName(e.target.value.slice(0, 50))}
                    className="h-7 text-xs"
                    maxLength={50}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleSubmit();
                      if (e.key === 'Escape') {
                        setEditingType(null);
                        setName('');
                      }
                    }}
                    autoFocus
                  />
                  <div className="flex gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 text-[10px] flex-1"
                      onClick={() => {
                        setEditingType(null);
                        setName('');
                      }}
                    >
                      Cancel
                    </Button>
                    <Button
                      size="sm"
                      className="h-6 text-[10px] flex-1"
                      onClick={handleSubmit}
                      disabled={!name.trim() || isSaving}
                    >
                      {isSaving ? (
                        <Loader2 className="w-3 h-3 animate-spin" />
                      ) : (
                        'Name'
                      )}
                    </Button>
                  </div>
                </div>
              ) : (
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full h-auto py-2 justify-start"
                  onClick={() => setEditingType(type)}
                >
                  <Icon className="w-4 h-4 mr-2 text-muted-foreground" />
                  <span className="text-xs">Name {label}</span>
                </Button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
