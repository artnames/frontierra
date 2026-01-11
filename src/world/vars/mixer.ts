// Variable Mixer - Shared curves, clamps, and cross-coupling helpers
// All functions are deterministic and use stable iteration

// ============================================
// DETERMINISTIC HASH FUNCTIONS
// ============================================

/**
 * djb2 hash - stable string hashing
 */
export function hashString(str: string): number {
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) + hash) ^ str.charCodeAt(i);
    hash = hash >>> 0; // Convert to unsigned 32-bit
  }
  return hash;
}

/**
 * Combine multiple values into a single hash
 * Uses stable serialization (sorted keys for objects)
 */
export function hashValues(...values: (number | string)[]): number {
  const str = values.map(v => String(v)).join(':');
  return hashString(str);
}

/**
 * Deterministic pseudo-random from seed
 * Returns value in [0, 1)
 */
export function seededRandom(seed: number): number {
  // Simple LCG-based PRNG
  const x = Math.sin(seed * 9999) * 10000;
  return x - Math.floor(x);
}

/**
 * Get nth random value from a seed stream
 */
export function seededRandomN(seed: number, n: number): number {
  return seededRandom(hashValues(seed, n));
}

/**
 * Deterministic random in range [min, max]
 */
export function seededRandomRange(seed: number, min: number, max: number): number {
  return min + seededRandom(seed) * (max - min);
}

/**
 * Deterministic random integer in range [min, max]
 */
export function seededRandomInt(seed: number, min: number, max: number): number {
  return Math.floor(seededRandomRange(seed, min, max + 1));
}

// ============================================
// CURVE FUNCTIONS - Non-linear mappings
// ============================================

/**
 * Power curve - emphasizes extremes or midpoints
 * @param t - input value [0, 1]
 * @param power - curve exponent (>1 = emphasize high, <1 = emphasize low)
 */
export function powerCurve(t: number, power: number): number {
  return Math.pow(Math.max(0, Math.min(1, t)), power);
}

/**
 * Smoothstep - smooth S-curve, avoids flat midrange
 * Standard Hermite interpolation
 */
export function smoothstep(t: number): number {
  const x = Math.max(0, Math.min(1, t));
  return x * x * (3 - 2 * x);
}

/**
 * Smootherstep - even smoother S-curve (Ken Perlin)
 */
export function smootherstep(t: number): number {
  const x = Math.max(0, Math.min(1, t));
  return x * x * x * (x * (x * 6 - 15) + 10);
}

/**
 * Bias curve - shifts midpoint left or right
 * @param t - input value [0, 1]
 * @param bias - 0.5 = no change, <0.5 = shift left, >0.5 = shift right
 */
export function biasCurve(t: number, bias: number): number {
  const k = Math.pow(1 - bias, 3);
  return (t * k) / (t * k - t + 1);
}

/**
 * Gain curve - increases or decreases contrast around midpoint
 * @param t - input value [0, 1]
 * @param gain - 0.5 = linear, <0.5 = more contrast, >0.5 = less contrast
 */
export function gainCurve(t: number, gain: number): number {
  if (t < 0.5) {
    return biasCurve(2 * t, gain) / 2;
  }
  return 1 - biasCurve(2 * (1 - t), gain) / 2;
}

/**
 * Ease in - slow start, fast end
 */
export function easeIn(t: number, power: number = 2): number {
  return powerCurve(t, power);
}

/**
 * Ease out - fast start, slow end
 */
export function easeOut(t: number, power: number = 2): number {
  return 1 - powerCurve(1 - t, power);
}

/**
 * Ease in-out - slow start and end
 */
export function easeInOut(t: number, power: number = 2): number {
  if (t < 0.5) {
    return powerCurve(2 * t, power) / 2;
  }
  return 1 - powerCurve(2 * (1 - t), power) / 2;
}

// ============================================
// RANGE MAPPING
// ============================================

/**
 * Map value from one range to another
 */
export function mapRange(
  value: number, 
  inMin: number, 
  inMax: number, 
  outMin: number, 
  outMax: number
): number {
  const t = (value - inMin) / (inMax - inMin);
  return outMin + t * (outMax - outMin);
}

/**
 * Map value from [0, 100] to [outMin, outMax] with optional curve
 */
export function mapVar(
  value: number, 
  outMin: number, 
  outMax: number, 
  curve: 'linear' | 'smooth' | 'power' = 'linear',
  power: number = 2
): number {
  let t = Math.max(0, Math.min(100, value)) / 100;
  
  switch (curve) {
    case 'smooth':
      t = smoothstep(t);
      break;
    case 'power':
      t = powerCurve(t, power);
      break;
  }
  
  return outMin + t * (outMax - outMin);
}

