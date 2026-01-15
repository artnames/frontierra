/**
 * PostFXZelda - Stylized post-processing for a game-like illustrated look
 * 
 * Effects pipeline (in order):
 * 1. SSAO - Screen-space ambient occlusion for depth
 * 2. HueSaturation - Warm color grading boost
 * 3. BrightnessContrast - Punch up the image
 * 4. Bloom - Subtle glow on highlights (water, specular)
 * 5. SMAA - Anti-aliasing without blur
 * 6. Vignette - Frame the scene, draw focus to center
 * 
 * All effects are deterministic - no randomness or time-based variation.
 */

import { Suspense } from 'react';

import { 
  EffectComposer, 
  Bloom,
  Vignette,
  SMAA,
  HueSaturation,
  BrightnessContrast,
  SSAO,
} from '@react-three/postprocessing';
import { BlendFunction } from 'postprocessing';

interface PostFXZeldaProps {
  /** Enable/disable the entire effect stack */
  enabled?: boolean;
  /** Enable ambient occlusion (performance impact: medium) */
  aoEnabled?: boolean;
  /** Enable bloom effect (performance impact: low-medium) */
  bloomEnabled?: boolean;
  /** Enable vignette (performance impact: minimal) */
  vignetteEnabled?: boolean;
}

export function PostFXZelda({ 
  enabled = true,
  aoEnabled = true,
  bloomEnabled = true,
  vignetteEnabled = true,
}: PostFXZeldaProps) {
  if (!enabled) return null;
  
  return (
    <Suspense fallback={null}>
      <EffectComposer multisampling={0}>
        {/* 
          SSAO - Screen Space Ambient Occlusion
          Creates depth and grounding by darkening crevices and contact points.
          
          Tuning tips:
          - Increase radius for softer, broader shadows
          - Decrease intensity if dark areas look muddy
        */}
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
        
        {/* 
          HueSaturation - Color grading
          Boosts saturation for a more vibrant, illustrated game feel.
          
          saturation: 0.18 - Subtle boost, not cartoonish
          
          Tuning tips:
          - Range -1 to 1. Negative desaturates.
          - 0.15-0.25 gives a pleasant game-like pop
          - Above 0.3 starts looking oversaturated
        */}
        <HueSaturation
          blendFunction={BlendFunction.NORMAL}
          saturation={0.18}
          hue={0}
        />
        
        {/* 
          BrightnessContrast - Punch up the image
          Slight brightness lift with contrast boost for clarity.
          
          brightness: 0.02 - Tiny lift to avoid crushed blacks
          contrast: 0.08 - Subtle punch, makes edges read better
          
          Tuning tips:
          - Keep brightness near 0 to preserve shadows
          - Contrast 0.05-0.12 is the sweet spot
          - Too much contrast loses subtle terrain gradients
        */}
        <BrightnessContrast
          brightness={0.02}
          contrast={0.08}
        />
        
        {/* 
          Bloom - Glow on bright areas
          Adds subtle glow to water highlights and specular reflections.
          
          intensity: 0.22 - Subtle, not dreamy/hazy
          luminanceThreshold: 0.82 - Only brightest pixels bloom
          luminanceSmoothing: 0.15 - Gradual falloff from threshold
          mipmapBlur: true - High quality blur with better performance
          
          Tuning tips:
          - If terrain washes out, increase threshold to 0.88
          - Lower intensity (0.15) for more subtle effect
          - Increase to 0.35 for more fantasy/magical look
        */}
        {bloomEnabled && (
          <Bloom
            intensity={0.22}
            luminanceThreshold={0.82}
            luminanceSmoothing={0.15}
            mipmapBlur={true}
          />
        )}
        
        {/* 
          SMAA - Anti-aliasing
          NOTE: SMAA loads internal textures asynchronously; wrapping the composer
          in Suspense prevents a mount-time crash (undefined.length) if those
          textures aren't ready yet.
        */}
        <SMAA />
        
        {/* 
          Vignette - Frame the scene
          Darkens edges to draw focus to center, adds cinematic framing.
          
          offset: 0.25 - How far the vignette extends from center (0 = none, 1 = full)
          darkness: 0.45 - Intensity of the darkening
        */}
        {vignetteEnabled && (
          <Vignette
            offset={0.25}
            darkness={0.45}
            blendFunction={BlendFunction.NORMAL}
          />
        )}
      </EffectComposer>
    </Suspense>
  );
}
