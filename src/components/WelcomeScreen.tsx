// Welcome Screen - First-time visitor onboarding
// Shows once per session/device to encourage multiplayer adoption

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Users, Globe, Sparkles, ArrowRight } from 'lucide-react';
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
    // Check if user has seen welcome screen this session
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

export function WelcomeScreen({ onSelectMultiplayer, onSelectSolo, isAuthenticated }: WelcomeScreenProps) {
  return (
    <div className="fixed inset-0 z-[100] bg-background flex items-center justify-center p-4">
      <div className="max-w-md w-full text-center">
        {/* Logo */}
        <div className="mb-8 flex justify-center">
          <img 
            src={frontierraLogo} 
            alt="Frontierra" 
            className="h-24 object-contain drop-shadow-[0_0_20px_hsl(var(--primary)/0.3)]"
          />
        </div>
        
        {/* Tagline */}
        <p className="text-muted-foreground mb-8 text-sm">
          Explore infinite procedural worlds. Claim your land. Build your legacy.
        </p>
        
        {/* Primary CTA - Multiplayer */}
        <Button
          size="lg"
          className="w-full mb-3 gap-2 h-14 text-base font-semibold"
          onClick={onSelectMultiplayer}
        >
          <Users className="w-5 h-5" />
          {isAuthenticated ? 'Enter Multiplayer' : 'Join Multiplayer'}
          <ArrowRight className="w-4 h-4 ml-auto" />
        </Button>
        
        <p className="text-xs text-muted-foreground mb-4">
          {isAuthenticated 
            ? 'Go to your land or explore others' 
            : 'Sign up to claim your own land'}
        </p>
        
        {/* Divider */}
        <div className="flex items-center gap-3 my-6">
          <div className="flex-1 h-px bg-border" />
          <span className="text-xs text-muted-foreground">or</span>
          <div className="flex-1 h-px bg-border" />
        </div>
        
        {/* Secondary CTA - Solo */}
        <Button
          variant="outline"
          size="lg"
          className="w-full gap-2 h-12"
          onClick={onSelectSolo}
        >
          <Globe className="w-4 h-4" />
          Try Solo Mode
        </Button>
        
        <p className="text-xs text-muted-foreground mt-2">
          No account needed — explore freely
        </p>
        
        {/* Features hint */}
        <div className="mt-8 pt-6 border-t border-border">
          <div className="flex items-center justify-center gap-6 text-xs text-muted-foreground">
            <div className="flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-primary" />
              <span>Deterministic worlds</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Users className="w-3.5 h-3.5 text-primary" />
              <span>100 unique lands</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
