// V2 Unified Mapping - Realistic variable interactions with coupling
// This extends the base V2 mapping with more realistic parameter interactions
// MUST NOT change V1 behavior - mapV1Vars() remains untouched

import { 
  hashValues, 
  seededRandom, 
  seededRandomRange,
  smoothstep,
  powerCurve,
  mapVar,
  normalizeVar,
  blendVars,
  applyInfluence
} from './mixer';
import type { WorldArchetype, ResolvedWorldParams } from './mapping_v2';
import { ARCHETYPE_PROFILES, ARCHETYPES, selectArchetype } from './mapping_v2';

// ============================================
// V2 UNIFIED REALISTIC VARIABLE MAPPINGS
// Non-linear curves + cross-coupling for believable worlds
// ============================================

export interface V2RealisticParams {
  // Shaped base values
  terrainDetailShaped: number;
  biomeRichnessShaped: number;
  forestShaped: number;
  mountainShaped: number;
  pathShaped: number;
  roughnessShaped: number;
  mountainDensityShaped: number;
  visualStyleShaped: number;
  
  // Coupled outputs
  effectiveForest: number;
  effectiveMountainSteepness: number;
  effectivePathWear: number;
  effectiveMoistureBias: number;
  
  // V2 derived controls
  riverWidth: number;
  riverContinuity: number;
  riverBankLift: number;
  coastBuffer: number;
  pathWidth: number;
}

/**
 * Map V2 vars with realistic interactions
 * Uses shaped values (smoothstep/pow) and cross-coupling
 * 
 * @param macroVars - 10 user-facing vars [0-100]
 * @param seed - World seed for derived values
 * @returns Realistic parameter set with coupling applied
 */
export function mapV2VarsRealistic(macroVars: number[], seed: number): V2RealisticParams {
  // Ensure we have 10 vars
  const vars = macroVars.slice(0, 10).map(v => normalizeVar(v ?? 50));
  while (vars.length < 10) vars.push(50);
  
  // ============================================
  // SHAPED VALUES - Non-linear curves
  // ============================================
  
  // Smoothstep for more natural midpoint behavior
  const terrainDetailRaw = vars[3] / 100;
  const terrainDetailShaped = smoothstep(terrainDetailRaw);
  
  const biomeRichnessRaw = vars[4] / 100;
  const biomeRichnessShaped = smoothstep(biomeRichnessRaw);
  
  const forestRaw = vars[5] / 100;
  const forestShaped = smoothstep(forestRaw);
  
  // Power curve emphasizes high values for mountains
  const mountainRaw = vars[6] / 100;
  const mountainShaped = powerCurve(mountainRaw, 1.3);
  
  const pathRaw = vars[7] / 100;
  const pathShaped = smoothstep(pathRaw);
  
  const roughnessRaw = vars[8] / 100;
  const roughnessShaped = powerCurve(roughnessRaw, 1.4);
  
  const mountainDensityRaw = vars[9] / 100;
  const mountainDensityShaped = smoothstep(mountainDensityRaw);
  
  const visualStyleRaw = vars[9] / 100;
  const visualStyleShaped = visualStyleRaw;
  
  // ============================================
  // COUPLED OUTPUTS - Realistic interactions
  // ============================================
  
  // Forest influenced by biome richness
  // Richer biomes = slightly more forest potential
  const forestMultiplier = 0.85 + biomeRichnessShaped * 0.30;
  const effectiveForest = (0.10 + forestShaped * 0.75) * forestMultiplier;
  
  // Mountain steepness influenced by terrain detail
  // More detailed terrain = slightly steeper mountains
  const steepnessMultiplier = 0.95 + terrainDetailShaped * 0.15;
  const effectiveMountainSteepness = (0.20 + mountainShaped * 0.80) * steepnessMultiplier;
  
  // Path wear influenced by visual style
  // Different styles affect path appearance
  const pathWearMultiplier = 0.9 + visualStyleShaped * 0.2;
  const effectivePathWear = (0.5 + pathShaped * 1.5) * pathWearMultiplier;
  
  // Moisture bias from biome richness
  // Richer biomes tend to be wetter
  const effectiveMoistureBias = -0.08 + biomeRichnessShaped * 0.20;
  
  // ============================================
  // V2 DERIVED CONTROLS
  // These are computed from existing vars + seed
  // ============================================
  
  // River width: influenced by biome richness (wetter = wider rivers)
  const riverWidth = 0.8 + biomeRichnessShaped * 1.2 + seededRandomRange(hashValues(seed, 'river-width'), -0.2, 0.2);
  
  // River continuity: how connected rivers are (higher = fewer breaks)
  const riverContinuity = 0.5 + biomeRichnessShaped * 0.3 + seededRandomRange(hashValues(seed, 'river-cont'), 0, 0.15);
  
  // River bank lift: slight elevation at riverbanks
  const riverBankLift = 0.03 + forestShaped * 0.05;
  
  // Coast buffer: how far mountains stay from coasts
  const coastBuffer = 1.5 + (1 - mountainDensityShaped) * 2.0;
  
  // Path width: influenced by path density
  const pathWidth = 0.8 + pathShaped * 0.8;
  
  return {
    terrainDetailShaped,
    biomeRichnessShaped,
    forestShaped,
    mountainShaped,
    pathShaped,
    roughnessShaped,
    mountainDensityShaped,
    visualStyleShaped,
    effectiveForest,
    effectiveMountainSteepness,
    effectivePathWear,
    effectiveMoistureBias,
    riverWidth,
    riverContinuity,
    riverBankLift,
    coastBuffer,
    pathWidth
  };
}

