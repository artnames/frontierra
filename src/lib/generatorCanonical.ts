// Canonical Generator Source Selector
// SINGLE ENTRY POINT for all world generation (Solo & Multiplayer, 2D & 3D)
// This ensures both the 2D map and 3D explorer use the exact same generator
// 
// CRITICAL: Both Solo and Multiplayer use WORLD_LAYOUT_SOURCE (the original V1 generator)
// The WORLD_A_LAYOUT_SOURCE has different VAR mappings and should NOT be used

import { WORLD_LAYOUT_SOURCE } from './worldGenerator';

// ============================================
// GENERATOR MODES
// ============================================

export type GeneratorMode = 'v1_unified';

export interface GeneratorContext {
  isMultiplayer: boolean;
  seed: number;
  vars: number[];
  worldX?: number;
  worldY?: number;
}

export interface CanonicalGeneratorResult {
  source: string;
  mode: GeneratorMode;
  sourceHash: string;
}

// ============================================
// SOURCE HASH (deterministic, stable)
// ============================================

function hashString(str: string): string {
  let hash = 5381;
  for (let i = 0; i < Math.min(str.length, 10000); i++) {
    hash = ((hash << 5) + hash) ^ str.charCodeAt(i);
    hash = hash >>> 0;
  }
  return hash.toString(16).padStart(8, '0').toUpperCase();
}

// Pre-computed hashes for known sources (for verification)
const SOURCE_HASHES = new Map<string, string>();

function getSourceHash(source: string): string {
  const cached = SOURCE_HASHES.get(source);
  if (cached) return cached;
  
  const hash = hashString(source);
  SOURCE_HASHES.set(source, hash);
  return hash;
}

// ============================================
// CANONICAL SOURCE SELECTOR
// UNIFIED: Both Solo and Multiplayer use the SAME V1 generator (WORLD_LAYOUT_SOURCE)
// This is the original working generator with proper VAR mappings
// ============================================

export function getCanonicalWorldLayoutSource(ctx: GeneratorContext): CanonicalGeneratorResult {
  // UNIFIED: Always use the original WORLD_LAYOUT_SOURCE for both modes
  // This ensures Solo keeps working and Multiplayer uses the same engine
  const source = WORLD_LAYOUT_SOURCE;
  
  return {
    source,
    mode: 'v1_unified',
    sourceHash: getSourceHash(source)
  };
}

// ============================================
// DEBUG INFO FOR OVERLAY
// ============================================

export interface GeneratorProofInfo {
  mode: GeneratorMode;
  sourceHash: string;
  isMultiplayer: boolean;
  waterLevel: number;
  biomeRichness: number;
}

export function getGeneratorProofInfo(
  ctx: GeneratorContext,
  resolvedWaterLevel: number,
  resolvedBiomeRichness: number
): GeneratorProofInfo {
  const { mode, sourceHash } = getCanonicalWorldLayoutSource(ctx);
  
  return {
    mode,
    sourceHash,
    isMultiplayer: ctx.isMultiplayer,
    waterLevel: resolvedWaterLevel,
    biomeRichness: resolvedBiomeRichness
  };
}

// ============================================
// UNIT TEST HELPERS
// ============================================

export function assertSameGenerator(
  ctx1: GeneratorContext,
  ctx2: GeneratorContext
): boolean {
  const result1 = getCanonicalWorldLayoutSource(ctx1);
  const result2 = getCanonicalWorldLayoutSource(ctx2);
  
  // Both should always use the same unified generator
  return result1.sourceHash === result2.sourceHash;
}
