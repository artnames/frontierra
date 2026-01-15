import { Suspense } from "react";
import {
  EffectComposer,
  Bloom,
  Vignette,
  HueSaturation,
  BrightnessContrast,
  Outline,
  FXAA,
} from "@react-three/postprocessing";
import { BlendFunction, KernelSize } from "postprocessing";

type Strength = "subtle" | "medium" | "strong";

export interface PostFXZeldaProps {
  enabled?: boolean;

  // stylization toggles
  outlineEnabled?: boolean;
  bloomEnabled?: boolean;
  vignetteEnabled?: boolean;

  // look preset
  strength?: Strength;
}

const PRESET: Record<Strength, { outlineStrength: number; bloom: number; sat: number; contrast: number }> = {
  subtle: { outlineStrength: 2.0, bloom: 0.12, sat: 0.12, contrast: 0.06 },
  medium: { outlineStrength: 4.5, bloom: 0.18, sat: 0.18, contrast: 0.1 },
  strong: { outlineStrength: 7.5, bloom: 0.26, sat: 0.26, contrast: 0.14 },
};

export function PostFXZelda({
  enabled = true,
  outlineEnabled = true,
  bloomEnabled = true,
  vignetteEnabled = true,
  strength = "strong",
}: PostFXZeldaProps) {
  if (!enabled) return null;

  const p = PRESET[strength];

  return (
    <Suspense fallback={null}>
      {/* enableNormalPass helps Outline (and future AO) */}
      <EffectComposer multisampling={0} enableNormalPass>
        {/* CARTOON OUTLINE (requires Selection/Select in WorldExplorer) */}
        {outlineEnabled && (
          <Outline
            blendFunction={BlendFunction.NORMAL}
            edgeStrength={p.outlineStrength}
            pulseSpeed={0}
            visibleEdgeColor={0x0a0a0a}
            hiddenEdgeColor={0x0a0a0a}
            xRay={false}
            blur
            kernelSize={KernelSize.MEDIUM}
          />
        )}

        {/* Color pop */}
        <HueSaturation saturation={p.sat} hue={0} />
        <BrightnessContrast brightness={0.01} contrast={p.contrast} />

        {/* Subtle highlight glow */}
        {bloomEnabled && <Bloom intensity={p.bloom} luminanceThreshold={0.78} luminanceSmoothing={0.15} mipmapBlur />}

        {/* AA without SMAA crash */}
        <FXAA />

        {vignetteEnabled && <Vignette offset={0.25} darkness={0.45} />}
      </EffectComposer>
    </Suspense>
  );
}
