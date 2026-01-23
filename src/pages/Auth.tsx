// Cinematic Landing + Auth Page
// Premium "open world" hero with Solo Mode, Seed+VAR storytelling, and multiplayer login

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { z } from 'zod';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { HeroBackground, AmbientCanvas } from '@/components/landing/HeroBackground';
import { ModeCards } from '@/components/landing/ModeCards';
import { SeedVarExplainer } from '@/components/landing/SeedVarExplainer';
import { Sparkles, Map, Repeat, Grid3X3 } from 'lucide-react';
import frontierraLogo from '@/assets/frontierra-logo.png';

// Validation schemas
const emailSchema = z.string().email('Invalid email address');
const passwordSchema = z.string().min(6, 'Password must be at least 6 characters');

export default function Auth() {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});
  
  const { isAuthenticated, isLoading, signIn, signUp } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  // Redirect if already authenticated
  useEffect(() => {
    if (!isLoading && isAuthenticated) {
      navigate('/', { replace: true });
    }
  }, [isAuthenticated, isLoading, navigate]);

  const validateForm = (email: string, password: string): boolean => {
    const newErrors: { email?: string; password?: string } = {};
    
    const emailResult = emailSchema.safeParse(email);
    if (!emailResult.success) {
      newErrors.email = emailResult.error.errors[0].message;
    }
    
    const passwordResult = passwordSchema.safeParse(password);
    if (!passwordResult.success) {
      newErrors.password = passwordResult.error.errors[0].message;
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleLogin = async (email: string, password: string) => {
    if (!validateForm(email, password)) return;
    
    setIsSubmitting(true);
    try {
      const { error } = await signIn(email, password);
      
      if (error) {
        if (error.message.includes('Invalid login credentials')) {
          toast({
            title: 'Login failed',
            description: 'Invalid email or password. Please try again.',
            variant: 'destructive'
          });
        } else {
          toast({
            title: 'Login failed',
            description: error.message,
            variant: 'destructive'
          });
        }
      } else {
        toast({
          title: 'Welcome back!',
          description: 'Successfully logged in'
        });
        navigate('/', { replace: true });
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSignUp = async (email: string, password: string) => {
    if (!validateForm(email, password)) return;
    
    setIsSubmitting(true);
    try {
      const { error } = await signUp(email, password);
      
      if (error) {
        if (error.message.includes('already registered')) {
          toast({
            title: 'Account exists',
            description: 'This email is already registered. Try logging in instead.',
            variant: 'destructive'
          });
        } else {
          toast({
            title: 'Signup failed',
            description: error.message,
            variant: 'destructive'
          });
        }
      } else {
        toast({
          title: 'Welcome to Frontierra!',
          description: 'Your account has been created'
        });
        navigate('/', { replace: true });
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSoloMode = () => {
    // Navigate to main page in solo mode
    // Clear any session welcome flag so they see the main app
    sessionStorage.setItem('frontierra-welcome-seen', 'true');
    sessionStorage.setItem('frontierra-mode', 'solo');
    navigate('/', { replace: true });
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground overflow-x-hidden">
      {/* Cinematic Background */}
      <HeroBackground />
      <AmbientCanvas />
      
      {/* Content */}
      <div className="relative z-10 min-h-screen flex flex-col">
        {/* Hero Section */}
        <header className="pt-12 sm:pt-16 pb-8 px-6 text-center">
          {/* Logo with glow */}
          <div className="relative inline-block mb-6">
            <div 
              className="absolute inset-0 blur-3xl opacity-40"
              style={{ background: 'hsl(var(--primary))' }}
            />
            <img 
              src={frontierraLogo} 
              alt="Frontierra" 
              width="400" 
              height="160"
              fetchPriority="high"
              className="relative h-24 sm:h-32 lg:h-40 object-contain drop-shadow-[0_0_40px_hsl(var(--primary)/0.5)]"
            />
          </div>
          
          {/* Hook line */}
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-foreground mb-4 font-sans tracking-tight">
            Forge your world. <span className="text-primary">Claim your land.</span>
          </h1>
          
          {/* USP Bullets */}
          <div className="flex flex-wrap justify-center gap-4 sm:gap-6 text-sm text-muted-foreground max-w-2xl mx-auto">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-primary" />
              <span>Deterministic worlds from Seed + VAR</span>
            </div>
            <div className="flex items-center gap-2">
              <Grid3X3 className="w-4 h-4 text-primary" />
              <span>10×10 continent • each player owns one land</span>
            </div>
            <div className="flex items-center gap-2">
              <Repeat className="w-4 h-4 text-primary" />
              <span>Same Seed + VAR → same world, always</span>
            </div>
          </div>
        </header>
        
        {/* Mode Selection Cards */}
        <section className="py-8 sm:py-12">
          <ModeCards
            onSoloMode={handleSoloMode}
            onLogin={handleLogin}
            onSignUp={handleSignUp}
            isSubmitting={isSubmitting}
            errors={errors}
            setErrors={setErrors}
          />
        </section>
        
        {/* Seed + VAR Explainer */}
        <section className="py-8 sm:py-12">
          <SeedVarExplainer />
        </section>
        
        {/* Community Row */}
        <section className="py-8 px-6 border-t border-border/30">
          <div className="max-w-2xl mx-auto flex flex-wrap items-center justify-center gap-6">
            {/* Social Links */}
            <div className="flex items-center gap-4">
              <a
                href="https://discord.gg/lovable-dev"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-card/30 border border-border/30 text-muted-foreground hover:text-foreground hover:border-primary/30 transition-colors"
                aria-label="Join Discord"
              >
                <svg viewBox="0 0 24 24" className="w-5 h-5" fill="currentColor">
                  <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z"/>
                </svg>
                <span className="text-sm">Discord</span>
              </a>
              <a
                href="https://x.com/ArtNames_io"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-card/30 border border-border/30 text-muted-foreground hover:text-foreground hover:border-primary/30 transition-colors"
                aria-label="Follow on X"
              >
                <svg viewBox="0 0 24 24" className="w-5 h-5" fill="currentColor">
                  <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                </svg>
                <span className="text-sm">X / Twitter</span>
              </a>
            </div>
            
            {/* Stats */}
            <div className="flex items-center gap-6 text-center">
              <div>
                <div className="text-lg font-bold text-primary font-sans">100</div>
                <div className="text-xs text-muted-foreground">Unique Lands</div>
              </div>
              <div className="w-px h-8 bg-border/50" />
              <div>
                <div className="text-lg font-bold text-primary font-sans">∞</div>
                <div className="text-xs text-muted-foreground">Exploration</div>
              </div>
            </div>
          </div>
        </section>
        
        {/* Footer */}
        <footer className="mt-auto py-6 px-6 text-center border-t border-border/20">
          <p className="text-xs text-muted-foreground">
            Frontierra by <span className="text-primary">Nexart</span> — Every world is mathematically unique
          </p>
        </footer>
      </div>
    </div>
  );
}
