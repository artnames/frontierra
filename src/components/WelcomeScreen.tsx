// Welcome Screen - Premium Frontierra Landing Page
// Game-quality design with clear hierarchy and strong conversion

import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Users, Globe, Sparkles, ArrowRight, Map, Repeat, Grid3X3, ChevronDown } from 'lucide-react';
import frontierraLogo from '@/assets/frontierra-logo.png';

interface WelcomeScreenProps {
  onSelectMultiplayer: () => void;
  onSelectSolo: () => void;
  isAuthenticated: boolean;
}

const WELCOME_SEEN_KEY = 'frontierra-welcome-seen';

export function useWelcomeScreen() {
  const [showWelcome, setShowWelcome] = useState(false);
  
  useEffect(() => {
    const seen = sessionStorage.getItem(WELCOME_SEEN_KEY);
    if (!seen) {
      setShowWelcome(true);
    }
  }, []);
  
  const dismissWelcome = () => {
    sessionStorage.setItem(WELCOME_SEEN_KEY, 'true');
    setShowWelcome(false);
  };
  
  return { showWelcome, dismissWelcome };
}

function FeatureRow({ icon: Icon, label }: { icon: React.ElementType; label: string }) {
  return (
    <div className="flex items-center gap-2 text-muted-foreground">
      <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
        <Icon className="w-4 h-4 text-primary" />
      </div>
      <span className="text-sm">{label}</span>
    </div>
  );
}

