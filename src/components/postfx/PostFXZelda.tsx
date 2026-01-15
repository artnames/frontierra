/**
 * PostFXZelda - Stylized post-processing for a game-like illustrated look
 *
 * Effects pipeline (in order):
 * 1. SSAO - Screen-space ambient occlusion for depth (requires NormalPass)
 * 2. HueSaturation - Warm color grading boost
 * 3. BrightnessContrast - Punch up the image
 * 4. Bloom - Subtle glow on highlights (water, specular)
 * 5. FXAA - Stable AA (avoids SMAA async texture crash)
 * 6. Vignette - Frame the scene, draw focus to center
 *
 * All effects are deterministic - no randomness or time-based variation.
 */

import { Suspense } from "react";

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

interface PostFXZeldaProps {
  /** Enable/disable the entire effect stack */
  enabled?: boolean;
  /** Enable ambient occlusion (performance impact: medium) */
  aoEnabled?: boolean;
  /** Enable bloom effect (performance impact: low-medium) */
  bloomEnabled?: boolean;
  /** Enable vignette (performance impact: minimal) */
  vignetteEnabled?: boolean;
}

export function PostFXZelda({
  enabled = true,
  aoEnabled = true,
  bloomEnabled = true,
  vignetteEnabled = true,
}: PostFXZeldaProps) {
  if (!enabled) return null;

  return (
    <Suspense fallback={null}>
      <EffectComposer multisampling={0} enableNormalPass>
        {aoEnabled && (
          <SSAO
            blendFunction={BlendFunction.MULTIPLY}
            samples={16}
            radius={5}
            intensity={20}
            luminanceInfluence={0.5}
            bias={0.035}
          />
        )}

        <HueSaturation blendFunction={BlendFunction.NORMAL} saturation={0.18} hue={0} />

        <BrightnessContrast brightness={0.02} contrast={0.08} />

        {bloomEnabled && (
          <Bloom intensity={0.22} luminanceThreshold={0.82} luminanceSmoothing={0.15} mipmapBlur={true} />
        )}

        {/* Stable anti-aliasing that doesn't depend on async SMAA textures */}
        <FXAA />

        {vignetteEnabled && <Vignette offset={0.25} darkness={0.45} blendFunction={BlendFunction.NORMAL} />}
      </EffectComposer>
    </Suspense>
  );
}
