// src/components/postfx/PostFXZelda.tsx
import React, { memo, useEffect, useMemo, useState } from "react";
import { useThree } from "@react-three/fiber";
import {
  EffectComposer,
  Bloom,
  Vignette,
  HueSaturation,
  BrightnessContrast,
  Noise,
  FXAA,
  ToneMapping,
  Outline,
} from "@react-three/postprocessing";
import { BlendFunction, ToneMappingMode } from "postprocessing";
import * as THREE from "three";

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
  const { scene } = useThree();

  // Delay outline mount a couple frames to avoid "selection not ready" / init timing issues
  const [outlineReady, setOutlineReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let raf1 = requestAnimationFrame(() => {
      if (cancelled) return;
      let raf2 = requestAnimationFrame(() => {
        if (!cancelled) setOutlineReady(true);
      });
      return () => cancelAnimationFrame(raf2);
    });
    return () => {
      cancelled = true;
      cancelAnimationFrame(raf1);
    };
  }, []);

  // Check we actually have meshes on layer 1 before enabling outline
  // Only run this check after outlineReady to ensure scene is populated
  const hasLayer1Meshes = useMemo(() => {
    if (!outlineReady) return false;
    if (!scene || !scene.children || scene.children.length === 0) return false;

    let found = false;
    const mask = new THREE.Layers();
    mask.set(1);

    try {
      scene.traverse((o: any) => {
        if (found) return;
        if (o && (o.isMesh || o.isInstancedMesh) && o.layers && o.layers.test) {
          if (o.layers.test(mask)) found = true;
        }
      });
    } catch (e) {
      console.warn("[PostFXZelda] Error traversing scene:", e);
      return false;
    }

    return found;
  }, [scene, outlineReady, scene.children?.length]);

  if (!enabled) return null;

  const isSubtle = strength === "subtle";
  const isStrong = strength === "strong";
  const isZelda = strength === "zelda";

  // Grade hard enough that it's obvious
  const sat = isSubtle ? 0.22 : isStrong ? 0.45 : 0.75;
  const bright = isSubtle ? 0.03 : isStrong ? 0.06 : 0.09;
  const contrast = isSubtle ? 0.18 : isStrong ? 0.32 : 0.48;

  // Vignette that you *will* see
  const vignetteOffset = isSubtle ? 0.35 : isStrong ? 0.42 : 0.48;
  const vignetteDark = isSubtle ? 0.55 : isStrong ? 0.72 : 0.85;

  // Bloom that reads "cartoon glow"
  const bloomIntensity = isSubtle ? 0.25 : isStrong ? 0.5 : 0.85;
  const bloomThreshold = isSubtle ? 0.9 : isStrong ? 0.85 : 0.78;

  // Thicker outlines for "Zelda-ish"
  const edgeStrength = isZelda ? 5.5 : isStrong ? 4.0 : 2.5;
  const edgeWidth = isZelda ? 2.6 : isStrong ? 2.0 : 1.5;

  const shouldOutline = outlineEnabled && outlineReady && hasLayer1Meshes;

  return (
    <EffectComposer multisampling={0} enableNormalPass={shouldOutline}>
      <ToneMapping mode={ToneMappingMode.ACES_FILMIC} />
      <HueSaturation hue={0} saturation={sat} />
      <BrightnessContrast brightness={bright} contrast={contrast} />
      {bloomEnabled && (
        <Bloom intensity={bloomIntensity} luminanceThreshold={bloomThreshold} luminanceSmoothing={0.12} mipmapBlur />
      )}
      {shouldOutline && (
        <Outline
          selectionLayer={1}
          blendFunction={BlendFunction.NORMAL}
          edgeStrength={edgeStrength}
          width={edgeWidth}
          pulseSpeed={0}
          visibleEdgeColor={0x050505}
          hiddenEdgeColor={0x050505}
        />
      )}
      <FXAA />
      {vignetteEnabled && (
        <Vignette eskil={false} offset={vignetteOffset} darkness={vignetteDark} blendFunction={BlendFunction.NORMAL} />
      )}
      {noiseEnabled && <Noise premultiply opacity={isSubtle ? 0.04 : isStrong ? 0.06 : 0.085} />}
    </EffectComposer>
  );
});