function ModeCard({ 
  title, 
  description, 
  icon: Icon, 
  onClick, 
  variant = 'primary',
  buttonLabel 
}: { 
  title: string;
  description: string;
  icon: React.ElementType;
  onClick: () => void;
  variant?: 'primary' | 'secondary';
  buttonLabel: string;
}) {
  const isPrimary = variant === 'primary';
  
  return (
    <div 
      className={`
        relative group flex-1 min-w-[280px] p-6 rounded-xl border transition-all duration-300
        ${isPrimary 
          ? 'bg-gradient-to-br from-primary/15 via-primary/5 to-transparent border-primary/30 hover:border-primary/50 hover:shadow-[0_0_40px_-10px_hsl(var(--primary)/0.4)]' 
          : 'bg-card/50 border-border hover:border-primary/30 hover:bg-card/80'
        }
      `}
    >
      {/* Glow effect for primary */}
      {isPrimary && (
        <div className="absolute inset-0 rounded-xl bg-gradient-to-br from-primary/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
      )}
      
      <div className="relative z-10">
        <div className={`
          w-12 h-12 rounded-xl flex items-center justify-center mb-4
          ${isPrimary ? 'bg-primary text-primary-foreground' : 'bg-muted text-foreground'}
        `}>
          <Icon className="w-6 h-6" />
        </div>
        
        <h3 className="text-lg font-semibold text-foreground mb-2 font-sans">{title}</h3>
        <p className="text-sm text-muted-foreground mb-5 leading-relaxed">{description}</p>
        
        <Button
          onClick={onClick}
          variant={isPrimary ? 'default' : 'outline'}
          className={`
            w-full h-12 text-sm font-semibold gap-2 transition-all duration-200
            ${isPrimary 
              ? 'bg-primary hover:bg-primary/90 shadow-lg shadow-primary/25 hover:shadow-primary/40 hover:scale-[1.02]' 
              : 'hover:bg-primary/10 hover:border-primary/50 hover:scale-[1.02]'
            }
          `}
        >
          {buttonLabel}
          <ArrowRight className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
}

export function WelcomeScreen({ onSelectMultiplayer, onSelectSolo, isAuthenticated }: WelcomeScreenProps) {
  const learnMoreRef = useRef<HTMLDivElement>(null);
  
  const scrollToLearnMore = () => {
    learnMoreRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <div className="fixed inset-0 z-[100] bg-background overflow-y-auto">
      {/* Background effects */}
      <div className="fixed inset-0 pointer-events-none">
        {/* Grid pattern */}
        <div 
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage: `
              linear-gradient(hsl(var(--primary)/0.3) 1px, transparent 1px),
              linear-gradient(90deg, hsl(var(--primary)/0.3) 1px, transparent 1px)
            `,
            backgroundSize: '60px 60px',
          }}
        />
        {/* Radial glow behind hero */}
        <div 
          className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[600px]"
          style={{
            background: 'radial-gradient(ellipse at center, hsl(var(--primary)/0.12) 0%, transparent 70%)',
          }}
        />
        {/* Vignette */}
        <div 
          className="absolute inset-0"
          style={{
            background: 'radial-gradient(ellipse at center, transparent 40%, hsl(var(--background)) 100%)',
          }}
        />
      </div>

      {/* Content */}
      <div className="relative z-10 min-h-screen flex flex-col">
        {/* Hero Section */}
        <section className="flex-1 flex flex-col items-center justify-center px-6 py-16 text-center">
          {/* Logo */}
          <div className="mb-6 relative">
            <div 
              className="absolute inset-0 blur-3xl opacity-30"
              style={{ background: 'hsl(var(--primary))' }}
            />
            <img 
              src={frontierraLogo} 
              alt="Frontierra" 
              width="320" 
              height="128"
              fetchPriority="high"
              className="relative h-20 sm:h-28 object-contain drop-shadow-[0_0_30px_hsl(var(--primary)/0.4)]"
            />
          </div>
          
          {/* Title */}
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-foreground mb-4 font-sans tracking-tight">
            Frontierra
          </h1>
          
          {/* Subtitle */}
          <p className="text-lg sm:text-xl text-muted-foreground max-w-lg mb-10 leading-relaxed">
            Deterministic procedural worlds you can explore and claim.
          </p>
          
          {/* Mode Cards */}
          <div className="flex flex-col sm:flex-row gap-4 w-full max-w-2xl mb-12">
            <ModeCard
              title="Multiplayer"
              description="Go to your land, visit others, and build your legacy together."
              icon={Users}
              onClick={onSelectMultiplayer}
              variant="primary"
              buttonLabel={isAuthenticated ? 'Enter Multiplayer' : 'Join Multiplayer'}
            />
            <ModeCard
              title="Solo Mode"
              description="Instant exploration. No account needed. Dive in now."
              icon={Globe}
              onClick={onSelectSolo}
              variant="secondary"
              buttonLabel="Try Solo Mode"
            />
          </div>
          
          {/* Learn More Link */}
          <button
            onClick={scrollToLearnMore}
            className="flex flex-col items-center gap-1 text-muted-foreground hover:text-primary transition-colors group"
            aria-label="Learn more about Frontierra"
          >
            <span className="text-xs uppercase tracking-wider">Learn more</span>
            <ChevronDown className="w-4 h-4 animate-bounce" />
          </button>
        </section>

        {/* Feature Strip */}
        <section 
          ref={learnMoreRef}
          className="border-t border-border bg-card/30 backdrop-blur-sm py-12 px-6"
        >
          <div className="max-w-3xl mx-auto">
            <h2 className="text-sm uppercase tracking-wider text-muted-foreground mb-6 text-center font-sans">
              What is Frontierra?
            </h2>
            
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
              <FeatureRow icon={Sparkles} label="Deterministic generation" />
              <FeatureRow icon={Repeat} label="Seed-based replay" />
              <FeatureRow icon={Grid3X3} label="Infinite map tiles" />
            </div>
            
            {/* Stats strip */}
            <div className="mt-10 pt-8 border-t border-border/50 flex flex-wrap justify-center gap-8 text-center">
              <div>
                <div className="text-2xl font-bold text-primary font-sans">100</div>
                <div className="text-xs text-muted-foreground uppercase tracking-wider">Unique Lands</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-primary font-sans">∞</div>
                <div className="text-xs text-muted-foreground uppercase tracking-wider">Exploration</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-primary font-sans">1:1</div>
                <div className="text-xs text-muted-foreground uppercase tracking-wider">Seed Replay</div>
              </div>
            </div>
          </div>
        </section>

        {/* Footer */}
        <footer className="py-6 px-6 text-center border-t border-border/50">
          <p className="text-xs text-muted-foreground">
            Built with procedural love. Every world is mathematically unique.
          </p>
        </footer>
      </div>
    </div>
  );
}
