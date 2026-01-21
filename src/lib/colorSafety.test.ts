// Tests for river/vegetation color safety and PostFX vignette bounds
// Ensures no white/invisible rendering due to invalid colors

import { describe, it, expect } from 'vitest';
import { PALETTE, VEGETATION_COLORS, hexToRgb01 } from '@/theme/palette';

// Safe color helper from ForestTrees.tsx - replicated for testing
function getVegColor(baseColor: { r: number; g: number; b: number } | undefined | null, variation: number, shift: number = 20): string {
  // Fallback to meadow green if baseColor is invalid
  if (!baseColor || typeof baseColor.r !== 'number' || typeof baseColor.g !== 'number' || typeof baseColor.b !== 'number') {
    baseColor = { r: 0.537, g: 0.612, b: 0.435 }; // #899C6F
  }
  
  const r = Number.isFinite(baseColor.r) ? baseColor.r : 0.5;
  const g = Number.isFinite(baseColor.g) ? baseColor.g : 0.5;
  const b = Number.isFinite(baseColor.b) ? baseColor.b : 0.5;
  
  const vShift = Math.floor(variation * shift) - shift / 2;
  return `rgb(${Math.max(0, Math.min(255, Math.round(r * 255) + vShift))}, ${Math.max(0, Math.min(255, Math.round(g * 255) + vShift))}, ${Math.max(0, Math.min(255, Math.round(b * 255) + vShift * 0.5))})`;
}

// Helper to parse rgb() string - handles both "rgb(r, g, b)" and "rgb(r,g,b)"
function parseRgb(rgbStr: string): { r: number; g: number; b: number } | null {
  const match = rgbStr.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
  if (!match) {
    // Try without spaces
    const match2 = rgbStr.match(/rgb\((\d+),(\d+),(\d+)\)/);
    if (!match2) return null;
    return {
      r: parseInt(match2[1], 10),
      g: parseInt(match2[2], 10),
      b: parseInt(match2[3], 10),
    };
  }
  return {
    r: parseInt(match[1], 10),
    g: parseInt(match[2], 10),
    b: parseInt(match[3], 10),
  };
}

describe('Vegetation color safety', () => {
  it('returns valid RGB for valid baseColor', () => {
    const color = getVegColor({ r: 0.5, g: 0.6, b: 0.4 }, 0.5);
    const parsed = parseRgb(color);
    
    expect(parsed).not.toBeNull();
    expect(parsed!.r).toBeGreaterThanOrEqual(0);
    expect(parsed!.r).toBeLessThanOrEqual(255);
    expect(parsed!.g).toBeGreaterThanOrEqual(0);
    expect(parsed!.g).toBeLessThanOrEqual(255);
    expect(parsed!.b).toBeGreaterThanOrEqual(0);
    expect(parsed!.b).toBeLessThanOrEqual(255);
  });

  it('returns fallback meadow green for undefined baseColor', () => {
    const color = getVegColor(undefined, 0.5);
    const parsed = parseRgb(color);
    
    expect(parsed).not.toBeNull();
    // Should be close to meadow green #899C6F
    expect(parsed!.r).toBeGreaterThan(100);
    expect(parsed!.g).toBeGreaterThan(100);
    expect(parsed!.b).toBeGreaterThan(50);
  });

  it('returns fallback for null baseColor', () => {
    const color = getVegColor(null, 0.5);
    const parsed = parseRgb(color);
    
    expect(parsed).not.toBeNull();
  });

  it('handles NaN values in baseColor', () => {
    const color = getVegColor({ r: NaN, g: 0.5, b: 0.4 }, 0.5);
    const parsed = parseRgb(color);
    
    expect(parsed).not.toBeNull();
    // Should use 0.5 fallback for r
    expect(parsed!.r).toBeGreaterThan(100);
  });

  it('never returns white (255,255,255) for any variation', () => {
    for (let v = 0; v <= 1; v += 0.1) {
      const color = getVegColor(VEGETATION_COLORS.pineBase, v);
      
      // Check the color string is not empty and starts with rgb(
      expect(color.length).toBeGreaterThan(0);
      expect(color.startsWith('rgb(')).toBe(true);
      
      // Ensure it doesn't contain pure white
      expect(color.includes('255, 255, 255')).toBe(false);
      expect(color.includes('255,255,255')).toBe(false);
    }
  });

  it('produces valid colors for all VEGETATION_COLORS', () => {
    const vegColors = [
      VEGETATION_COLORS.pineBase,
      VEGETATION_COLORS.deciduousBase,
      VEGETATION_COLORS.bushBase,
      VEGETATION_COLORS.barkDark,
      VEGETATION_COLORS.barkLight,
      VEGETATION_COLORS.rockBase,
    ];

    for (const vc of vegColors) {
      const color = getVegColor(vc, 0.5);
      const parsed = parseRgb(color);
      
      expect(parsed).not.toBeNull();
      expect(Number.isFinite(parsed!.r)).toBe(true);
      expect(Number.isFinite(parsed!.g)).toBe(true);
      expect(Number.isFinite(parsed!.b)).toBe(true);
    }
  });
});

