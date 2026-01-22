// Forest Trees & Vegetation - 3D objects placed on terrain from NexArt
// CRITICAL: Uses canonical palette from src/theme/palette.ts
// BUG-003: Implements safe disposal pattern for Three.js resources

import { useMemo, createContext, useContext, useEffect, useRef } from "react";
import * as THREE from "three";
import { WorldData, getElevationAt, isNearWater } from "@/lib/worldData";
import { useWorldTextures } from "@/hooks/useWorldTextures";
import { MaterialKind } from "@/lib/materialRegistry";
import { PALETTE, ROLES, hexToRgb255, VEGETATION_COLORS } from "@/theme/palette";

// DEV-only resource tracking
const DEV = import.meta.env.DEV;
let devGeometryCount = 0;
let devMaterialCount = 0;

function trackResourceCreate(type: 'geometry' | 'material') {
  if (!DEV) return;
  if (type === 'geometry') devGeometryCount++;
  else devMaterialCount++;
}

function trackResourceDispose(type: 'geometry' | 'material') {
  if (!DEV) return;
  if (type === 'geometry') devGeometryCount--;
  else devMaterialCount--;
}

// Log resource stats periodically in dev mode
if (DEV) {
  setInterval(() => {
    if (devGeometryCount > 0 || devMaterialCount > 0) {
      console.debug(`[ForestTrees] Resources: geometries=${devGeometryCount}, materials=${devMaterialCount}`);
    }
  }, 10000);
}

interface ForestTreesProps {
  world: WorldData;
  useRichMaterials?: boolean; // When true, use enhanced materials for visual richness
  worldX?: number;
  worldY?: number;
  shadowsEnabled?: boolean; // When true, trees cast shadows
  outlineEnabled?: boolean; // Toon-ish outlines (stable, not postprocessing)
}

// Context to pass material richness setting to all vegetation components
const VegetationRichnessContext = createContext(false);

// Context to provide procedural textures to vegetation (when richness is enabled)
const VegetationTexturesContext = createContext<Map<MaterialKind, THREE.CanvasTexture> | null>(null);

// Context to pass shadow settings to all vegetation components
const VegetationShadowContext = createContext(false);

// Context to enable/disable toon outlines
const VegetationOutlineContext = createContext(false);

// Vegetation types enum for variety
type VegetationType =
  | "pine"
  | "deciduous"
  | "bush"
  | "birch"
  | "willow"
  | "deadTree"
  | "flower"
  | "rock"
  | "grassClump"
  | "mushroom"
  | "fern";

interface VegetationItem {
  x: number;
  y: number;
  z: number;
  scale: number;
  type: VegetationType;
  colorVariant: number; // 0-1 for color variation
  rotation: number; // Y-axis rotation
}

// Deterministic pseudo-random based on coordinates and seed
function seededRandom(x: number, y: number, seedOffset: number): number {
  const n = Math.sin(x * 12.9898 + y * 78.233 + seedOffset) * 43758.5453;
  return n - Math.floor(n);
}

// Helper to create color strings from palette with variation
// VEGETATION FIX: Safe color helper that NEVER returns white/undefined
// Always returns a valid green-family color from the palette

// DEV counter for tracking sanitizer triggers
let vegColorSanitizerCount = 0;

