/**
 * PostFXZelda - Stylized post-processing for a Zelda-ish illustrated look
 *
 * Goals:
 * - Stronger color grading + contrast (less “plain”)
 * - Depth grounding via SSAO (requires NormalPass)
 * - Stable AA via FXAA (no SMAA texture-loader crashes)
 * - Subtle bloom + vignette
 *
 * Deterministic: no randomness, no time-driven variation required.
 */

import {
  EffectComposer,
  Bloom,
  Vignette,
  HueSaturation,
  BrightnessContrast,
  SSAO,
  FXAA,
} from "@react-three/postprocessing";
import { BlendFunction } from "postprocessing";

export interface PostFXZeldaProps {
  enabled?: boolean;
  bloomEnabled?: boolean;
  vignetteEnabled?: boolean;
  grainEnabled?: boolean;
  aaEnabled?: boolean;
}

export function PostFXZelda({
  enabled = true,
  aoEnabled = true,
  bloomEnabled = true,
  vignetteEnabled = true,
  strength = "default",
}: PostFXZeldaProps) {
  if (!enabled) return null;

  // Stronger grading so you *actually* see a difference.
  const grade =
    strength === "soft"
      ? { sat: 0.12, bright: 0.01, contrast: 0.06, bloom: 0.18, vig: 0.35 }
      : strength === "strong"
        ? { sat: 0.28, bright: 0.03, contrast: 0.14, bloom: 0.28, vig: 0.55 }
        : { sat: 0.2, bright: 0.02, contrast: 0.1, bloom: 0.22, vig: 0.45 };

  return (
    <EffectComposer multisampling={0} enableNormalPass>
      {/* Stable AA (no async assets) */}
      <FXAA />

      {/* Depth grounding */}
      {aoEnabled && (
        <SSAO
          blendFunction={BlendFunction.MULTIPLY}
          samples={16}
          radius={6}
          intensity={18}
          luminanceInfluence={0.55}
          bias={0.03}
        />
      )}

      {/* Color grading */}
      <HueSaturation blendFunction={BlendFunction.NORMAL} hue={0} saturation={grade.sat} />

      {/* Punch */}
      <BrightnessContrast brightness={grade.bright} contrast={grade.contrast} />

      {/* Subtle highlight bloom (water/spec) */}
      {bloomEnabled && <Bloom intensity={grade.bloom} luminanceThreshold={0.82} luminanceSmoothing={0.18} mipmapBlur />}

      {/* Frame focus */}
      {vignetteEnabled && <Vignette offset={0.25} darkness={grade.vig} blendFunction={BlendFunction.NORMAL} />}
    </EffectComposer>
  );
}
