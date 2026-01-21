// Generator Proof Hook
// Provides real-time debug info about generator mode, water level, and river stats
// Sources data from actual pipeline objects

import { useMemo, useRef, useEffect } from 'react';
import { WorldData } from '@/lib/worldData';
import { getCanonicalWorldLayoutSource, GeneratorMode } from '@/lib/generatorCanonical';
import { mapV1Vars } from '@/world/vars/mapping_v1';
import { buildParamsV2 } from '@/world';

const DEV = import.meta.env.DEV;

export interface RiverDebugStats {
  riverCellCount: number;
  riverVertices: number;
  riverIndices: number;
}

export interface GeneratorProofData {
  mode: GeneratorMode;
  sourceHash: string;
  mappingVersion: 'v1' | 'v2';
  isMultiplayer: boolean;
  waterLevel: number;
  biomeRichness: number;
  microVars: number[];
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
  mappingVersion: 'v1' | 'v2',
  isMultiplayer: boolean,
  seed: number,
  vars: number[],
  microOverrides?: Map<number, number>
): GeneratorProofData {
  // Get canonical source info
  const canonicalResult = useMemo(() => {
    return getCanonicalWorldLayoutSource({
      mappingVersion,
      isMultiplayer,
      seed,
      vars,
      microOverrides
    });
  }, [mappingVersion, isMultiplayer, seed, vars, microOverrides]);
  
  // Compute water level based on mapping version
  const waterLevel = useMemo(() => {
    if (mappingVersion === 'v2') {
      // V2 uses fixed base + micro offset
      // Base is 0.10, MV[0] adds offset
      const v2Params = buildParamsV2(seed, vars, microOverrides);
      // Water level in V2 refinement is 0.10 + waterLevelOffset from MV[0]
      // MV[0] maps 0-100 to -0.08 to +0.08
      const mv0 = v2Params.vars[10] ?? 50;
      const offset = (mv0 / 100 - 0.5) * 0.16; // Maps 0-100 to -0.08..+0.08
      return Math.max(0.02, Math.min(0.55, 0.10 + offset));
    } else {
      // V1: VAR[4] directly maps to water level
      const v1Mapped = mapV1Vars(vars);
      return v1Mapped.waterLevel;
    }
  }, [mappingVersion, seed, vars, microOverrides]);
  
  // Compute biome richness
  const biomeRichness = useMemo(() => {
    return (vars[4] ?? 50) / 100;
  }, [vars]);
  
  // Get micro vars for display
  const microVars = useMemo(() => {
    if (mappingVersion === 'v2') {
      const v2Params = buildParamsV2(seed, vars, microOverrides);
      return v2Params.vars.slice(10, 13); // MV[0-2]
    }
    return [];
  }, [mappingVersion, seed, vars, microOverrides]);
  
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
    mappingVersion,
    isMultiplayer,
    waterLevel,
    biomeRichness,
    microVars,
    riverStats: {
      riverCellCount,
      riverVertices: globalRiverStats.riverVertices,
      riverIndices: globalRiverStats.riverIndices
    }
  };
}
