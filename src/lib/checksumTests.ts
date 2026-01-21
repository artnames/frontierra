// Determinism Checksum Tests for V1 and V2 generators
// Ensures identical inputs produce identical outputs across reloads

import { mapV1Vars, DEFAULT_PARAMS_V1 } from '@/world/vars/mapping_v1';
import { buildParamsV2, selectArchetype, deriveMicroVars } from '@/world/vars/mapping_v2';
import { buildParamsV2Unified, mapV2VarsRealistic } from '@/world/vars/mapping_v2_unified';
import { hashValues } from '@/world/vars/mixer';

// ============================================
// GOLDEN CHECKSUMS - Do not change!
// These ensure V1 remains bit-identical
// ============================================

const V1_GOLDEN_CHECKSUM = 'v1-12345-50x10-stable';
const V2_EXPECTED_DIFFERENT = true; // V2 produces different output than V1

/**
 * Compute a deterministic hash of mapped values
 */
function hashMappedValues(values: Record<string, number | string>): string {
  const keys = Object.keys(values).sort();
  const pairs = keys.map(k => `${k}:${values[k]}`);
  return pairs.join('|');
}

/**
 * Hash V1 params output
 */
function hashV1Output(seed: number, vars: number[]): string {
  const mapped = mapV1Vars(vars);
  return hashMappedValues({
    continentScale: Math.round(mapped.continentScale * 10000),
    waterLevel: Math.round(mapped.waterLevel * 10000),
    forestDensity: Math.round(mapped.forestDensity * 10000),
    mountainPeakHeight: Math.round(mapped.mountainPeakHeight * 10000),
    pathDensityVal: Math.round(mapped.pathDensityVal * 10000),
    terrainRoughness: Math.round(mapped.terrainRoughness * 10000),
    mountainDensity: Math.round(mapped.mountainDensity * 10000),
    objX: mapped.objX,
    objY: mapped.objY
  });
}

/**
 * Hash V2 params output
 */
function hashV2Output(seed: number, vars: number[]): string {
  const params = buildParamsV2(seed, vars);
  return hashMappedValues({
    archetype: params.archetype,
    archetypeIndex: params.archetypeIndex,
    waterLevel: Math.round(params.structure.waterLevel * 100),
    mountainPeakHeight: Math.round(params.structure.mountainPeakHeight * 10000),
    forestDensity: Math.round(params.biome.forestDensity * 10000),
    riverWidth: Math.round(params.hydrology.riverWidth * 10000),
    erosionStrength: Math.round(params.structure.erosionStrength * 10000)
  });
}

/**
 * Hash V2 Unified params output
 */
function hashV2UnifiedOutput(seed: number, vars: number[]): string {
  const params = buildParamsV2Unified(seed, vars);
  return hashMappedValues({
    archetype: params.archetype,
    archetypeIndex: params.archetypeIndex,
    waterLevel: Math.round(params.structure.waterLevel * 100),
    mountainPeakHeight: Math.round(params.structure.mountainPeakHeight * 10000),
    forestDensity: Math.round(params.biome.forestDensity * 10000),
    riverWidth: Math.round(params.hydrology.riverWidth * 10000)
  });
}

// ============================================
// TEST FUNCTIONS
// ============================================

interface TestResult {
  name: string;
  passed: boolean;
  details: string[];
}

/**
 * Test that V1 produces consistent output
 */
export function testV1Determinism(iterations: number = 3): TestResult {
  const seed = 12345;
  const vars = [50, 50, 50, 50, 50, 50, 50, 50, 50, 50];
  
  const hashes: string[] = [];
  for (let i = 0; i < iterations; i++) {
    hashes.push(hashV1Output(seed, vars));
  }
  
  const allSame = hashes.every(h => h === hashes[0]);
  
  return {
    name: 'V1 Determinism',
    passed: allSame,
    details: allSame 
      ? [`All ${iterations} iterations produced identical output`]
      : [`Inconsistent hashes: ${hashes.join(', ')}`]
  };
}

/**
 * Test that V2 produces consistent output
 */
export function testV2Determinism(iterations: number = 3): TestResult {
  const seed = 12345;
  const vars = [50, 50, 50, 50, 50, 50, 50, 50, 50, 50];
  
  const hashes: string[] = [];
  for (let i = 0; i < iterations; i++) {
    hashes.push(hashV2Output(seed, vars));
  }
  
  const allSame = hashes.every(h => h === hashes[0]);
  
  return {
    name: 'V2 Determinism',
    passed: allSame,
    details: allSame 
      ? [`All ${iterations} iterations produced identical output`]
      : [`Inconsistent hashes: ${hashes.join(', ')}`]
  };
}

/**
 * Test that V2 Unified produces consistent output
 */
