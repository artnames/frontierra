/**
 * PostFXZelda - Stylized post-processing (stable + deterministic)
 *
 * Key stability choices:
 * - Uses FXAA instead of SMAA (SMAA is a common source of undefined.length crashes)
 * - Enables NormalPass when SSAO is enabled
 * - Guards against zero-size mount
 */

import { Suspense, useMemo } from "react";
import { useThree } from "@react-three/fiber";
import {
  EffectComposer,
  Bloom,
  Vignette,
  HueSaturation,
  BrightnessContrast,
  SSAO,
  FXAA,
  Noise,
} from "@react-three/postprocessing";
import { BlendFunction } from "postprocessing";

type Strength = "subtle" | "strong";

export interface PostFXZeldaProps {
  enabled?: boolean;
  strength?: Strength;
  aoEnabled?: boolean;
  bloomEnabled?: boolean;
  vignetteEnabled?: boolean;
  noiseEnabled?: boolean;
}

export function PostFXZelda({
  enabled = true,
  strength = "strong",
  aoEnabled = true,
  bloomEnabled = true,
  vignetteEnabled = true,
  noiseEnabled = true,
}: PostFXZeldaProps) {
  const { size } = useThree();

  // Prevent mount-time edge cases (0x0)
  if (!enabled) return null;
  if (!size?.width || !size?.height) return null;

  const tuned = useMemo(() => {
    if (strength === "subtle") {
      return {
        sat: 0.12,
        bright: 0.01,
        contrast: 0.06,
        bloomIntensity: 0.18,
        bloomThreshold: 0.86,
        vignetteDarkness: 0.38,
        vignetteOffset: 0.22,
        noiseOpacity: 0.03,
        aoIntensity: 6,
        aoRadius: 3.5,
        aoBias: 0.03,
      };
    }
    // strong
    return {
      sat: 0.28,
      bright: 0.02,
      contrast: 0.14,
      bloomIntensity: 0.35,
      bloomThreshold: 0.82,
      vignetteDarkness: 0.52,
      vignetteOffset: 0.28,
      noiseOpacity: 0.05,
      aoIntensity: 10,
      aoRadius: 4.5,
      aoBias: 0.03,
    };
  }, [strength]);

  return (
    <Suspense fallback={null}>
      {/* enableNormalPass is required for SSAO */}
      <EffectComposer multisampling={0} enableNormalPass>
        {aoEnabled && (
          <SSAO
            blendFunction={BlendFunction.MULTIPLY}
            samples={16}
            radius={tuned.aoRadius}
            intensity={tuned.aoIntensity}
            luminanceInfluence={0.5}
            bias={tuned.aoBias}
          />
        )}

        <HueSaturation blendFunction={BlendFunction.NORMAL} hue={0} saturation={tuned.sat} />

        <BrightnessContrast brightness={tuned.bright} contrast={tuned.contrast} />

        {bloomEnabled && (
          <Bloom
            intensity={tuned.bloomIntensity}
            luminanceThreshold={tuned.bloomThreshold}
            luminanceSmoothing={0.15}
            mipmapBlur
          />
        )}

        {noiseEnabled && <Noise premultiply blendFunction={BlendFunction.SOFT_LIGHT} opacity={tuned.noiseOpacity} />}

        {/* Stable AA */}
        <FXAA />

        {vignetteEnabled && (
          <Vignette
            blendFunction={BlendFunction.NORMAL}
            offset={tuned.vignetteOffset}
            darkness={tuned.vignetteDarkness}
          />
        )}
      </EffectComposer>
    </Suspense>
  );
}
