// src/components/postfx/PostFXZelda.tsx
import React, { memo, useEffect, useState } from "react";
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
  outlineEnabled?: boolean;
  bloomEnabled?: boolean;
  vignetteEnabled?: boolean;
  noiseEnabled?: boolean;
}

export const PostFXZelda = memo(function PostFXZelda({
  enabled = true,
  strength = "zelda",
  outlineEnabled = true,
  bloomEnabled = true,
  vignetteEnabled = true,
  noiseEnabled = true,
}: PostFXZeldaProps) {
  // Delay rendering to ensure scene is initialized
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    let frameCount = 0;
    let rafId: number;

    const waitForScene = () => {
      frameCount++;
      if (frameCount >= 5) {
        setIsReady(true);
      } else {
        rafId = requestAnimationFrame(waitForScene);
      }
    };

    rafId = requestAnimationFrame(waitForScene);

    return () => {
      if (rafId) cancelAnimationFrame(rafId);
    };
  }, []);

  // Don't render until ready
  if (!enabled || !isReady) return null;

  const isSubtle = strength === "subtle";
  const isStrong = strength === "strong";

  const sat = isSubtle ? 0.22 : isStrong ? 0.45 : 0.75;
  const bright = isSubtle ? 0.03 : isStrong ? 0.06 : 0.09;
  const contrast = isSubtle ? 0.18 : isStrong ? 0.32 : 0.48;

  const vignetteOffset = isSubtle ? 0.35 : isStrong ? 0.42 : 0.48;
  const vignetteDark = isSubtle ? 0.55 : isStrong ? 0.72 : 0.85;

  const bloomIntensity = isSubtle ? 0.25 : isStrong ? 0.5 : 0.85;
  const bloomThreshold = isSubtle ? 0.9 : isStrong ? 0.85 : 0.78;

  return (
    <EffectComposer multisampling={0} enableNormalPass={false}>
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
      {noiseEnabled && <Noise premultiply opacity={isSubtle ? 0.04 : isStrong ? 0.06 : 0.085} />}
    </EffectComposer>
  );
});
