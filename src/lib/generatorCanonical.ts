// Canonical Generator Source Selector
// SINGLE ENTRY POINT for all world generation (Solo & Multiplayer, 2D & 3D)
// This ensures both the 2D map and 3D explorer use the exact same generator

import { WORLD_LAYOUT_SOURCE } from './worldGenerator';
import { WORLD_UNIFIED_LAYOUT_SOURCE_V2 } from './worldGeneratorUnified';

// ============================================
// GENERATOR MODES
// ============================================

export type GeneratorMode = 'v1_solo' | 'v1_worldA';

export interface GeneratorContext {
  isMultiplayer: boolean; // has worldContext
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
// This is the ONLY function that should select a generator source
// ============================================

export function getCanonicalWorldLayoutSource(ctx: GeneratorContext): CanonicalGeneratorResult {
  let source: string;
  let mode: GeneratorMode;
  
  if (ctx.isMultiplayer) {
    // Multiplayer: World A Unified source
    source = WORLD_UNIFIED_LAYOUT_SOURCE_V2;
    mode = 'v1_worldA';
  } else {
    // Solo: Legacy source
    source = WORLD_LAYOUT_SOURCE;
    mode = 'v1_solo';
  }
  
  return {
    source,
    mode,
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
  
  return result1.sourceHash === result2.sourceHash && result1.mode === result2.mode;
}
