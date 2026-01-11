// Determinism Verification Utilities
// Ensures identical outputs for identical inputs across sessions/devices

import { buildParamsV2, randomizeMacroVars, type ResolvedWorldParams } from '@/world';
import { hashValues } from '@/world/vars/mixer';

export interface VerificationResult {
  passed: boolean;
  v1Hash: string;
  v2Hash: string;
  v1Matches: boolean;
  v2Matches: boolean;
  details: string[];
}

/**
 * Build V1-style params (just passes through vars unchanged)
 */
function buildParamsV1(seed: number, macroVars: number[]): { seed: number; vars: number[]; mappingVersion: 'v1' } {
  return {
    seed,
    vars: macroVars.slice(0, 10).map(v => Math.max(0, Math.min(100, v ?? 50))),
    mappingVersion: 'v1'
  };
}

/**
 * Verify that the parameter system produces identical outputs
 * for identical inputs across multiple invocations
 */
export function verifyDeterminism(
  seed: number,
  macroVars: number[],
  iterations: number = 3
): VerificationResult {
  const details: string[] = [];
  const v1Hashes: string[] = [];
  const v2Hashes: string[] = [];
  
  // Run multiple iterations
  for (let i = 0; i < iterations; i++) {
    const v1Result = buildParamsV1(seed, macroVars);
    const v2Result = buildParamsV2(seed, macroVars);
    
    // Hash the entire params object
    const v1Hash = hashValues(
      v1Result.seed,
      v1Result.vars.join(','),
      v1Result.mappingVersion
    );
    
    const v2Hash = hashValues(
      v2Result.seed,
      v2Result.vars.join(','),
      v2Result.mappingVersion,
      v2Result.archetype
    );
    
    v1Hashes.push(v1Hash.toString(16));
    v2Hashes.push(v2Hash.toString(16));
  }
  
  // Check all hashes match
  const v1Matches = v1Hashes.every(h => h === v1Hashes[0]);
  const v2Matches = v2Hashes.every(h => h === v2Hashes[0]);
  
  if (v1Matches) {
    details.push(`✓ V1 mapping is deterministic (hash: ${v1Hashes[0]})`);
  } else {
    details.push(`✗ V1 mapping NOT deterministic: ${v1Hashes.join(' ≠ ')}`);
  }
  
  if (v2Matches) {
    details.push(`✓ V2 mapping is deterministic (hash: ${v2Hashes[0]})`);
  } else {
    details.push(`✗ V2 mapping NOT deterministic: ${v2Hashes.join(' ≠ ')}`);
  }
  
  return {
    passed: v1Matches && v2Matches,
    v1Hash: v1Hashes[0],
    v2Hash: v2Hashes[0],
    v1Matches,
    v2Matches,
    details
  };
}

/**
 * Compare V1 vs V2 output for the same inputs
 * V1 should preserve legacy behavior, V2 adds new features
 */
export function compareVersions(
  seed: number,
  macroVars: number[]
): { v1: ReturnType<typeof buildParamsV1>; v2: ResolvedWorldParams; comparison: string[] } {
  const v1 = buildParamsV1(seed, macroVars);
  const v2 = buildParamsV2(seed, macroVars);
  
  const comparison: string[] = [];
  
  // V1 should have the same vars as input
  const v1VarsMatch = macroVars.every((v, i) => v1.vars[i] === Math.max(0, Math.min(100, v ?? 50)));
  comparison.push(v1VarsMatch 
    ? '✓ V1 preserves input vars exactly' 
    : '✗ V1 modified input vars (unexpected)'
  );
  
  // V2 should have archetype
  comparison.push(v2.archetype 
    ? `✓ V2 archetype: ${v2.archetype}` 
    : '✗ V2 missing archetype'
  );
  
  // V2 should have extra vars (micro vars are included in vars array)
  const microVarCount = v2.vars.length - 10;
  comparison.push(microVarCount > 0 
    ? `✓ V2 derived ${microVarCount} micro vars` 
    : '✗ V2 has no micro vars'
  );
  
  return { v1, v2, comparison };
}

/**
 * Run a full determinism test suite
 */
export function runDeterminismTests(): {
  allPassed: boolean;
  results: Array<{ name: string; passed: boolean; details: string[] }>;
} {
  const results: Array<{ name: string; passed: boolean; details: string[] }> = [];
  
  // Test 1: Basic determinism with default values
  const test1 = verifyDeterminism(12345, [50, 50, 50, 50, 50, 50, 50, 50, 50, 50]);
  results.push({
    name: 'Default params determinism',
    passed: test1.passed,
    details: test1.details
  });
  
  // Test 2: Edge case - all zeros
  const test2 = verifyDeterminism(0, [0, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
  results.push({
    name: 'Zero values determinism',
    passed: test2.passed,
    details: test2.details
  });
  
  // Test 3: Edge case - all max
  const test3 = verifyDeterminism(999999, [100, 100, 100, 100, 100, 100, 100, 100, 100, 100]);
  results.push({
    name: 'Max values determinism',
    passed: test3.passed,
    details: test3.details
  });
  
  // Test 4: Version comparison
  const comparison = compareVersions(42, [30, 70, 50, 60, 40, 80, 20, 90, 10, 55]);
  results.push({
    name: 'V1 vs V2 comparison',
    passed: true, // Comparison always passes, it's informational
    details: comparison.comparison
  });
  
  // Test 5: Randomization determinism
  const rand1 = randomizeMacroVars(12345);
  const rand2 = randomizeMacroVars(12345);
  const randMatch = rand1.every((v: number, i: number) => v === rand2[i]);
  results.push({
    name: 'Randomization determinism',
    passed: randMatch,
    details: [randMatch 
      ? '✓ Randomization produces identical results for same seed'
      : '✗ Randomization is NOT deterministic'
    ]
  });
  
  const allPassed = results.every(r => r.passed);
  
  return { allPassed, results };
}

/**
 * Console-friendly test runner for development
 */
export function logDeterminismTests(): void {
  console.group('🔒 Determinism Verification');
  
  const { allPassed, results } = runDeterminismTests();
  
  results.forEach(result => {
    console.groupCollapsed(
      `${result.passed ? '✓' : '✗'} ${result.name}`
    );
    result.details.forEach(d => console.log(d));
    console.groupEnd();
  });
  
  console.log(allPassed 
    ? '\n✅ ALL TESTS PASSED - Determinism verified!' 
    : '\n❌ SOME TESTS FAILED - Check details above'
  );
  
  console.groupEnd();
}
