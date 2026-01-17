// PostFXZelda - Zelda: Breath of the Wild / Genshin Impact style post-processing
// Uses custom shaders for stability (no postprocessing library dependency)
// Properly handles sky dome, stars, and all scene elements

import { memo, useMemo, useEffect } from "react";
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

// Strength presets - tuned for Zelda/Genshin look
const STRENGTH_PRESETS = {
  subtle: {
    bloom: 0.08,
    vignette: 0.18,
    vignetteOffset: 0.93,
    saturation: 1.04,
    contrast: 1.02,
    warmth: 0.012,
    noise: 0.008,
  },
  strong: {
    bloom: 0.22,
    vignette: 0.32,
    vignetteOffset: 0.85,
    saturation: 1.14,
    contrast: 1.07,
    warmth: 0.032,
    noise: 0.018,
  },
  zelda: {
    bloom: 0.14,
    vignette: 0.22,
    vignetteOffset: 0.9,
    saturation: 1.08,
    contrast: 1.04,
    warmth: 0.02,
    noise: 0.01,
  },
};

// Screen-space post-processing shader
class ScreenPostFXMaterial extends THREE.ShaderMaterial {
  constructor() {
    super({
      uniforms: {
        tDiffuse: { value: null },
        uTime: { value: 0 },
        uResolution: { value: new THREE.Vector2(1, 1) },
        uVignetteStrength: { value: 0.22 },
        uVignetteOffset: { value: 0.9 },
        uVignetteEnabled: { value: 1.0 },
        uSaturation: { value: 1.08 },
        uContrast: { value: 1.04 },
        uWarmth: { value: 0.02 },
        uNoiseStrength: { value: 0.01 },
        uNoiseEnabled: { value: 1.0 },
        uBloomStrength: { value: 0.14 },
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
        
        // Smooth vignette
        float vignette(vec2 uv, float strength, float offset) {
          vec2 coord = (uv - 0.5) * 2.0;
          float dist = length(coord);
          return smoothstep(offset + strength, offset - strength * 0.4, dist);
        }
        
        // Color adjustments
        vec3 adjustSaturation(vec3 color, float sat) {
          float grey = dot(color, vec3(0.2126, 0.7152, 0.0722));
          return mix(vec3(grey), color, sat);
        }
        
        vec3 adjustContrast(vec3 color, float contrast) {
          return (color - 0.5) * contrast + 0.5;
        }
        
        vec3 applyWarmth(vec3 color, float warmth) {
          color.r += warmth;
          color.g += warmth * 0.3;
          color.b -= warmth * 0.4;
          return color;
        }
        
        // Soft glow bloom approximation
        vec3 getBloom(vec2 uv, vec2 texelSize) {
          vec3 bloom = vec3(0.0);
          
          // Sample in a cross pattern for soft glow
          const float samples = 8.0;
          const float radius = 4.0;
          
          for (float i = 1.0; i <= samples; i += 1.0) {
            float offset = i * radius;
            float weight = 1.0 - (i / samples) * 0.7;
            
            vec3 s1 = texture2D(tDiffuse, uv + vec2(offset, 0.0) * texelSize).rgb;
            vec3 s2 = texture2D(tDiffuse, uv - vec2(offset, 0.0) * texelSize).rgb;
            vec3 s3 = texture2D(tDiffuse, uv + vec2(0.0, offset) * texelSize).rgb;
            vec3 s4 = texture2D(tDiffuse, uv - vec2(0.0, offset) * texelSize).rgb;
            
            // Only bloom bright pixels
            float b1 = max(0.0, dot(s1, vec3(0.33)) - 0.7);
            float b2 = max(0.0, dot(s2, vec3(0.33)) - 0.7);
            float b3 = max(0.0, dot(s3, vec3(0.33)) - 0.7);
            float b4 = max(0.0, dot(s4, vec3(0.33)) - 0.7);
            
            bloom += s1 * b1 * weight;
            bloom += s2 * b2 * weight;
            bloom += s3 * b3 * weight;
            bloom += s4 * b4 * weight;
          }
          
          return bloom / (samples * 2.0);
        }
        
        void main() {
          vec4 base = texture2D(tDiffuse, vUv);
          vec3 color = base.rgb;
          vec2 texelSize = 1.0 / uResolution;
          
          // Add bloom
          if (uBloomEnabled > 0.5) {
            vec3 bloom = getBloom(vUv, texelSize);
            color += bloom * uBloomStrength;
          }
          
          // Color grading
          color = adjustSaturation(color, uSaturation);
          color = adjustContrast(color, uContrast);
          color = applyWarmth(color, uWarmth);
          
          // Vignette
          if (uVignetteEnabled > 0.5) {
            float vig = vignette(vUv, uVignetteStrength, uVignetteOffset);
            color *= mix(0.7, 1.0, vig);
          }
          
          // Film grain
          if (uNoiseEnabled > 0.5) {
            float n = hash(vUv * uResolution + fract(uTime * 43.0) * 100.0);
            color += (n - 0.5) * uNoiseStrength;
          }
          
          gl_FragColor = vec4(clamp(color, 0.0, 1.0), base.a);
        }
      `,
    });
  }
}

// PostFX renderer component
function PostFXEffect({
  strength = "zelda",
  bloomEnabled = true,
  vignetteEnabled = true,
  noiseEnabled = true,
}: Omit<PostFXZeldaProps, "enabled" | "outlineEnabled">) {
  const { gl, scene, camera, size } = useThree();
  const preset = STRENGTH_PRESETS[strength];

  // Render target to capture the scene
  const renderTarget = useMemo(() => {
    return new THREE.WebGLRenderTarget(size.width, size.height, {
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter,
      format: THREE.RGBAFormat,
      type: THREE.UnsignedByteType,
    });
  }, [size.width, size.height]);

  // Post material
  const postMaterial = useMemo(() => new ScreenPostFXMaterial(), []);

  // Fullscreen quad
  const fsQuad = useMemo(() => {
    const geo = new THREE.PlaneGeometry(2, 2);
    const mesh = new THREE.Mesh(geo, postMaterial);
    mesh.frustumCulled = false;
    return mesh;
  }, [postMaterial]);

  // Ortho camera for the post pass
  const orthoCamera = useMemo(() => {
    return new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  }, []);

  // Update uniforms
  useEffect(() => {
    postMaterial.uniforms.uVignetteStrength.value = preset.vignette;
    postMaterial.uniforms.uVignetteOffset.value = preset.vignetteOffset;
    postMaterial.uniforms.uVignetteEnabled.value = vignetteEnabled ? 1.0 : 0.0;
    postMaterial.uniforms.uSaturation.value = preset.saturation;
    postMaterial.uniforms.uContrast.value = preset.contrast;
    postMaterial.uniforms.uWarmth.value = preset.warmth;
    postMaterial.uniforms.uNoiseStrength.value = preset.noise;
    postMaterial.uniforms.uNoiseEnabled.value = noiseEnabled ? 1.0 : 0.0;
    postMaterial.uniforms.uBloomStrength.value = preset.bloom;
    postMaterial.uniforms.uBloomEnabled.value = bloomEnabled ? 1.0 : 0.0;
    postMaterial.uniforms.uResolution.value.set(size.width, size.height);
  }, [postMaterial, preset, bloomEnabled, vignetteEnabled, noiseEnabled, size]);

  // Update render target size
  useEffect(() => {
    renderTarget.setSize(size.width, size.height);
  }, [size, renderTarget]);

  // Cleanup
  useEffect(() => {
    return () => {
      renderTarget.dispose();
      postMaterial.dispose();
      fsQuad.geometry.dispose();
    };
  }, [renderTarget, postMaterial, fsQuad]);

  // Main render loop - runs after everything else
  useFrame(({ clock }) => {
    const currentRenderTarget = gl.getRenderTarget();
    const currentAutoClear = gl.autoClear;

    // Step 1: Render the entire scene to our render target
    gl.setRenderTarget(renderTarget);
    gl.autoClear = true;
    gl.clear();
    gl.render(scene, camera);

    // Step 2: Render post-processed result to screen
    gl.setRenderTarget(currentRenderTarget);
    gl.autoClear = false;

    postMaterial.uniforms.tDiffuse.value = renderTarget.texture;
    postMaterial.uniforms.uTime.value = clock.getElapsedTime();

    gl.clear();
    gl.render(fsQuad, orthoCamera);

    // Restore state
    gl.autoClear = currentAutoClear;
  }, 1000); // High priority number = runs last

  return null;
}

/**
 * PostFXZelda - Zelda/Genshin style post-processing
 *
 * Features:
 * - Soft bloom glow on bright areas
 * - Vignette for cinematic framing
 * - Color grading with warm saturated tones
 * - Subtle film grain for texture
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
