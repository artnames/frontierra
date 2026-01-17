// PostFXZelda - Zelda: Breath of the Wild / Genshin Impact style post-processing
// Uses custom shaders for stability (no postprocessing library dependency)

import { memo, useRef, useMemo, useEffect } from "react";
import { useThree, useFrame, extend } from "@react-three/fiber";
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

// Strength presets
const STRENGTH_PRESETS = {
  subtle: {
    bloom: 0.15,
    bloomThreshold: 0.85,
    vignette: 0.25,
    vignetteOffset: 0.9,
    saturation: 1.05,
    contrast: 1.02,
    warmth: 0.02,
    noise: 0.015,
  },
  strong: {
    bloom: 0.35,
    bloomThreshold: 0.7,
    vignette: 0.4,
    vignetteOffset: 0.85,
    saturation: 1.15,
    contrast: 1.08,
    warmth: 0.04,
    noise: 0.025,
  },
  zelda: {
    bloom: 0.25,
    bloomThreshold: 0.75,
    vignette: 0.3,
    vignetteOffset: 0.88,
    saturation: 1.12,
    contrast: 1.05,
    warmth: 0.035,
    noise: 0.018,
  },
};

// Custom shader material for the final composite pass
class ZeldaPostFXMaterial extends THREE.ShaderMaterial {
  constructor() {
    super({
      uniforms: {
        tDiffuse: { value: null },
        tBloom: { value: null },
        uTime: { value: 0 },
        uResolution: { value: new THREE.Vector2(1, 1) },
        // Effect controls
        uBloomStrength: { value: 0.25 },
        uBloomEnabled: { value: 1.0 },
        uVignetteStrength: { value: 0.3 },
        uVignetteOffset: { value: 0.88 },
        uVignetteEnabled: { value: 1.0 },
        uSaturation: { value: 1.12 },
        uContrast: { value: 1.05 },
        uWarmth: { value: 0.035 },
        uNoiseStrength: { value: 0.018 },
        uNoiseEnabled: { value: 1.0 },
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
        uniform sampler2D tBloom;
        uniform float uTime;
        uniform vec2 uResolution;
        
        uniform float uBloomStrength;
        uniform float uBloomEnabled;
        uniform float uVignetteStrength;
        uniform float uVignetteOffset;
        uniform float uVignetteEnabled;
        uniform float uSaturation;
        uniform float uContrast;
        uniform float uWarmth;
        uniform float uNoiseStrength;
        uniform float uNoiseEnabled;
        
        varying vec2 vUv;
        
        // Film grain noise
        float hash(vec2 p) {
          return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453);
        }
        
        // Soft vignette
        float vignette(vec2 uv, float strength, float offset) {
          vec2 coord = (uv - 0.5) * 2.0;
          float dist = length(coord);
          float vig = smoothstep(offset + strength, offset - strength * 0.5, dist);
          return vig;
        }
        
        // Saturation adjustment
        vec3 adjustSaturation(vec3 color, float saturation) {
          float grey = dot(color, vec3(0.2126, 0.7152, 0.0722));
          return mix(vec3(grey), color, saturation);
        }
        
        // Contrast adjustment with midpoint preservation
        vec3 adjustContrast(vec3 color, float contrast) {
          return (color - 0.5) * contrast + 0.5;
        }
        
        // Warm/cool color shift (Zelda-style warm tones)
        vec3 applyWarmth(vec3 color, float warmth) {
          color.r += warmth;
          color.b -= warmth * 0.5;
          return color;
        }
        
        // Soft tone mapping (prevents harsh highlights)
        vec3 softToneMap(vec3 color) {
          // Reinhard-ish soft clamp
          return color / (color + vec3(1.0));
        }
        
        void main() {
          vec4 baseColor = texture2D(tDiffuse, vUv);
          vec3 color = baseColor.rgb;
          
          // Add bloom if enabled
          if (uBloomEnabled > 0.5) {
            vec3 bloom = texture2D(tBloom, vUv).rgb;
            color += bloom * uBloomStrength;
          }
          
          // Apply color grading (Zelda/Genshin style)
          color = adjustSaturation(color, uSaturation);
          color = adjustContrast(color, uContrast);
          color = applyWarmth(color, uWarmth);
          
          // Soft tone mapping to prevent blown highlights
          color = softToneMap(color * 1.1) * 1.1;
          
          // Apply vignette if enabled
          if (uVignetteEnabled > 0.5) {
            float vig = vignette(vUv, uVignetteStrength, uVignetteOffset);
            color *= mix(0.7, 1.0, vig);
          }
          
          // Add subtle film grain if enabled
          if (uNoiseEnabled > 0.5) {
            float noise = hash(vUv * uResolution + uTime * 100.0);
            noise = (noise - 0.5) * uNoiseStrength;
            color += noise;
          }
          
          // Final clamp
          color = clamp(color, 0.0, 1.0);
          
          gl_FragColor = vec4(color, baseColor.a);
        }
      `,
    });
  }
}

// Bloom extraction shader (extracts bright areas)
class BloomExtractMaterial extends THREE.ShaderMaterial {
  constructor() {
    super({
      uniforms: {
        tDiffuse: { value: null },
        uThreshold: { value: 0.75 },
        uSoftKnee: { value: 0.5 },
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
        uniform float uThreshold;
        uniform float uSoftKnee;
        varying vec2 vUv;
        
        void main() {
          vec4 color = texture2D(tDiffuse, vUv);
          float brightness = dot(color.rgb, vec3(0.2126, 0.7152, 0.0722));
          
          // Soft threshold with knee
          float soft = brightness - uThreshold + uSoftKnee;
          soft = clamp(soft / (2.0 * uSoftKnee), 0.0, 1.0);
          soft = soft * soft;
          
          float contribution = max(soft, step(uThreshold, brightness));
          
          gl_FragColor = vec4(color.rgb * contribution, 1.0);
        }
      `,
    });
  }
}

