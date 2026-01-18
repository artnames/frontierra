// Discovery Points HUD
// Displays current discovery points and cooldown status

import { Trophy, Clock, Sparkles } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { DiscoveryResult } from "@/lib/multiplayer/discoveryRegistry";

interface DiscoveryPointsHUDProps {
  points: number;
  canDiscover: boolean;
  cooldownTimeRemaining: string | null;
  lastResult: DiscoveryResult | null;
  onResultDismiss: () => void;
  isOwnLand: boolean;
}

export function DiscoveryPointsHUD({
  points,
  canDiscover,
  cooldownTimeRemaining,
  lastResult,
  onResultDismiss,
  isOwnLand
}: DiscoveryPointsHUDProps) {
  return (
    <div className="flex flex-col items-end gap-2">
      {/* Points display */}
      <div className="terminal-panel px-3 py-2 flex items-center gap-2 bg-background/90">
        <Trophy className="w-4 h-4 text-yellow-500" />
        <span className="text-sm font-mono font-bold">{points}</span>
        <span className="text-xs text-muted-foreground">pts</span>
      </div>

      {/* Discovery status - only show on other players' lands */}
      {!isOwnLand && (
        <div className="terminal-panel px-3 py-1.5 flex items-center gap-2 bg-background/90">
          {canDiscover ? (
            <>
              <Sparkles className="w-3.5 h-3.5 text-green-500" />
              <span className="text-xs text-green-500">Find the hidden object!</span>
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
                ? "bg-green-500/20 border-green-500/50" 
                : "bg-muted/90"
            }`}
          >
            <div className="flex items-center gap-3">
              {lastResult.success ? (
                <>
                  <div className="w-8 h-8 rounded-full bg-green-500/30 flex items-center justify-center">
                    <Sparkles className="w-5 h-5 text-green-400" />
                  </div>
                  <div>
                    <div className="text-sm font-bold text-green-400">
                      +{lastResult.pointsAwarded} Point!
                    </div>
                    <div className="text-xs text-green-300/80">
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
