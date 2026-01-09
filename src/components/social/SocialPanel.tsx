// Social Panel - Main container for all social features
// Integrates presence, notes, and feature naming

import { cn } from '@/lib/utils';
import { PlayerLand } from '@/lib/multiplayer/types';
import { PresenceHint } from './PresenceHint';
import { LandNotesPanel } from './LandNotesPanel';
import { FeatureNamingPanel } from './FeatureNamingPanel';
import { useSocialPresence } from '@/hooks/useSocialPresence';
import { useLandNotes } from '@/hooks/useLandNotes';
import { useWorldFeatures } from '@/hooks/useWorldFeatures';
import { Separator } from '@/components/ui/separator';
import { Users } from 'lucide-react';

interface SocialPanelProps {
  playerId: string | null;
  currentLand: PlayerLand | null;
  className?: string;
}

export function SocialPanel({
  playerId,
  currentLand,
  className
}: SocialPanelProps) {
  const { presenceMessage } = useSocialPresence({
    playerId,
    currentLand,
    enabled: !!currentLand
  });

  const {
    notes,
    myNote,
    isLoading: notesLoading,
    showNotes,
    setShowNotes,
    createNote,
    removeNote,
    isNoteFaded
  } = useLandNotes({
    playerId,
    currentLand,
    enabled: !!currentLand
  });

  const {
    landFeatures,
    isFeatureNamed,
    getFeatureName,
    createFeatureName
  } = useWorldFeatures({
    playerId,
    currentLand,
    enabled: !!currentLand
  });

  if (!currentLand) {
    return (
      <div className={cn("text-sm text-muted-foreground italic", className)}>
        Enter a land to see social features.
      </div>
    );
  }

  return (
    <div className={cn("space-y-4", className)}>
      {/* Header */}
      <div className="flex items-center gap-2">
        <Users className="w-4 h-4 text-muted-foreground" />
        <h3 className="text-sm font-semibold text-foreground">Social</h3>
      </div>

      {/* Presence hint */}
      <PresenceHint message={presenceMessage} />

      <Separator className="bg-border/50" />

      {/* Land notes */}
      <LandNotesPanel
        notes={notes}
        myNote={myNote}
        showNotes={showNotes}
        isLoading={notesLoading}
        playerId={playerId}
        onToggleShow={setShowNotes}
        onCreateNote={createNote}
        onDeleteNote={removeNote}
        isNoteFaded={isNoteFaded}
      />

      <Separator className="bg-border/50" />

      {/* Feature naming */}
      <FeatureNamingPanel
        landFeatures={landFeatures}
        playerId={playerId}
        isFeatureNamed={isFeatureNamed}
        getFeatureName={getFeatureName}
        onNameFeature={createFeatureName}
      />
    </div>
  );
}
