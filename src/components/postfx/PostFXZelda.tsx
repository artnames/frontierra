// src/components/postfx/PostFXZelda.tsx
import React, { memo } from "react";
import { EffectComposer } from "@react-three/postprocessing";

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

  if (!enabled) return null;

  // Empty composer: mounts the pipeline but applies no effects.
  return <EffectComposer multisampling={0} />;
});
