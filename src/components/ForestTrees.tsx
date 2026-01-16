// Forest Trees & Vegetation - 3D objects placed on terrain from NexArt

import { useMemo, createContext, useContext } from "react";
import * as THREE from "three";
import { WorldData, getElevationAt } from "@/lib/worldData";
import { useWorldTextures } from "@/hooks/useWorldTextures";
import { MaterialKind } from "@/lib/materialRegistry";

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

/**
 * Stable toon outline: inverted hull (BackSide) slightly scaled up.
 * This is MUCH more reliable than postprocessing Outline and won’t crash.
 */
const OUTLINE_SCALE = 1.07; // higher => thicker outline
const outlineMaterial = new THREE.MeshBasicMaterial({
  color: new THREE.Color("#050505"),
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
  // Guard against incomplete world data
  if (!world || !world.terrain || world.terrain.length === 0 || !world.gridSize) {
    return null;
  }

  // When material richness is enabled...
  const { textures, isReady } = useWorldTextures({
    worldX,
    worldY,
    seed: world.seed,
    vars: world.vars,
    enabled: useRichMaterials,
  });

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
// Increased offsets to handle steep slopes where elevation varies within a cell
const TREE_GROUND_OFFSET = -0.35; // Trees sink deeper into ground for slope stability
const SMALL_VEG_GROUND_OFFSET = -0.12; // Small plants also need more offset on slopes

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

// Pine tree - tall conifer
function PineTree({ x, y, z, scale, colorVariant, rotation }: VegProps) {
  const isRich = useContext(VegetationRichnessContext);
  const shadows = useContext(VegetationShadowContext);
  const outlines = useContext(VegetationOutlineContext);

  const greenShift = Math.floor(colorVariant * 30) - 15;
  const baseGreen = 74 + greenShift;

  return (
    <group position={[x, y, z]} scale={scale} rotation={[0, rotation, 0]}>
      {/* trunk */}
      <OutlineShell enabled={outlines} position={[0, 0.4, 0]}>
        <cylinderGeometry args={[0.06, 0.1, 0.8, 6]} />
      </OutlineShell>
      <mesh position={[0, 0.4, 0]} castShadow={shadows} receiveShadow={shadows}>
        <cylinderGeometry args={[0.06, 0.1, 0.8, 6]} />
        <BarkMaterial color="#4a3020" isRich={isRich} />
      </mesh>

      {/* cones */}
      <OutlineShell enabled={outlines} position={[0, 1.0, 0]}>
        <coneGeometry args={[0.4, 0.8, 6]} />
      </OutlineShell>
      <mesh position={[0, 1.0, 0]} castShadow={shadows} receiveShadow={shadows}>
        <coneGeometry args={[0.4, 0.8, 6]} />
        <VegMaterial color={`rgb(26, ${baseGreen}, 26)`} isRich={isRich} />
      </mesh>

      <OutlineShell enabled={outlines} position={[0, 1.5, 0]}>
        <coneGeometry args={[0.3, 0.6, 6]} />
      </OutlineShell>
      <mesh position={[0, 1.5, 0]} castShadow={shadows} receiveShadow={shadows}>
        <coneGeometry args={[0.3, 0.6, 6]} />
        <VegMaterial color={`rgb(31, ${baseGreen + 11}, 32)`} isRich={isRich} />
      </mesh>

      <OutlineShell enabled={outlines} position={[0, 1.9, 0]}>
        <coneGeometry args={[0.2, 0.5, 6]} />
      </OutlineShell>
      <mesh position={[0, 1.9, 0]} castShadow={shadows} receiveShadow={shadows}>
        <coneGeometry args={[0.2, 0.5, 6]} />
        <VegMaterial color={`rgb(37, ${baseGreen + 22}, 40)`} isRich={isRich} />
      </mesh>
    </group>
  );
}

// Deciduous tree - round leafy tree
function DeciduousTree({ x, y, z, scale, colorVariant, rotation }: VegProps) {
  const isRich = useContext(VegetationRichnessContext);
  const shadows = useContext(VegetationShadowContext);
  const outlines = useContext(VegetationOutlineContext);

  const greenShift = Math.floor(colorVariant * 40) - 20;
  const baseGreen = 90 + greenShift;

  return (
    <group position={[x, y, z]} scale={scale} rotation={[0, rotation, 0]}>
      {/* trunk */}
      <OutlineShell enabled={outlines} position={[0, 0.5, 0]}>
        <cylinderGeometry args={[0.08, 0.12, 1.0, 6]} />
      </OutlineShell>
      <mesh position={[0, 0.5, 0]} castShadow={shadows} receiveShadow={shadows}>
        <cylinderGeometry args={[0.08, 0.12, 1.0, 6]} />
        <BarkMaterial color="#3d2517" isRich={isRich} />
      </mesh>

      {/* foliage blobs */}
      <OutlineShell enabled={outlines} position={[0, 1.4, 0]}>
        <sphereGeometry args={[0.55, 8, 6]} />
      </OutlineShell>
      <mesh position={[0, 1.4, 0]} castShadow={shadows} receiveShadow={shadows}>
        <sphereGeometry args={[0.55, 8, 6]} />
        <VegMaterial color={`rgb(42, ${baseGreen}, 37)`} isRich={isRich} />
      </mesh>

      <OutlineShell enabled={outlines} position={[0.25, 1.2, 0.15]}>
        <sphereGeometry args={[0.35, 6, 5]} />
      </OutlineShell>
      <mesh position={[0.25, 1.2, 0.15]} castShadow={shadows} receiveShadow={shadows}>
        <sphereGeometry args={[0.35, 6, 5]} />
        <VegMaterial color={`rgb(50, ${baseGreen + 11}, 48)`} isRich={isRich} />
      </mesh>

      <OutlineShell enabled={outlines} position={[-0.2, 1.3, -0.1]}>
        <sphereGeometry args={[0.3, 6, 5]} />
      </OutlineShell>
      <mesh position={[-0.2, 1.3, -0.1]} castShadow={shadows} receiveShadow={shadows}>
        <sphereGeometry args={[0.3, 6, 5]} />
        <VegMaterial color={`rgb(40, ${baseGreen - 5}, 34)`} isRich={isRich} />
      </mesh>
    </group>
  );
}

// Bush - small shrub
function Bush({ x, y, z, scale, colorVariant, rotation }: VegProps) {
  const isRich = useContext(VegetationRichnessContext);
  const shadows = useContext(VegetationShadowContext);
  const outlines = useContext(VegetationOutlineContext);

  const greenShift = Math.floor(colorVariant * 35) - 15;
  const baseGreen = 106 + greenShift;

  return (
    <group position={[x, y, z]} scale={scale} rotation={[0, rotation, 0]}>
      {/* stem */}
      <OutlineShell enabled={outlines} position={[0, 0.15, 0]}>
        <cylinderGeometry args={[0.03, 0.05, 0.3, 5]} />
      </OutlineShell>
      <mesh position={[0, 0.15, 0]} castShadow={shadows} receiveShadow={shadows}>
        <cylinderGeometry args={[0.03, 0.05, 0.3, 5]} />
        <BarkMaterial color="#5a4030" isRich={isRich} />
      </mesh>

      {/* bush blobs */}
      <OutlineShell enabled={outlines} position={[0, 0.4, 0]}>
        <sphereGeometry args={[0.3, 7, 5]} />
      </OutlineShell>
      <mesh position={[0, 0.4, 0]} castShadow={shadows} receiveShadow={shadows}>
        <sphereGeometry args={[0.3, 7, 5]} />
        <VegMaterial color={`rgb(58, ${baseGreen}, 53)`} isRich={isRich} />
      </mesh>

      <OutlineShell enabled={outlines} position={[0.12, 0.35, 0.08]}>
        <sphereGeometry args={[0.18, 5, 4]} />
      </OutlineShell>
      <mesh position={[0.12, 0.35, 0.08]} castShadow={shadows} receiveShadow={shadows}>
        <sphereGeometry args={[0.18, 5, 4]} />
        <VegMaterial color={`rgb(69, ${baseGreen + 6}, 64)`} isRich={isRich} />
      </mesh>
    </group>
  );
}

// Birch tree - white bark, slender
function BirchTree({ x, y, z, scale, colorVariant, rotation }: VegProps) {
  const isRich = useContext(VegetationRichnessContext);
  const shadows = useContext(VegetationShadowContext);
  const outlines = useContext(VegetationOutlineContext);

  const greenShift = Math.floor(colorVariant * 30) - 10;
  const baseGreen = 140 + greenShift;

  return (
    <group position={[x, y, z]} scale={scale} rotation={[0, rotation, 0]}>
      {/* trunk */}
      <OutlineShell enabled={outlines} position={[0, 0.6, 0]}>
        <cylinderGeometry args={[0.05, 0.07, 1.2, 6]} />
      </OutlineShell>
      <mesh position={[0, 0.6, 0]} castShadow={shadows} receiveShadow={shadows}>
        <cylinderGeometry args={[0.05, 0.07, 1.2, 6]} />
        <BarkMaterial color="#e8e0d0" isRich={isRich} />
      </mesh>

      {/* Dark bark marks (no outline — tiny) */}
      <mesh position={[0.03, 0.4, 0.04]} castShadow={shadows}>
        <boxGeometry args={[0.02, 0.08, 0.01]} />
        <BarkMaterial color="#2a2a2a" isRich={isRich} />
      </mesh>
      <mesh position={[-0.02, 0.7, -0.03]} castShadow={shadows}>
        <boxGeometry args={[0.015, 0.06, 0.01]} />
        <BarkMaterial color="#3a3a3a" isRich={isRich} />
      </mesh>

      {/* foliage */}
      <OutlineShell enabled={outlines} position={[0, 1.4, 0]}>
        <sphereGeometry args={[0.45, 7, 6]} />
      </OutlineShell>
      <mesh position={[0, 1.4, 0]} castShadow={shadows} receiveShadow={shadows}>
        <sphereGeometry args={[0.45, 7, 6]} />
        <VegMaterial color={`rgb(100, ${baseGreen}, 60)`} isRich={isRich} />
      </mesh>

      <OutlineShell enabled={outlines} position={[0.2, 1.5, 0.1]}>
        <sphereGeometry args={[0.25, 6, 5]} />
      </OutlineShell>
      <mesh position={[0.2, 1.5, 0.1]} castShadow={shadows} receiveShadow={shadows}>
        <sphereGeometry args={[0.25, 6, 5]} />
        <VegMaterial color={`rgb(120, ${baseGreen + 15}, 70)`} isRich={isRich} />
      </mesh>
    </group>
  );
}

// Willow tree - drooping branches
function WillowTree({ x, y, z, scale, colorVariant, rotation }: VegProps) {
  const isRich = useContext(VegetationRichnessContext);
  const shadows = useContext(VegetationShadowContext);
  const outlines = useContext(VegetationOutlineContext);

  const greenShift = Math.floor(colorVariant * 25);
  const baseGreen = 130 + greenShift;

  return (
    <group position={[x, y, z]} scale={scale} rotation={[0, rotation, 0]}>
      {/* trunk */}
      <OutlineShell enabled={outlines} position={[0, 0.5, 0]}>
        <cylinderGeometry args={[0.1, 0.15, 1.0, 6]} />
      </OutlineShell>
      <mesh position={[0, 0.5, 0]} castShadow={shadows} receiveShadow={shadows}>
        <cylinderGeometry args={[0.1, 0.15, 1.0, 6]} />
        <BarkMaterial color="#4a3828" isRich={isRich} />
      </mesh>

      {/* canopy */}
      <OutlineShell enabled={outlines} position={[0, 1.2, 0]}>
        <sphereGeometry args={[0.5, 8, 6]} />
      </OutlineShell>
      <mesh position={[0, 1.2, 0]} castShadow={shadows} receiveShadow={shadows}>
        <sphereGeometry args={[0.5, 8, 6]} />
        <VegMaterial color={`rgb(80, ${baseGreen}, 50)`} isRich={isRich} />
      </mesh>

      {/* drooping branches */}
      <OutlineShell enabled={outlines} position={[0.35, 0.8, 0]}>
        <cylinderGeometry args={[0.15, 0.05, 0.8, 5]} />
      </OutlineShell>
      <mesh position={[0.35, 0.8, 0]} castShadow={shadows} receiveShadow={shadows}>
        <cylinderGeometry args={[0.15, 0.05, 0.8, 5]} />
        <VegMaterial color={`rgb(70, ${baseGreen - 10}, 45)`} isRich={isRich} />
      </mesh>

      <OutlineShell enabled={outlines} position={[-0.3, 0.75, 0.2]}>
        <cylinderGeometry args={[0.12, 0.04, 0.7, 5]} />
      </OutlineShell>
      <mesh position={[-0.3, 0.75, 0.2]} castShadow={shadows} receiveShadow={shadows}>
        <cylinderGeometry args={[0.12, 0.04, 0.7, 5]} />
        <VegMaterial color={`rgb(75, ${baseGreen - 5}, 48)`} isRich={isRich} />
      </mesh>

      <OutlineShell enabled={outlines} position={[0.1, 0.7, -0.35]}>
        <cylinderGeometry args={[0.1, 0.03, 0.6, 5]} />
      </OutlineShell>
      <mesh position={[0.1, 0.7, -0.35]} castShadow={shadows} receiveShadow={shadows}>
        <cylinderGeometry args={[0.1, 0.03, 0.6, 5]} />
        <VegMaterial color={`rgb(85, ${baseGreen + 5}, 55)`} isRich={isRich} />
      </mesh>
    </group>
  );
}

// Dead tree - bare branches
function DeadTree({ x, y, z, scale, colorVariant, rotation }: VegProps) {
  const isRich = useContext(VegetationRichnessContext);
  const shadows = useContext(VegetationShadowContext);
  const outlines = useContext(VegetationOutlineContext);

  const grayShift = Math.floor(colorVariant * 20);
  const baseGray = 60 + grayShift;

  return (
    <group position={[x, y, z]} scale={scale} rotation={[0, rotation, 0]}>
      {/* trunk */}
      <OutlineShell enabled={outlines} position={[0, 0.5, 0]}>
        <cylinderGeometry args={[0.06, 0.1, 1.0, 5]} />
      </OutlineShell>
      <mesh position={[0, 0.5, 0]} castShadow={shadows} receiveShadow={shadows}>
        <cylinderGeometry args={[0.06, 0.1, 1.0, 5]} />
        <BarkMaterial color={`rgb(${baseGray}, ${baseGray - 10}, ${baseGray - 20})`} isRich={isRich} />
      </mesh>

      {/* bare branches */}
      <OutlineShell enabled={outlines} position={[0.15, 0.9, 0]} rotation={[0, 0, -0.5]} scale={1.12}>
        <cylinderGeometry args={[0.02, 0.03, 0.4, 4]} />
      </OutlineShell>
      <mesh position={[0.15, 0.9, 0]} rotation={[0, 0, -0.5]} castShadow={shadows}>
        <cylinderGeometry args={[0.02, 0.03, 0.4, 4]} />
        <BarkMaterial color={`rgb(${baseGray - 5}, ${baseGray - 15}, ${baseGray - 25})`} isRich={isRich} />
      </mesh>

      <OutlineShell enabled={outlines} position={[-0.12, 1.0, 0.05]} rotation={[0.2, 0, 0.6]} scale={1.12}>
        <cylinderGeometry args={[0.015, 0.025, 0.35, 4]} />
      </OutlineShell>
      <mesh position={[-0.12, 1.0, 0.05]} rotation={[0.2, 0, 0.6]} castShadow={shadows}>
        <cylinderGeometry args={[0.015, 0.025, 0.35, 4]} />
        <BarkMaterial color={`rgb(${baseGray - 8}, ${baseGray - 18}, ${baseGray - 28})`} isRich={isRich} />
      </mesh>

      <OutlineShell enabled={outlines} position={[0.05, 1.1, -0.1]} rotation={[-0.3, 0, 0.2]} scale={1.12}>
        <cylinderGeometry args={[0.01, 0.02, 0.25, 4]} />
      </OutlineShell>
      <mesh position={[0.05, 1.1, -0.1]} rotation={[-0.3, 0, 0.2]} castShadow={shadows}>
        <cylinderGeometry args={[0.01, 0.02, 0.25, 4]} />
        <BarkMaterial color={`rgb(${baseGray - 3}, ${baseGray - 13}, ${baseGray - 23})`} isRich={isRich} />
      </mesh>
    </group>
  );
}

// Flower - colorful small plant (receives shadows only, too small to cast meaningful shadows)
function Flower({ x, y, z, scale, colorVariant, rotation }: VegProps) {
  const isRich = useContext(VegetationRichnessContext);
  const shadows = useContext(VegetationShadowContext);

  // Different flower colors based on variant
  const flowerColors = ["#ff6b8a", "#ffeb3b", "#9c27b0", "#ff9800", "#e91e63", "#03a9f4", "#f44336"];
  const colorIndex = Math.floor(colorVariant * flowerColors.length);
  const flowerColor = flowerColors[colorIndex % flowerColors.length];

  return (
    <group position={[x, y, z]} scale={scale * 0.5} rotation={[0, rotation, 0]}>
      {/* Stem */}
      <mesh position={[0, 0.15, 0]} receiveShadow={shadows}>
        <cylinderGeometry args={[0.015, 0.02, 0.3, 4]} />
        <VegMaterial color="#228b22" isRich={isRich} />
      </mesh>
      {/* Flower head */}
      <mesh position={[0, 0.35, 0]} receiveShadow={shadows}>
        <sphereGeometry args={[0.08, 6, 5]} />
        <VegMaterial color={flowerColor} isRich={isRich} />
      </mesh>
      {/* Center */}
      <mesh position={[0, 0.38, 0.05]} receiveShadow={shadows}>
        <sphereGeometry args={[0.03, 4, 4]} />
        <VegMaterial color="#ffd700" isRich={isRich} />
      </mesh>
    </group>
  );
}

// Rock - natural stone
function Rock({ x, y, z, scale, colorVariant, rotation }: VegProps) {
  const isRich = useContext(VegetationRichnessContext);
  const shadows = useContext(VegetationShadowContext);
  const outlines = useContext(VegetationOutlineContext);

  const grayBase = 90 + Math.floor(colorVariant * 40);

  return (
    <group position={[x, y, z]} scale={scale * 0.6} rotation={[0, rotation, colorVariant * 0.3]}>
      <OutlineShell enabled={outlines} position={[0, 0.12, 0]}>
        <dodecahedronGeometry args={[0.2, 0]} />
      </OutlineShell>
      <mesh position={[0, 0.12, 0]} castShadow={shadows} receiveShadow={shadows}>
        <dodecahedronGeometry args={[0.2, 0]} />
        <BarkMaterial color={`rgb(${grayBase}, ${grayBase - 5}, ${grayBase - 10})`} isRich={isRich} />
      </mesh>

      {colorVariant > 0.5 && (
        <>
          <OutlineShell enabled={outlines} position={[0.15, 0.08, 0.1]}>
            <dodecahedronGeometry args={[0.1, 0]} />
          </OutlineShell>
          <mesh position={[0.15, 0.08, 0.1]} castShadow={shadows} receiveShadow={shadows}>
            <dodecahedronGeometry args={[0.1, 0]} />
            <BarkMaterial color={`rgb(${grayBase - 15}, ${grayBase - 20}, ${grayBase - 25})`} isRich={isRich} />
          </mesh>
        </>
      )}
    </group>
  );
}

// Grass clump - tall grass (receives shadows only)
function GrassClump({ x, y, z, scale, colorVariant, rotation }: VegProps) {
  const isRich = useContext(VegetationRichnessContext);
  const shadows = useContext(VegetationShadowContext);

  const greenShift = Math.floor(colorVariant * 40) - 20;
  const baseGreen = 140 + greenShift;

  return (
    <group position={[x, y, z]} scale={scale * 0.4} rotation={[0, rotation, 0]}>
      {[0, 0.4, 0.8, 1.2, 1.6].map((angle, i) => (
        <mesh
          key={i}
          position={[Math.sin(angle) * 0.05, 0.15 + i * 0.02, Math.cos(angle) * 0.05]}
          rotation={[0.1 - i * 0.02, angle, 0]}
          receiveShadow={shadows}
        >
          <boxGeometry args={[0.02, 0.3 + colorVariant * 0.1, 0.005]} />
          <VegMaterial color={`rgb(${80 + i * 5}, ${baseGreen + i * 3}, ${50 + i * 3})`} isRich={isRich} />
        </mesh>
      ))}
    </group>
  );
}

// Mushroom - forest floor fungus (receives shadows only)
function Mushroom({ x, y, z, scale, colorVariant, rotation }: VegProps) {
  const isRich = useContext(VegetationRichnessContext);
  const shadows = useContext(VegetationShadowContext);

  const mushroomColors = [
    { cap: "#8b4513", spots: "#f5deb3" },
    { cap: "#dc143c", spots: "#ffffff" },
    { cap: "#daa520", spots: "#8b4513" },
    { cap: "#f4a460", spots: "#ffffff" },
  ];
  const colorIndex = Math.floor(colorVariant * mushroomColors.length);
  const colors = mushroomColors[colorIndex % mushroomColors.length];

  return (
    <group position={[x, y, z]} scale={scale * 0.3} rotation={[0, rotation, 0]}>
      {/* Stem */}
      <mesh position={[0, 0.1, 0]} receiveShadow={shadows}>
        <cylinderGeometry args={[0.04, 0.05, 0.2, 6]} />
        <VegMaterial color="#f5f5dc" isRich={isRich} />
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

// Fern - forest understory plant (receives shadows only)
function Fern({ x, y, z, scale, colorVariant, rotation }: VegProps) {
  const isRich = useContext(VegetationRichnessContext);
  const shadows = useContext(VegetationShadowContext);

  const greenShift = Math.floor(colorVariant * 30);
  const baseGreen = 120 + greenShift;

  return (
    <group position={[x, y, z]} scale={scale * 0.5} rotation={[0, rotation, 0]}>
      {/* Multiple fronds spreading out */}
      {[0, 1, 2, 3, 4].map((i) => {
        const angle = (i / 5) * Math.PI * 2 + colorVariant;
        const tilt = 0.4 + colorVariant * 0.2;
        return (
          <group key={i} rotation={[tilt, angle, 0]}>
            <mesh position={[0, 0.15, 0.1]} receiveShadow={shadows}>
              <boxGeometry args={[0.08, 0.02, 0.25]} />
              <VegMaterial color={`rgb(${50 + i * 5}, ${baseGreen + i * 2}, ${40 + i * 3})`} isRich={isRich} />
            </mesh>
          </group>
        );
      })}
    </group>
  );
}
