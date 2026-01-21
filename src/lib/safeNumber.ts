// Safe Number Utility - Eliminates NaN sources at the source
// BUG-001: All height queries must return finite numbers

const DEV = import.meta.env.DEV;

// Track fallback usage in dev mode (throttled to once per source per session)
const fallbackWarningSources = new Set<string>();

/**
 * Ensures a value is a finite number, returning fallback if not.
 * Use this at the SOURCE where NaN can originate:
 * - out-of-bounds sampling
 * - undefined terrain cells
 * - missing terrain arrays
 * - division by zero
 * - interpolation with invalid inputs
 * 
 * @param value - The value to check
 * @param fallback - The fallback value to return if value is not finite
 * @param source - Optional source identifier for dev warnings (throttled)
 * @returns A finite number
 */
export function safeNumber(value: unknown, fallback: number, source?: string): number {
  // Fast path for valid numbers
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  
  // Dev warning (throttled to once per source per session)
  if (DEV && source && !fallbackWarningSources.has(source)) {
    fallbackWarningSources.add(source);
    console.warn(
      `[safeNumber] Fallback triggered at "${source}": ` +
      `value=${value} (type=${typeof value}), using fallback=${fallback}`
    );
  }
  
  return fallback;
}

/**
 * Safely clamp a number to a range, guarding against NaN
 */
export function safeClamp(value: unknown, min: number, max: number, fallback: number, source?: string): number {
  const num = safeNumber(value, fallback, source);
  return Math.max(min, Math.min(max, num));
}

/**
 * Safely divide two numbers, returning fallback on NaN or Infinity
 */
export function safeDivide(numerator: number, denominator: number, fallback: number, source?: string): number {
  if (denominator === 0) {
    if (DEV && source && !fallbackWarningSources.has(source)) {
      fallbackWarningSources.add(source);
      console.warn(`[safeDivide] Division by zero at "${source}", using fallback=${fallback}`);
    }
    return fallback;
  }
  
  const result = numerator / denominator;
  return safeNumber(result, fallback, source);
}

/**
 * Safely interpolate between two values
 */
export function safeLerp(a: number, b: number, t: number, fallback: number, source?: string): number {
  const safeA = safeNumber(a, fallback, source);
  const safeB = safeNumber(b, fallback, source);
  const safeT = safeClamp(t, 0, 1, 0.5, source);
  
  return safeA + (safeB - safeA) * safeT;
}

/**
 * Reset fallback warning tracking (for tests)
 */
export function resetFallbackWarnings(): void {
  fallbackWarningSources.clear();
}
