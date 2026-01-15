import React from "react";
import {
  EffectComposer,
  Bloom,
  Vignette,
  HueSaturation,
  BrightnessContrast,
  FXAA,
  ToneMapping,
  ColorDepth,
  Noise,
} from "@react-three/postprocessing";
import { BlendFunction, ToneMappingMode } from "postprocessing";

export type PostFXStrength = "subtle" | "strong" | "zelda";

export interface PostFXZeldaProps {
  enabled?: boolean;
  bloomEnabled?: boolean;
  vignetteEnabled?: boolean;
  strength?: PostFXStrength;
}

class PostFXErrorBoundary extends React.Component<{ children: React.ReactNode }, { hasError: boolean }> {
  state = { hasError: false };
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  componentDidCatch(err: any) {
    console.warn("[PostFXZelda] disabled due to runtime error:", err);
  }
  render() {
    if (this.state.hasError) return null;
    return this.props.children;
  }
}

export function PostFXZelda({
  enabled = true,
  bloomEnabled = true,
  vignetteEnabled = true,
  strength = "strong",
}: PostFXZeldaProps) {
  if (!enabled) return null;

  const isSubtle = strength === "subtle";
  const isStrong = strength === "strong";
  const isZelda = strength === "zelda";

  // The “stylized” part:
  // - ColorDepth reduces gradient smoothness -> painterly / gamey
  // - Noise adds dithering so banding looks intentional instead of ugly
  const bits = isSubtle ? 24 : isStrong ? 16 : 12; // 12 is clearly stylized

  return (
    <PostFXErrorBoundary>
      <EffectComposer multisampling={0}>
        <ToneMapping mode={ToneMappingMode.ACES_FILMIC} />

        <HueSaturation
          blendFunction={BlendFunction.NORMAL}
          saturation={isSubtle ? 0.14 : isStrong ? 0.28 : 0.38}
          hue={0}
        />

        <BrightnessContrast
          brightness={isSubtle ? 0.01 : isStrong ? 0.03 : 0.04}
          contrast={isSubtle ? 0.1 : isStrong ? 0.18 : 0.24}
        />

        {/* Posterize the image (biggest visible style jump) */}
        <ColorDepth bits={bits} />

        {/* Dither so the posterization feels “painted” not “broken” */}
        <Noise
          premultiply
          blendFunction={BlendFunction.SOFT_LIGHT}
          opacity={isSubtle ? 0.035 : isStrong ? 0.05 : 0.065}
        />

        {bloomEnabled && (
          <Bloom
            intensity={isSubtle ? 0.18 : isStrong ? 0.35 : 0.45}
            luminanceThreshold={isSubtle ? 0.88 : isStrong ? 0.82 : 0.78}
            luminanceSmoothing={0.15}
            mipmapBlur
          />
        )}

        <FXAA />

        {vignetteEnabled && (
          <Vignette
            offset={isSubtle ? 0.18 : isStrong ? 0.25 : 0.28}
            darkness={isSubtle ? 0.32 : isStrong ? 0.48 : 0.55}
            blendFunction={BlendFunction.NORMAL}
          />
        )}
      </EffectComposer>
    </PostFXErrorBoundary>
  );
}
