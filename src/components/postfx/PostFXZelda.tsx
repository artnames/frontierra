// src/components/postfx/PostFXZelda.tsx
import { memo } from "react";

export type PostFXStrength = "subtle" | "strong" | "zelda";

export interface PostFXZeldaProps {
  enabled?: boolean;
  strength?: PostFXStrength;
  outlineEnabled?: boolean;
  bloomEnabled?: boolean;
  vignetteEnabled?: boolean;
  noiseEnabled?: boolean;
}

/**
 * HARD NO-OP VERSION
 * - Intentionally does not import @react-three/postprocessing or postprocessing.
 * - This is only to confirm whether the crash is caused by those imports.
 */
export const PostFXZelda = memo(function PostFXZelda(_props: PostFXZeldaProps) {
  return null;
});
