// Presence Hint - Subtle presence indicator
// Shows who has been here and when

import { cn } from '@/lib/utils';
import { Ghost } from 'lucide-react';

interface PresenceHintProps {
  message: string | null;
  className?: string;
}

export function PresenceHint({ message, className }: PresenceHintProps) {
  if (!message) return null;

  return (
    <div 
      className={cn(
        "flex items-center gap-2 px-3 py-2 rounded-lg",
        "bg-muted/30 border border-border/30 backdrop-blur-sm",
        "text-sm text-muted-foreground italic",
        "animate-in fade-in-0 slide-in-from-top-2 duration-500",
        className
      )}
    >
      <Ghost className="w-4 h-4 opacity-60" />
      <span>{message}</span>
    </div>
  );
}
