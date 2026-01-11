// V2 Mapping - New var mixer with regimes, cross-coupling, and derived fields
// Produces significantly more structural variety while maintaining determinism

import { 
  ALL_VARS, 
  TOTAL_VAR_COUNT, 
  getDefaultVars, 
  clampVars,
  VarDefinition
} from './schema';
import { 
  hashValues, 
  seededRandom, 
  seededRandomN,
  seededRandomRange,
  seededRandomInt,
  smoothstep,
  smootherstep,
  powerCurve,
  easeInOut,
  mapVar,
  mapRange,
  normalizeVar,
  blendVars,
  applyInfluence,
  threshold,
  inverseThreshold
} from './mixer';
import { WorldParamsV1, mapV1Vars, DEFAULT_PARAMS_V1 } from './mapping_v1';

// ============================================
// V2 WORLD PARAMS
// ============================================

export type MappingVersion = 'v1' | 'v2';

export interface WorldParamsV2 {
  seed: number;
  macroVars: number[];           // 10 user-facing vars
  microVars: number[];           // 25 advanced vars (can be auto-derived or overridden)
  microOverrides: Set<number>;   // Indices of manually overridden micro vars
  mappingVersion: MappingVersion;
  worldArchetype: WorldArchetype;
}

// Full resolved params for generation
export interface ResolvedWorldParams {
  seed: number;
  vars: number[];                // Full 35-var array
  mappingVersion: MappingVersion;
  archetype: WorldArchetype;
  archetypeIndex: number;
  
  // Computed structural values
  structure: StructuralParams;
  hydrology: HydrologyParams;
  biome: BiomeParams;
  detail: DetailParams;
  placement: PlacementParams;
}

// ============================================
// WORLD ARCHETYPES - Regime switching
// ============================================

export type WorldArchetype = 
  | 'plateau'       // Flat highlands with steep edges
  | 'basin'         // Lowland surrounded by mountains
  | 'ridged'        // Long mountain ridges dividing regions
  | 'fractured'     // Broken terrain with many small features
  | 'archipelago'   // Many islands and water channels
  | 'coastal'       // Large landmass with detailed coastline
  | 'highlands';    // Rolling hills and mountains throughout

export const ARCHETYPES: WorldArchetype[] = [
  'plateau',
  'basin',
  'ridged',
  'fractured',
  'archipelago',
  'coastal',
  'highlands'
];

export interface ArchetypeProfile {
  id: WorldArchetype;
  name: string;
  description: string;
  
  // Base modifiers applied to params
  waterLevelMod: number;       // -30 to +30 applied to water level
  mountainHeightMod: number;   // Multiplier 0.5 to 2.0
  mountainDensityMod: number;  // Multiplier 0.3 to 2.0
  coastlineComplexity: number; // 0-100 base value
  plateauTendency: number;     // 0-100
  valleyDepth: number;         // 0-100
  erosionStrength: number;     // 0-100
}

export const ARCHETYPE_PROFILES: Record<WorldArchetype, ArchetypeProfile> = {
  plateau: {
    id: 'plateau',
    name: 'Plateau',
    description: 'Flat highlands with dramatic cliff edges',
    waterLevelMod: -15,
    mountainHeightMod: 0.6,
    mountainDensityMod: 1.5,
    coastlineComplexity: 30,
    plateauTendency: 90,
    valleyDepth: 20,
    erosionStrength: 30
  },
  basin: {
    id: 'basin',
    name: 'Basin',
    description: 'Central lowland ringed by mountains',
    waterLevelMod: 10,
    mountainHeightMod: 1.3,
    mountainDensityMod: 0.8,
    coastlineComplexity: 40,
    plateauTendency: 20,
    valleyDepth: 80,
    erosionStrength: 60
  },
  ridged: {
    id: 'ridged',
    name: 'Ridged',
    description: 'Long mountain chains dividing regions',
    waterLevelMod: -5,
    mountainHeightMod: 1.5,
    mountainDensityMod: 0.6,
    coastlineComplexity: 50,
    plateauTendency: 40,
    valleyDepth: 60,
    erosionStrength: 50
  },
  fractured: {
    id: 'fractured',
    name: 'Fractured',
    description: 'Broken terrain with many varied features',
    waterLevelMod: 0,
    mountainHeightMod: 1.0,
    mountainDensityMod: 1.2,
    coastlineComplexity: 80,
    plateauTendency: 30,
    valleyDepth: 70,
    erosionStrength: 80
  },
  archipelago: {
    id: 'archipelago',
    name: 'Archipelago',
    description: 'Islands and water channels throughout',
    waterLevelMod: 25,
    mountainHeightMod: 0.8,
    mountainDensityMod: 0.5,
    coastlineComplexity: 95,
    plateauTendency: 50,
    valleyDepth: 40,
    erosionStrength: 40
  },
  coastal: {
    id: 'coastal',
    name: 'Coastal',
    description: 'Large landmass with detailed shoreline',
    waterLevelMod: 5,
    mountainHeightMod: 1.1,
    mountainDensityMod: 0.7,
    coastlineComplexity: 70,
    plateauTendency: 35,
    valleyDepth: 50,
    erosionStrength: 55
  },
  highlands: {
    id: 'highlands',
    name: 'Highlands',
    description: 'Rolling hills and mountains everywhere',
    waterLevelMod: -10,
    mountainHeightMod: 1.2,
    mountainDensityMod: 1.8,
    coastlineComplexity: 45,
    plateauTendency: 25,
    valleyDepth: 55,
    erosionStrength: 45
  }
};

