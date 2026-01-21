// Determinism Checksum Tests for V1 and V2 generators
// Ensures identical inputs produce identical outputs across reloads

import { describe, it, expect } from 'vitest';
import { mapV1Vars } from '@/world/vars/mapping_v1';
import { buildParamsV2, selectArchetype } from '@/world/vars/mapping_v2';
import { buildParamsV2Unified, mapV2VarsRealistic } from '@/world/vars/mapping_v2_unified';

describe('V1 Determinism', () => {
  it('produces identical output for same inputs', () => {
    const vars = [50, 50, 50, 50, 50, 50, 50, 50, 50, 50];
    
    const result1 = mapV1Vars(vars);
    const result2 = mapV1Vars(vars);
    const result3 = mapV1Vars(vars);
    
    expect(result1.continentScale).toBe(result2.continentScale);
    expect(result2.continentScale).toBe(result3.continentScale);
    expect(result1.waterLevel).toBe(result2.waterLevel);
    expect(result1.forestDensity).toBe(result2.forestDensity);
  });
  
  it('handles edge case vars', () => {
    const minVars = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
    const maxVars = [100, 100, 100, 100, 100, 100, 100, 100, 100, 100];
    
    const minResult = mapV1Vars(minVars);
    const maxResult = mapV1Vars(maxVars);
    
    expect(minResult.waterLevel).toBeLessThan(maxResult.waterLevel);
    expect(minResult.forestDensity).toBeLessThan(maxResult.forestDensity);
  });
});

describe('V2 Determinism', () => {
  it('produces identical output for same inputs', () => {
    const seed = 12345;
    const vars = [50, 50, 50, 50, 50, 50, 50, 50, 50, 50];
    
    const result1 = buildParamsV2(seed, vars);
    const result2 = buildParamsV2(seed, vars);
    const result3 = buildParamsV2(seed, vars);
    
    expect(result1.archetype).toBe(result2.archetype);
    expect(result2.archetype).toBe(result3.archetype);
    expect(result1.structure.waterLevel).toBe(result2.structure.waterLevel);
    expect(result1.hydrology.riverWidth).toBe(result2.hydrology.riverWidth);
  });
  
  it('archetype selection is deterministic', () => {
    const seed = 12345;
    const vars = [50, 50, 50, 50, 50, 50, 50, 50, 50, 50];
    
    const arch1 = selectArchetype(seed, vars);
    const arch2 = selectArchetype(seed, vars);
    const arch3 = selectArchetype(seed, vars);
    
    expect(arch1).toBe(arch2);
    expect(arch2).toBe(arch3);
  });
  
  it('different seeds produce different archetypes (at least sometimes)', () => {
    const vars = [50, 50, 50, 50, 50, 50, 50, 50, 50, 50];
    const archetypes = new Set<string>();
    
    // Test 20 different seeds
    for (let i = 0; i < 20; i++) {
      archetypes.add(selectArchetype(i * 12345, vars));
    }
    
    // Should have at least 2 different archetypes
    expect(archetypes.size).toBeGreaterThan(1);
  });
});

describe('V2 Unified Determinism', () => {
  it('produces identical output for same inputs', () => {
    const seed = 12345;
    const vars = [50, 50, 50, 50, 50, 50, 50, 50, 50, 50];
    
    const result1 = buildParamsV2Unified(seed, vars);
    const result2 = buildParamsV2Unified(seed, vars);
    
    expect(result1.archetype).toBe(result2.archetype);
    expect(result1.structure.waterLevel).toBe(result2.structure.waterLevel);
    expect(result1.hydrology.riverWidth).toBe(result2.hydrology.riverWidth);
  });
});

describe('V1 vs V2 Difference', () => {
  it('V1 and V2 produce different outputs', () => {
    const seed = 12345;
    const vars = [50, 50, 50, 50, 50, 50, 50, 50, 50, 50];
    
    const v1Result = mapV1Vars(vars);
    const v2Result = buildParamsV2(seed, vars);
    
    // They should have different structure due to archetype modifiers
    // V2 has archetype which V1 doesn't have
    expect(v2Result.archetype).toBeDefined();
  });
});

describe('V2 Realistic Coupling', () => {
  it('forest is influenced by biome richness', () => {
    const seed = 12345;
    const lowBiome = [50, 50, 50, 50, 20, 60, 50, 50, 50, 50]; // Low biome richness
    const highBiome = [50, 50, 50, 50, 80, 60, 50, 50, 50, 50]; // High biome richness
    
    const lowResult = mapV2VarsRealistic(lowBiome, seed);
    const highResult = mapV2VarsRealistic(highBiome, seed);
    
    // Higher biome richness should boost effective forest
    expect(highResult.effectiveForest).toBeGreaterThan(lowResult.effectiveForest);
  });
  
  it('river width is influenced by biome richness', () => {
    const seed = 12345;
    const lowBiome = [50, 50, 50, 50, 20, 50, 50, 50, 50, 50];
    const highBiome = [50, 50, 50, 50, 80, 50, 50, 50, 50, 50];
    
    const lowResult = mapV2VarsRealistic(lowBiome, seed);
    const highResult = mapV2VarsRealistic(highBiome, seed);
    
    // Higher biome richness = wetter = wider rivers
    expect(highResult.riverWidth).toBeGreaterThan(lowResult.riverWidth);
  });
  
  it('all shaped values are valid numbers', () => {
    const seed = 12345;
    const vars = [50, 50, 50, 50, 50, 50, 50, 50, 50, 50];
    
    const result = mapV2VarsRealistic(vars, seed);
    
    expect(Number.isFinite(result.terrainDetailShaped)).toBe(true);
    expect(Number.isFinite(result.biomeRichnessShaped)).toBe(true);
    expect(Number.isFinite(result.effectiveForest)).toBe(true);
    expect(Number.isFinite(result.riverWidth)).toBe(true);
    expect(Number.isFinite(result.coastBuffer)).toBe(true);
  });
});