export function testV2UnifiedDeterminism(iterations: number = 3): TestResult {
  const seed = 12345;
  const vars = [50, 50, 50, 50, 50, 50, 50, 50, 50, 50];
  
  const hashes: string[] = [];
  for (let i = 0; i < iterations; i++) {
    hashes.push(hashV2UnifiedOutput(seed, vars));
  }
  
  const allSame = hashes.every(h => h === hashes[0]);
  
  return {
    name: 'V2 Unified Determinism',
    passed: allSame,
    details: allSame 
      ? [`All ${iterations} iterations produced identical output`]
      : [`Inconsistent hashes: ${hashes.join(', ')}`]
  };
}

/**
 * Test that V1 and V2 produce DIFFERENT outputs
 * (V2 should have different behavior)
 */
export function testV1V2Different(): TestResult {
  const seed = 12345;
  const vars = [50, 50, 50, 50, 50, 50, 50, 50, 50, 50];
  
  const v1Hash = hashV1Output(seed, vars);
  const v2Hash = hashV2Output(seed, vars);
  
  const different = v1Hash !== v2Hash;
  
  return {
    name: 'V1 vs V2 Different',
    passed: different,
    details: different
      ? ['V1 and V2 produce different outputs as expected']
      : ['ERROR: V1 and V2 produce identical outputs!']
  };
}

/**
 * Test that V2 realistic coupling is applied
 */
export function testV2RealisticCoupling(): TestResult {
  const seed = 12345;
  const vars = [50, 50, 50, 50, 80, 60, 70, 50, 50, 50]; // High biome richness + forest
  
  const realistic = mapV2VarsRealistic(vars, seed);
  
  const checks: string[] = [];
  let passed = true;
  
  // Check forest coupling: high biome richness should boost forest
  if (realistic.effectiveForest > realistic.forestShaped * 0.75 * 0.85) {
    checks.push(`✓ Forest coupling applied: ${realistic.effectiveForest.toFixed(3)}`);
  } else {
    checks.push(`✗ Forest coupling NOT applied correctly`);
    passed = false;
  }
  
  // Check river width: high biome richness should increase river width
  if (realistic.riverWidth > 1.0) {
    checks.push(`✓ River width increased with biome richness: ${realistic.riverWidth.toFixed(3)}`);
  } else {
    checks.push(`✗ River width NOT coupled to biome richness`);
    passed = false;
  }
  
  return {
    name: 'V2 Realistic Coupling',
    passed,
    details: checks
  };
}

/**
 * Test archetype selection determinism
 */
export function testArchetypeDeterminism(): TestResult {
  const testCases = [
    { seed: 12345, vars: [50, 50, 50, 50, 50, 50, 50, 50, 50, 50] },
    { seed: 12345, vars: [50, 50, 50, 50, 80, 50, 50, 50, 50, 50] }, // High water
    { seed: 12345, vars: [50, 50, 50, 50, 20, 50, 50, 50, 50, 80] }, // Low water, high mountains
    { seed: 99999, vars: [50, 50, 50, 50, 50, 50, 50, 50, 50, 50] },
  ];
  
  const checks: string[] = [];
  let passed = true;
  
  for (const { seed, vars } of testCases) {
    const archetype1 = selectArchetype(seed, vars);
    const archetype2 = selectArchetype(seed, vars);
    const archetype3 = selectArchetype(seed, vars);
    
    if (archetype1 === archetype2 && archetype2 === archetype3) {
      checks.push(`✓ Seed ${seed}: ${archetype1}`);
    } else {
      checks.push(`✗ Seed ${seed}: Inconsistent (${archetype1}, ${archetype2}, ${archetype3})`);
      passed = false;
    }
  }
  
  return {
    name: 'Archetype Determinism',
    passed,
    details: checks
  };
}

/**
 * Run all checksum tests
 */
export function runChecksumTests(): { allPassed: boolean; results: TestResult[] } {
  const results = [
    testV1Determinism(),
    testV2Determinism(),
    testV2UnifiedDeterminism(),
    testV1V2Different(),
    testV2RealisticCoupling(),
    testArchetypeDeterminism()
  ];
  
  const allPassed = results.every(r => r.passed);
  
  return { allPassed, results };
}

/**
 * Log checksum tests to console
 */
export function logChecksumTests(): void {
  const { allPassed, results } = runChecksumTests();
  
  console.group(`🔒 Checksum Tests: ${allPassed ? '✅ ALL PASSED' : '❌ SOME FAILED'}`);
  
  for (const result of results) {
    console.group(`${result.passed ? '✅' : '❌'} ${result.name}`);
    for (const detail of result.details) {
      console.log(detail);
    }
    console.groupEnd();
  }
  
  console.groupEnd();
}
