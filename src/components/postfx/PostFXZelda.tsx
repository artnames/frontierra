/**
 * PostFXZelda - Stylized post-processing (safe in Vite/Lovable preview)
 * Goal: noticeable art direction without crashing.
 *
 * IMPORTANT:
 * - We intentionally avoid SMAA + SSAO here (common crash sources in preview builds).
 * - We use ToneMapping effect, so set renderer.toneMapping = NoToneMapping in <Canvas>.
 */

import React from "react";
import {
  EffectComposer,
  Bloom,
  Vignette,
  HueSaturation,
  BrightnessContrast,
  FXAA,
  ToneMapping,
} from "@react-three/postprocessing";
import { BlendFunction, ToneMappingMode } from "postprocessing";

export type PostFXStrength = "subtle" | "strong";

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
    if (this.state.hasError) return null; // keep the game running
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

  const strong = strength === "strong";

  return (
    <PostFXErrorBoundary>
      <EffectComposer multisampling={0}>
        {/* Tone mapping in post (avoid double tone mapping) */}
        <ToneMapping mode={ToneMappingMode.ACES_FILMIC} />

        {/* Zelda-ish grade: more saturation + punch */}
        <HueSaturation blendFunction={BlendFunction.NORMAL} saturation={strong ? 0.28 : 0.16} hue={0} />
        <BrightnessContrast brightness={strong ? 0.03 : 0.015} contrast={strong ? 0.14 : 0.08} />

        {/* Soft highlight glow */}
        {bloomEnabled && (
          <Bloom
            intensity={strong ? 0.35 : 0.22}
            luminanceThreshold={strong ? 0.8 : 0.86}
            luminanceSmoothing={0.15}
            mipmapBlur
          />
        )}

        {/* Anti-aliasing that doesn't require texture assets */}
        <FXAA />

        {/* Frame it */}
        {vignetteEnabled && (
          <Vignette
            offset={strong ? 0.25 : 0.18}
            darkness={strong ? 0.45 : 0.35}
            blendFunction={BlendFunction.NORMAL}
          />
        )}
      </EffectComposer>
    </PostFXErrorBoundary>
  );
}
