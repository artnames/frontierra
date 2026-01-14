// EnhancedWaterPlane - Masked water + rivers with fresnel, foam edges, and flow
// Renders water ONLY where world tiles are water, and renders rivers ONLY where hasRiver.
// CRITICAL: deterministic (no Math.random / Date.now). Animation is visual only (uTime).

import { useMemo, useRef } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { WorldData } from "@/lib/worldData";
import { WORLD_HEIGHT_SCALE, getWaterLevel, RIVER_DEPTH_OFFSET } from "@/lib/worldConstants";
import { getTimeOfDay, isNight, TimeOfDayContext } from "@/lib/timeOfDay";
import { WORLD_A_ID } from "@/lib/worldContext";

interface EnhancedWaterPlaneProps {
  world: WorldData;
  worldX?: number;
  worldY?: number;
  animated?: boolean;
}

// Water color palette
const WATER_COLORS = {
  day: {
    shallow: new THREE.Color(0.15, 0.45, 0.55),
    deep: new THREE.Color(0.06, 0.22, 0.38),
    river: new THREE.Color(0.07, 0.3, 0.4),
    foam: new THREE.Color(0.88, 0.92, 0.95),
  },
  night: {
    shallow: new THREE.Color(0.06, 0.18, 0.28),
    deep: new THREE.Color(0.02, 0.08, 0.16),
    river: new THREE.Color(0.03, 0.12, 0.2),
    foam: new THREE.Color(0.55, 0.62, 0.7),
  },
};

function clamp01(v: number) {
  return Math.max(0, Math.min(1, v));
}

// Deterministic hash based on coords + seed (no Math.random)
function hash01(x: number, y: number, seed: number): number {
  const n = Math.sin(x * 12.9898 + y * 78.233 + seed * 0.12345) * 43758.5453123;
  return n - Math.floor(n);
}

