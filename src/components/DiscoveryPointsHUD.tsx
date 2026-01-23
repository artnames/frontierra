// Discovery Points HUD
// Displays current discovery points, cooldown status, and leaderboard

import { Clock, Sparkles } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { DiscoveryResult } from "@/lib/multiplayer/discoveryRegistry";
import { DiscoveryLeaderboard, LeaderboardEntry } from "./DiscoveryLeaderboard";

interface DiscoveryPointsHUDProps {
  points: number;
  canDiscover: boolean;
  cooldownTimeRemaining: string | null;
  lastResult: DiscoveryResult | null;
  onResultDismiss: () => void;
  isOwnLand: boolean;
  leaderboard?: LeaderboardEntry[];
  playerRank?: LeaderboardEntry | null;
  playerId?: string | null;
}

export function DiscoveryPointsHUD({
  points,
  canDiscover,
  cooldownTimeRemaining,
  lastResult,
  onResultDismiss,
  isOwnLand,
  leaderboard = [],
  playerRank = null,
  playerId = null
}: DiscoveryPointsHUDProps) {
  return (
    <div className="flex flex-col items-end gap-2">
      {/* Leaderboard */}
      <DiscoveryLeaderboard
        topPlayers={leaderboard}
        currentPlayer={playerRank}
        playerId={playerId}
      />

      {/* Discovery status - only show on other players' lands */}
      {!isOwnLand && (
        <div className="terminal-panel px-3 py-1.5 flex items-center gap-2 bg-background/90">
          {canDiscover ? (
            <>
              <Sparkles className="w-3.5 h-3.5 text-emerald-500" />
              <span className="text-xs text-emerald-500">Find the hidden object!</span>
            </>
          ) : cooldownTimeRemaining ? (
            <>
              <Clock className="w-3.5 h-3.5 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">
                Next discovery in {cooldownTimeRemaining}
              </span>
            </>
          ) : (
            <>
              <Clock className="w-3.5 h-3.5 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">Already discovered today</span>
            </>
          )}
        </div>
      )}

      {/* Discovery result toast */}
      <AnimatePresence>
        {lastResult && (
          <motion.div
            initial={{ opacity: 0, y: -20, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.95 }}
            onAnimationComplete={() => {
              // Auto-dismiss after 3 seconds
              setTimeout(onResultDismiss, 3000);
            }}
            className={`terminal-panel px-4 py-3 ${
              lastResult.success 
                ? "bg-emerald-500/20 border-emerald-500/50" 
                : "bg-muted/90"
            }`}
          >
            <div className="flex items-center gap-3">
              {lastResult.success ? (
                <>
                  <div className="w-8 h-8 rounded-full bg-emerald-500/30 flex items-center justify-center">
                    <Sparkles className="w-5 h-5 text-emerald-400" />
                  </div>
                  <div>
                    <div className="text-sm font-bold text-emerald-400">
                      +{lastResult.pointsAwarded} Point!
                    </div>
                    <div className="text-xs text-emerald-300/80">
                      Object discovered
                    </div>
                  </div>
                </>
              ) : (
                <>
                  <Clock className="w-5 h-5 text-muted-foreground" />
                  <div className="text-xs text-muted-foreground">
                    {lastResult.message}
                  </div>
                </>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
