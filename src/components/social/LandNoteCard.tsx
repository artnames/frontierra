// Land Note Card - Displays a single note left on a land
// Fades visually after 7 days

import { cn } from '@/lib/utils';
import { MessageSquare, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { LandNote } from '@/lib/multiplayer/socialRegistry';
import { formatDistanceToNow } from 'date-fns';

interface LandNoteCardProps {
  note: LandNote;
  isMine: boolean;
  isFaded: boolean;
  onDelete?: () => void;
  className?: string;
}

export function LandNoteCard({ 
  note, 
  isMine, 
  isFaded, 
  onDelete,
  className 
}: LandNoteCardProps) {
  const timeAgo = formatDistanceToNow(new Date(note.created_at), { addSuffix: true });

  return (
    <div 
      className={cn(
        "group relative p-3 rounded-lg",
        "bg-secondary/50 border border-border/50",
        "transition-all duration-300",
        isFaded && "opacity-40",
        isMine && "border-primary/30 bg-primary/5",
        className
      )}
    >
      <div className="flex items-start gap-2">
        <MessageSquare className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-sm text-foreground break-words">
            {note.message}
          </p>
          <p className="text-[10px] text-muted-foreground mt-1">
            {isMine ? 'You' : 'Someone'} • {timeAgo}
          </p>
        </div>
        {isMine && onDelete && (
          <Button
            variant="ghost"
            size="icon"
            className="w-6 h-6 opacity-0 group-hover:opacity-100 transition-opacity"
            onClick={onDelete}
          >
            <Trash2 className="w-3 h-3 text-destructive" />
          </Button>
        )}
      </div>
    </div>
  );
}
