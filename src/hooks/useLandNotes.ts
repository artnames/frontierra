// Land Notes Hook
// Manages asynchronous land notes (max 140 chars, 1 per player per land)

import { useState, useEffect, useCallback } from 'react';
import { PlayerLand } from '@/lib/multiplayer/types';
import {
  getNotesForLand,
  setLandNote,
  deleteNote,
  subscribeToNotes,
  LandNote
} from '@/lib/multiplayer/socialRegistry';

interface UseLandNotesOptions {
  playerId: string | null;
  currentLand: PlayerLand | null;
  enabled?: boolean;
}

export function useLandNotes({
  playerId,
  currentLand,
  enabled = true
}: UseLandNotesOptions) {
  const [notes, setNotes] = useState<LandNote[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showNotes, setShowNotes] = useState(true);

  // Check if note is older than 7 days (for visual fading)
  const isNoteFaded = useCallback((note: LandNote): boolean => {
    const created = new Date(note.created_at);
    const now = new Date();
    const diffDays = (now.getTime() - created.getTime()) / (1000 * 60 * 60 * 24);
    return diffDays > 7;
  }, []);

  // Get user's own note on this land
  const myNote = notes.find(n => n.author_id === playerId);

  // Fetch notes when land changes
  useEffect(() => {
    if (!currentLand || !enabled) {
      setNotes([]);
      return;
    }

    setIsLoading(true);
    getNotesForLand(currentLand.pos_x, currentLand.pos_y)
      .then(setNotes)
      .finally(() => setIsLoading(false));
  }, [currentLand?.pos_x, currentLand?.pos_y, enabled]);

  // Subscribe to real-time note updates
  useEffect(() => {
    if (!enabled || !currentLand) return;

    const unsubscribe = subscribeToNotes((note, event) => {
      // Only handle notes for current land
      if (note.world_x !== currentLand.pos_x || note.world_y !== currentLand.pos_y) {
        return;
      }

      switch (event) {
        case 'INSERT':
          setNotes(prev => [note, ...prev.filter(n => n.id !== note.id)]);
          break;
        case 'UPDATE':
          setNotes(prev => prev.map(n => n.id === note.id ? note : n));
          break;
        case 'DELETE':
          setNotes(prev => prev.filter(n => n.id !== note.id));
          break;
      }
    });

    return unsubscribe;
  }, [enabled, currentLand?.pos_x, currentLand?.pos_y]);

  // Create or update a note
  const createNote = useCallback(async (message: string): Promise<boolean> => {
    if (!playerId || !currentLand) return false;

    const note = await setLandNote(
      playerId,
      currentLand.pos_x,
      currentLand.pos_y,
      message
    );

    if (note) {
      setNotes(prev => {
        // Replace existing note from same author or add new
        const filtered = prev.filter(n => n.author_id !== playerId);
        return [note, ...filtered];
      });
      return true;
    }

    return false;
  }, [playerId, currentLand]);

  // Delete own note
  const removeNote = useCallback(async (): Promise<boolean> => {
    if (!playerId || !myNote) return false;

    const success = await deleteNote(playerId, myNote.id);
    if (success) {
      setNotes(prev => prev.filter(n => n.id !== myNote.id));
    }
    return success;
  }, [playerId, myNote]);

  return {
    notes,
    myNote,
    isLoading,
    showNotes,
    setShowNotes,
    createNote,
    removeNote,
    isNoteFaded
  };
}
