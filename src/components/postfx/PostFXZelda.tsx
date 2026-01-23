// PostFXZelda - Zelda: Breath of the Wild / Genshin Impact style post-processing
// BRIGHT & VIBRANT version - emphasizes color and light, minimal darkening
// Properly handles sky dome, stars, and all scene elements

import { memo, useEffect, useRef } from "react";
import { useThree, useFrame } from "@react-three/fiber";
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

// Strength presets - tuned for BRIGHT Zelda/Genshin look
// VIGNETTE FIX: Made vignette almost invisible - just a subtle focus hint
const STRENGTH_PRESETS = {
  subtle: {
    bloom: 0.15,
    vignette: 0.008, // Almost invisible
    vignetteOffset: 1.0, // At extreme edges only
    saturation: 1.12,
    contrast: 1.02,
    brightness: 1.08,
    warmth: 0.018,
    noise: 0.005,
  },
  strong: {
    bloom: 0.28,
    vignette: 0.015, // Very subtle
    vignetteOffset: 0.99, // Far to edges
    saturation: 1.22,
    contrast: 1.05,
    brightness: 1.12,
    warmth: 0.03,
    noise: 0.01,
  },
  // "zelda" preset - vivid colors, barely-there vignette
  zelda: {
    bloom: 0.22,
    vignette: 0.01, // Barely visible - just gentle focus
    vignetteOffset: 1.0, // At extreme edges only
    saturation: 1.18,
    contrast: 1.04,
    brightness: 1.1,
    warmth: 0.025,
    noise: 0.006,
  },
};