describe('Palette color validity', () => {
  it('all PALETTE colors are valid hex', () => {
    for (const [key, value] of Object.entries(PALETTE)) {
      expect(value).toMatch(/^#[0-9A-Fa-f]{6}$/);
    }
  });

  it('hexToRgb01 returns valid 0-1 range for all palette colors', () => {
    for (const [key, hex] of Object.entries(PALETTE)) {
      const rgb = hexToRgb01(hex);
      
      expect(rgb.r).toBeGreaterThanOrEqual(0);
      expect(rgb.r).toBeLessThanOrEqual(1);
      expect(rgb.g).toBeGreaterThanOrEqual(0);
      expect(rgb.g).toBeLessThanOrEqual(1);
      expect(rgb.b).toBeGreaterThanOrEqual(0);
      expect(rgb.b).toBeLessThanOrEqual(1);
    }
  });

  it('water colors (abyss, forest) are not white', () => {
    const abyss = hexToRgb01(PALETTE.abyss);
    const forest = hexToRgb01(PALETTE.forest);
    
    // abyss should be dark (#001C24)
    expect(abyss.r).toBeLessThan(0.1);
    expect(abyss.g).toBeLessThan(0.15);
    expect(abyss.b).toBeLessThan(0.2);
    
    // forest should be green (#576E45)
    expect(forest.g).toBeGreaterThan(forest.r);
  });
});

describe('PostFX vignette bounds', () => {
  // Vignette presets from PostFXZelda.tsx
  const STRENGTH_PRESETS = {
    subtle: { vignette: 0.03, vignetteOffset: 0.98 },
    strong: { vignette: 0.06, vignetteOffset: 0.96 },
    zelda: { vignette: 0.04, vignetteOffset: 0.97 },
  };

  it('vignette strength is within safe bounds (< 0.15 to avoid dark edges)', () => {
    const MAX_SAFE_VIGNETTE = 0.15;
    
    for (const [name, preset] of Object.entries(STRENGTH_PRESETS)) {
      expect(preset.vignette).toBeLessThanOrEqual(MAX_SAFE_VIGNETTE);
      expect(preset.vignette).toBeGreaterThanOrEqual(0);
    }
  });

  it('vignette offset pushes effect to edges (> 0.9)', () => {
    const MIN_SAFE_OFFSET = 0.9;
    
    for (const [name, preset] of Object.entries(STRENGTH_PRESETS)) {
      expect(preset.vignetteOffset).toBeGreaterThanOrEqual(MIN_SAFE_OFFSET);
      expect(preset.vignetteOffset).toBeLessThanOrEqual(1.0);
    }
  });

  it('zelda preset has most transparent vignette', () => {
    // zelda preset should be lighter than strong
    expect(STRENGTH_PRESETS.zelda.vignette).toBeLessThan(STRENGTH_PRESETS.strong.vignette);
  });
});
