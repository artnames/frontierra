/**
 * PostFXZelda - Stylized post-processing for a Zelda-ish illustrated look
 *
 * IMPORTANT:
 * - SMAA is intentionally NOT used because it can crash in some Vite/preview builds
 *   with "Cannot read properties of undefined (reading 'length')".
 * - SSAO is also disabled by default because it requires NormalPass wiring.
 *
 * This stack is stable + visibly changes the look:
 * 1) HueSaturation (color pop)
 * 2) BrightnessContrast (punch)
 * 3) Bloom (soft highlight glow)
 * 4) Vignette (framing)
 */

import { useMemo } from "react";
import { EffectComposer, Bloom, Vignette, HueSaturation, BrightnessContrast } from "@react-three/postprocessing";
import { BlendFunction } from "postprocessing";

export type PostFXStrength = "subtle" | "strong";

export interface PostFXZeldaProps {
  enabled?: boolean;
  strength?: PostFXStrength;

  // Keep these for future expansion, but they won't crash anything right now.
  aoEnabled?: boolean; // intentionally unused in the safe version
  bloomEnabled?: boolean;
  vignetteEnabled?: boolean;
}

export function PostFXZelda({
  enabled = true,
  strength = "strong",
  bloomEnabled = true,
  vignetteEnabled = true,
}: PostFXZeldaProps) {
  const settings = useMemo(() => {
    // Tuned to be clearly visible but not “Instagram filter”.
    if (strength === "subtle") {
      return {
        saturation: 0.1,
        brightness: 0.01,
        contrast: 0.05,
        bloomIntensity: 0.16,
        bloomThreshold: 0.88,
        vignetteOffset: 0.22,
        vignetteDarkness: 0.35,
      };
    }
    return {
      saturation: 0.22,
      brightness: 0.02,
      contrast: 0.1,
      bloomIntensity: 0.28,
      bloomThreshold: 0.84,
      vignetteOffset: 0.25,
      vignetteDarkness: 0.45,
    };
  }, [strength]);

  if (!enabled) return null;

  return (
    <EffectComposer multisampling={0}>
      <HueSaturation blendFunction={BlendFunction.NORMAL} hue={0} saturation={settings.saturation} />

      <BrightnessContrast brightness={settings.brightness} contrast={settings.contrast} />

      {bloomEnabled && (
        <Bloom
          intensity={settings.bloomIntensity}
          luminanceThreshold={settings.bloomThreshold}
          luminanceSmoothing={0.15}
          mipmapBlur
        />
      )}

      {vignetteEnabled && (
        <Vignette
          offset={settings.vignetteOffset}
          darkness={settings.vignetteDarkness}
          blendFunction={BlendFunction.NORMAL}
        />
      )}
    </EffectComposer>
  );
}
