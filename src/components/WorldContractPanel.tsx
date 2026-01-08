import { useState, useMemo } from 'react';
import { AlertTriangle, Check, Copy, Hash, Layers, Shield } from 'lucide-react';
import { WorldData } from '@/lib/worldData';
import { 
  computeWorldHash, 
  WorldAction, 
  ActionResult,
  executeAction,
  PROTOCOL_INFO,
  DeterminismTest,
  runDeterminismTest
} from '@/lib/worldContract';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';

interface WorldContractPanelProps {
  world: WorldData;
  actions: WorldAction[];
  onDeterminismBreak?: (breakType: 'math_random' | 'date' | 'none') => void;
  deterministicTest?: DeterminismTest | null;
}

export function WorldContractPanel({ 
  world, 
  actions,
  onDeterminismBreak,
  deterministicTest
}: WorldContractPanelProps) {
  const { toast } = useToast();
  const [copied, setCopied] = useState<string | null>(null);
  
  const worldHash = useMemo(() => computeWorldHash(world), [world]);
  
  // Compute action results
  const actionResults = useMemo(() => {
    return actions.map((action, i) => {
      const prevActions = actions.slice(0, i);
      return executeAction(world, action, prevActions);
    });
  }, [world, actions]);
  
  const handleCopy = async (value: string, label: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(label);
      toast({ title: 'Copied', description: `${label} copied to clipboard` });
      setTimeout(() => setCopied(null), 2000);
    } catch (err) {
      toast({ title: 'Failed', description: 'Could not copy', variant: 'destructive' });
    }
  };
  
  const isInvalid = deterministicTest && !deterministicTest.isValid;
  
  return (
    <div className={`terminal-panel p-3 space-y-3 ${isInvalid ? 'border-destructive' : ''}`}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Shield className="w-4 h-4 text-primary" />
          <span className="text-xs font-display uppercase tracking-wider text-muted-foreground">
            World Contract
          </span>
        </div>
        <div className={`flex items-center gap-1 text-[10px] ${isInvalid ? 'text-destructive' : 'text-accent'}`}>
          {isInvalid ? (
            <>
              <AlertTriangle className="w-3 h-3" />
              INVALID
            </>
          ) : (
            <>
              <Check className="w-3 h-3" />
              VALID
            </>
          )}
        </div>
      </div>
      
      {/* Invalid Warning Banner */}
      {isInvalid && (
        <div className="bg-destructive/20 border border-destructive/50 rounded p-2">
          <div className="flex items-center gap-2 text-destructive text-xs font-bold">
            <AlertTriangle className="w-4 h-4" />
            WORLD INVALID — DETERMINISM BROKEN
          </div>
          <div className="text-[10px] text-destructive/80 mt-1">
            {deterministicTest.breakType === 'math_random' && 'Cause: Math.random() injection'}
            {deterministicTest.breakType === 'date' && 'Cause: Date.now() injection'}
          </div>
          <div className="text-[10px] text-muted-foreground mt-1 font-mono">
            Expected: {deterministicTest.expectedHash}
            <br />
            Actual: {deterministicTest.actualHash}
          </div>
        </div>
      )}
      
      {/* Contract Data */}
      <div className="space-y-2 text-[10px]">
        {/* Seed */}
        <ContractRow 
          label="SEED" 
          value={world.seed.toString()} 
          onCopy={() => handleCopy(world.seed.toString(), 'Seed')}
          copied={copied === 'Seed'}
        />
        
        {/* World Hash */}
        <ContractRow 
          label="WORLD_HASH" 
          value={worldHash}
          highlight
          onCopy={() => handleCopy(worldHash, 'Hash')}
          copied={copied === 'Hash'}
        />
        
        {/* VAR Array */}
        <div className="flex items-start justify-between">
          <span className="text-muted-foreground">VAR[0..9]</span>
          <div className="text-right font-mono text-secondary-foreground max-w-[140px] break-all">
            [{world.vars.join(',')}]
          </div>
        </div>
        
        {/* Object Position */}
        <ContractRow 
          label="OBJECT_POS" 
          value={`(${world.plantedObject.x}, ${world.plantedObject.y})`}
        />
        
        {/* Spawn Position */}
        <ContractRow 
          label="SPAWN_POS" 
          value={`(${world.spawnPoint.x.toFixed(0)}, ${world.spawnPoint.y.toFixed(0)})`}
        />
      </div>
      
      {/* Protocol Info */}
      <div className="border-t border-border pt-2 space-y-1 text-[10px]">
        <div className="flex items-center gap-1.5 text-muted-foreground">
          <Layers className="w-3 h-3" />
          <span>PROTOCOL</span>
        </div>
        <div className="grid grid-cols-2 gap-x-2 gap-y-0.5 text-[9px] pl-4">
          <span className="text-muted-foreground">Engine:</span>
          <span className="text-secondary-foreground">{PROTOCOL_INFO.name}</span>
          <span className="text-muted-foreground">Version:</span>
          <span className="text-secondary-foreground">v{PROTOCOL_INFO.version}</span>
          <span className="text-muted-foreground">SDK:</span>
          <span className="text-secondary-foreground">{PROTOCOL_INFO.sdk}</span>
          <span className="text-muted-foreground">Determinism:</span>
          <span className="text-accent">{PROTOCOL_INFO.determinism}</span>
        </div>
      </div>
      
      {/* Actions */}
      {actions.length > 0 && (
        <div className="border-t border-border pt-2 space-y-1">
          <div className="text-[10px] text-muted-foreground uppercase">Actions</div>
          {actions.map((action, i) => (
            <div key={i} className="text-[9px] font-mono bg-secondary/50 rounded p-1.5">
              <div className="flex justify-between">
                <span className="text-primary">{action.type}</span>
                <span className={actionResults[i]?.success ? 'text-accent' : 'text-destructive'}>
                  {actionResults[i]?.success ? 'OK' : 'FAIL'}
                </span>
              </div>
              <div className="text-muted-foreground">
                @ ({action.gridX}, {action.gridY})
              </div>
              {actionResults[i]?.success && (
                <div className="text-secondary-foreground">
                  Result: {actionResults[i].hash}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
      
      {/* Stress Test Controls */}
      {onDeterminismBreak && (
        <div className="border-t border-border pt-2 space-y-1.5">
          <div className="text-[10px] text-muted-foreground uppercase">Stress Test</div>
          <div className="flex gap-1">
            <Button
              variant="outline"
              size="sm"
              onClick={() => onDeterminismBreak('none')}
              className="text-[9px] h-6 flex-1"
            >
              Reset
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => onDeterminismBreak('math_random')}
              className="text-[9px] h-6 flex-1 text-data-highlight border-data-highlight/30"
            >
              Math.random
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => onDeterminismBreak('date')}
              className="text-[9px] h-6 flex-1 text-data-highlight border-data-highlight/30"
            >
              Date.now
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

interface ContractRowProps {
  label: string;
  value: string;
  highlight?: boolean;
  onCopy?: () => void;
  copied?: boolean;
}

function ContractRow({ label, value, highlight, onCopy, copied }: ContractRowProps) {
  return (
    <div className="flex items-center justify-between group">
      <span className="text-muted-foreground">{label}</span>
      <div className="flex items-center gap-1">
        <span className={`font-mono ${highlight ? 'text-primary glow-text' : 'text-secondary-foreground'}`}>
          {value}
        </span>
        {onCopy && (
          <button 
            onClick={onCopy}
            className="opacity-0 group-hover:opacity-100 transition-opacity p-0.5"
          >
            {copied ? (
              <Check className="w-3 h-3 text-accent" />
            ) : (
              <Copy className="w-3 h-3 text-muted-foreground hover:text-primary" />
            )}
          </button>
        )}
      </div>
    </div>
  );
}