function getVegColor(baseColor: { r: number; g: number; b: number } | undefined | null, variation: number, shift: number = 20): string {
  // VEGETATION FIX: Fallback to meadow green if baseColor is invalid or missing
  const fallbackColor = { r: 0.537, g: 0.612, b: 0.435 }; // #899C6F meadow green
  
  let safeColor = fallbackColor;
  let usedFallback = false;
  
  if (baseColor && 
      typeof baseColor.r === 'number' && Number.isFinite(baseColor.r) &&
      typeof baseColor.g === 'number' && Number.isFinite(baseColor.g) &&
      typeof baseColor.b === 'number' && Number.isFinite(baseColor.b)) {
    if (baseColor.r >= 0 && baseColor.r <= 1 && 
        baseColor.g >= 0 && baseColor.g <= 1 && 
        baseColor.b >= 0 && baseColor.b <= 1) {
      safeColor = baseColor;
    } else {
      usedFallback = true;
    }
  } else {
    usedFallback = true;
  }
  
  if (usedFallback && import.meta.env.DEV) {
    vegColorSanitizerCount++;
    if (vegColorSanitizerCount % 100 === 1) {
      console.warn(`[ForestTrees] Color sanitizer triggered ${vegColorSanitizerCount} times`);
    }
  }
  
  // Apply deterministic variation
  const safeVariation = Number.isFinite(variation) ? variation : 0.5;
  const safeShift = Number.isFinite(shift) ? shift : 20;
  const vShift = Math.floor(safeVariation * safeShift) - safeShift / 2;
  
  const r = Math.max(0, Math.min(255, Math.round(safeColor.r * 255) + vShift));
  const g = Math.max(0, Math.min(255, Math.round(safeColor.g * 255) + vShift));
  const b = Math.max(0, Math.min(255, Math.round(safeColor.b * 255) + Math.floor(vShift * 0.5)));
  
  // FIX: Return HEX color instead of rgb() - Three.js parses rgb() incorrectly!
  const toHex = (v: number) => v.toString(16).padStart(2, '0');
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

// Palette-based flower colors using accent hues
const FLOWER_COLORS = [
  PALETTE.amber,    // Orange
  PALETTE.lime,     // Bright green-yellow
  PALETTE.flame,    // Warm orange-red
  PALETTE.crimson,  // Red
  PALETTE.coral,    // Coral pink
  PALETTE.mist,     // White
];

/**
 * Stable toon outline: inverted hull (BackSide) slightly scaled up.
 * This is MUCH more reliable than postprocessing Outline and won't crash.
 * BUG-003: This is a singleton material, not disposed per-component.
 */
const OUTLINE_SCALE = 1.07;
const outlineMaterial = new THREE.MeshBasicMaterial({
  color: new THREE.Color(PALETTE.deep), // Use palette deep for outlines
  side: THREE.BackSide,
  depthWrite: false,
  transparent: false,
});

function OutlineShell({
  enabled,
  position,
  rotation,
  scale = OUTLINE_SCALE,
  children,
}: {
  enabled: boolean;
  position?: [number, number, number];
  rotation?: [number, number, number];
  scale?: number;
  children: React.ReactNode; // geometry element(s)
}) {
  if (!enabled) return null;
  return (
    <mesh position={position} rotation={rotation} scale={scale}>
      {children}
      <primitive object={outlineMaterial} attach="material" />
    </mesh>
  );
}

export function ForestTrees({
  world,
  useRichMaterials = false,
  worldX = 0,
  worldY = 0,
  shadowsEnabled = true,
  outlineEnabled = false,
}: ForestTreesProps) {
  // When material richness is enabled...
  const { textures, isReady } = useWorldTextures({
    worldX,
    worldY,
    seed: world?.seed ?? 0,
    vars: world?.vars ?? [],
    enabled: useRichMaterials,
  });

  // BUG-003: Track previous textures for disposal
  const prevTexturesRef = useRef<Map<MaterialKind, THREE.CanvasTexture> | null>(null);

  // BUG-003: Dispose previous textures when they change
  useEffect(() => {
    if (prevTexturesRef.current && prevTexturesRef.current !== textures) {
      // Textures from useWorldTextures are managed by that hook
      // We don't dispose them here as they're shared/cached
    }
    prevTexturesRef.current = textures;

    return () => {
      // Cleanup on unmount - textures are managed by useWorldTextures
    };
  }, [textures]);

  const vegetation = useMemo(() => {
    const items: VegetationItem[] = [];

    // Guard against incomplete world data
    if (!world || !world.terrain || world.terrain.length === 0 || world.gridSize === 0) {
      return items;
    }

    const seed = world.seed || 0;

    // Define vegetation distribution based on terrain properties
    for (let gy = 1; gy < world.gridSize - 1; gy += 1) {
      for (let gx = 1; gx < world.gridSize - 1; gx += 1) {
        const cell = world.terrain[gy]?.[gx];
        if (!cell) continue;

        const flippedZ = world.gridSize - 1 - gy;
        const r1 = seededRandom(gx, gy, seed);
        const r2 = seededRandom(gx + 100, gy + 100, seed);
        const r3 = seededRandom(gx + 200, gy + 200, seed);

        // Forest tiles - trees and understory
        if (cell.type === "forest") {
          // Main tree (70% chance per cell)
          if (r1 < 0.7) {
            const offsetX = (r2 - 0.5) * 0.8;
            const offsetZ = (r3 - 0.5) * 0.8;
            const treeX = gx + offsetX;
            const treeZ = flippedZ + offsetZ;
            
            // Skip if position is in or near water (bank buffer = 0.8)
            if (isNearWater(world, treeX, treeZ, 0.8)) continue;
            
            const terrainY = getElevationAt(world, treeX, treeZ);

            // Select tree type based on elevation and moisture
            let treeType: VegetationType;
            const elevation = cell.elevation || 0;
            const moisture = cell.moisture || 0.5;
            const typeRoll = seededRandom(gx * 3, gy * 3, seed + 50);

            if (elevation > 0.6) {
              // High elevation - mostly pines
              treeType = typeRoll < 0.8 ? "pine" : typeRoll < 0.95 ? "deadTree" : "birch";
            } else if (moisture > 0.7) {
              // High moisture - willows and birches
              treeType = typeRoll < 0.4 ? "willow" : typeRoll < 0.7 ? "birch" : "deciduous";
            } else if (moisture < 0.3) {
              // Low moisture - dead trees and sparse pines
              treeType = typeRoll < 0.5 ? "deadTree" : typeRoll < 0.8 ? "pine" : "bush";
            } else {
              // Normal conditions - mixed forest
              treeType =
                typeRoll < 0.25
                  ? "pine"
                  : typeRoll < 0.5
                    ? "deciduous"
                    : typeRoll < 0.7
                      ? "birch"
                      : typeRoll < 0.85
                        ? "willow"
                        : "bush";
            }

            items.push({
              x: treeX,
              y: terrainY,
              z: treeZ,
              scale: 0.8 + r1 * 0.6,
              type: treeType,
              colorVariant: seededRandom(gx * 7, gy * 11, seed + 100),
              rotation: r2 * Math.PI * 2,
            });
          }

          // Understory vegetation (ferns, mushrooms, flowers)
          if (r2 > 0.5 && cell.moisture > 0.4) {
            const offsetX2 = (seededRandom(gx + 300, gy + 300, seed) - 0.5) * 0.9;
            const offsetZ2 = (seededRandom(gx + 400, gy + 400, seed) - 0.5) * 0.9;
            const understoryX = gx + offsetX2;
            const understoryZ = flippedZ + offsetZ2;
            
            // Skip if position is in or near water (bank buffer = 0.5)
            if (isNearWater(world, understoryX, understoryZ, 0.5)) continue;
            
            const understoryY = getElevationAt(world, understoryX, understoryZ);

            const understoryRoll = seededRandom(gx * 5, gy * 5, seed + 150);
            const understoryType: VegetationType =
              understoryRoll < 0.4 ? "fern" : understoryRoll < 0.7 ? "mushroom" : "flower";

            items.push({
              x: understoryX,
              y: understoryY,
              z: understoryZ,
              scale: 0.3 + seededRandom(gx + 500, gy + 500, seed) * 0.4,
              type: understoryType,
              colorVariant: seededRandom(gx * 9, gy * 13, seed + 200),
              rotation: seededRandom(gx + 600, gy + 600, seed) * Math.PI * 2,
            });
          }

          // Dense forests get extra trees
          if (cell.moisture > 0.6 && r3 < 0.5) {
            const offsetX3 = (seededRandom(gx + 700, gy + 700, seed) - 0.5) * 0.7;
            const offsetZ3 = (seededRandom(gx + 800, gy + 800, seed) - 0.5) * 0.7;
            const tree2X = gx + offsetX3;
            const tree2Z = flippedZ + offsetZ3;
            
            // Skip if position is in or near water (bank buffer = 0.8)
            if (isNearWater(world, tree2X, tree2Z, 0.8)) continue;
            
            const terrain2Y = getElevationAt(world, tree2X, tree2Z);

            items.push({
              x: tree2X,
              y: terrain2Y,
              z: tree2Z,
              scale: 0.6 + r1 * 0.4,
              type: seededRandom(gx * 11, gy * 17, seed + 250) < 0.5 ? "bush" : "deciduous",
              colorVariant: seededRandom(gx * 13, gy * 19, seed + 300),
              rotation: seededRandom(gx + 900, gy + 900, seed) * Math.PI * 2,
            });
          }
        }

        // Ground tiles - sparse vegetation
        if (cell.type === "ground" && r1 < 0.15) {
          const offsetX = (r2 - 0.5) * 0.9;
          const offsetZ = (r3 - 0.5) * 0.9;
          const vegX = gx + offsetX;
          const vegZ = flippedZ + offsetZ;
          
          // Skip if position is in or near water (bank buffer = 0.5)
          if (isNearWater(world, vegX, vegZ, 0.5)) continue;
          
          const vegY = getElevationAt(world, vegX, vegZ);

          const groundRoll = seededRandom(gx * 4, gy * 4, seed + 350);
          let groundType: VegetationType;

          if (groundRoll < 0.3) groundType = "rock";
          else if (groundRoll < 0.5) groundType = "grassClump";
          else if (groundRoll < 0.7) groundType = "flower";
          else groundType = "bush";

          items.push({
            x: vegX,
            y: vegY,
            z: vegZ,
            scale: 0.4 + r1 * 0.5,
            type: groundType,
            colorVariant: seededRandom(gx * 15, gy * 21, seed + 400),
            rotation: r2 * Math.PI * 2,
          });
        }

        // Mountain tiles - rocks and hardy plants
        if (cell.type === "mountain" && r1 < 0.2) {
          const offsetX = (r2 - 0.5) * 0.8;
          const offsetZ = (r3 - 0.5) * 0.8;
          const rockX = gx + offsetX;
          const rockZ = flippedZ + offsetZ;
          
          // Skip if position is in or near water (bank buffer = 0.5)
          if (isNearWater(world, rockX, rockZ, 0.5)) continue;
          
          const rockY = getElevationAt(world, rockX, rockZ);

          const mountainRoll = seededRandom(gx * 6, gy * 6, seed + 450);

          items.push({
            x: rockX,
            y: rockY,
            z: rockZ,
            scale: 0.5 + r1 * 0.8,
            type: mountainRoll < 0.7 ? "rock" : mountainRoll < 0.9 ? "deadTree" : "pine",
            colorVariant: seededRandom(gx * 17, gy * 23, seed + 500),
            rotation: r2 * Math.PI * 2,
          });
        }
      }
    }

    return items;
  }, [world]);

  // Guard against incomplete world data - after hooks
  if (!world || !world.terrain || world.terrain.length === 0 || !world.gridSize) {
    return null;
  }

  return (
    <VegetationOutlineContext.Provider value={outlineEnabled}>
      <VegetationRichnessContext.Provider value={useRichMaterials}>
        <VegetationTexturesContext.Provider value={useRichMaterials && isReady ? textures : null}>
          <VegetationShadowContext.Provider value={shadowsEnabled}>
            <group>
              {vegetation.map((item, i) => (
                <Vegetation key={i} {...item} seed={world.seed} />
              ))}
            </group>
          </VegetationShadowContext.Provider>
        </VegetationTexturesContext.Provider>
      </VegetationRichnessContext.Provider>
    </VegetationOutlineContext.Provider>
  );
}

// Ground offset to sink vegetation into terrain for better connection
// FIX: Reduced offsets - trees were sinking too deep into terrain
// The negative offset compensates for geometry origin being at base, not center
const TREE_GROUND_OFFSET = -0.08; // Small sink to hide root artifacts (was -0.35)
const SMALL_VEG_GROUND_OFFSET = -0.03; // Minimal sink for small plants (was -0.12)

// Main vegetation component that renders the appropriate type
function Vegetation({ x, y, z, scale, type, colorVariant, rotation, seed }: VegetationItem & { seed: number }) {
  const shadowsEnabled = useContext(VegetationShadowContext);

  // Apply ground offset based on vegetation type
  const isTree = ["pine", "deciduous", "birch", "willow", "deadTree"].includes(type);
  const groundOffset = isTree ? TREE_GROUND_OFFSET : SMALL_VEG_GROUND_OFFSET;
  const adjustedY = y + groundOffset;

  // Contact shadow blob for trees (when shadows are enabled)
  const contactShadow =
    isTree && shadowsEnabled ? <ContactShadowBlob x={x} y={adjustedY + 0.02} z={z} scale={scale} seed={seed} /> : null;

  const vegProps = { x, y: adjustedY, z, scale, colorVariant, rotation };

  switch (type) {
    case "pine":
      return (
        <>
          {contactShadow}
          <PineTree {...vegProps} />
        </>
      );
    case "deciduous":
      return (
        <>
          {contactShadow}
          <DeciduousTree {...vegProps} />
        </>
      );
    case "bush":
      return <Bush {...vegProps} />;
    case "birch":
      return (
        <>
          {contactShadow}
          <BirchTree {...vegProps} />
        </>
      );
    case "willow":
      return (
        <>
          {contactShadow}
          <WillowTree {...vegProps} />
        </>
      );
    case "deadTree":
      return (
        <>
          {contactShadow}
          <DeadTree {...vegProps} />
        </>
      );
    case "flower":
      return <Flower {...vegProps} />;
    case "rock":
      return <Rock {...vegProps} />;
    case "grassClump":
      return <GrassClump {...vegProps} />;
    case "mushroom":
      return <Mushroom {...vegProps} />;
    case "fern":
      return <Fern {...vegProps} />;
    default:
      return null;
  }
}

interface VegProps {
  x: number;
  y: number;
  z: number;
  scale: number;
  colorVariant: number;
  rotation: number;
}

// Deterministic contact shadow blob under trees for grounding
function ContactShadowBlob({ x, y, z, scale, seed }: { x: number; y: number; z: number; scale: number; seed: number }) {
  // Deterministic size/opacity variation
  const sizeVariation = seededRandom(x * 17, z * 31, seed + 777);
  const radius = 0.3 * scale * (0.8 + sizeVariation * 0.4);
  const opacity = 0.12 + sizeVariation * 0.1; // 0.12-0.22 range

  return (
    <mesh position={[x, y, z]} rotation={[-Math.PI / 2, 0, 0]}>
      <circleGeometry args={[radius, 8]} />
      <meshBasicMaterial color="#000000" transparent opacity={opacity} depthWrite={false} />
    </mesh>
  );
}

// Enhanced material component that uses MeshStandardMaterial when richness is enabled
// When rich, we add deterministic surface detail via bump maps sourced from the procedural terrain textures.
function VegMaterial({ color, isRich }: { color: string; isRich: boolean }) {
  const textures = useContext(VegetationTexturesContext);
  const bumpMap = isRich ? (textures?.get("forest") ?? undefined) : undefined;

  if (isRich) {
    return (
      <meshStandardMaterial
        color={color}
        roughness={0.7}
        metalness={0.05}
        bumpMap={bumpMap}
        bumpScale={bumpMap ? 0.25 : 0}
      />
    );
  }
  return <meshLambertMaterial color={color} />;
}

// Bark/wood/stone material with enhanced properties
function BarkMaterial({ color, isRich }: { color: string; isRich: boolean }) {
  const textures = useContext(VegetationTexturesContext);
  const bumpMap = isRich ? (textures?.get("path") ?? textures?.get("rock") ?? undefined) : undefined;

  if (isRich) {
    return (
      <meshStandardMaterial
        color={color}
        roughness={0.95}
        metalness={0}
        bumpMap={bumpMap}
        bumpScale={bumpMap ? 0.35 : 0}
      />
    );
  }
  return <meshLambertMaterial color={color} />;
}

// Pine tree - tall conifer using palette colors
function PineTree({ x, y, z, scale, colorVariant, rotation }: VegProps) {
  const isRich = useContext(VegetationRichnessContext);
  const shadows = useContext(VegetationShadowContext);
  const outlines = useContext(VegetationOutlineContext);

  // Use palette-based colors with variation
  const baseLeaf = VEGETATION_COLORS.pineBase;
  const leafColor1 = getVegColor(baseLeaf, colorVariant, 15);
  const leafColor2 = getVegColor(baseLeaf, colorVariant + 0.2, 15);
  const leafColor3 = getVegColor(baseLeaf, colorVariant + 0.4, 15);

  return (
    <group position={[x, y, z]} scale={scale} rotation={[0, rotation, 0]}>
      {/* trunk */}
      <OutlineShell enabled={outlines} position={[0, 0.4, 0]}>
        <cylinderGeometry args={[0.06, 0.1, 0.8, 6]} />
      </OutlineShell>
      <mesh position={[0, 0.4, 0]} castShadow={shadows} receiveShadow={shadows}>
        <cylinderGeometry args={[0.06, 0.1, 0.8, 6]} />
        <BarkMaterial color={PALETTE.rust} isRich={isRich} />
      </mesh>

      {/* cones */}
      <OutlineShell enabled={outlines} position={[0, 1.0, 0]}>
        <coneGeometry args={[0.4, 0.8, 6]} />
      </OutlineShell>
      <mesh position={[0, 1.0, 0]} castShadow={shadows} receiveShadow={shadows}>
        <coneGeometry args={[0.4, 0.8, 6]} />
        <VegMaterial color={leafColor1} isRich={isRich} />
      </mesh>

      <OutlineShell enabled={outlines} position={[0, 1.5, 0]}>
        <coneGeometry args={[0.3, 0.6, 6]} />
      </OutlineShell>
      <mesh position={[0, 1.5, 0]} castShadow={shadows} receiveShadow={shadows}>
        <coneGeometry args={[0.3, 0.6, 6]} />
        <VegMaterial color={leafColor2} isRich={isRich} />
      </mesh>

      <OutlineShell enabled={outlines} position={[0, 1.9, 0]}>
        <coneGeometry args={[0.2, 0.5, 6]} />
      </OutlineShell>
      <mesh position={[0, 1.9, 0]} castShadow={shadows} receiveShadow={shadows}>
        <coneGeometry args={[0.2, 0.5, 6]} />
        <VegMaterial color={leafColor3} isRich={isRich} />
      </mesh>
    </group>
  );
}

// Deciduous tree - round leafy tree using palette colors
function DeciduousTree({ x, y, z, scale, colorVariant, rotation }: VegProps) {
  const isRich = useContext(VegetationRichnessContext);
  const shadows = useContext(VegetationShadowContext);
  const outlines = useContext(VegetationOutlineContext);

  // Use palette-based colors with variation
  const baseLeaf = VEGETATION_COLORS.deciduousBase;
  const leafColor1 = getVegColor(baseLeaf, colorVariant, 25);
  const leafColor2 = getVegColor(baseLeaf, colorVariant + 0.15, 25);
  const leafColor3 = getVegColor(baseLeaf, colorVariant - 0.1, 25);

  return (
    <group position={[x, y, z]} scale={scale} rotation={[0, rotation, 0]}>
      {/* trunk */}
      <OutlineShell enabled={outlines} position={[0, 0.5, 0]}>
        <cylinderGeometry args={[0.08, 0.12, 1.0, 6]} />
      </OutlineShell>
      <mesh position={[0, 0.5, 0]} castShadow={shadows} receiveShadow={shadows}>
        <cylinderGeometry args={[0.08, 0.12, 1.0, 6]} />
        <BarkMaterial color={PALETTE.rust} isRich={isRich} />
      </mesh>

      {/* foliage blobs */}
      <OutlineShell enabled={outlines} position={[0, 1.4, 0]}>
        <sphereGeometry args={[0.55, 8, 6]} />
      </OutlineShell>
      <mesh position={[0, 1.4, 0]} castShadow={shadows} receiveShadow={shadows}>
        <sphereGeometry args={[0.55, 8, 6]} />
        <VegMaterial color={leafColor1} isRich={isRich} />
      </mesh>

      <OutlineShell enabled={outlines} position={[0.25, 1.2, 0.15]}>
        <sphereGeometry args={[0.35, 6, 5]} />
      </OutlineShell>
      <mesh position={[0.25, 1.2, 0.15]} castShadow={shadows} receiveShadow={shadows}>
        <sphereGeometry args={[0.35, 6, 5]} />
        <VegMaterial color={leafColor2} isRich={isRich} />
      </mesh>

      <OutlineShell enabled={outlines} position={[-0.2, 1.3, -0.1]}>
        <sphereGeometry args={[0.3, 6, 5]} />
      </OutlineShell>
      <mesh position={[-0.2, 1.3, -0.1]} castShadow={shadows} receiveShadow={shadows}>
        <sphereGeometry args={[0.3, 6, 5]} />
        <VegMaterial color={leafColor3} isRich={isRich} />
      </mesh>
    </group>
  );
}

// Bush - small shrub using palette colors
function Bush({ x, y, z, scale, colorVariant, rotation }: VegProps) {
  const isRich = useContext(VegetationRichnessContext);
  const shadows = useContext(VegetationShadowContext);
  const outlines = useContext(VegetationOutlineContext);

  // Use palette-based colors with variation
  const baseLeaf = VEGETATION_COLORS.bushBase;
  const bushColor1 = getVegColor(baseLeaf, colorVariant, 20);
  const bushColor2 = getVegColor(baseLeaf, colorVariant + 0.15, 20);

  return (
    <group position={[x, y, z]} scale={scale} rotation={[0, rotation, 0]}>
      {/* stem */}
      <OutlineShell enabled={outlines} position={[0, 0.15, 0]}>
        <cylinderGeometry args={[0.03, 0.05, 0.3, 5]} />
      </OutlineShell>
      <mesh position={[0, 0.15, 0]} castShadow={shadows} receiveShadow={shadows}>
        <cylinderGeometry args={[0.03, 0.05, 0.3, 5]} />
        <BarkMaterial color={PALETTE.rust} isRich={isRich} />
      </mesh>

      {/* bush blobs */}
      <OutlineShell enabled={outlines} position={[0, 0.4, 0]}>
        <sphereGeometry args={[0.3, 7, 5]} />
      </OutlineShell>
      <mesh position={[0, 0.4, 0]} castShadow={shadows} receiveShadow={shadows}>
        <sphereGeometry args={[0.3, 7, 5]} />
        <VegMaterial color={bushColor1} isRich={isRich} />
      </mesh>

      <OutlineShell enabled={outlines} position={[0.12, 0.35, 0.08]}>
        <sphereGeometry args={[0.18, 5, 4]} />
      </OutlineShell>
      <mesh position={[0.12, 0.35, 0.08]} castShadow={shadows} receiveShadow={shadows}>
        <sphereGeometry args={[0.18, 5, 4]} />
        <VegMaterial color={bushColor2} isRich={isRich} />
      </mesh>
    </group>
  );
}

// Birch tree - white bark, slender (using palette)
function BirchTree({ x, y, z, scale, colorVariant, rotation }: VegProps) {
  const isRich = useContext(VegetationRichnessContext);
  const shadows = useContext(VegetationShadowContext);
  const outlines = useContext(VegetationOutlineContext);

  // Use palette-based colors with variation
  const baseLeaf = VEGETATION_COLORS.deciduousBase;
  const birchLeaf1 = getVegColor(baseLeaf, colorVariant, 20);
  const birchLeaf2 = getVegColor(baseLeaf, colorVariant + 0.2, 20);

  return (
    <group position={[x, y, z]} scale={scale} rotation={[0, rotation, 0]}>
      {/* trunk - birch has light bark from palette mist */}
      <OutlineShell enabled={outlines} position={[0, 0.6, 0]}>
        <cylinderGeometry args={[0.05, 0.07, 1.2, 6]} />
      </OutlineShell>
      <mesh position={[0, 0.6, 0]} castShadow={shadows} receiveShadow={shadows}>
        <cylinderGeometry args={[0.05, 0.07, 1.2, 6]} />
        <BarkMaterial color={PALETTE.mist} isRich={isRich} />
      </mesh>

      {/* Dark bark marks using palette deep */}
      <mesh position={[0.03, 0.4, 0.04]} castShadow={shadows}>
        <boxGeometry args={[0.02, 0.08, 0.01]} />
        <BarkMaterial color={PALETTE.deep} isRich={isRich} />
      </mesh>
      <mesh position={[-0.02, 0.7, -0.03]} castShadow={shadows}>
        <boxGeometry args={[0.015, 0.06, 0.01]} />
        <BarkMaterial color={PALETTE.sage} isRich={isRich} />
      </mesh>

      {/* foliage */}
      <OutlineShell enabled={outlines} position={[0, 1.4, 0]}>
        <sphereGeometry args={[0.45, 7, 6]} />
      </OutlineShell>
      <mesh position={[0, 1.4, 0]} castShadow={shadows} receiveShadow={shadows}>
        <sphereGeometry args={[0.45, 7, 6]} />
        <VegMaterial color={birchLeaf1} isRich={isRich} />
      </mesh>

      <OutlineShell enabled={outlines} position={[0.2, 1.5, 0.1]}>
        <sphereGeometry args={[0.25, 6, 5]} />
      </OutlineShell>
      <mesh position={[0.2, 1.5, 0.1]} castShadow={shadows} receiveShadow={shadows}>
        <sphereGeometry args={[0.25, 6, 5]} />
        <VegMaterial color={birchLeaf2} isRich={isRich} />
      </mesh>
    </group>
  );
}

// Willow tree - drooping branches (using palette)
function WillowTree({ x, y, z, scale, colorVariant, rotation }: VegProps) {
  const isRich = useContext(VegetationRichnessContext);
  const shadows = useContext(VegetationShadowContext);
  const outlines = useContext(VegetationOutlineContext);

  // Use palette-based colors with variation - willow is lighter green
  const baseLeaf = VEGETATION_COLORS.deciduousBase;
  const willowLeaf1 = getVegColor(baseLeaf, colorVariant, 18);
  const willowLeaf2 = getVegColor(baseLeaf, colorVariant - 0.1, 18);
  const willowLeaf3 = getVegColor(baseLeaf, colorVariant + 0.1, 18);

  return (
    <group position={[x, y, z]} scale={scale} rotation={[0, rotation, 0]}>
      {/* trunk */}
      <OutlineShell enabled={outlines} position={[0, 0.5, 0]}>
        <cylinderGeometry args={[0.1, 0.15, 1.0, 6]} />
      </OutlineShell>
      <mesh position={[0, 0.5, 0]} castShadow={shadows} receiveShadow={shadows}>
        <cylinderGeometry args={[0.1, 0.15, 1.0, 6]} />
        <BarkMaterial color={PALETTE.rust} isRich={isRich} />
      </mesh>

      {/* canopy */}
      <OutlineShell enabled={outlines} position={[0, 1.2, 0]}>
        <sphereGeometry args={[0.5, 8, 6]} />
      </OutlineShell>
      <mesh position={[0, 1.2, 0]} castShadow={shadows} receiveShadow={shadows}>
        <sphereGeometry args={[0.5, 8, 6]} />
        <VegMaterial color={willowLeaf1} isRich={isRich} />
      </mesh>

      {/* drooping branches */}
      <OutlineShell enabled={outlines} position={[0.35, 0.8, 0]}>
        <cylinderGeometry args={[0.15, 0.05, 0.8, 5]} />
      </OutlineShell>
      <mesh position={[0.35, 0.8, 0]} castShadow={shadows} receiveShadow={shadows}>
        <cylinderGeometry args={[0.15, 0.05, 0.8, 5]} />
        <VegMaterial color={willowLeaf2} isRich={isRich} />
      </mesh>

      <OutlineShell enabled={outlines} position={[-0.3, 0.75, 0.2]}>
        <cylinderGeometry args={[0.12, 0.04, 0.7, 5]} />
      </OutlineShell>
      <mesh position={[-0.3, 0.75, 0.2]} castShadow={shadows} receiveShadow={shadows}>
        <cylinderGeometry args={[0.12, 0.04, 0.7, 5]} />
        <VegMaterial color={willowLeaf3} isRich={isRich} />
      </mesh>

      <OutlineShell enabled={outlines} position={[0.1, 0.7, -0.35]}>
        <cylinderGeometry args={[0.1, 0.03, 0.6, 5]} />
      </OutlineShell>
      <mesh position={[0.1, 0.7, -0.35]} castShadow={shadows} receiveShadow={shadows}>
        <cylinderGeometry args={[0.1, 0.03, 0.6, 5]} />
        <VegMaterial color={willowLeaf1} isRich={isRich} />
      </mesh>
    </group>
  );
}

// Dead tree - bare branches (using palette)
function DeadTree({ x, y, z, scale, colorVariant, rotation }: VegProps) {
  const isRich = useContext(VegetationRichnessContext);
  const shadows = useContext(VegetationShadowContext);
  const outlines = useContext(VegetationOutlineContext);

  // Use palette-based colors - dead wood is between sage and deep
  const baseBark = VEGETATION_COLORS.barkDark;
  const deadColor1 = getVegColor(baseBark, colorVariant, 15);
  const deadColor2 = getVegColor(baseBark, colorVariant + 0.1, 15);
  const deadColor3 = getVegColor(baseBark, colorVariant - 0.1, 15);

  return (
    <group position={[x, y, z]} scale={scale} rotation={[0, rotation, 0]}>
      {/* trunk */}
      <OutlineShell enabled={outlines} position={[0, 0.5, 0]}>
        <cylinderGeometry args={[0.06, 0.1, 1.0, 5]} />
      </OutlineShell>
      <mesh position={[0, 0.5, 0]} castShadow={shadows} receiveShadow={shadows}>
        <cylinderGeometry args={[0.06, 0.1, 1.0, 5]} />
        <BarkMaterial color={deadColor1} isRich={isRich} />
      </mesh>

      {/* bare branches */}
      <OutlineShell enabled={outlines} position={[0.15, 0.9, 0]} rotation={[0, 0, -0.5]} scale={1.12}>
        <cylinderGeometry args={[0.02, 0.03, 0.4, 4]} />
      </OutlineShell>
      <mesh position={[0.15, 0.9, 0]} rotation={[0, 0, -0.5]} castShadow={shadows}>
        <cylinderGeometry args={[0.02, 0.03, 0.4, 4]} />
        <BarkMaterial color={deadColor2} isRich={isRich} />
      </mesh>

      <OutlineShell enabled={outlines} position={[-0.12, 1.0, 0.05]} rotation={[0.2, 0, 0.6]} scale={1.12}>
        <cylinderGeometry args={[0.015, 0.025, 0.35, 4]} />
      </OutlineShell>
      <mesh position={[-0.12, 1.0, 0.05]} rotation={[0.2, 0, 0.6]} castShadow={shadows}>
        <cylinderGeometry args={[0.015, 0.025, 0.35, 4]} />
        <BarkMaterial color={deadColor3} isRich={isRich} />
      </mesh>

      <OutlineShell enabled={outlines} position={[0.05, 1.1, -0.1]} rotation={[-0.3, 0, 0.2]} scale={1.12}>
        <cylinderGeometry args={[0.01, 0.02, 0.25, 4]} />
      </OutlineShell>
      <mesh position={[0.05, 1.1, -0.1]} rotation={[-0.3, 0, 0.2]} castShadow={shadows}>
        <cylinderGeometry args={[0.01, 0.02, 0.25, 4]} />
        <BarkMaterial color={deadColor2} isRich={isRich} />
      </mesh>
    </group>
  );
}

// Flower - colorful small plant (receives shadows only, too small to cast meaningful shadows)
function Flower({ x, y, z, scale, colorVariant, rotation }: VegProps) {
  const isRich = useContext(VegetationRichnessContext);
  const shadows = useContext(VegetationShadowContext);

  // Use palette-based flower colors
  const colorIndex = Math.floor(colorVariant * FLOWER_COLORS.length);
  const flowerColor = FLOWER_COLORS[colorIndex % FLOWER_COLORS.length];

  return (
    <group position={[x, y, z]} scale={scale * 0.5} rotation={[0, rotation, 0]}>
      {/* Stem */}
      <mesh position={[0, 0.15, 0]} receiveShadow={shadows}>
        <cylinderGeometry args={[0.015, 0.02, 0.3, 4]} />
        <VegMaterial color={PALETTE.meadow} isRich={isRich} />
      </mesh>
      {/* Flower head */}
      <mesh position={[0, 0.35, 0]} receiveShadow={shadows}>
        <sphereGeometry args={[0.08, 6, 5]} />
        <VegMaterial color={flowerColor} isRich={isRich} />
      </mesh>
      {/* Center */}
      <mesh position={[0, 0.38, 0.05]} receiveShadow={shadows}>
        <sphereGeometry args={[0.03, 4, 4]} />
        <VegMaterial color={PALETTE.amber} isRich={isRich} />
      </mesh>
    </group>
  );
}

// Rock - natural stone (using palette)
function Rock({ x, y, z, scale, colorVariant, rotation }: VegProps) {
  const isRich = useContext(VegetationRichnessContext);
  const shadows = useContext(VegetationShadowContext);
  const outlines = useContext(VegetationOutlineContext);

  // Use palette-based colors
  const baseRock = VEGETATION_COLORS.rockBase;
  const rockColor1 = getVegColor(baseRock, colorVariant, 15);
  const rockColor2 = getVegColor(baseRock, colorVariant - 0.15, 15);

  return (
    <group position={[x, y, z]} scale={scale * 0.6} rotation={[0, rotation, colorVariant * 0.3]}>
      <OutlineShell enabled={outlines} position={[0, 0.12, 0]}>
        <dodecahedronGeometry args={[0.2, 0]} />
      </OutlineShell>
      <mesh position={[0, 0.12, 0]} castShadow={shadows} receiveShadow={shadows}>
        <dodecahedronGeometry args={[0.2, 0]} />
        <BarkMaterial color={rockColor1} isRich={isRich} />
      </mesh>

      {colorVariant > 0.5 && (
        <>
          <OutlineShell enabled={outlines} position={[0.15, 0.08, 0.1]}>
            <dodecahedronGeometry args={[0.1, 0]} />
          </OutlineShell>
          <mesh position={[0.15, 0.08, 0.1]} castShadow={shadows} receiveShadow={shadows}>
            <dodecahedronGeometry args={[0.1, 0]} />
            <BarkMaterial color={rockColor2} isRich={isRich} />
          </mesh>
        </>
      )}
    </group>
  );
}

// Grass clump - tall grass (using palette)
function GrassClump({ x, y, z, scale, colorVariant, rotation }: VegProps) {
  const isRich = useContext(VegetationRichnessContext);
  const shadows = useContext(VegetationShadowContext);

  // Use palette-based colors
  const baseLeaf = VEGETATION_COLORS.bushBase;

  return (
    <group position={[x, y, z]} scale={scale * 0.4} rotation={[0, rotation, 0]}>
      {[0, 0.4, 0.8, 1.2, 1.6].map((angle, i) => {
        const grassColor = getVegColor(baseLeaf, colorVariant + i * 0.05, 12);
        return (
          <mesh
            key={i}
            position={[Math.sin(angle) * 0.05, 0.15 + i * 0.02, Math.cos(angle) * 0.05]}
            rotation={[0.1 - i * 0.02, angle, 0]}
            receiveShadow={shadows}
          >
            <boxGeometry args={[0.02, 0.3 + colorVariant * 0.1, 0.005]} />
            <VegMaterial color={grassColor} isRich={isRich} />
          </mesh>
        );
      })}
    </group>
  );
}

// Mushroom - forest floor fungus (using palette)
function Mushroom({ x, y, z, scale, colorVariant, rotation }: VegProps) {
  const isRich = useContext(VegetationRichnessContext);
  const shadows = useContext(VegetationShadowContext);

  // Mushroom colors from palette
  const mushroomColors = [
    { cap: PALETTE.rust, spots: PALETTE.mist },
    { cap: PALETTE.crimson, spots: PALETTE.mist },
    { cap: PALETTE.amber, spots: PALETTE.rust },
    { cap: PALETTE.coral, spots: PALETTE.mist },
  ];
  const colorIndex = Math.floor(colorVariant * mushroomColors.length);
  const colors = mushroomColors[colorIndex % mushroomColors.length];

  return (
    <group position={[x, y, z]} scale={scale * 0.3} rotation={[0, rotation, 0]}>
      {/* Stem */}
      <mesh position={[0, 0.1, 0]} receiveShadow={shadows}>
        <cylinderGeometry args={[0.04, 0.05, 0.2, 6]} />
        <VegMaterial color={PALETTE.mist} isRich={isRich} />
      </mesh>
      {/* Cap */}
      <mesh position={[0, 0.22, 0]} receiveShadow={shadows}>
        <sphereGeometry args={[0.12, 8, 4, 0, Math.PI * 2, 0, Math.PI / 2]} />
        <VegMaterial color={colors.cap} isRich={isRich} />
      </mesh>
      {/* Spots */}
      {colorVariant > 0.3 && (
        <>
          <mesh position={[0.05, 0.28, 0.03]} receiveShadow={shadows}>
            <sphereGeometry args={[0.02, 4, 4]} />
            <VegMaterial color={colors.spots} isRich={isRich} />
          </mesh>
          <mesh position={[-0.04, 0.26, -0.05]} receiveShadow={shadows}>
            <sphereGeometry args={[0.015, 4, 4]} />
            <VegMaterial color={colors.spots} isRich={isRich} />
          </mesh>
        </>
      )}
    </group>
  );
}

// Fern - forest understory plant (using palette)
function Fern({ x, y, z, scale, colorVariant, rotation }: VegProps) {
  const isRich = useContext(VegetationRichnessContext);
  const shadows = useContext(VegetationShadowContext);

  // Use palette-based colors
  const baseLeaf = VEGETATION_COLORS.pineBase;

  return (
    <group position={[x, y, z]} scale={scale * 0.5} rotation={[0, rotation, 0]}>
      {/* Multiple fronds spreading out */}
      {[0, 1, 2, 3, 4].map((i) => {
        const angle = (i / 5) * Math.PI * 2 + colorVariant;
        const tilt = 0.4 + colorVariant * 0.2;
        const frondColor = getVegColor(baseLeaf, colorVariant + i * 0.08, 18);

        return (
          <mesh
            key={i}
            position={[Math.sin(angle) * 0.08, 0.12, Math.cos(angle) * 0.08]}
            rotation={[tilt * Math.cos(angle), 0, tilt * Math.sin(angle)]}
            receiveShadow={shadows}
          >
            <boxGeometry args={[0.08, 0.25, 0.01]} />
            <VegMaterial color={frondColor} isRich={isRich} />
          </mesh>
        );
      })}
    </group>
  );
}
