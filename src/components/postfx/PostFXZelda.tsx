/**
 * PostFXZelda - Stylized post-processing for a game-like illustrated look
 * Safe mount: only creates EffectComposer once R3F has a valid size + client.
 */

import { Suspense, useEffect, useMemo, useState } from "react";
import { useThree } from "@react-three/fiber";
import {
  EffectComposer,
  Bloom,
  Vignette,
  HueSaturation,
  BrightnessContrast,
  SSAO,
  FXAA,
} from "@react-three/postprocessing";
import { BlendFunction } from "postprocessing";

interface PostFXZeldaProps {
  enabled?: boolean;
  aoEnabled?: boolean;
  bloomEnabled?: boolean;
  vignetteEnabled?: boolean;
}

export function PostFXZelda({
  enabled = true,
  aoEnabled = true,
  bloomEnabled = true,
  vignetteEnabled = true,
}: PostFXZeldaProps) {
  const { size } = useThree();
  const [clientReady, setClientReady] = useState(false);

  // SSR / first paint guard
  useEffect(() => {
    setClientReady(true);
  }, []);

  const hasSize = size.width > 0 && size.height > 0;
  const mount = enabled && clientReady && hasSize;

  // Key forces a clean re-init when size becomes valid (fixes refresh race)
  const composerKey = useMemo(() => `${size.width}x${size.height}`, [size.width, size.height]);

  if (!mount) return null;

  return (
    <Suspense fallback={null}>
      <EffectComposer key={composerKey} multisampling={0} enableNormalPass>
        {aoEnabled && (
          <SSAO
            blendFunction={BlendFunction.MULTIPLY}
            samples={16}
            radius={5}
            intensity={20}
            luminanceInfluence={0.5}
            bias={0.035}
          />
        )}

        <HueSaturation blendFunction={BlendFunction.NORMAL} saturation={0.18} hue={0} />

        <BrightnessContrast brightness={0.02} contrast={0.08} />

        {bloomEnabled && (
          <Bloom intensity={0.22} luminanceThreshold={0.82} luminanceSmoothing={0.15} mipmapBlur={true} />
        )}

        <FXAA />

        {vignetteEnabled && <Vignette offset={0.25} darkness={0.45} blendFunction={BlendFunction.NORMAL} />}
      </EffectComposer>
    </Suspense>
  );
}