// Screen-space post-processing shader - BRIGHT version
class ScreenPostFXMaterial extends THREE.ShaderMaterial {
  constructor() {
    super({
      uniforms: {
        tDiffuse: { value: null },
        uTime: { value: 0 },
        uResolution: { value: new THREE.Vector2(1, 1) },
        uVignetteStrength: { value: 0.1 },
        uVignetteOffset: { value: 0.94 },
        uVignetteEnabled: { value: 1.0 },
        uSaturation: { value: 1.12 },
        uContrast: { value: 1.0 },
        uBrightness: { value: 1.06 },
        uWarmth: { value: 0.02 },
        uNoiseStrength: { value: 0.008 },
        uNoiseEnabled: { value: 1.0 },
        uBloomStrength: { value: 0.18 },
        uBloomEnabled: { value: 1.0 },
      },
      vertexShader: `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform sampler2D tDiffuse;
        uniform float uTime;
        uniform vec2 uResolution;
        
        uniform float uVignetteStrength;
        uniform float uVignetteOffset;
        uniform float uVignetteEnabled;
        uniform float uSaturation;
        uniform float uContrast;
        uniform float uBrightness;
        uniform float uWarmth;
        uniform float uNoiseStrength;
        uniform float uNoiseEnabled;
        uniform float uBloomStrength;
        uniform float uBloomEnabled;
        
        varying vec2 vUv;
        
        // Simple hash for film grain
        float hash(vec2 p) {
          return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453);
        }
        
        // Ultra-soft vignette - almost invisible, just subtle focus hint at extreme edges
        float vignette(vec2 uv, float strength, float offset) {
          vec2 coord = (uv - 0.5) * 2.0;
          float dist = length(coord);
          // Extremely gentle falloff - 0.08 means max 8% darkening at corners
          float vig = 1.0 - smoothstep(offset, offset + strength * 4.0, dist) * 0.08;
          return vig;
        }
        
        // Color adjustments
        vec3 adjustSaturation(vec3 color, float sat) {
          float grey = dot(color, vec3(0.2126, 0.7152, 0.0722));
          return mix(vec3(grey), color, sat);
        }
        
        // Soft contrast that doesn't crush blacks
        vec3 adjustContrast(vec3 color, float contrast) {
          // Use a midpoint slightly above 0.5 to preserve shadows
          return (color - 0.45) * contrast + 0.45;
        }
        
        // Warm color shift - adds golden sunlight feel
        vec3 applyWarmth(vec3 color, float warmth) {
          color.r += warmth;
          color.g += warmth * 0.5;
          color.b -= warmth * 0.3;
          return color;
        }
        
        // Soft glow bloom - emphasizes highlights
        vec3 getBloom(vec2 uv, vec2 texelSize) {
          vec3 bloom = vec3(0.0);
          
          const float samples = 8.0;
          const float radius = 3.0;
          
          for (float i = 1.0; i <= samples; i += 1.0) {
            float offset = i * radius;
            float weight = 1.0 - (i / samples) * 0.6;
            
            vec3 s1 = texture2D(tDiffuse, uv + vec2(offset, 0.0) * texelSize).rgb;
            vec3 s2 = texture2D(tDiffuse, uv - vec2(offset, 0.0) * texelSize).rgb;
            vec3 s3 = texture2D(tDiffuse, uv + vec2(0.0, offset) * texelSize).rgb;
            vec3 s4 = texture2D(tDiffuse, uv - vec2(0.0, offset) * texelSize).rgb;
            vec3 s5 = texture2D(tDiffuse, uv + vec2(offset, offset) * 0.7 * texelSize).rgb;
            vec3 s6 = texture2D(tDiffuse, uv - vec2(offset, offset) * 0.7 * texelSize).rgb;
            
            // Bloom threshold - only very bright areas
            float threshold = 0.65;
            float b1 = max(0.0, dot(s1, vec3(0.33)) - threshold);
            float b2 = max(0.0, dot(s2, vec3(0.33)) - threshold);
            float b3 = max(0.0, dot(s3, vec3(0.33)) - threshold);
            float b4 = max(0.0, dot(s4, vec3(0.33)) - threshold);
            float b5 = max(0.0, dot(s5, vec3(0.33)) - threshold);
            float b6 = max(0.0, dot(s6, vec3(0.33)) - threshold);
            
            bloom += s1 * b1 * weight;
            bloom += s2 * b2 * weight;
            bloom += s3 * b3 * weight;
            bloom += s4 * b4 * weight;
            bloom += s5 * b5 * weight * 0.7;
            bloom += s6 * b6 * weight * 0.7;
          }
          
          return bloom / (samples * 1.5);
        }
        
        void main() {
          vec4 base = texture2D(tDiffuse, vUv);
          vec3 color = base.rgb;
          vec2 texelSize = 1.0 / uResolution;
          
          // Brightness boost FIRST (lifts the whole image)
          color *= uBrightness;
          
          // Add soft bloom
          if (uBloomEnabled > 0.5) {
            vec3 bloom = getBloom(vUv, texelSize);
            color += bloom * uBloomStrength;
          }
          
          // Color grading
          color = adjustSaturation(color, uSaturation);
          color = adjustContrast(color, uContrast);
          color = applyWarmth(color, uWarmth);
          
          // Very soft vignette (barely visible)
          if (uVignetteEnabled > 0.5) {
            float vig = vignette(vUv, uVignetteStrength, uVignetteOffset);
            color *= vig;
          }
          
          // Subtle film grain
          if (uNoiseEnabled > 0.5) {
            float n = hash(vUv * uResolution + fract(uTime * 43.0) * 100.0);
            color += (n - 0.5) * uNoiseStrength;
          }
          
          // Soft highlight rolloff (prevents harsh clipping)
          color = color / (color + vec3(0.5)) * 1.5;
          
          gl_FragColor = vec4(clamp(color, 0.0, 1.0), base.a);
        }
      `,
    });
  }
}