// ============================================
// COMPUTED PARAMETER GROUPS
// ============================================

export interface StructuralParams {
  continentScale: number;
  waterLevel: number;
  mountainPeakHeight: number;
  mountainDensity: number;
  coastlineComplexity: number;
  cliffFrequency: number;
  plateauSize: number;
  valleyDepth: number;
  ridgeSharpness: number;
  erosionStrength: number;
}

export interface HydrologyParams {
  seaLevel: number;
  riverThreshold: number;
  riverWidth: number;
  lakeTendency: number;
  wetlandSpread: number;
  rainfallAmount: number;
}

export interface BiomeParams {
  forestDensity: number;
  biomePatchiness: number;
  treeVariety: number;
  undergrowthDensity: number;
  meadowFrequency: number;
  temperatureVariance: number;
  snowlineHeight: number;
}

export interface DetailParams {
  terrainRoughness: number;
  pathDensity: number;
  pathBranching: number;
  pathCurvature: number;
  rockFrequency: number;
  microElevation: number;
  surfaceTexture: number;
}

export interface PlacementParams {
  landmarkType: number;
  landmarkX: number;
  landmarkY: number;
  poiDensity: number;
  poiClustering: number;
  ruinFrequency: number;
  resourceDensity: number;
  spawnSafety: number;
}

// ============================================
// BUILD PARAMS - Core V2 function
// ============================================

/**
 * Deterministically select archetype from seed and macro vars
 */
export function selectArchetype(seed: number, macroVars: number[]): WorldArchetype {
  // Use a combination of seed and key vars to select archetype
  const waterLevel = macroVars[4] ?? 50;
  const mountainDensity = macroVars[9] ?? 50;
  
  // Weighted selection based on vars
  const archetypeHash = hashValues(seed, 'archetype', Math.floor(waterLevel / 20), Math.floor(mountainDensity / 20));
  const baseIndex = Math.abs(archetypeHash) % ARCHETYPES.length;
  
  // Bias towards certain archetypes based on vars
  if (waterLevel > 70) {
    // High water = more likely archipelago
    if (seededRandom(hashValues(seed, 'water-bias')) > 0.4) {
      return 'archipelago';
    }
  }
  
  if (mountainDensity > 75 && waterLevel < 40) {
    // High mountains, low water = highlands
    if (seededRandom(hashValues(seed, 'mtn-bias')) > 0.5) {
      return 'highlands';
    }
  }
  
  if (mountainDensity < 25 && waterLevel < 30) {
    // Low mountains, low water = plateau
    if (seededRandom(hashValues(seed, 'plateau-bias')) > 0.5) {
      return 'plateau';
    }
  }
  
  return ARCHETYPES[baseIndex];
}

/**
 * Derive micro vars from seed + macro vars
 * These provide additional detail while maintaining coherence
 */
