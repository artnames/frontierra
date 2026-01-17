// PostFXZelda - Zelda: Breath of the Wild / Genshin Impact style post-processing
// Stars and sky dome are rendered AFTER post-fx to avoid pixelation
// Uses custom shaders for stability (no postprocessing library dependency)

import { memo, useMemo, useEffect, useRef } from "react";
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

// Strength presets - tuned for Zelda/Genshin look with brighter nights
const STRENGTH_PRESETS = {
  subtle: {
    bloom: 0.06,
    vignette: 0.12,
    vignetteOffset: 0.95,
    saturation: 1.03,
    contrast: 1.01,
    warmth: 0.008,
    noise: 0.005,
  },
  strong: {
    bloom: 0.18,
    vignette: 0.28,
    vignetteOffset: 0.88,
    saturation: 1.12,
    contrast: 1.06,
    warmth: 0.025,
    noise: 0.014,
  },
  zelda: {
    bloom: 0.10,
    vignette: 0.16,
    vignetteOffset: 0.92,
    saturation: 1.06,
    contrast: 1.03,
    warmth: 0.015,
    noise: 0.006,
  },
};

// Screen-space post-processing shader - excludes sky layer
class ScreenPostFXMaterial extends THREE.ShaderMaterial {
  constructor() {
    super({
      uniforms: {
        tDiffuse: { value: null },
        uTime: { value: 0 },
        uResolution: { value: new THREE.Vector2(1, 1) },
        uVignetteStrength: { value: 0.16 },
        uVignetteOffset: { value: 0.92 },
        uVignetteEnabled: { value: 1.0 },
        uSaturation: { value: 1.06 },
        uContrast: { value: 1.03 },
        uWarmth: { value: 0.015 },
        uNoiseStrength: { value: 0.006 },
        uNoiseEnabled: { value: 1.0 },
        uBloomStrength: { value: 0.10 },
        uBloomEnabled: { value: 1.0 },
        uNightBoost: { value: 0.0 },
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
        uniform float uNightBoost;
        
        varying vec2 vUv;
        
        // Simple hash for film grain
        float hash(vec2 p) {
          return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453);
        }
        
        // Softer vignette for Zelda style
        float vignette(vec2 uv, float strength, float offset) {
          vec2 coord = (uv - 0.5) * 2.0;
          float dist = length(coord);
          return smoothstep(offset + strength, offset - strength * 0.5, dist);
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
          color.g += warmth * 0.4;
          color.b -= warmth * 0.3;
          return color;
        }
        
        // Softer bloom for Zelda/Genshin dreamy glow
        vec3 getBloom(vec2 uv, vec2 texelSize) {
          vec3 bloom = vec3(0.0);
          float totalWeight = 0.0;
          
          // Gaussian-like kernel for soft glow
          const float samples = 6.0;
          const float radius = 3.0;
          
          for (float i = 1.0; i <= samples; i += 1.0) {
            float offset = i * radius;
            float weight = exp(-i * 0.4); // Gaussian falloff
            
            vec3 s1 = texture2D(tDiffuse, uv + vec2(offset, 0.0) * texelSize).rgb;
            vec3 s2 = texture2D(tDiffuse, uv - vec2(offset, 0.0) * texelSize).rgb;
            vec3 s3 = texture2D(tDiffuse, uv + vec2(0.0, offset) * texelSize).rgb;
            vec3 s4 = texture2D(tDiffuse, uv - vec2(0.0, offset) * texelSize).rgb;
            vec3 s5 = texture2D(tDiffuse, uv + vec2(offset, offset) * 0.7 * texelSize).rgb;
            vec3 s6 = texture2D(tDiffuse, uv - vec2(offset, offset) * 0.7 * texelSize).rgb;
            
            // Only bloom bright pixels - lower threshold for dreamy effect
            float threshold = 0.5;
            float b1 = max(0.0, dot(s1, vec3(0.33)) - threshold);
            float b2 = max(0.0, dot(s2, vec3(0.33)) - threshold);
            float b3 = max(0.0, dot(s3, vec3(0.33)) - threshold);
            float b4 = max(0.0, dot(s4, vec3(0.33)) - threshold);
            float b5 = max(0.0, dot(s5, vec3(0.33)) - threshold);
            float b6 = max(0.0, dot(s6, vec3(0.33)) - threshold);
            
            bloom += (s1 * b1 + s2 * b2 + s3 * b3 + s4 * b4 + s5 * b5 + s6 * b6) * weight;
            totalWeight += weight * 6.0;
          }
          
          return bloom / max(totalWeight, 1.0);
        }
        
        void main() {
          vec4 base = texture2D(tDiffuse, vUv);
          vec3 color = base.rgb;
          vec2 texelSize = 1.0 / uResolution;
          
          // Night brightness boost for playability
          if (uNightBoost > 0.0) {
            float luminance = dot(color, vec3(0.2126, 0.7152, 0.0722));
            // Lift shadows more than highlights
            float lift = uNightBoost * (1.0 - luminance * 0.5);
            color += lift * vec3(0.08, 0.1, 0.14); // Slight blue tint for moonlight
          }
          
          // Add soft bloom
          if (uBloomEnabled > 0.5) {
            vec3 bloom = getBloom(vUv, texelSize);
            color += bloom * uBloomStrength;
          }
          
          // Color grading - gentle Zelda style
          color = adjustSaturation(color, uSaturation);
          color = adjustContrast(color, uContrast);
          color = applyWarmth(color, uWarmth);
          
          // Soft vignette
          if (uVignetteEnabled > 0.5) {
            float vig = vignette(vUv, uVignetteStrength, uVignetteOffset);
            color *= mix(0.75, 1.0, vig);
          }
          
          // Very subtle film grain
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

// Layer masks
const LAYER_TERRAIN = 0; // Default layer - terrain, trees, etc.
const LAYER_SKY = 1; // Sky dome, stars, sun/moon

// PostFX renderer component - renders terrain through post-fx, sky directly
function PostFXEffect({
  strength = "zelda",
  bloomEnabled = true,
  vignetteEnabled = true,
  noiseEnabled = true,
}: Omit<PostFXZeldaProps, "enabled" | "outlineEnabled">) {
  const { gl, scene, camera, size } = useThree();
  const preset = STRENGTH_PRESETS[strength];
  const skyLayerRef = useRef<THREE.Layers>(new THREE.Layers());

  // Setup layers on mount
  useEffect(() => {
    // Tag sky objects to be excluded from post-fx
    scene.traverse((obj) => {
      // Objects with renderOrder < -900 are sky elements
      if (obj.renderOrder <= -900) {
        obj.layers.set(LAYER_SKY);
      }
    });
  }, [scene]);

  // Render target to capture the scene (terrain only)
  const renderTarget = useMemo(() => {
    const dpr = Math.min(window.devicePixelRatio, 2);
    return new THREE.WebGLRenderTarget(
      Math.floor(size.width * dpr),
      Math.floor(size.height * dpr),
      {
        minFilter: THREE.LinearFilter,
        magFilter: THREE.LinearFilter,
        format: THREE.RGBAFormat,
        type: THREE.UnsignedByteType,
      }
    );
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

  // Detect night for brightness boost
  const getNightBoost = () => {
    // Check scene background luminance to detect night
    const bg = scene.background;
    if (bg && bg instanceof THREE.Color) {
      const luminance = bg.r * 0.2126 + bg.g * 0.7152 + bg.b * 0.0722;
      if (luminance < 0.15) {
        return Math.max(0, 0.25 - luminance); // Boost dark scenes
      }
    }
    return 0;
  };

  // Update uniforms
  useEffect(() => {
    const dpr = Math.min(window.devicePixelRatio, 2);
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
    postMaterial.uniforms.uResolution.value.set(
      size.width * dpr,
      size.height * dpr
    );
  }, [postMaterial, preset, bloomEnabled, vignetteEnabled, noiseEnabled, size]);

  // Update render target size
  useEffect(() => {
    const dpr = Math.min(window.devicePixelRatio, 2);
    renderTarget.setSize(
      Math.floor(size.width * dpr),
      Math.floor(size.height * dpr)
    );
  }, [size, renderTarget]);

  // Cleanup
  useEffect(() => {
    return () => {
      renderTarget.dispose();
      postMaterial.dispose();
      fsQuad.geometry.dispose();
    };
  }, [renderTarget, postMaterial, fsQuad]);

  // Main render loop
  useFrame(({ clock }) => {
    const currentRenderTarget = gl.getRenderTarget();
    const currentAutoClear = gl.autoClear;

    // Update night boost
    postMaterial.uniforms.uNightBoost.value = getNightBoost();

    // Ensure camera sees both layers
    const originalMask = camera.layers.mask;

    // Step 1: Render terrain layer only to render target
    camera.layers.set(LAYER_TERRAIN);
    gl.setRenderTarget(renderTarget);
    gl.autoClear = true;
    gl.clear();

    // Temporarily hide sky objects
    const skyObjects: THREE.Object3D[] = [];
    scene.traverse((obj) => {
      if (obj.renderOrder <= -900 && obj.visible) {
        skyObjects.push(obj);
        obj.visible = false;
      }
    });

    gl.render(scene, camera);

    // Restore sky objects
    skyObjects.forEach((obj) => (obj.visible = true));

    // Step 2: Render post-processed terrain to screen
    gl.setRenderTarget(currentRenderTarget);
    gl.autoClear = true;
    gl.clear();

    postMaterial.uniforms.tDiffuse.value = renderTarget.texture;
    postMaterial.uniforms.uTime.value = clock.getElapsedTime();

    gl.render(fsQuad, orthoCamera);

    // Step 3: Render sky layer directly on top (no post-fx, native resolution)
    gl.autoClear = false;
    camera.layers.enableAll();

    // Re-hide terrain, show only sky
    const terrainObjects: THREE.Object3D[] = [];
    scene.traverse((obj) => {
      if (obj.renderOrder > -900 && obj.visible && obj !== fsQuad) {
        terrainObjects.push(obj);
        obj.visible = false;
      }
    });

    // Clear depth for sky to render on top
    gl.clearDepth();
    gl.render(scene, camera);

    // Restore terrain
    terrainObjects.forEach((obj) => (obj.visible = true));

    // Restore camera layers
    camera.layers.mask = originalMask;
    gl.autoClear = currentAutoClear;
  }, 1000); // High priority = runs last

  return null;
}

/**
 * PostFXZelda - Zelda/Genshin style post-processing
 *
 * Features:
 * - Soft dreamy bloom on bright areas
 * - Gentle vignette for cinematic framing
 * - Warm color grading with slight saturation boost
 * - Very subtle film grain for texture
 * - Night brightness boost for playability
 * - Sky/stars rendered at native resolution (not pixelated)
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
