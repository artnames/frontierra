// src/components/postfx/PostFXZelda.tsx
import React, { memo } from "react";
import {
  EffectComposer,
  Bloom,
  Vignette,
  HueSaturation,
  BrightnessContrast,
  Noise,
  FXAA,
  ToneMapping,
} from "@react-three/postprocessing";
import { BlendFunction, ToneMappingMode } from "postprocessing";

export type PostFXStrength = "subtle" | "strong" | "zelda";

export interface PostFXZeldaProps {
  enabled?: boolean;
  strength?: PostFXStrength;

  // keep for compatibility (even if you ignore it)
  outlineEnabled?: boolean;

  bloomEnabled?: boolean;
  vignetteEnabled?: boolean;
  noiseEnabled?: boolean;
}

export const PostFXZelda = memo(function PostFXZelda(props: PostFXZeldaProps = {}) {
  const {
    enabled = true,
    strength = "zelda",
    // outlineEnabled ignored here if you removed Outline
    bloomEnabled = true,
    vignetteEnabled = true,
    noiseEnabled = true,
  } = props;

  if (!enabled) return null;

  const isSubtle = strength === "subtle";
  const isStrong = strength === "strong";

  const sat = isSubtle ? 0.2 : isStrong ? 0.45 : 0.7;
  const bright = isSubtle ? 0.02 : isStrong ? 0.05 : 0.08;
  const contrast = isSubtle ? 0.15 : isStrong ? 0.28 : 0.42;

  const vignetteOffset = isSubtle ? 0.35 : isStrong ? 0.4 : 0.45;
  const vignetteDark = isSubtle ? 0.45 : isStrong ? 0.6 : 0.75;

  const bloomIntensity = isSubtle ? 0.2 : isStrong ? 0.4 : 0.65;
  const bloomThreshold = isSubtle ? 0.9 : isStrong ? 0.85 : 0.8;

  return (
    <EffectComposer multisampling={0}>
      <ToneMapping mode={ToneMappingMode.ACES_FILMIC} />
      <HueSaturation hue={0} saturation={sat} />
      <BrightnessContrast brightness={bright} contrast={contrast} />

      {bloomEnabled && (
        <Bloom intensity={bloomIntensity} luminanceThreshold={bloomThreshold} luminanceSmoothing={0.12} mipmapBlur />
      )}

      <FXAA />

      {vignetteEnabled && (
        <Vignette eskil={false} offset={vignetteOffset} darkness={vignetteDark} blendFunction={BlendFunction.NORMAL} />
      )}

      {noiseEnabled && <Noise premultiply opacity={isSubtle ? 0.03 : isStrong ? 0.05 : 0.07} />}
    </EffectComposer>
  );
});