/**
 * Derive V2 micro vars with realistic coupling
 * Extended version with more derived controls
 */
export function deriveV2MicroVarsUnified(
  seed: number, 
  macroVars: number[], 
  archetype: WorldArchetype
): number[] {
  const profile = ARCHETYPE_PROFILES[archetype];
  const realistic = mapV2VarsRealistic(macroVars, seed);
  const microVars: number[] = [];
  
  // Helper to derive a value with seed variation and influence
  const derive = (index: number, baseValue: number, influences: [number, number][] = []): number => {
    const seedVar = seededRandomRange(hashValues(seed, 'micro-v2', index), -12, 12);
    let value = baseValue + seedVar;
    
    for (const [macroIndex, weight] of influences) {
      value = applyInfluence(value, macroVars[macroIndex] ?? 50, weight);
    }
    
    return normalizeVar(value);
  };
  
  // Index 0: River width (coupled to biome richness)
  microVars.push(normalizeVar(realistic.riverWidth * 40 + 20));
  
  // Index 1: River continuity (coupled to biome richness)
  microVars.push(normalizeVar(realistic.riverContinuity * 100));
  
  // Index 2: River bank lift
  microVars.push(normalizeVar(realistic.riverBankLift * 500 + 20));
  
  // Index 3: Coast buffer (coupled to mountain density)
  microVars.push(normalizeVar(realistic.coastBuffer * 25));
  
  // Index 4: Path width (coupled to path density)
  microVars.push(normalizeVar(realistic.pathWidth * 50 + 10));
  
  // Index 5: Erosion strength - from archetype
  microVars.push(derive(5, profile.erosionStrength, [[8, 0.2]]));
  
  // Index 6: Coastline complexity - from archetype
  microVars.push(derive(6, profile.coastlineComplexity, [[4, 0.15]]));
  
  // Index 7: Cliff frequency - influenced by mountain height
  microVars.push(derive(7, 50, [[6, 0.4]]));
  
  // Index 8: Plateau size - from archetype
  microVars.push(derive(8, profile.plateauTendency, [[9, -0.15]]));
  
  // Index 9: Valley depth - from archetype
  microVars.push(derive(9, profile.valleyDepth, [[6, 0.2]]));
  
  // Index 10: Ridge sharpness - influenced by mountain height
  microVars.push(derive(10, 50, [[6, 0.45]]));
  
  // Index 11: Lake tendency - influenced by water level
  microVars.push(derive(11, profile.waterLevelMod > 10 ? 60 : 40, [[4, 0.35]]));
  
  // Index 12: Wetland spread - influenced by forest density
  microVars.push(derive(12, 50, [[5, 0.25]]));
  
  // Index 13: Snowline offset - influenced by mountain height
  microVars.push(derive(13, 50, [[6, 0.3]]));
  
  return microVars;
}