// Gaussian blur shader
class BlurMaterial extends THREE.ShaderMaterial {
  constructor() {
    super({
      uniforms: {
        tDiffuse: { value: null },
        uDirection: { value: new THREE.Vector2(1, 0) },
        uResolution: { value: new THREE.Vector2(1, 1) },
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
        uniform vec2 uDirection;
        uniform vec2 uResolution;
        varying vec2 vUv;
        
        void main() {
          vec2 texelSize = 1.0 / uResolution;
          vec2 offset = uDirection * texelSize;
          
          // 9-tap Gaussian blur
          vec4 color = vec4(0.0);
          color += texture2D(tDiffuse, vUv - offset * 4.0) * 0.0162;
          color += texture2D(tDiffuse, vUv - offset * 3.0) * 0.0540;
          color += texture2D(tDiffuse, vUv - offset * 2.0) * 0.1216;
          color += texture2D(tDiffuse, vUv - offset * 1.0) * 0.1945;
          color += texture2D(tDiffuse, vUv) * 0.2270;
          color += texture2D(tDiffuse, vUv + offset * 1.0) * 0.1945;
          color += texture2D(tDiffuse, vUv + offset * 2.0) * 0.1216;
          color += texture2D(tDiffuse, vUv + offset * 3.0) * 0.0540;
          color += texture2D(tDiffuse, vUv + offset * 4.0) * 0.0162;
          
          gl_FragColor = color;
        }
      `,
    });
  }
}

// Extend Three.js with our custom materials
extend({ ZeldaPostFXMaterial, BloomExtractMaterial, BlurMaterial });

// Main PostFX component using useFrame for rendering
function PostFXEffect({
  strength = "zelda",
  bloomEnabled = true,
  vignetteEnabled = true,
  noiseEnabled = true,
}: Omit<PostFXZeldaProps, "enabled">) {
  const { gl, scene, camera, size } = useThree();

  const preset = STRENGTH_PRESETS[strength];

  // Create render targets
  const renderTargets = useMemo(() => {
    const baseTarget = new THREE.WebGLRenderTarget(size.width, size.height, {
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter,
      format: THREE.RGBAFormat,
    });

    // Half-resolution for bloom (performance)
    const bloomSize = { width: Math.floor(size.width / 2), height: Math.floor(size.height / 2) };
    const bloomExtract = new THREE.WebGLRenderTarget(bloomSize.width, bloomSize.height, {
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter,
      format: THREE.RGBAFormat,
    });
    const bloomBlurH = new THREE.WebGLRenderTarget(bloomSize.width, bloomSize.height, {
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter,
      format: THREE.RGBAFormat,
    });
    const bloomBlurV = new THREE.WebGLRenderTarget(bloomSize.width, bloomSize.height, {
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter,
      format: THREE.RGBAFormat,
    });

    return { baseTarget, bloomExtract, bloomBlurH, bloomBlurV, bloomSize };
  }, [size.width, size.height]);

  // Create materials
  const materials = useMemo(() => {
    const bloomExtractMat = new BloomExtractMaterial();
    const blurMat = new BlurMaterial();
    const compositeMat = new ZeldaPostFXMaterial();

    return { bloomExtractMat, blurMat, compositeMat };
  }, []);

  // Create fullscreen quad
  const fsQuad = useMemo(() => {
    const geometry = new THREE.PlaneGeometry(2, 2);
    const mesh = new THREE.Mesh(geometry);
    mesh.frustumCulled = false;
    return mesh;
  }, []);

  // Orthographic camera for post-processing
  const orthoCamera = useMemo(() => {
    return new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  }, []);

  // Update materials when settings change
  useEffect(() => {
    const { compositeMat, bloomExtractMat } = materials;

    compositeMat.uniforms.uBloomStrength.value = preset.bloom;
    compositeMat.uniforms.uBloomEnabled.value = bloomEnabled ? 1.0 : 0.0;
    compositeMat.uniforms.uVignetteStrength.value = preset.vignette;
    compositeMat.uniforms.uVignetteOffset.value = preset.vignetteOffset;
    compositeMat.uniforms.uVignetteEnabled.value = vignetteEnabled ? 1.0 : 0.0;
    compositeMat.uniforms.uSaturation.value = preset.saturation;
    compositeMat.uniforms.uContrast.value = preset.contrast;
    compositeMat.uniforms.uWarmth.value = preset.warmth;
    compositeMat.uniforms.uNoiseStrength.value = preset.noise;
    compositeMat.uniforms.uNoiseEnabled.value = noiseEnabled ? 1.0 : 0.0;
    compositeMat.uniforms.uResolution.value.set(size.width, size.height);

    bloomExtractMat.uniforms.uThreshold.value = preset.bloomThreshold;
  }, [materials, preset, bloomEnabled, vignetteEnabled, noiseEnabled, size]);

  // Update render targets on resize
  useEffect(() => {
    const { baseTarget, bloomExtract, bloomBlurH, bloomBlurV, bloomSize } = renderTargets;

    baseTarget.setSize(size.width, size.height);

    const newBloomWidth = Math.floor(size.width / 2);
    const newBloomHeight = Math.floor(size.height / 2);
    bloomExtract.setSize(newBloomWidth, newBloomHeight);
    bloomBlurH.setSize(newBloomWidth, newBloomHeight);
    bloomBlurV.setSize(newBloomWidth, newBloomHeight);

    materials.blurMat.uniforms.uResolution.value.set(newBloomWidth, newBloomHeight);
  }, [size, renderTargets, materials]);

  // Cleanup
  useEffect(() => {
    return () => {
      renderTargets.baseTarget.dispose();
      renderTargets.bloomExtract.dispose();
      renderTargets.bloomBlurH.dispose();
      renderTargets.bloomBlurV.dispose();
      materials.bloomExtractMat.dispose();
      materials.blurMat.dispose();
      materials.compositeMat.dispose();
      fsQuad.geometry.dispose();
    };
  }, [renderTargets, materials, fsQuad]);

  // Main render loop
  useFrame(({ clock }) => {
    const { baseTarget, bloomExtract, bloomBlurH, bloomBlurV } = renderTargets;
    const { bloomExtractMat, blurMat, compositeMat } = materials;

    // Store original render target
    const originalTarget = gl.getRenderTarget();

    // 1. Render scene to base target
    gl.setRenderTarget(baseTarget);
    gl.render(scene, camera);

    if (bloomEnabled) {
      // 2. Extract bright areas
      bloomExtractMat.uniforms.tDiffuse.value = baseTarget.texture;
      fsQuad.material = bloomExtractMat;
      gl.setRenderTarget(bloomExtract);
      gl.render(fsQuad, orthoCamera);

      // 3. Horizontal blur
      blurMat.uniforms.tDiffuse.value = bloomExtract.texture;
      blurMat.uniforms.uDirection.value.set(2.0, 0);
      fsQuad.material = blurMat;
      gl.setRenderTarget(bloomBlurH);
      gl.render(fsQuad, orthoCamera);

      // 4. Vertical blur
      blurMat.uniforms.tDiffuse.value = bloomBlurH.texture;
      blurMat.uniforms.uDirection.value.set(0, 2.0);
      gl.setRenderTarget(bloomBlurV);
      gl.render(fsQuad, orthoCamera);

      compositeMat.uniforms.tBloom.value = bloomBlurV.texture;
    }

    // 5. Final composite pass
    compositeMat.uniforms.tDiffuse.value = baseTarget.texture;
    compositeMat.uniforms.uTime.value = clock.getElapsedTime();
    fsQuad.material = compositeMat;

    gl.setRenderTarget(originalTarget);
    gl.render(fsQuad, orthoCamera);
  }, 1); // Priority 1 = runs after scene rendering

  return null;
}

/**
 * PostFXZelda - Zelda: Breath of the Wild / Genshin Impact style post-processing
 *
 * Features:
 * - Soft bloom on bright areas
 * - Vignette for cinematic framing
 * - Color grading with warm tones
 * - Subtle film grain
 * - Saturation and contrast adjustments
 */
export const PostFXZelda = memo(function PostFXZelda({
  enabled = true,
  strength = "zelda",
  outlineEnabled = false,
  bloomEnabled = true,
  vignetteEnabled = true,
  noiseEnabled = true,
}: PostFXZeldaProps) {
  if (!enabled) {
    return null;
  }

  return (
    <PostFXEffect
      strength={strength}
      bloomEnabled={bloomEnabled}
      vignetteEnabled={vignetteEnabled}
      noiseEnabled={noiseEnabled}
    />
  );
});
