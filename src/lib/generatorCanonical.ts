// Canonical Generator Source Selector
// SINGLE ENTRY POINT for all world generation (Solo & Multiplayer, 2D & 3D)
// This ensures both the 2D map and 3D explorer use the exact same generator

import { WORLD_LAYOUT_SOURCE } from './worldGenerator';
import { WORLD_UNIFIED_LAYOUT_SOURCE_V2 } from './worldGeneratorUnified';
import { WORLD_V2_REFINEMENT_SOURCE } from './worldGeneratorV2Refinement';

// ============================================
// GENERATOR MODES
// ============================================

export type GeneratorMode = 'v1_solo' | 'v1_worldA' | 'v2_refinement';

export interface GeneratorContext {
  mappingVersion: 'v1' | 'v2';
  isMultiplayer: boolean; // has worldContext
  seed: number;
  vars: number[];
  worldX?: number;
  worldY?: number;
  microOverrides?: Map<number, number>;
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
  const isV2 = ctx.mappingVersion === 'v2';
  
  let source: string;
  let mode: GeneratorMode;
  
  if (isV2) {
    // V2 mode: ALWAYS use refinement source (Solo & Multiplayer unified)
    source = WORLD_V2_REFINEMENT_SOURCE;
    mode = 'v2_refinement';
  } else if (ctx.isMultiplayer) {
    // V1 Multiplayer: World A Unified source
    source = WORLD_UNIFIED_LAYOUT_SOURCE_V2;
    mode = 'v1_worldA';
  } else {
    // V1 Solo: Legacy source
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
  mappingVersion: 'v1' | 'v2';
  isMultiplayer: boolean;
  waterLevel: number;
  biomeRichness: number;
  microVars: number[];
}

export function getGeneratorProofInfo(
  ctx: GeneratorContext,
  resolvedWaterLevel: number,
  resolvedBiomeRichness: number,
  microVars: number[]
): GeneratorProofInfo {
  const { mode, sourceHash } = getCanonicalWorldLayoutSource(ctx);
  
  return {
    mode,
    sourceHash,
    mappingVersion: ctx.mappingVersion,
    isMultiplayer: ctx.isMultiplayer,
    waterLevel: resolvedWaterLevel,
    biomeRichness: resolvedBiomeRichness,
    microVars: microVars.slice(0, 3) // MV[0-2] for display
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