export function deriveMicroVars(seed: number, macroVars: number[], archetype: WorldArchetype): number[] {
  const profile = ARCHETYPE_PROFILES[archetype];
  const microVars: number[] = [];
  
  // Helper to derive a value with influence from macro vars
  const derive = (index: number, baseValue: number, influences: [number, number][] = []): number => {
    // Start with seed-derived variation
    const seedVar = seededRandomRange(hashValues(seed, 'micro', index), -15, 15);
    let value = baseValue + seedVar;
    
    // Apply influences from macro vars
    for (const [macroIndex, weight] of influences) {
      value = applyInfluence(value, macroVars[macroIndex] ?? 50, weight);
    }
    
    return normalizeVar(value);
  };
  
  // Index 10: River threshold - influenced by water level
  microVars.push(derive(10, 50, [[4, 0.3]])); 
  
  // Index 11: River width - influenced by water level and roughness
  microVars.push(derive(11, 50, [[4, 0.2], [8, -0.15]]));
  
  // Index 12: Lake tendency - influenced by water level
  microVars.push(derive(12, profile.waterLevelMod > 10 ? 60 : 40, [[4, 0.4]]));
  
  // Index 13: Wetland spread - influenced by forest density
  microVars.push(derive(13, 50, [[5, 0.25]]));
  
  // Index 14: Erosion strength - from archetype
  microVars.push(derive(14, profile.erosionStrength));
  
  // Index 15: Coastline complexity - from archetype
  microVars.push(derive(15, profile.coastlineComplexity, [[4, 0.2]]));
  
  // Index 16: Cliff frequency - influenced by mountain height
  microVars.push(derive(16, 50, [[6, 0.4]]));
  
  // Index 17: Plateau size - from archetype
  microVars.push(derive(17, profile.plateauTendency, [[9, -0.2]]));
  
  // Index 18: Valley depth - from archetype
  microVars.push(derive(18, profile.valleyDepth, [[6, 0.2]]));
  
  // Index 19: Ridge sharpness - influenced by mountain height
  microVars.push(derive(19, 50, [[6, 0.5]]));
  
  // Index 20: Biome patchiness - influenced by roughness
  microVars.push(derive(20, 50, [[8, 0.3]]));
  
  // Index 21: Tree variety - influenced by forest density
  microVars.push(derive(21, 50, [[5, 0.35]]));
  
  // Index 22: Undergrowth density - influenced by forest density
  microVars.push(derive(22, 50, [[5, 0.4]]));
  
  // Index 23: Meadow frequency - inverse of forest density
  microVars.push(derive(23, inverseThreshold(macroVars[5] ?? 50, 30)));
  
  // Index 24: Temperature variance - influenced by mountain height
  microVars.push(derive(24, 50, [[6, 0.3]]));
  
  // Index 25: Path branching - influenced by path density
  microVars.push(derive(25, 50, [[7, 0.5]]));
  
  // Index 26: Path curvature - seed-derived
  microVars.push(derive(26, 50));
  
  // Index 27: Rock frequency - influenced by mountain density
  microVars.push(derive(27, 50, [[9, 0.4]]));
  
  // Index 28: Micro elevation - influenced by roughness
  microVars.push(derive(28, 50, [[8, 0.6]]));
  
  // Index 29: Surface texture - influenced by roughness
  microVars.push(derive(29, 50, [[8, 0.5]]));
  
  // Index 30: POI density - seed-derived with landmark influence
  microVars.push(derive(30, 50, [[0, 0.2]]));
  
  // Index 31: POI clustering
  microVars.push(derive(31, 50));
  
  // Index 32: Ruin frequency
  microVars.push(derive(32, 40, [[0, 0.3]]));
  
  // Index 33: Resource density
  microVars.push(derive(33, 50, [[5, 0.2]]));
  
  // Index 34: Spawn safety
  microVars.push(derive(34, 60, [[4, -0.2], [9, -0.15]]));
  
  return microVars;
}

/**
 * Build resolved params from seed + macro vars
 * This is the main entry point for V2 world generation
 */
