// Animated Trees - Subtle tree sway using sine wave
// Visual-only, no physics, no interaction
import { useRef, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { WorldData, getElevationAt } from "@/lib/worldData";

interface AnimatedTreesProps {
  world: WorldData;
}

interface SwayingTree {
  x: number;
  y: number;
  z: number;
  scale: number;
  phase: number;
  swayAmount: number;
}

function seededRandom(x: number, y: number, seedOffset: number): number {
  const n = Math.sin(x * 12.9898 + y * 78.233 + seedOffset) * 43758.5453;
  return n - Math.floor(n);
}

export function AnimatedTrees({ world }: AnimatedTreesProps) {
  const groupRef = useRef<THREE.Group>(null);

  const trees = useMemo(() => {
    const items: SwayingTree[] = [];

    // Guard against incomplete world data
    if (!world || !world.terrain || world.terrain.length === 0 || !world.gridSize) {
      return items;
    }

    const seed = world.seed || 0;

    for (let gy = 1; gy < world.gridSize - 1; gy += 2) {
      for (let gx = 1; gx < world.gridSize - 1; gx += 2) {
        const cell = world.terrain[gy]?.[gx];
        if (!cell || cell.type !== "forest") continue;

        const flippedZ = world.gridSize - 1 - gy;
        const r1 = seededRandom(gx, gy, seed);

        if (r1 < 0.4) {
          const offsetX = (seededRandom(gx + 100, gy + 100, seed) - 0.5) * 0.6;
          const offsetZ = (seededRandom(gx + 200, gy + 200, seed) - 0.5) * 0.6;
          const treeX = gx + offsetX;
          const treeZ = flippedZ + offsetZ;
          const terrainY = getElevationAt(world, treeX, treeZ);

          items.push({
            x: treeX,
            y: terrainY,
            z: treeZ,
            scale: 0.6 + r1 * 0.5,
            phase: seededRandom(gx * 3, gy * 3, seed) * Math.PI * 2,
            swayAmount: 0.01 + seededRandom(gx * 5, gy * 5, seed) * 0.015,
          });
        }
      }
    }

    return items;
  }, [world]);

  useFrame(({ clock }) => {
    if (!groupRef.current) return;

    const time = clock.getElapsedTime();
    const children = groupRef.current.children;

    trees.forEach((tree, i) => {
      const child = children[i];
      if (!child) return;

      const sway = Math.sin(time * 0.8 + tree.phase) * tree.swayAmount;
      const swayZ = Math.sin(time * 0.6 + tree.phase * 1.3) * tree.swayAmount * 0.7;

      child.rotation.x = sway;
      child.rotation.z = swayZ;
    });
  });

  return (
    <group ref={groupRef}>
      {trees.map((tree, i) => (
        <group key={i} position={[tree.x, tree.y, tree.z]} scale={tree.scale}>
          <mesh position={[0, 0.4, 0]}>
            <cylinderGeometry args={[0.04, 0.08, 0.8, 5]} />
            <meshLambertMaterial color="#3d2517" />
          </mesh>
          <mesh position={[0, 1.1, 0]}>
            <coneGeometry args={[0.35, 0.9, 6]} />
            <meshLambertMaterial color="#1a4a1a" />
          </mesh>
          <mesh position={[0, 1.7, 0]}>
            <coneGeometry args={[0.25, 0.6, 6]} />
            <meshLambertMaterial color="#1f5520" />
          </mesh>
        </group>
      ))}
    </group>
  );
}
