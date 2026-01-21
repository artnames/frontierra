// Unit tests for safeNumber utility
// BUG-001: Ensure NaN sources are eliminated

import { describe, it, expect, beforeEach } from 'vitest';
import { safeNumber, safeClamp, safeDivide, safeLerp, resetFallbackWarnings } from './safeNumber';

describe('safeNumber', () => {
  beforeEach(() => {
    resetFallbackWarnings();
  });

  describe('safeNumber()', () => {
    it('returns valid numbers unchanged', () => {
      expect(safeNumber(0, 999)).toBe(0);
      expect(safeNumber(42, 999)).toBe(42);
      expect(safeNumber(-100, 999)).toBe(-100);
      expect(safeNumber(3.14159, 999)).toBe(3.14159);
    });

    it('returns fallback for NaN', () => {
      expect(safeNumber(NaN, 0)).toBe(0);
      expect(safeNumber(NaN, 5)).toBe(5);
    });

    it('returns fallback for Infinity', () => {
      expect(safeNumber(Infinity, 0)).toBe(0);
      expect(safeNumber(-Infinity, 0)).toBe(0);
    });

    it('returns fallback for undefined', () => {
      expect(safeNumber(undefined, 10)).toBe(10);
    });

    it('returns fallback for null', () => {
      expect(safeNumber(null, 10)).toBe(10);
    });

    it('returns fallback for strings', () => {
      expect(safeNumber('hello', 0)).toBe(0);
      expect(safeNumber('42', 0)).toBe(0); // Strings are not auto-converted
    });

    it('returns fallback for objects', () => {
      expect(safeNumber({}, 0)).toBe(0);
      expect(safeNumber([], 0)).toBe(0);
    });
  });

  describe('safeClamp()', () => {
    it('clamps values to range', () => {
      expect(safeClamp(5, 0, 10, 0)).toBe(5);
      expect(safeClamp(-5, 0, 10, 0)).toBe(0);
      expect(safeClamp(15, 0, 10, 0)).toBe(10);
    });

    it('returns fallback for invalid values before clamping', () => {
      expect(safeClamp(NaN, 0, 10, 5)).toBe(5);
      expect(safeClamp(undefined, 0, 10, 5)).toBe(5);
    });

    it('clamps fallback within range', () => {
      expect(safeClamp(NaN, 0, 10, 50)).toBe(10); // fallback=50 clamped to max=10
      expect(safeClamp(undefined, 5, 10, 0)).toBe(5); // fallback=0 clamped to min=5
    });
  });

  describe('safeDivide()', () => {
    it('divides normally for non-zero denominator', () => {
      expect(safeDivide(10, 2, 0)).toBe(5);
      expect(safeDivide(1, 4, 0)).toBe(0.25);
    });

    it('returns fallback for division by zero', () => {
      expect(safeDivide(10, 0, 999)).toBe(999);
    });

    it('returns fallback for invalid result', () => {
      // NaN / number still produces NaN
      expect(safeDivide(NaN, 2, 0)).toBe(0);
    });
  });

  describe('safeLerp()', () => {
    it('interpolates correctly for valid inputs', () => {
      expect(safeLerp(0, 10, 0.5, 0)).toBe(5);
      expect(safeLerp(0, 10, 0, 0)).toBe(0);
      expect(safeLerp(0, 10, 1, 0)).toBe(10);
    });

    it('clamps t to 0-1 range', () => {
      expect(safeLerp(0, 10, -1, 0)).toBe(0); // t clamped to 0
      expect(safeLerp(0, 10, 2, 0)).toBe(10); // t clamped to 1
    });

    it('handles invalid a or b with fallback', () => {
      expect(safeLerp(NaN, 10, 0.5, 5)).toBe(7.5); // a=5 fallback
      expect(safeLerp(0, NaN, 0.5, 5)).toBe(2.5); // b=5 fallback
    });
  });
});
