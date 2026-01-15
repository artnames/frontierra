/**
 * PostFXZelda - Stylized post-processing for a Zelda-ish illustrated look
 *
 * Key fixes:
 * - SSAO needs NormalPass  -> EffectComposer enableNormalPass
 * - SMAA can crash in some builds (async textures) -> use FXAA instead (stable)
 * - Add Outline to actually stylize the scene (cel/ink vibe)
 */

import { Suspense, useMemo } from "react";
import {
  EffectComposer,
  Bloom,
  Vignette,
  HueSaturation,
  BrightnessContrast,
  SSAO,
  FXAA,
  Outline,
} from "@react-three/postprocessing";
import { BlendFunction } from "postprocessing";

export interface PostFXZeldaProps {
  enabled?: boolean;
  aoEnabled?: boolean;
  bloomEnabled?: boolean;
  vignetteEnabled?: boolean;
  outlineEnabled?: boolean;
  strength?: "subtle" | "strong";
}

export function PostFXZelda({
  enabled = true,
  aoEnabled = true,
  bloomEnabled = true,
  vignetteEnabled = true,
  outlineEnabled = true,
  strength = "strong",
}: PostFXZeldaProps) {
  if (!enabled) return null;

  const tune = useMemo(() => {
    if (strength === "subtle") {
      return {
        sat: 0.12,
        contrast: 0.06,
        brightness: 0.01,
        bloomIntensity: 0.14,
        bloomThreshold: 0.88,
        vignetteDarkness: 0.35,
        aoRadius: 2.0,
        aoIntensity: 12,
        outlineStrength: 1.2,
        outlineWidth: 0.006,
      };
    }
    return {
      sat: 0.22,
      contrast: 0.12,
      brightness: 0.02,
      bloomIntensity: 0.22,
      bloomThreshold: 0.84,
      vignetteDarkness: 0.45,
      aoRadius: 3.5,
      aoIntensity: 18,
      outlineStrength: 1.8,
      outlineWidth: 0.008,
    };
  }, [strength]);

  // Only enable NormalPass if we use effects that need it (SSAO, Outline).
  const needsNormalPass = aoEnabled || outlineEnabled;

  return (
    <Suspense fallback={null}>
      <EffectComposer multisampling={0} enableNormalPass={needsNormalPass}>
        {/* Stylized outline = biggest “Zelda-ish” lever */}
        {outlineEnabled && (
          <Outline
            blendFunction={BlendFunction.NORMAL}
            edgeStrength={tune.outlineStrength}
            width={tune.outlineWidth}
            // Keep these conservative to avoid flicker
            visibleEdgeColor={0x0b0b0f}
            hiddenEdgeColor={0x0b0b0f}
          />
        )}

        {/* AO for grounding (SSAO is fine if tuned + NormalPass enabled) */}
        {aoEnabled && (
          <SSAO
            blendFunction={BlendFunction.MULTIPLY}
            samples={16}
            radius={tune.aoRadius}
            intensity={tune.aoIntensity}
            luminanceInfluence={0.4}
            bias={0.03}
          />
        )}

        {/* Color grading */}
        <HueSaturation blendFunction={BlendFunction.NORMAL} saturation={tune.sat} hue={0} />

        <BrightnessContrast brightness={tune.brightness} contrast={tune.contrast} />

        {/* Bloom for water/spec highlights */}
        {bloomEnabled && (
          <Bloom
            intensity={tune.bloomIntensity}
            luminanceThreshold={tune.bloomThreshold}
            luminanceSmoothing={0.15}
            mipmapBlur
          />
        )}

        {/* FXAA = stable AA (no async textures like SMAA) */}
        <FXAA />

        {/* Frame */}
        {vignetteEnabled && (
          <Vignette offset={0.25} darkness={tune.vignetteDarkness} blendFunction={BlendFunction.NORMAL} />
        )}
      </EffectComposer>
    </Suspense>
  );
}
