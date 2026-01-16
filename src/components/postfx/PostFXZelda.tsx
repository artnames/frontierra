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
  Outline,
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
class OutlineBoundary extends React.Component<{ children: React.ReactNode }, { hasError: boolean }> {
  state = { hasError: false };
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  componentDidCatch(err: any) {
    console.warn("[PostFX] Outline disabled due to error:", err);
  }
  render() {
    return this.state.hasError ? null : this.props.children;
  }
}
export const PostFXZelda = memo(function PostFXZelda({
  enabled = true,
  strength = "zelda",
  outlineEnabled = true,
  bloomEnabled = true,
  vignetteEnabled = true,
  noiseEnabled = true,
}: PostFXZeldaProps) {
  if (!enabled) return null;

  const [outlineReady, setOutlineReady] = useState(false);

  useEffect(() => {
    let raf1 = requestAnimationFrame(() => {
      let raf2 = requestAnimationFrame(() => setOutlineReady(true));
      // @ts-ignore
      PostFXZelda.__raf2 = raf2;
    });
    return () => {
      cancelAnimationFrame(raf1);
      // @ts-ignore
      if (PostFXZelda.__raf2) cancelAnimationFrame(PostFXZelda.__raf2);
    };
  }, []);

  const isSubtle = strength === "subtle";
  const isStrong = strength === "strong";
  const isZelda = strength === "zelda";

  const sat = isSubtle ? 0.18 : isStrong ? 0.38 : 0.62;
  const bright = isSubtle ? 0.02 : isStrong ? 0.04 : 0.06;
  const contrast = isSubtle ? 0.12 : isStrong ? 0.22 : 0.34;

  const vignetteDark = isSubtle ? 0.45 : isStrong ? 0.68 : 0.82;
  const vignetteOffset = isSubtle ? 0.12 : isStrong ? 0.06 : 0.02;

  const bloomIntensity = isSubtle ? 0.18 : isStrong ? 0.35 : 0.55;
  const bloomThreshold = isSubtle ? 0.88 : isStrong ? 0.84 : 0.8;

  const edgeStrength = isZelda ? 6.0 : isStrong ? 4.0 : 2.5;
  const edgeWidth = isZelda ? 3.0 : isStrong ? 2.2 : 1.6;

  return (
    <EffectComposer multisampling={0}>
      <ToneMapping
        mode={ToneMappingMode.ACES_FILMIC}
        resolution={256}
        whitePoint={16.0}
        middleGrey={0.6}
        minLuminance={0.01}
        averageLuminance={0.6}
        adaptationRate={1.0}
      />

      <HueSaturation hue={0} saturation={sat} />
      <BrightnessContrast brightness={bright} contrast={contrast} />

      {bloomEnabled && (
        <Bloom intensity={bloomIntensity} luminanceThreshold={bloomThreshold} luminanceSmoothing={0.12} mipmapBlur />
      )}

      {/* ✅ Stable: outline objects in THREE layer 1 (no Selection/Select) */}
      {outlineEnabled && outlineReady && (
        <OutlineBoundary>
          <Outline
            selectionLayer={1}
            blendFunction={BlendFunction.NORMAL}
            edgeStrength={edgeStrength}
            width={edgeWidth}
            pulseSpeed={0}
            visibleEdgeColor={0x050505}
            hiddenEdgeColor={0x050505}
          />
        </OutlineBoundary>
      )}

      <FXAA />

      {vignetteEnabled && (
        <Vignette eskil={false} offset={vignetteOffset} darkness={vignetteDark} blendFunction={BlendFunction.NORMAL} />
      )}

      {noiseEnabled && <Noise premultiply opacity={isSubtle ? 0.03 : isStrong ? 0.05 : 0.07} />}
    </EffectComposer>
  );
});
