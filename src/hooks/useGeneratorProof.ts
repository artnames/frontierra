// Generator Proof Hook
// Provides real-time debug info about generator mode, water level, and river stats
// Sources data from actual pipeline objects

import { useMemo, useRef, useEffect } from 'react';
import { WorldData } from '@/lib/worldData';
import { getCanonicalWorldLayoutSource, GeneratorMode } from '@/lib/generatorCanonical';
import { mapV1Vars } from '@/world/vars/mapping_v1';

const DEV = import.meta.env.DEV;

export interface RiverDebugStats {
  riverCellCount: number;
  riverVertices: number;
  riverIndices: number;
}

export interface GeneratorProofData {
  mode: GeneratorMode;
  sourceHash: string;
  isMultiplayer: boolean;
  waterLevel: number;
  biomeRichness: number;
  riverStats: RiverDebugStats;
}

// Global registry for river geometry stats (set by EnhancedWaterPlane)
let globalRiverStats: RiverDebugStats = { riverCellCount: 0, riverVertices: 0, riverIndices: 0 };

export function setGlobalRiverStats(stats: RiverDebugStats) {
  globalRiverStats = stats;
  if (DEV) {
    console.debug('[useGeneratorProof] River stats updated:', stats);
  }
}

export function getGlobalRiverStats(): RiverDebugStats {
  return globalRiverStats;
}

/**
 * Count river cells in WorldData terrain grid
 */
export function countRiverCells(world: WorldData | null): number {
  if (!world?.terrain) return 0;
  
  let count = 0;
  for (const row of world.terrain) {
    if (!row) continue;
    for (const cell of row) {
      // River cells that aren't ocean water
      if (cell?.hasRiver && cell.type !== 'water') {
        count++;
      }
    }
  }
  return count;
}

/**
 * Hook to get generator proof data for the overlay
 */
export function useGeneratorProof(
  world: WorldData | null,
  isMultiplayer: boolean,
  seed: number,
  vars: number[],
  worldX: number = 0,
  worldY: number = 0
): GeneratorProofData {
  // Get canonical source info with worldX/worldY for unified generation proof
  const canonicalResult = useMemo(() => {
    return getCanonicalWorldLayoutSource({
      isMultiplayer,
      seed,
      vars,
      worldX,
      worldY
    });
  }, [isMultiplayer, seed, vars, worldX, worldY]);
  
  // Compute water level using V1 mapping
  const waterLevel = useMemo(() => {
    const v1Mapped = mapV1Vars(vars);
    return v1Mapped.waterLevel;
  }, [vars]);
  
  // Compute biome richness
  const biomeRichness = useMemo(() => {
    return (vars[4] ?? 50) / 100;
  }, [vars]);
  
  // Count river cells from world data
  const riverCellCount = useMemo(() => {
    return countRiverCells(world);
  }, [world]);
  
  // Use ref to track last known geometry stats (updated by EnhancedWaterPlane)
  const riverStatsRef = useRef<RiverDebugStats>({ riverCellCount: 0, riverVertices: 0, riverIndices: 0 });
  
  // Update river cell count whenever world changes
  useEffect(() => {
    riverStatsRef.current.riverCellCount = riverCellCount;
  }, [riverCellCount]);
  
  // Poll global stats (updated by EnhancedWaterPlane)
  useEffect(() => {
    const interval = setInterval(() => {
      const global = getGlobalRiverStats();
      riverStatsRef.current.riverVertices = global.riverVertices;
      riverStatsRef.current.riverIndices = global.riverIndices;
    }, 500);
    return () => clearInterval(interval);
  }, []);
  
  return {
    mode: canonicalResult.mode,
    sourceHash: canonicalResult.sourceHash,
    isMultiplayer,
    waterLevel,
    biomeRichness,
    riverStats: {
      riverCellCount,
      riverVertices: globalRiverStats.riverVertices,
      riverIndices: globalRiverStats.riverIndices
    }
  };
}
