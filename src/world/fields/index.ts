// Derived Fields - Deterministic field generators for biome/vegetation systems
// These fields are computed from seed + params and used throughout generation

import { 
  hashValues, 
  seededRandom, 
  valueNoise2D, 
  fractalNoise2D,
  smoothstep,
  mapRange
} from '../vars/mixer';
import { ResolvedWorldParams } from '../vars/mapping_v2';

// ============================================
// FIELD INTERFACES
// ============================================

export interface DerivedFields {
  wetness: (x: number, y: number) => number;      // 0-1
  temperature: (x: number, y: number) => number;  // 0-1
  ruggedness: (x: number, y: number) => number;   // 0-1
}

// ============================================
// FIELD GENERATORS
// ============================================

/**
 * Create wetness field - determines moisture levels
 * Influenced by: water proximity, elevation, rainfall
 */
export function createWetnessField(
  seed: number, 
  params: ResolvedWorldParams,
  gridSize: number = 64
): (x: number, y: number) => number {
  const fieldSeed = hashValues(seed, 'wetness');
  const { hydrology, structure } = params;
  
  return (x: number, y: number): number => {
    const nx = x / gridSize;
    const ny = y / gridSize;
    
    // Base moisture from noise
    const baseMoisture = fractalNoise2D(nx * 4, ny * 4, fieldSeed, 3, 0.5, 2);
    
    // Water proximity boost (simulated - in real impl would check actual water tiles)
    const waterProximity = valueNoise2D(nx * 2, ny * 2, fieldSeed + 1000);
    const waterBoost = waterProximity > (1 - hydrology.seaLevel) ? 0.3 : 0;
    
    // Elevation penalty (higher = drier)
    const elevNoise = fractalNoise2D(nx * 3, ny * 3, fieldSeed + 2000, 2);
    const elevationPenalty = elevNoise * structure.mountainDensity * 0.2;
    
    // Combine with rainfall influence
    const wetness = baseMoisture * 0.6 + 
                    hydrology.rainfallAmount * 0.3 + 
                    waterBoost - 
                    elevationPenalty;
    
    return Math.max(0, Math.min(1, wetness));
  };
}

/**
 * Create temperature field - determines climate zones
 * Influenced by: elevation, latitude simulation, variance setting
 */
export function createTemperatureField(
  seed: number,
  params: ResolvedWorldParams,
  gridSize: number = 64
): (x: number, y: number) => number {
  const fieldSeed = hashValues(seed, 'temperature');
  const { biome, structure } = params;
  
  return (x: number, y: number): number => {
    const nx = x / gridSize;
    const ny = y / gridSize;
    
    // Base temperature with latitude-like gradient
    const latitudeEffect = 1 - Math.abs(ny - 0.5) * 2 * biome.temperatureVariance;
    
    // Noise variation
    const tempNoise = fractalNoise2D(nx * 3, ny * 3, fieldSeed, 2, 0.6, 2);
    
    // Elevation cooling (higher = colder)
    const elevNoise = fractalNoise2D(nx * 4, ny * 4, fieldSeed + 3000, 2);
    const elevationCooling = elevNoise * structure.mountainPeakHeight * 0.4;
    
    const temperature = latitudeEffect * 0.5 + 
                        tempNoise * 0.3 + 
                        0.3 - 
                        elevationCooling;
    
    return Math.max(0, Math.min(1, temperature));
  };
}

/**
 * Create ruggedness field - determines terrain roughness
 * Influenced by: mountain proximity, erosion, cliff frequency
 */
export function createRuggednessField(
  seed: number,
  params: ResolvedWorldParams,
  gridSize: number = 64
): (x: number, y: number) => number {
  const fieldSeed = hashValues(seed, 'ruggedness');
  const { structure, detail } = params;
  
  return (x: number, y: number): number => {
    const nx = x / gridSize;
    const ny = y / gridSize;
    
    // Base ruggedness from noise
    const baseRugged = fractalNoise2D(nx * 5, ny * 5, fieldSeed, 3, 0.5, 2);
    
    // Mountain influence
    const mtnNoise = valueNoise2D(nx * 2, ny * 2, fieldSeed + 4000);
    const mountainBoost = mtnNoise > 0.6 ? (mtnNoise - 0.6) * structure.mountainDensity : 0;
    
    // Cliff contribution
    const cliffNoise = valueNoise2D(nx * 8, ny * 8, fieldSeed + 5000);
    const cliffBoost = cliffNoise > 0.7 ? structure.cliffFrequency * 0.3 : 0;
    
    // Erosion smoothing
    const erosionSmooth = structure.erosionStrength * 0.15;
    
    const ruggedness = baseRugged * detail.terrainRoughness * 0.5 + 
                       mountainBoost + 
                       cliffBoost - 
                       erosionSmooth;
    
    return Math.max(0, Math.min(1, ruggedness));
  };
}

/**
 * Create all derived fields at once
 */
export function createDerivedFields(
  seed: number,
  params: ResolvedWorldParams,
  gridSize: number = 64
): DerivedFields {
  return {
    wetness: createWetnessField(seed, params, gridSize),
    temperature: createTemperatureField(seed, params, gridSize),
    ruggedness: createRuggednessField(seed, params, gridSize)
  };
}

/**
 * Sample all fields at a point
 */
export function sampleFields(
  fields: DerivedFields,
  x: number,
  y: number
): { wetness: number; temperature: number; ruggedness: number } {
  return {
    wetness: fields.wetness(x, y),
    temperature: fields.temperature(x, y),
    ruggedness: fields.ruggedness(x, y)
  };
}