export function EnhancedWaterPlane({ world, worldX = 0, worldY = 0, animated = true }: EnhancedWaterPlaneProps) {
  const meshRef = useRef<THREE.Mesh>(null);

  const heightScale = WORLD_HEIGHT_SCALE;

  const waterLevel = getWaterLevel(world.vars);
  const waterThresholdHeight = waterLevel * heightScale;

  // River surface baseline (matches terrain carve logic)
  const riverSurfaceBase = waterThresholdHeight - RIVER_DEPTH_OFFSET + 0.04; // sits above carved riverbed

  // Time of day context
  const timeContext: TimeOfDayContext = useMemo(
    () => ({
      worldId: WORLD_A_ID,
      worldX,
      worldY,
    }),
    [worldX, worldY],
  );

  const timeOfDay = useMemo(() => getTimeOfDay(timeContext), [timeContext]);
  const night = isNight(timeOfDay);

  // Compute a safe lake/ocean water plane height (below lowest non-water)
  const lakeWaterHeight = useMemo(() => {
    let minNonWaterElevation = Infinity;
    let waterCellCount = 0;

    for (const row of world.terrain) {
      for (const cell of row) {
        if (cell.type === "water") {
          waterCellCount++;
        } else if (cell.type !== "bridge") {
          const cellHeight = cell.elevation * heightScale;
          if (cellHeight < minNonWaterElevation) minNonWaterElevation = cellHeight;
        }
      }
    }

    if (waterCellCount === 0) {
      return minNonWaterElevation - 2;
    }

    const maxSafeHeight = minNonWaterElevation - 0.3;
    return Math.min(waterThresholdHeight, maxSafeHeight);
  }, [world.terrain, heightScale, waterThresholdHeight]);

  /**
   * Build a mask texture:
   *  R = lake/ocean water mask (cell.type === 'water') 0/255
   *  G = river mask (cell.hasRiver) 0/255
   *  B = flowX (0..255)
   *  A = flowY (0..255)
   *
   * NOTE: We flip Y to match rendering orientation used elsewhere (terrain uses flippedY).
   */
  const maskTex = useMemo(() => {
    const size = world.gridSize;
    const data = new Uint8Array(size * size * 4);

    const seed = world.seed || 0;

    for (let y = 0; y < size; y++) {
      const flippedY = size - 1 - y;
      for (let x = 0; x < size; x++) {
        const cell = world.terrain[flippedY]?.[x];
        const i = (y * size + x) * 4;

        const isLake = !!cell && cell.type === "water";
        const isRiver = !!cell && !!cell.hasRiver;

        // Flow direction for rivers from local neighbor structure (deterministic)
        let fx = 0;
        let fy = 0;

        if (isRiver) {
          const left = world.terrain[flippedY]?.[x - 1];
          const right = world.terrain[flippedY]?.[x + 1];
          const up = world.terrain[flippedY - 1]?.[x];
          const down = world.terrain[flippedY + 1]?.[x];

          const lx = left?.hasRiver ? 1 : 0;
          const rx = right?.hasRiver ? 1 : 0;
          const uy = up?.hasRiver ? 1 : 0;
          const dy = down?.hasRiver ? 1 : 0;

          // crude “river tangent”: prefer direction toward connected neighbors
          fx = rx - lx;
          fy = dy - uy;

          // if ambiguous (junction/isolated), fall back to deterministic angle
          const mag = Math.sqrt(fx * fx + fy * fy);
          if (mag < 0.001) {
            const a = hash01(x + worldX * size, y + worldY * size, seed) * Math.PI * 2;
            fx = Math.cos(a);
            fy = Math.sin(a);
          } else {
            fx /= mag;
            fy /= mag;
          }
        }

        // Encode flow from [-1..1] -> [0..1] -> [0..255]
        const encFx = Math.floor(clamp01(fx * 0.5 + 0.5) * 255);
        const encFy = Math.floor(clamp01(fy * 0.5 + 0.5) * 255);

        data[i] = isLake ? 255 : 0;
        data[i + 1] = isRiver ? 255 : 0;
        data[i + 2] = encFx;
        data[i + 3] = encFy;
      }
    }

    const tex = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
    tex.needsUpdate = true;
    tex.magFilter = THREE.NearestFilter;
    tex.minFilter = THREE.NearestFilter;
    tex.wrapS = THREE.ClampToEdgeWrapping;
    tex.wrapT = THREE.ClampToEdgeWrapping;
    tex.generateMipmaps = false;
    return tex;
  }, [world, worldX, worldY]);

  /**
   * Build a shared-vertex grid geometry (size x size verts) like terrain,
   * so we can position river surface slightly lower than lake surface if desired.
   *
   * We still DISCARD non-water in shader, so geometry exists everywhere but is cheap.
   */
  const geometry = useMemo(() => {
    const size = world.gridSize;
    const vertCount = size * size;
    const cellCount = (size - 1) * (size - 1);
    const indexCount = cellCount * 6;

    const positions = new Float32Array(vertCount * 3);
    const uvs = new Float32Array(vertCount * 2);
    const indices = new Uint32Array(indexCount);

    const seed = world.seed || 0;

    for (let y = 0; y < size; y++) {
      const flippedY = size - 1 - y;
      for (let x = 0; x < size; x++) {
        const vi = y * size + x;
        const cell = world.terrain[flippedY]?.[x];

        const isLake = !!cell && cell.type === "water";
        const isRiver = !!cell && !!cell.hasRiver;

        // Slight deterministic height micro-variation to break perfect flatness (tiny)
        const v = (hash01(x + worldX * size, y + worldY * size, seed) - 0.5) * 0.01;

        // Lake water is flat; river water sits slightly lower and varies slightly
        let h = lakeWaterHeight + v;
        if (isRiver) h = riverSurfaceBase + v * 1.5;

        positions[vi * 3] = x;
        positions[vi * 3 + 1] = h;
        positions[vi * 3 + 2] = y;

        uvs[vi * 2] = x / (size - 1);
        uvs[vi * 2 + 1] = y / (size - 1);
      }
    }

    let ii = 0;
    for (let y = 0; y < size - 1; y++) {
      for (let x = 0; x < size - 1; x++) {
        const v00 = y * size + x;
        const v10 = y * size + (x + 1);
        const v01 = (y + 1) * size + x;
        const v11 = (y + 1) * size + (x + 1);

        indices[ii++] = v00;
        indices[ii++] = v01;
        indices[ii++] = v10;

        indices[ii++] = v01;
        indices[ii++] = v11;
        indices[ii++] = v10;
      }
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geo.setAttribute("uv", new THREE.BufferAttribute(uvs, 2));
    geo.setIndex(new THREE.BufferAttribute(indices, 1));
    geo.computeVertexNormals();
    return geo;
  }, [world, worldX, worldY, lakeWaterHeight, riverSurfaceBase]);

  // Shader material (masked water + foam edges + river flow)
  const shaderMaterial = useMemo(() => {
    const colors = night ? WATER_COLORS.night : WATER_COLORS.day;

    return new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uMaskTex: { value: maskTex },

        uShallowColor: { value: colors.shallow },
        uDeepColor: { value: colors.deep },
        uRiverColor: { value: colors.river },
        uFoamColor: { value: colors.foam },

        uFresnelPower: { value: 2.6 },
        uFresnelBias: { value: 0.08 },

        uAnimated: { value: animated ? 1.0 : 0.0 },
        uOpacity: { value: night ? 0.82 : 0.72 },
        uReflectivity: { value: night ? 0.45 : 0.28 },

        // tuning knobs
        uLakeWaveScale: { value: 0.1 },
        uRiverWaveScale: { value: 0.2 },
        uRiverFlowSpeed: { value: 0.35 },
        uFoamStrength: { value: night ? 0.35 : 0.55 },
      },
      vertexShader: `
        varying vec3 vWorldPosition;
        varying vec3 vWorldNormal;
        varying vec2 vUv;

        void main() {
          vUv = uv;
          vec4 worldPos = modelMatrix * vec4(position, 1.0);
          vWorldPosition = worldPos.xyz;
          vWorldNormal = normalize(mat3(modelMatrix) * normal);
          gl_Position = projectionMatrix * viewMatrix * worldPos;
        }
      `,
      fragmentShader: `
        uniform float uTime;
        uniform sampler2D uMaskTex;

        uniform vec3 uShallowColor;
        uniform vec3 uDeepColor;
        uniform vec3 uRiverColor;
        uniform vec3 uFoamColor;

        uniform float uFresnelPower;
        uniform float uFresnelBias;
        uniform float uAnimated;
        uniform float uOpacity;
        uniform float uReflectivity;

        uniform float uLakeWaveScale;
        uniform float uRiverWaveScale;
        uniform float uRiverFlowSpeed;
        uniform float uFoamStrength;

        varying vec3 vWorldPosition;
        varying vec3 vWorldNormal;
        varying vec2 vUv;

        float hash(vec2 p) {
          return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
        }

        float noise(vec2 p) {
          vec2 i = floor(p);
          vec2 f = fract(p);
          f = f * f * (3.0 - 2.0 * f);
          float a = hash(i);
          float b = hash(i + vec2(1.0, 0.0));
          float c = hash(i + vec2(0.0, 1.0));
          float d = hash(i + vec2(1.0, 1.0));
          return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
        }

        // Approx edge: compare mask with its neighbors (NearestFilter texture)
        float edgeFactor(vec2 uv, vec2 texel, float channel) {
          float m  = texture2D(uMaskTex, uv)[int(channel)];
          float ml = texture2D(uMaskTex, uv + vec2(-texel.x, 0.0))[int(channel)];
          float mr = texture2D(uMaskTex, uv + vec2( texel.x, 0.0))[int(channel)];
          float mu = texture2D(uMaskTex, uv + vec2(0.0, -texel.y))[int(channel)];
          float md = texture2D(uMaskTex, uv + vec2(0.0,  texel.y))[int(channel)];

          float d0 = abs(m - ml);
          float d1 = abs(m - mr);
          float d2 = abs(m - mu);
          float d3 = abs(m - md);

          return clamp(max(max(d0, d1), max(d2, d3)), 0.0, 1.0);
        }

        void main() {
          vec4 mask = texture2D(uMaskTex, vUv);

          float isLake = step(0.5, mask.r);   // 0/1
          float isRiver = step(0.5, mask.g);  // 0/1

          // If neither lake nor river, don't render any water
          if (isLake < 0.5 && isRiver < 0.5) discard;

          vec3 viewDir = normalize(cameraPosition - vWorldPosition);

          // Flow (encoded in B/A as 0..1)
          vec2 flow = mask.ba * 2.0 - 1.0;
          float flowMag = max(length(flow), 1e-4);
          flow /= flowMag;

          // Compute edges (shoreline / river banks)
          // We estimate texel size from the mask texture itself.
          vec2 texel = vec2(1.0 / float(textureSize(uMaskTex, 0).x), 1.0 / float(textureSize(uMaskTex, 0).y));

          // For lakes, edge where lake mask changes; for rivers, edge where river mask changes.
          float lakeEdge = edgeFactor(vUv, texel, 0.0);
          float riverEdge = edgeFactor(vUv, texel, 1.0);

          // Waves: lake = broader, river = tighter + advected along flow
          float t = (uAnimated > 0.5) ? uTime : 0.0;

          float lakeW1 = noise(vWorldPosition.xz * uLakeWaveScale + t * 0.12) * 2.0 - 1.0;
          float lakeW2 = noise(vWorldPosition.xz * (uLakeWaveScale * 1.7) - t * 0.09) * 2.0 - 1.0;

          vec2 adv = flow * t * uRiverFlowSpeed;
          float riverW1 = noise((vWorldPosition.xz + adv) * uRiverWaveScale) * 2.0 - 1.0;
          float riverW2 = noise((vWorldPosition.xz - adv * 0.7) * (uRiverWaveScale * 1.8)) * 2.0 - 1.0;

          // Blend normal perturbation
          vec3 normal = normalize(vWorldNormal);

          float waveX = mix(lakeW1, riverW1, isRiver);
          float waveZ = mix(lakeW2, riverW2, isRiver);

          normal.x += waveX * mix(0.06, 0.09, isRiver);
          normal.z += waveZ * mix(0.06, 0.09, isRiver);
          normal = normalize(normal);

          // Fresnel
          float fresnel = uFresnelBias + (1.0 - uFresnelBias) * pow(1.0 - max(dot(viewDir, normal), 0.0), uFresnelPower);

          // Depth tint approximation:
          // - lakes: deeper away from shoreline (1 - lakeEdge)
          // - rivers: slightly darker in center (1 - riverEdge)
          float lakeDepth = clamp(1.0 - lakeEdge, 0.0, 1.0);
          float riverDepth = clamp(1.0 - riverEdge, 0.0, 1.0);

          vec3 lakeColor = mix(uShallowColor, uDeepColor, pow(lakeDepth, 1.35));
          vec3 riverColor = mix(uRiverColor * 1.10, uRiverColor * 0.75, pow(riverDepth, 1.25));

          vec3 waterColor = mix(lakeColor, riverColor, isRiver);

          // Spec highlight
          vec3 lightDir = normalize(vec3(0.25, 1.0, 0.20));
          float spec = pow(max(dot(reflect(-lightDir, normal), viewDir), 0.0), isRiver > 0.5 ? 42.0 : 36.0);
          vec3 specColor = vec3(1.0, 0.98, 0.95) * spec * mix(0.22, 0.28, isRiver);

          // Foam:
          // - stronger on river banks and lake shorelines
          // - modulated by high-frequency noise so it doesn't look like a flat outline
          float foamBase = mix(lakeEdge, riverEdge, isRiver);
          float foamNoise = noise(vWorldPosition.xz * mix(0.55, 0.85, isRiver) + t * mix(0.10, 0.18, isRiver));
          float foam = clamp(foamBase * (0.55 + foamNoise * 0.85), 0.0, 1.0) * uFoamStrength;

          // Reflection tint
          vec3 reflectionColor = vec3(0.50, 0.60, 0.70) * uReflectivity;

          // Final
          vec3 finalColor = waterColor;

          // Blend in reflection via fresnel
          finalColor = mix(finalColor, reflectionColor, fresnel * uReflectivity);

          // Add foam + spec
          finalColor += uFoamColor * foam * mix(0.45, 0.70, isRiver);
          finalColor += specColor;

          // Opacity: slightly thinner near edges, thicker in center
          float depthAlpha = mix(lakeDepth, riverDepth, isRiver);
          float alpha = uOpacity * (0.70 + 0.30 * depthAlpha);
          alpha = clamp(alpha, 0.45, 0.92);

          gl_FragColor = vec4(finalColor, alpha);
        }
      `,
      transparent: true,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
  }, [night, animated, maskTex]);

  // Animate
  useFrame((_, delta) => {
    if (!animated) return;
    shaderMaterial.uniforms.uTime.value += delta;
  });

  return (
    <mesh ref={meshRef} geometry={geometry} material={shaderMaterial} position={[0, 0, 0]} frustumCulled={false} />
  );
}
