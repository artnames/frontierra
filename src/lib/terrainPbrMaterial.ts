// Terrain PBR material with deterministic micro-detail
// - Keeps vertex colors as the primary albedo identity
// - Adds subtle triplanar detail + roughness variation via onBeforeCompile
// - No runtime randomness (purely deterministic from world position)

import * as THREE from "three";

export interface TerrainPbrDetailOptions {
  detailTexture: THREE.Texture | null;
  textureInfluence: number; // 0..1 (luminance-only)
  microDetailEnabled: boolean;

  // World offset in grid units to keep detail stable across world tiles
  worldOffset: THREE.Vector2;

  // Detail sampling frequency (bigger => more repeats)
  detailScale: number;

  // Intensities
  albedoVariation: number; // e.g. 0.08 (±8%)
  roughnessVariation: number; // e.g. 0.20 (±20%)
  slopeAO: number; // e.g. 0.15

  // Base PBR properties
  baseRoughness: number;
  baseMetalness: number;

  transparent?: boolean;
  opacity?: number;
}

const fallbackWhiteTex = (() => {
  const t = new THREE.DataTexture(new Uint8Array([255, 255, 255, 255]), 1, 1, THREE.RGBAFormat);
  t.wrapS = THREE.RepeatWrapping;
  t.wrapT = THREE.RepeatWrapping;
  t.needsUpdate = true;
  return t;
})();

export function createTerrainPbrDetailMaterial(opts: TerrainPbrDetailOptions): THREE.MeshStandardMaterial {
  const mat = new THREE.MeshStandardMaterial({
    color: new THREE.Color(1, 1, 1),
    vertexColors: true,
    roughness: opts.baseRoughness,
    metalness: opts.baseMetalness,
    side: THREE.DoubleSide,
    transparent: Boolean(opts.transparent),
    opacity: opts.opacity ?? 1,
  });

  // Ensure unique shader program per settings set (prevents cache collisions)
  mat.customProgramCacheKey = () => {
    const f = (n: number) => Number.isFinite(n) ? n.toFixed(3) : String(n);
    return [
      "terrain_pbr_detail_v1",
      opts.microDetailEnabled ? "md1" : "md0",
      `ti${f(opts.textureInfluence)}`,
      `ds${f(opts.detailScale)}`,
      `av${f(opts.albedoVariation)}`,
      `rv${f(opts.roughnessVariation)}`,
      `ao${f(opts.slopeAO)}`,
      opts.transparent ? "tr1" : "tr0",
    ].join("_");
  };

  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uDetailMap = { value: opts.detailTexture ?? fallbackWhiteTex };
    shader.uniforms.uDetailInfluence = { value: opts.detailTexture ? opts.textureInfluence : 0.0 };
    shader.uniforms.uMicroEnabled = { value: opts.microDetailEnabled ? 1.0 : 0.0 };
    shader.uniforms.uDetailScale = { value: opts.detailScale };
    shader.uniforms.uAlbedoVar = { value: opts.albedoVariation };
    shader.uniforms.uRoughVar = { value: opts.roughnessVariation };
    shader.uniforms.uSlopeAO = { value: opts.slopeAO };
    shader.uniforms.uWorldOffset = { value: opts.worldOffset.clone() };

    // ---- vertex: capture world pos + world normal ----
    shader.vertexShader = shader.vertexShader
      .replace(
        "#include <common>",
        `#include <common>

varying vec3 vWorldPos;
varying vec3 vWorldNormal;`
      )
      // IMPORTANT: do NOT rely on Three's internal `worldPosition` symbol name.
      // Compute world pos explicitly from `transformed` so shader stays compatible
      // across Three.js chunk changes and avoids failed program compilation (GPU leaks).
      .replace(
        "#include <begin_vertex>",
        `#include <begin_vertex>

vec4 wp = vec4( transformed, 1.0 );
#ifdef USE_INSTANCING
  wp = instanceMatrix * wp;
#endif
wp = modelMatrix * wp;
vWorldPos = wp.xyz;`
      )
      .replace(
        "#include <defaultnormal_vertex>",
        `#include <defaultnormal_vertex>

// approximate world normal (good enough for triplanar weights)
vWorldNormal = normalize(mat3(modelMatrix) * objectNormal);`
      );

    // ---- fragment: micro detail + roughness variation ----
    shader.fragmentShader = shader.fragmentShader.replace(
      "#include <common>",
      `#include <common>

varying vec3 vWorldPos;
varying vec3 vWorldNormal;

uniform sampler2D uDetailMap;
uniform float uDetailInfluence;
uniform float uMicroEnabled;
uniform float uDetailScale;
uniform float uAlbedoVar;
uniform float uRoughVar;
uniform float uSlopeAO;
uniform vec2 uWorldOffset;

float hash21(vec2 p){
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
}

float noise2(vec2 p){
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  float a = hash21(i);
  float b = hash21(i + vec2(1.0, 0.0));
  float c = hash21(i + vec2(0.0, 1.0));
  float d = hash21(i + vec2(1.0, 1.0));
  return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}

float fbm2(vec2 p){
  float v = 0.0;
  float a = 0.5;
  float f = 1.0;
  for (int i = 0; i < 3; i++) {
    v += a * noise2(p * f);
    f *= 2.0;
    a *= 0.5;
  }
  return v;
}

vec3 triplanarLumaSample(vec3 p, vec3 n){
  vec3 an = abs(n);
  vec3 w = pow(an, vec3(4.0));
  w /= (w.x + w.y + w.z + 1e-5);

  vec3 tx = texture2D(uDetailMap, p.zy * uDetailScale).rgb;
  vec3 ty = texture2D(uDetailMap, p.xz * uDetailScale).rgb;
  vec3 tz = texture2D(uDetailMap, p.xy * uDetailScale).rgb;
  return tx * w.x + ty * w.y + tz * w.z;
}`
    );

    // Apply albedo modulation after vertex colors are applied
    shader.fragmentShader = shader.fragmentShader.replace(
      "#include <color_fragment>",
      `#include <color_fragment>

if (uMicroEnabled > 0.5) {
  vec3 p = vWorldPos + vec3(uWorldOffset.x, 0.0, uWorldOffset.y);
  vec3 n = normalize(vWorldNormal);

  // Luminance-only detail modulation (keeps vertex colors as identity)
  vec3 detailRGB = triplanarLumaSample(p, n);
  float detailLum = dot(detailRGB, vec3(0.299, 0.587, 0.114));
  float detailMod = mix(1.0, detailLum, uDetailInfluence);

  // Procedural micro grain (no UVs, no runtime randomness)
  float micro = fbm2(p.xz * 0.8);
  float microMod = 1.0 + (micro - 0.5) * (2.0 * uAlbedoVar);

  // Slope-based contact darkening (subtle, stylized)
  float slope = 1.0 - abs(dot(normalize(vWorldNormal), vec3(0.0, 1.0, 0.0)));
  float ao = 1.0 - slope * uSlopeAO;

  diffuseColor.rgb *= detailMod * microMod * ao;
}`
    );

    // Apply roughness variation once roughnessFactor exists
    shader.fragmentShader = shader.fragmentShader.replace(
      "#include <roughnessmap_fragment>",
      `#include <roughnessmap_fragment>

if (uMicroEnabled > 0.5) {
  vec3 p = vWorldPos + vec3(uWorldOffset.x, 0.0, uWorldOffset.y);
  float microR = fbm2(p.xz * 0.6);
  roughnessFactor = clamp(roughnessFactor + (microR - 0.5) * (2.0 * uRoughVar), 0.04, 1.0);
}`
    );
  };

  return mat;
}