// PostFX renderer component
// FIX: Proper lifecycle management - create resources once, dispose on unmount only
function PostFXEffect({
  strength = "zelda",
  bloomEnabled = true,
  vignetteEnabled = true,
  noiseEnabled = true,
}: Omit<PostFXZeldaProps, "enabled" | "outlineEnabled">) {
  const { gl, scene, camera, size } = useThree();
  const preset = STRENGTH_PRESETS[strength];

  // FIX: Use refs to track resources for proper lifecycle
  const renderTargetRef = useRef<THREE.WebGLRenderTarget | null>(null);
  const postMaterialRef = useRef<ScreenPostFXMaterial | null>(null);
  const fsQuadRef = useRef<THREE.Mesh | null>(null);
  const orthoCameraRef = useRef<THREE.OrthographicCamera | null>(null);
  const geometryRef = useRef<THREE.PlaneGeometry | null>(null);

  // FIX: Create resources only once (lazy initialization)
  if (!renderTargetRef.current) {
    renderTargetRef.current = new THREE.WebGLRenderTarget(size.width, size.height, {
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter,
      format: THREE.RGBAFormat,
      type: THREE.UnsignedByteType,
    });
  }

  if (!postMaterialRef.current) {
    postMaterialRef.current = new ScreenPostFXMaterial();
  }

  if (!geometryRef.current) {
    geometryRef.current = new THREE.PlaneGeometry(2, 2);
  }

  if (!fsQuadRef.current && postMaterialRef.current && geometryRef.current) {
    fsQuadRef.current = new THREE.Mesh(geometryRef.current, postMaterialRef.current);
    fsQuadRef.current.frustumCulled = false;
  }

  if (!orthoCameraRef.current) {
    orthoCameraRef.current = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  }

  const renderTarget = renderTargetRef.current;
  const postMaterial = postMaterialRef.current;
  const fsQuad = fsQuadRef.current;
  const orthoCamera = orthoCameraRef.current;

  // Update uniforms
  useEffect(() => {
    if (!postMaterial) return;
    postMaterial.uniforms.uVignetteStrength.value = preset.vignette;
    postMaterial.uniforms.uVignetteOffset.value = preset.vignetteOffset;
    postMaterial.uniforms.uVignetteEnabled.value = vignetteEnabled ? 1.0 : 0.0;
    postMaterial.uniforms.uSaturation.value = preset.saturation;
    postMaterial.uniforms.uContrast.value = preset.contrast;
    postMaterial.uniforms.uBrightness.value = preset.brightness;
    postMaterial.uniforms.uWarmth.value = preset.warmth;
    postMaterial.uniforms.uNoiseStrength.value = preset.noise;
    postMaterial.uniforms.uNoiseEnabled.value = noiseEnabled ? 1.0 : 0.0;
    postMaterial.uniforms.uBloomStrength.value = preset.bloom;
    postMaterial.uniforms.uBloomEnabled.value = bloomEnabled ? 1.0 : 0.0;
    postMaterial.uniforms.uResolution.value.set(size.width, size.height);
  }, [postMaterial, preset, bloomEnabled, vignetteEnabled, noiseEnabled, size]);

  // FIX: Resize render target without recreating it
  useEffect(() => {
    if (renderTarget) {
      renderTarget.setSize(size.width, size.height);
    }
  }, [size.width, size.height, renderTarget]);

  // FIX: Cleanup ONLY on unmount - dispose all resources once
  useEffect(() => {
    return () => {
      if (renderTargetRef.current) {
        renderTargetRef.current.dispose();
        renderTargetRef.current = null;
      }
      if (postMaterialRef.current) {
        postMaterialRef.current.dispose();
        postMaterialRef.current = null;
      }
      if (geometryRef.current) {
        geometryRef.current.dispose();
        geometryRef.current = null;
      }
      fsQuadRef.current = null;
      orthoCameraRef.current = null;
    };
  }, []);

  // Main render loop - runs after everything else
  useFrame(({ clock }) => {
    const currentRenderTarget = gl.getRenderTarget();
    const currentAutoClear = gl.autoClear;

    // Step 1: Render entire scene to render target
    gl.setRenderTarget(renderTarget);
    gl.autoClear = true;
    gl.clear();
    gl.render(scene, camera);

    // Step 2: Apply post-processing and render to screen
    gl.setRenderTarget(currentRenderTarget);
    gl.autoClear = false;

    postMaterial.uniforms.tDiffuse.value = renderTarget.texture;
    postMaterial.uniforms.uTime.value = clock.getElapsedTime();

    gl.clear();
    gl.render(fsQuad, orthoCamera);

    // Restore state
    gl.autoClear = currentAutoClear;
  }, 1000);

  return null;
}

/**
 * PostFXZelda - BRIGHT & VIBRANT Zelda/Genshin style
 *
 * Key differences from standard PostFX:
 * - Brightness boost instead of darkening
 * - Very soft vignette (barely visible)
 * - Warm color grading
 * - Soft bloom on highlights
 * - No contrast crushing
 */
export const PostFXZelda = memo(function PostFXZelda({
  enabled = true,
  strength = "zelda",
  outlineEnabled = false,
  bloomEnabled = true,
  vignetteEnabled = true,
  noiseEnabled = true,
}: PostFXZeldaProps) {
  if (!enabled) return null;

  return (
    <PostFXEffect
      strength={strength}
      bloomEnabled={bloomEnabled}
      vignetteEnabled={vignetteEnabled}
      noiseEnabled={noiseEnabled}
    />
  );
});
