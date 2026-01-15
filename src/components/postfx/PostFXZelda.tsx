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
  Outline,
} from "@react-three/postprocessing";
import { BlendFunction, ToneMappingMode } from "postprocessing";

export type PostFXStrength = "subtle" | "strong" | "zelda";

export interface PostFXZeldaProps {
  enabled?: boolean;
  bloomEnabled?: boolean;
  vignetteEnabled?: boolean;
  outlineEnabled?: boolean;
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
  outlineEnabled = true,
  strength = "zelda",
}: PostFXZeldaProps) {
  if (!enabled) return null;

  const isSubtle = strength === "subtle";
  const isStrong = strength === "strong";
  const isZelda = strength === "zelda";

  const bits = isSubtle ? 24 : isStrong ? 16 : 12;

  return (
    <PostFXErrorBoundary>
      <EffectComposer multisampling={0} enableNormalPass>
        <ToneMapping mode={ToneMappingMode.ACES_FILMIC} />

        {/* Stronger “game palette” */}
        <HueSaturation
          blendFunction={BlendFunction.NORMAL}
          saturation={isSubtle ? 0.16 : isStrong ? 0.3 : 0.42}
          hue={0}
        />
        <BrightnessContrast
          brightness={isSubtle ? 0.01 : isStrong ? 0.03 : 0.04}
          contrast={isSubtle ? 0.12 : isStrong ? 0.2 : 0.28}
        />

        {/* Toon-ish banding + controlled dithering */}
        <ColorDepth bits={bits} />
        <Noise
          premultiply
          blendFunction={BlendFunction.SOFT_LIGHT}
          opacity={isSubtle ? 0.03 : isStrong ? 0.05 : 0.065}
        />

        {/* OUTLINES (the big win) */}
        {outlineEnabled && (
          <Outline
            blendFunction={BlendFunction.NORMAL}
            edgeStrength={isZelda ? 3.5 : isStrong ? 2.6 : 1.8}
            pulseSpeed={0}
            visibleEdgeColor={0x050505}
            hiddenEdgeColor={0x050505}
            width={isZelda ? 2.2 : isStrong ? 1.8 : 1.4} // thicker edges
          />
        )}

        {bloomEnabled && (
          <Bloom
            intensity={isSubtle ? 0.18 : isStrong ? 0.32 : 0.42}
            luminanceThreshold={isSubtle ? 0.88 : isStrong ? 0.82 : 0.78}
            luminanceSmoothing={0.15}
            mipmapBlur
          />
        )}

        <FXAA />

        {vignetteEnabled && <Vignette offset={0.0} darkness={1.0} blendFunction={BlendFunction.NORMAL} />}
      </EffectComposer>
    </PostFXErrorBoundary>
  );
}