export function buildParamsV2(
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
  
  // Derive micro vars
  let microVars = deriveMicroVars(seed, clampedMacro, archetype);
  
  // Apply any manual overrides
  if (microOverrides) {
    microOverrides.forEach((value, index) => {
      const microIndex = index - 10;
      if (microIndex >= 0 && microIndex < microVars.length) {
        microVars[microIndex] = normalizeVar(value);
      }
    });
  }
  
  // Combine into full vars array
  const vars = [...clampedMacro, ...microVars];
  
  // Compute structural params with non-linear curves
  const structure: StructuralParams = {
    continentScale: mapVar(vars[3], 0.02, 0.12, 'smooth'),
    waterLevel: normalizeVar(mapVar(vars[4], 10, 55) + profile.waterLevelMod * 0.55),
    mountainPeakHeight: mapVar(vars[6], 0.15, 1.0, 'power', 1.3) * profile.mountainHeightMod,
    mountainDensity: mapVar(vars[9], 0.02, 1.2, 'smooth') * profile.mountainDensityMod,
    coastlineComplexity: smoothstep(vars[15] / 100),
    cliffFrequency: mapVar(vars[16], 0, 1, 'smooth'),
    plateauSize: mapVar(vars[17], 0, 1),
    valleyDepth: mapVar(vars[18], 0, 1),
    ridgeSharpness: mapVar(vars[19], 0.3, 1.5, 'power', 1.5),
    erosionStrength: mapVar(vars[14], 0, 1)
  };
  
  // Compute hydrology params
  const hydrology: HydrologyParams = {
    seaLevel: structure.waterLevel / 100,
    riverThreshold: mapVar(vars[10], 0.01, 0.03),
    riverWidth: mapVar(vars[11], 0.5, 2.0),
    lakeTendency: mapVar(vars[12], 0, 1),
    wetlandSpread: mapVar(vars[13], 0.05, 0.25),
    rainfallAmount: blendVars([[vars[4], 0.6], [vars[13], 0.4]]) / 100
  };
  
  // Compute biome params
  const biome: BiomeParams = {
    forestDensity: mapVar(vars[5], 0.08, 0.90, 'smooth'),
    biomePatchiness: mapVar(vars[20], 0.02, 0.15),
    treeVariety: mapVar(vars[21], 0.3, 1.0),
    undergrowthDensity: mapVar(vars[22], 0.1, 0.8),
    meadowFrequency: mapVar(vars[23], 0.05, 0.5),
    temperatureVariance: mapVar(vars[24], 0.2, 1.0),
    snowlineHeight: 0.6 + (1 - vars[24] / 100) * 0.3
  };
  
  // Compute detail params  
  const detail: DetailParams = {
    terrainRoughness: mapVar(vars[8], 0.03, 1.8, 'power', 1.4),
    pathDensity: mapVar(vars[7], 0.0, 1.0),
    pathBranching: mapVar(vars[25], 0.1, 0.6),
    pathCurvature: mapVar(vars[26], 0.3, 1.2),
    rockFrequency: mapVar(vars[27], 0.05, 0.5),
    microElevation: mapVar(vars[28], 0.01, 0.1),
    surfaceTexture: mapVar(vars[29], 0.3, 1.0)
  };
  
  // Compute placement params
  const placement: PlacementParams = {
    landmarkType: Math.floor(mapVar(vars[0], 0, 6)),
    landmarkX: mapVar(vars[1], 4, 60),
    landmarkY: mapVar(vars[2], 4, 60),
    poiDensity: mapVar(vars[30], 0.02, 0.2),
    poiClustering: mapVar(vars[31], 0.1, 0.8),
    ruinFrequency: mapVar(vars[32], 0.01, 0.15),
    resourceDensity: mapVar(vars[33], 0.05, 0.3),
    spawnSafety: mapVar(vars[34], 0.3, 0.9)
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

// ============================================
// CONVERSION UTILITIES
// ============================================

/**
 * Convert V1 params to V2 format
 */
export function v1ToV2Params(v1: WorldParamsV1): WorldParamsV2 {
  const archetype = selectArchetype(v1.seed, v1.vars);
  const microVars = deriveMicroVars(v1.seed, v1.vars, archetype);
  
  return {
    seed: v1.seed,
    macroVars: [...v1.vars],
    microVars,
    microOverrides: new Set(),
    mappingVersion: 'v2',
    worldArchetype: archetype
  };
}

/**
 * Convert V2 params back to V1 format (for sharing with legacy clients)
 */
export function v2ToV1Params(v2: WorldParamsV2): WorldParamsV1 {
  return {
    seed: v2.seed,
    vars: v2.macroVars.slice(0, 10)
  };
}

/**
 * Resolve params - works with either V1 or V2
 */
export function resolveParams(
  seed: number,
  vars: number[],
  version: MappingVersion = 'v2'
): ResolvedWorldParams {
  if (version === 'v1' || vars.length === 10) {
    // V1 mode - use legacy mapping, derive micro vars
    const archetype = selectArchetype(seed, vars);
    const microVars = deriveMicroVars(seed, vars, archetype);
    const fullVars = [...vars.slice(0, 10), ...microVars];
    
    return buildParamsV2(seed, vars.slice(0, 10));
  }
  
  // V2 mode - use full vars
  return buildParamsV2(seed, vars.slice(0, 10), new Map(
    vars.slice(10).map((v, i) => [i + 10, v])
  ));
}

// ============================================
// DETERMINISTIC RANDOMIZE
// ============================================

/**
 * Deterministic randomize - generates new macro config from seed stream
 */
export function randomizeMacroVars(seed: number, streamId: string = 'vars-randomize:v1'): number[] {
  const streamSeed = hashValues(seed, streamId);
  
  return Array.from({ length: 10 }, (_, i) => {
    // Use non-uniform distribution for more interesting worlds
    const raw = seededRandomN(streamSeed, i);
    
    // Apply different curves to different vars
    let value: number;
    switch (i) {
      case 4: // Water level - bias toward middle
        value = 25 + raw * 50;
        break;
      case 6: // Mountain height - bias toward higher
        value = 20 + easeInOut(raw) * 80;
        break;
      case 9: // Mountain density - bias toward lower-mid
        value = raw * 70;
        break;
      default:
        value = raw * 100;
    }
    
    return normalizeVar(value);
  });
}

/**
 * Randomize seed value
 */
export function randomizeSeedV2(currentSeed: number): number {
  return hashValues(currentSeed, 'new-seed', Date.now ? 0 : 0) % 1000000;
}

// ============================================
// PRESETS
// ============================================

export interface WorldPreset {
  id: string;
  name: string;
  description: string;
  macroVars: number[];
  suggestedArchetype?: WorldArchetype;
}

export const WORLD_PRESETS: WorldPreset[] = [
  {
    id: 'balanced',
    name: 'Balanced',
    description: 'Well-rounded terrain with variety',
    macroVars: [50, 50, 50, 50, 50, 50, 50, 50, 50, 50]
  },
  {
    id: 'island_paradise',
    name: 'Island Paradise',
    description: 'Tropical islands with lush forests',
    macroVars: [30, 50, 50, 40, 75, 80, 30, 40, 30, 20],
    suggestedArchetype: 'archipelago'
  },
  {
    id: 'alpine_peaks',
    name: 'Alpine Peaks',
    description: 'Dramatic mountains with snow caps',
    macroVars: [50, 50, 50, 60, 25, 40, 95, 50, 60, 85],
    suggestedArchetype: 'highlands'
  },
  {
    id: 'rolling_meadows',
    name: 'Rolling Meadows',
    description: 'Gentle hills and open grasslands',
    macroVars: [40, 50, 50, 35, 30, 25, 20, 60, 25, 15],
    suggestedArchetype: 'plateau'
  },
  {
    id: 'dense_wilderness',
    name: 'Dense Wilderness',
    description: 'Thick forests with hidden paths',
    macroVars: [60, 50, 50, 50, 40, 95, 40, 25, 45, 30]
  },
  {
    id: 'river_delta',
    name: 'River Delta',
    description: 'Water-rich lowlands with channels',
    macroVars: [35, 50, 50, 45, 65, 55, 25, 45, 35, 25],
    suggestedArchetype: 'basin'
  },
  {
    id: 'rugged_frontier',
    name: 'Rugged Frontier',
    description: 'Harsh terrain with dramatic features',
    macroVars: [70, 50, 50, 70, 35, 35, 80, 30, 90, 70],
    suggestedArchetype: 'fractured'
  },
  {
    id: 'coastal_cliffs',
    name: 'Coastal Cliffs',
    description: 'Dramatic coastline with sea views',
    macroVars: [45, 50, 50, 55, 55, 45, 60, 55, 50, 40],
    suggestedArchetype: 'coastal'
  },
  {
    id: 'mystic_valley',
    name: 'Mystic Valley',
    description: 'Deep valleys surrounded by peaks',
    macroVars: [80, 50, 50, 40, 45, 65, 75, 40, 40, 45],
    suggestedArchetype: 'basin'
  },
  {
    id: 'ancient_plateau',
    name: 'Ancient Plateau',
    description: 'Flat highlands with steep edges',
    macroVars: [55, 50, 50, 30, 20, 50, 45, 55, 20, 60],
    suggestedArchetype: 'plateau'
  },
  {
    id: 'fjord_lands',
    name: 'Fjord Lands',
    description: 'Deep water channels between mountains',
    macroVars: [50, 50, 50, 65, 60, 55, 85, 35, 55, 50],
    suggestedArchetype: 'ridged'
  },
  {
    id: 'sparse_badlands',
    name: 'Sparse Badlands',
    description: 'Dry terrain with minimal vegetation',
    macroVars: [65, 50, 50, 80, 15, 10, 55, 20, 85, 55],
    suggestedArchetype: 'fractured'
  }
];

/**
 * Get preset by ID
 */
export function getPreset(id: string): WorldPreset | undefined {
  return WORLD_PRESETS.find(p => p.id === id);
}
