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
              width={400} 
              height={160}
              loading="eager"
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