/**
 * Build resolved params for V2 Unified mode
 * Uses realistic coupling and derives world context for Solo
 */
export function buildParamsV2Unified(
  seed: number,
  macroVars: number[],
  microOverrides?: Map<number, number>
): ResolvedWorldParams {
  // Clamp macro vars
  const clampedMacro = macroVars.slice(0, 10).map(v => normalizeVar(v ?? 50));
  while (clampedMacro.length < 10) clampedMacro.push(50);
  
  // Select archetype
  const archetype = selectArchetype(seed, clampedMacro);
  const profile = ARCHETYPE_PROFILES[archetype];
  const archetypeIndex = ARCHETYPES.indexOf(archetype);
  
  // Derive micro vars with V2 unified coupling
  let microVars = deriveV2MicroVarsUnified(seed, clampedMacro, archetype);
  
  // Apply any manual overrides
  if (microOverrides) {
    microOverrides.forEach((value, index) => {
      const microIndex = index - 10;
      if (microIndex >= 0 && microIndex < microVars.length) {
        microVars[microIndex] = normalizeVar(value);
      }
    });
  }
  
  // Get realistic mapped values
  const realistic = mapV2VarsRealistic(clampedMacro, seed);
  
  // Combine into full vars array
  const vars = [...clampedMacro, ...microVars];
  
  // Build resolved params using realistic values
  const structure = {
    continentScale: mapVar(vars[3], 0.02, 0.12, 'smooth'),
    waterLevel: normalizeVar(mapVar(vars[4], 10, 55) + profile.waterLevelMod * 0.55),
    mountainPeakHeight: realistic.effectiveMountainSteepness * profile.mountainHeightMod,
    mountainDensity: realistic.mountainDensityShaped * profile.mountainDensityMod,
    coastlineComplexity: smoothstep(microVars[6] / 100),
    cliffFrequency: mapVar(microVars[7], 0, 1, 'smooth'),
    plateauSize: mapVar(microVars[8], 0, 1),
    valleyDepth: mapVar(microVars[9], 0, 1),
    ridgeSharpness: mapVar(microVars[10], 0.3, 1.5, 'power', 1.5),
    erosionStrength: mapVar(microVars[5], 0, 1)
  };
  
  const hydrology = {
    seaLevel: structure.waterLevel / 100,
    riverThreshold: 0.02,
    riverWidth: realistic.riverWidth,
    lakeTendency: mapVar(microVars[11], 0, 1),
    wetlandSpread: mapVar(microVars[12], 0.05, 0.25),
    rainfallAmount: blendVars([[vars[4], 0.6], [microVars[12], 0.4]]) / 100
  };
  
  const biome = {
    forestDensity: realistic.effectiveForest,
    biomePatchiness: 0.06,
    treeVariety: 0.6,
    undergrowthDensity: 0.4,
    meadowFrequency: 0.2,
    temperatureVariance: 0.5,
    snowlineHeight: 0.6 + mapVar(microVars[13], -0.1, 0.2)
  };
  
  const detail = {
    terrainRoughness: realistic.roughnessShaped * 1.5,
    pathDensity: realistic.pathShaped,
    pathBranching: 0.3,
    pathCurvature: 0.6,
    rockFrequency: 0.2,
    microElevation: 0.05,
    surfaceTexture: 0.6
  };
  
  const placement = {
    landmarkType: Math.floor(mapVar(vars[0], 0, 6)),
    landmarkX: mapVar(vars[1], 4, 60),
    landmarkY: mapVar(vars[2], 4, 60),
    poiDensity: 0.1,
    poiClustering: 0.5,
    ruinFrequency: 0.05,
    resourceDensity: 0.15,
    spawnSafety: 0.7
  };
  
  return {
    seed,
    vars,
    mappingVersion: 'v2',
    archetype,
    archetypeIndex,
    structure,
    hydrology,
    biome,
    detail,
    placement
  };
}
