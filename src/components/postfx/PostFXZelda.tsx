/**
 * PostFXZelda - stable, deterministic postprocessing using THREE examples composer.
 * No @react-three/postprocessing.
 *
 * Stack:
 * - RenderPass
 * - GradePass (saturation/contrast/brightness + vignette)
 * - UnrealBloomPass (subtle)
 * - FXAA (anti-alias)
 */

import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { useFrame, useThree } from "@react-three/fiber";

import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { ShaderPass } from "three/examples/jsm/postprocessing/ShaderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
import { FXAAShader } from "three/examples/jsm/shaders/FXAAShader.js";

interface PostFXZeldaProps {
  enabled?: boolean;
  bloomEnabled?: boolean;
  vignetteEnabled?: boolean;
  // grading knobs (keep defaults if you want)
  saturation?: number; // 1 = neutral
  contrast?: number; // 1 = neutral
  brightness?: number; // 0 = neutral
}

function makeGradeShader() {
  return {
    uniforms: {
      tDiffuse: { value: null as THREE.Texture | null },
      uSaturation: { value: 1.18 },
      uContrast: { value: 1.08 },
      uBrightness: { value: 0.02 },
      uVignette: { value: 1.0 }, // 0 disables
      uVigOffset: { value: 0.25 },
      uVigDarkness: { value: 0.45 },
    },
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform sampler2D tDiffuse;
      uniform float uSaturation;
      uniform float uContrast;
      uniform float uBrightness;

      uniform float uVignette;
      uniform float uVigOffset;
      uniform float uVigDarkness;

      varying vec2 vUv;

      vec3 applySaturation(vec3 c, float s) {
        float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
        return mix(vec3(l), c, s);
      }

      void main() {
        vec4 tex = texture2D(tDiffuse, vUv);
        vec3 col = tex.rgb;

        // brightness + contrast
        col += uBrightness;
        col = (col - 0.5) * uContrast + 0.5;

        // saturation
        col = applySaturation(col, uSaturation);

        // vignette
        if (uVignette > 0.5) {
          vec2 p = vUv - 0.5;
          float r = length(p);
          // offset controls spread, darkness controls intensity
          float vig = smoothstep(0.75 - uVigOffset, 0.95, r);
          col *= (1.0 - vig * uVigDarkness);
        }

        gl_FragColor = vec4(col, tex.a);
      }
    `,
  };
}

export function PostFXZelda({
  enabled = true,
  bloomEnabled = true,
  vignetteEnabled = true,
  saturation = 1.18,
  contrast = 1.08,
  brightness = 0.02,
}: PostFXZeldaProps) {
  const { gl, scene, camera, size } = useThree();

  const composerRef = useRef<EffectComposer | null>(null);
  const gradePassRef = useRef<ShaderPass | null>(null);
  const bloomPassRef = useRef<UnrealBloomPass | null>(null);
  const fxaaPassRef = useRef<ShaderPass | null>(null);

  // build composer once (and rebuild if renderer changes)
  useEffect(() => {
    if (!enabled) return;

    const composer = new EffectComposer(gl);
    composerRef.current = composer;

    const renderPass = new RenderPass(scene, camera);
    composer.addPass(renderPass);

    const gradePass = new ShaderPass(makeGradeShader() as any);
    gradePassRef.current = gradePass;
    composer.addPass(gradePass);

    const bloomPass = new UnrealBloomPass(
      new THREE.Vector2(size.width, size.height),
      0.22, // strength
      0.35, // radius
      0.82, // threshold-ish (higher = less bloom)
    );
    bloomPass.enabled = bloomEnabled;
    bloomPassRef.current = bloomPass;
    composer.addPass(bloomPass);

    const fxaaPass = new ShaderPass(FXAAShader);
    fxaaPassRef.current = fxaaPass;
    composer.addPass(fxaaPass);

    // Ensure final pass renders to screen
    fxaaPass.renderToScreen = true;

    return () => {
      composer.dispose();
      composerRef.current = null;
      gradePassRef.current = null;
      bloomPassRef.current = null;
      fxaaPassRef.current = null;
    };
  }, [gl, scene, camera, enabled]); // intentionally NOT depending on size (we resize separately)

  // resize handling
  useEffect(() => {
    const composer = composerRef.current;
    if (!composer) return;

    composer.setSize(size.width, size.height);

    // FXAA needs resolution uniform in screen pixels
    const fxaa = fxaaPassRef.current;
    if (fxaa && fxaa.material?.uniforms?.resolution) {
      fxaa.material.uniforms.resolution.value.set(1 / size.width, 1 / size.height);
    }

    const bloom = bloomPassRef.current;
    if (bloom) bloom.setSize(size.width, size.height);
  }, [size.width, size.height]);

  // update knobs deterministically
  useEffect(() => {
    const grade = gradePassRef.current;
    if (!grade) return;

    grade.uniforms.uSaturation.value = saturation;
    grade.uniforms.uContrast.value = contrast;
    grade.uniforms.uBrightness.value = brightness;

    grade.uniforms.uVignette.value = vignetteEnabled ? 1.0 : 0.0;
    // you can tweak these later if you want
    grade.uniforms.uVigOffset.value = 0.25;
    grade.uniforms.uVigDarkness.value = 0.45;
  }, [saturation, contrast, brightness, vignetteEnabled]);

  useEffect(() => {
    const bloom = bloomPassRef.current;
    if (bloom) bloom.enabled = bloomEnabled;
  }, [bloomEnabled]);

  // render composer after the scene
  useFrame(() => {
    if (!enabled) return;
    const composer = composerRef.current;
    if (!composer) return;

    // Important: let composer handle output
    composer.render();
  }, 1);

  return null;
}