/**
 * Normalize value to [0, 100] range
 */
export function normalizeVar(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

// ============================================
// CROSS-COUPLING HELPERS
// ============================================

/**
 * Blend multiple vars with weights
 * @param vars - array of [value, weight] pairs
 */
export function blendVars(vars: [number, number][]): number {
  let totalWeight = 0;
  let weightedSum = 0;
  
  for (const [value, weight] of vars) {
    weightedSum += value * weight;
    totalWeight += weight;
  }
  
  if (totalWeight === 0) return 50;
  return normalizeVar(weightedSum / totalWeight);
}

/**
 * Apply influence from one var to another
 * @param baseVar - the primary variable value
 * @param influencer - the influencing variable value
 * @param strength - how much influence (0-1)
 * @param direction - 'positive' = adds, 'negative' = subtracts, 'bidirectional' = based on influencer
 */
export function applyInfluence(
  baseVar: number,
  influencer: number,
  strength: number,
  direction: 'positive' | 'negative' | 'bidirectional' = 'bidirectional'
): number {
  const normalizedInfluencer = (influencer - 50) / 50; // -1 to 1
  
  let delta = 0;
  switch (direction) {
    case 'positive':
      delta = (influencer / 100) * strength * 50;
      break;
    case 'negative':
      delta = -(influencer / 100) * strength * 50;
      break;
    case 'bidirectional':
      delta = normalizedInfluencer * strength * 50;
      break;
  }
  
  return normalizeVar(baseVar + delta);
}

/**
 * Threshold function - returns 0 below threshold, scales above
 */
export function threshold(value: number, thresholdPoint: number): number {
  if (value < thresholdPoint) return 0;
  return (value - thresholdPoint) / (100 - thresholdPoint) * 100;
}

/**
 * Inverse threshold - returns 100 below threshold, scales down above
 */
export function inverseThreshold(value: number, thresholdPoint: number): number {
  if (value < thresholdPoint) return 100;
  return 100 - (value - thresholdPoint) / (100 - thresholdPoint) * 100;
}

// ============================================
// DETERMINISTIC ARRAY OPERATIONS
// ============================================

/**
 * Shuffle array deterministically using seed
 */
export function shuffleDeterministic<T>(arr: T[], seed: number): T[] {
  const result = [...arr];
  for (let i = result.length - 1; i > 0; i--) {
    const j = seededRandomInt(hashValues(seed, i), 0, i);
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

/**
 * Pick n items from array deterministically
 */
export function pickDeterministic<T>(arr: T[], n: number, seed: number): T[] {
  const shuffled = shuffleDeterministic(arr, seed);
  return shuffled.slice(0, Math.min(n, arr.length));
}

// ============================================
// STABLE 2D NOISE HELPERS
// ============================================

/**
 * Simple 2D value noise using hashing
 * Deterministic based on seed
 */
export function valueNoise2D(x: number, y: number, seed: number): number {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const xf = x - xi;
  const yf = y - yi;
  
  // Hash corners
  const n00 = seededRandom(hashValues(seed, xi, yi));
  const n10 = seededRandom(hashValues(seed, xi + 1, yi));
  const n01 = seededRandom(hashValues(seed, xi, yi + 1));
  const n11 = seededRandom(hashValues(seed, xi + 1, yi + 1));
  
  // Smooth interpolation
  const sx = smoothstep(xf);
  const sy = smoothstep(yf);
  
  // Bilinear interpolation
  const nx0 = n00 * (1 - sx) + n10 * sx;
  const nx1 = n01 * (1 - sx) + n11 * sx;
  
  return nx0 * (1 - sy) + nx1 * sy;
}

/**
 * Fractal noise (FBM) using value noise
 */
export function fractalNoise2D(
  x: number, 
  y: number, 
  seed: number, 
  octaves: number = 4,
  persistence: number = 0.5,
  lacunarity: number = 2
): number {
  let total = 0;
  let amplitude = 1;
  let frequency = 1;
  let maxValue = 0;
  
  for (let i = 0; i < octaves; i++) {
    total += valueNoise2D(x * frequency, y * frequency, seed + i * 1000) * amplitude;
    maxValue += amplitude;
    amplitude *= persistence;
    frequency *= lacunarity;
  }
  
  return total / maxValue;
}
