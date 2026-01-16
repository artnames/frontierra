// src/components/postfx/PostFXZelda.tsx
import React, { memo } from "react";
import { EffectComposer, Noise } from "@react-three/postprocessing";

export type PostFXStrength = "subtle" | "strong" | "zelda";

export interface PostFXZeldaProps {
  enabled?: boolean;
  strength?: PostFXStrength;
  outlineEnabled?: boolean;
  bloomEnabled?: boolean;
  vignetteEnabled?: boolean;
  noiseEnabled?: boolean;
}

export const PostFXZelda = memo(function PostFXZelda(props: PostFXZeldaProps = {}) {
  const { enabled = true } = props;

  // Baseline: mounted, but visually a no-op.
  // IMPORTANT: EffectComposer must have at least ONE child, otherwise
  // @react-three/postprocessing can crash trying to read children.length.
  if (!enabled) return null;

  return (
    <EffectComposer multisampling={0} enableNormalPass={false}>
      {/* No-op placeholder (opacity 0) */}
      <Noise premultiply opacity={0} />
    </EffectComposer>
  );
});
