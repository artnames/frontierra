// Mode Selection Cards - Multiplayer & Solo
// Premium game-UI styled cards with auth form embedded

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Users, Globe, ArrowRight, Mail, Lock, Loader2 } from 'lucide-react';

interface ModeCardsProps {
  onSoloMode: () => void;
  onLogin: (email: string, password: string) => Promise<void>;
  onSignUp: (email: string, password: string) => Promise<void>;
  isSubmitting: boolean;
  errors: { email?: string; password?: string };
  setErrors: (errors: { email?: string; password?: string }) => void;
}

type AuthMode = 'login' | 'signup';

export function ModeCards({ 
  onSoloMode, 
  onLogin, 
  onSignUp, 
  isSubmitting,
  errors,
  setErrors
}: ModeCardsProps) {
  const [authMode, setAuthMode] = useState<AuthMode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (authMode === 'login') {
      await onLogin(email, password);
    } else {
      await onSignUp(email, password);
    }
  };

  return (
    <div className="w-full max-w-4xl mx-auto px-4">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-6">
        {/* Multiplayer Card */}
        <div className="relative group rounded-2xl border border-primary/30 bg-gradient-to-br from-primary/10 via-primary/5 to-transparent backdrop-blur-sm overflow-hidden transition-all duration-300 hover:border-primary/50 hover:shadow-[0_0_60px_-15px_hsl(var(--primary)/0.4)]">
          {/* Glow effect */}
          <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
          
          <div className="relative z-10 p-6">
            {/* Header */}
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-xl bg-primary text-primary-foreground flex items-center justify-center shadow-lg shadow-primary/30">
                <Users className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-foreground font-sans">Multiplayer</h3>
                <p className="text-sm text-muted-foreground">Claim land. Build with others.</p>
              </div>
            </div>
            
            {/* Auth Mode Toggle */}
            <div className="flex bg-background/30 rounded-lg p-1 mb-5">
              <button
                type="button"
                onClick={() => setAuthMode('login')}
                className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-all duration-200 ${
                  authMode === 'login'
                    ? 'bg-primary text-primary-foreground shadow-md shadow-primary/25'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                Login
              </button>
              <button
                type="button"
                onClick={() => setAuthMode('signup')}
                className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-all duration-200 ${
                  authMode === 'signup'
                    ? 'bg-primary text-primary-foreground shadow-md shadow-primary/25'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                Sign Up
              </button>
            </div>
            
            {/* Auth Form */}
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email" className="text-xs flex items-center gap-2 text-muted-foreground">
                  <Mail className="w-3.5 h-3.5" />
                  Email
                </Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    if (errors.email) setErrors({ ...errors, email: undefined });
                  }}
                  placeholder="explorer@frontierra.world"
                  className={`bg-background/50 border-border/50 h-11 ${errors.email ? 'border-destructive' : ''}`}
                  disabled={isSubmitting}
                />
                {errors.email && <p className="text-xs text-destructive">{errors.email}</p>}
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="password" className="text-xs flex items-center gap-2 text-muted-foreground">
                  <Lock className="w-3.5 h-3.5" />
                  Password
                </Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    if (errors.password) setErrors({ ...errors, password: undefined });
                  }}
                  placeholder="••••••••"
                  className={`bg-background/50 border-border/50 h-11 ${errors.password ? 'border-destructive' : ''}`}
                  disabled={isSubmitting}
                />
                {errors.password && <p className="text-xs text-destructive">{errors.password}</p>}
              </div>
              
              <Button
                type="submit"
                disabled={isSubmitting}
                className="w-full h-12 text-sm font-semibold gap-2 bg-primary hover:bg-primary/90 shadow-lg shadow-primary/25 hover:shadow-primary/40 hover:scale-[1.02] transition-all duration-200"
              >
                {isSubmitting ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    {authMode === 'login' ? 'Enter Multiplayer' : 'Create Account'}
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </Button>
            </form>
          </div>
        </div>
        
        {/* Solo Mode Card */}
        <div className="relative group rounded-2xl border border-border bg-card/40 backdrop-blur-sm overflow-hidden transition-all duration-300 hover:border-primary/40 hover:bg-card/60">
          <div className="relative z-10 p-6 h-full flex flex-col">
            {/* Header */}
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-xl bg-muted text-foreground flex items-center justify-center">
                <Globe className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-foreground font-sans">Solo Mode</h3>
                <p className="text-sm text-muted-foreground">Instant exploration. No account needed.</p>
              </div>
            </div>
            
            {/* Features */}
            <div className="flex-1 space-y-3 mb-6">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <div className="w-1.5 h-1.5 rounded-full bg-primary/60" />
                <span>Jump straight into infinite worlds</span>
              </div>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <div className="w-1.5 h-1.5 rounded-full bg-primary/60" />
                <span>Customize Seed & VAR parameters</span>
              </div>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <div className="w-1.5 h-1.5 rounded-full bg-primary/60" />
                <span>Share reproducible world links</span>
              </div>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <div className="w-1.5 h-1.5 rounded-full bg-primary/60" />
                <span>No data stored — pure exploration</span>
              </div>
            </div>
            
            {/* CTA */}
            <Button
              onClick={onSoloMode}
              variant="outline"
              className="w-full h-12 text-sm font-semibold gap-2 border-border/50 hover:bg-primary/10 hover:border-primary/50 hover:scale-[1.02] transition-all duration-200"
            >
              Try Solo Mode
              <ArrowRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
