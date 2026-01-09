// Land Notes Panel - Create and view notes on a land
// Max 140 chars, 1 note per player per land

import { useState } from 'react';
import { cn } from '@/lib/utils';
import { MessageSquarePlus, Eye, EyeOff, Send, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { LandNoteCard } from './LandNoteCard';
import { LandNote } from '@/lib/multiplayer/socialRegistry';
import { toast } from 'sonner';

interface LandNotesPanelProps {
  notes: LandNote[];
  myNote: LandNote | undefined;
  showNotes: boolean;
  isLoading: boolean;
  playerId: string | null;
  onToggleShow: (show: boolean) => void;
  onCreateNote: (message: string) => Promise<boolean>;
  onDeleteNote: () => Promise<boolean>;
  isNoteFaded: (note: LandNote) => boolean;
  className?: string;
}

export function LandNotesPanel({
  notes,
  myNote,
  showNotes,
  isLoading,
  playerId,
  onToggleShow,
  onCreateNote,
  onDeleteNote,
  isNoteFaded,
  className
}: LandNotesPanelProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [message, setMessage] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const handleSubmit = async () => {
    if (!message.trim()) return;
    
    setIsSaving(true);
    const success = await onCreateNote(message.trim());
    setIsSaving(false);
    
    if (success) {
      toast.success('Note left on this land');
      setMessage('');
      setIsEditing(false);
    } else {
      toast.error('Failed to leave note');
    }
  };

  const handleDelete = async () => {
    const success = await onDeleteNote();
    if (success) {
      toast.success('Note removed');
    } else {
      toast.error('Failed to remove note');
    }
  };

  const canLeaveNote = playerId && !myNote;

  return (
    <div className={cn("space-y-3", className)}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-medium text-foreground flex items-center gap-2">
          <MessageSquarePlus className="w-4 h-4" />
          Land Notes
          {notes.length > 0 && (
            <span className="text-xs text-muted-foreground">({notes.length})</span>
          )}
        </h4>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 px-2"
          onClick={() => onToggleShow(!showNotes)}
        >
          {showNotes ? (
            <EyeOff className="w-4 h-4" />
          ) : (
            <Eye className="w-4 h-4" />
          )}
        </Button>
      </div>

      {showNotes && (
        <>
          {/* Leave a note */}
          {canLeaveNote && !isEditing && (
            <Button
              variant="outline"
              size="sm"
              className="w-full justify-start text-muted-foreground"
              onClick={() => setIsEditing(true)}
            >
              <MessageSquarePlus className="w-4 h-4 mr-2" />
              Leave a note here...
            </Button>
          )}

          {isEditing && (
            <div className="space-y-2">
              <Textarea
                placeholder="Leave a note for others who pass through..."
                value={message}
                onChange={(e) => setMessage(e.target.value.slice(0, 140))}
                className="min-h-[80px] text-sm resize-none"
                maxLength={140}
              />
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">
                  {message.length}/140
                </span>
                <div className="flex gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setIsEditing(false);
                      setMessage('');
                    }}
                  >
                    Cancel
                  </Button>
                  <Button
                    size="sm"
                    onClick={handleSubmit}
                    disabled={!message.trim() || isSaving}
                  >
                    {isSaving ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <>
                        <Send className="w-4 h-4 mr-1" />
                        Leave Note
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* Notes list */}
          {isLoading ? (
            <div className="flex items-center justify-center py-4">
              <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
            </div>
          ) : notes.length === 0 ? (
            <p className="text-xs text-muted-foreground italic py-2">
              No notes have been left here yet.
            </p>
          ) : (
            <div className="space-y-2 max-h-[200px] overflow-y-auto">
              {notes.map((note) => (
                <LandNoteCard
                  key={note.id}
                  note={note}
                  isMine={note.author_id === playerId}
                  isFaded={isNoteFaded(note)}
                  onDelete={note.author_id === playerId ? handleDelete : undefined}
                />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
