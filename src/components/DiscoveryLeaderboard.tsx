// Discovery Leaderboard
// Shows top 3 players + current player's rank

import { Trophy, Medal, Award, User } from "lucide-react";
import { cn } from "@/lib/utils";

export interface LeaderboardEntry {
  player_id: string;
  display_name: string | null;
  discovery_points: number;
  rank: number;
}

interface DiscoveryLeaderboardProps {
  topPlayers: LeaderboardEntry[];
  currentPlayer: LeaderboardEntry | null;
  playerId: string | null;
}

const getRankIcon = (rank: number) => {
  switch (rank) {
    case 1:
      return <Trophy className="w-3.5 h-3.5 text-yellow-500" />;
    case 2:
      return <Medal className="w-3.5 h-3.5 text-gray-400" />;
    case 3:
      return <Award className="w-3.5 h-3.5 text-amber-600" />;
    default:
      return <span className="text-xs font-mono text-muted-foreground w-3.5 text-center">#{rank}</span>;
  }
};

const formatName = (name: string | null, playerId: string, isCurrentPlayer: boolean): string => {
  if (isCurrentPlayer) return "You";
  if (name) return name.length > 12 ? name.slice(0, 10) + "…" : name;
  return playerId.slice(0, 6) + "…";
};

export function DiscoveryLeaderboard({
  topPlayers,
  currentPlayer,
  playerId
}: DiscoveryLeaderboardProps) {
  if (topPlayers.length === 0) {
    return null;
  }

  // Check if current player is already in top 3
  const isCurrentInTop3 = currentPlayer && currentPlayer.rank <= 3;
  
  // Display entries: top 3 + current player if not in top 3
  const displayEntries = isCurrentInTop3 
    ? topPlayers 
    : [...topPlayers, currentPlayer].filter(Boolean) as LeaderboardEntry[];

  return (
    <div className="terminal-panel px-3 py-2 bg-background/90 min-w-[140px]">
      <div className="flex items-center gap-1.5 mb-2 pb-1.5 border-b border-border/30">
        <Trophy className="w-3 h-3 text-yellow-500" />
        <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">
          Leaderboard
        </span>
      </div>
      
      <div className="space-y-1">
        {displayEntries.map((entry, index) => {
          const isCurrentPlayer = entry.player_id === playerId;
          const showDivider = !isCurrentInTop3 && index === topPlayers.length - 1 && currentPlayer;
          
          return (
            <div key={entry.player_id}>
              {showDivider && (
                <div className="border-t border-border/30 my-1.5" />
              )}
              <div
                className={cn(
                  "flex items-center gap-2 py-0.5 px-1 rounded-sm",
                  isCurrentPlayer && "bg-primary/10"
                )}
              >
                <div className="flex items-center justify-center w-4">
                  {getRankIcon(entry.rank)}
                </div>
                <span
                  className={cn(
                    "text-xs flex-1 truncate",
                    isCurrentPlayer ? "font-semibold text-primary" : "text-foreground/80"
                  )}
                >
                  {formatName(entry.display_name, entry.player_id, isCurrentPlayer)}
                </span>
                <span
                  className={cn(
                    "text-xs font-mono",
                    isCurrentPlayer ? "text-primary" : "text-muted-foreground"
                  )}
                >
                  {entry.discovery_points}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
