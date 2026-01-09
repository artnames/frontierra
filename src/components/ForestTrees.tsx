// Forest Trees - 3D trees placed on forest tiles from NexArt

import { useMemo } from 'react';
import * as THREE from 'three';
import { WorldData, getElevationAt } from '@/lib/worldData';
import { WORLD_HEIGHT_SCALE } from '@/lib/worldConstants';

interface ForestTreesProps {
  world: WorldData;
}

export function ForestTrees({ world }: ForestTreesProps) {
  const heightScale = WORLD_HEIGHT_SCALE;
  
  const trees = useMemo(() => {
    const items: { x: number; y: number; z: number; scale: number; variant: number }[] = [];
    
    // Sample every 2 cells for performance, use deterministic placement
    for (let gy = 1; gy < world.gridSize - 1; gy += 2) {
      for (let gx = 1; gx < world.gridSize - 1; gx += 2) {
        const cell = world.terrain[gy]?.[gx];
        if (cell?.type === 'forest') {
          // Deterministic offset within cell
          const offsetX = ((gx * 17 + gy * 31) % 100) / 100 - 0.5;
          const offsetZ = ((gx * 23 + gy * 13) % 100) / 100 - 0.5;
          
          // COORDINATE FIX: Flip Y-axis for Three.js positioning
          const flippedZ = world.gridSize - 1 - gy;
          
          // Get proper terrain elevation using getElevationAt
          const treeX = gx + offsetX * 0.8;
          const treeZ = flippedZ + offsetZ * 0.8;
          const terrainY = getElevationAt(world, treeX, treeZ);
          
          // Larger tree scale for better visibility
          items.push({
            x: treeX,
            y: terrainY,
            z: treeZ,
            scale: 1.0 + ((gx * 7 + gy * 11) % 50) / 80,
            variant: (gx + gy) % 3
          });
          
          // Add second tree for denser forests
          if (cell.moisture > 0.5) {
            const offsetX2 = ((gx * 41 + gy * 19) % 100) / 100 - 0.5;
            const offsetZ2 = ((gx * 29 + gy * 37) % 100) / 100 - 0.5;
            const tree2X = gx + offsetX2 * 0.8;
            const tree2Z = flippedZ + offsetZ2 * 0.8;
            const terrain2Y = getElevationAt(world, tree2X, tree2Z);
            
            items.push({
              x: tree2X,
              y: terrain2Y,
              z: tree2Z,
              scale: 0.8 + ((gx * 13 + gy * 19) % 40) / 80,
              variant: (gx + gy + 1) % 3
            });
          }
        }
      }
    }
    
    return items;
  }, [world]);

  return (
    <group>
      {trees.map((tree, i) => (
        <Tree key={i} {...tree} />
      ))}
    </group>
  );
}

function Tree({ x, y, z, scale, variant }: { x: number; y: number; z: number; scale: number; variant: number }) {
  if (variant === 0) {
    // Pine tree
    return (
      <group position={[x, y, z]} scale={scale}>
        <mesh position={[0, 0.4, 0]}>
          <cylinderGeometry args={[0.06, 0.1, 0.8, 6]} />
          <meshLambertMaterial color="#4a3020" />
        </mesh>
        <mesh position={[0, 1.0, 0]}>
          <coneGeometry args={[0.4, 0.8, 6]} />
          <meshLambertMaterial color="#1a4a1a" />
        </mesh>
        <mesh position={[0, 1.5, 0]}>
          <coneGeometry args={[0.3, 0.6, 6]} />
          <meshLambertMaterial color="#1f5520" />
        </mesh>
        <mesh position={[0, 1.9, 0]}>
          <coneGeometry args={[0.2, 0.5, 6]} />
          <meshLambertMaterial color="#256028" />
        </mesh>
      </group>
    );
  } else if (variant === 1) {
    // Deciduous tree
    return (
      <group position={[x, y, z]} scale={scale}>
        <mesh position={[0, 0.5, 0]}>
          <cylinderGeometry args={[0.08, 0.12, 1.0, 6]} />
          <meshLambertMaterial color="#3d2517" />
        </mesh>
        <mesh position={[0, 1.4, 0]}>
          <sphereGeometry args={[0.55, 8, 6]} />
          <meshLambertMaterial color="#2a5a25" />
        </mesh>
        <mesh position={[0.25, 1.2, 0.15]}>
          <sphereGeometry args={[0.35, 6, 5]} />
          <meshLambertMaterial color="#326530" />
        </mesh>
        <mesh position={[-0.2, 1.3, -0.1]}>
          <sphereGeometry args={[0.3, 6, 5]} />
          <meshLambertMaterial color="#285522" />
        </mesh>
      </group>
    );
  } else {
    // Bush/small tree
    return (
      <group position={[x, y, z]} scale={scale}>
        <mesh position={[0, 0.2, 0]}>
          <cylinderGeometry args={[0.04, 0.06, 0.4, 5]} />
          <meshLambertMaterial color="#5a4030" />
        </mesh>
        <mesh position={[0, 0.5, 0]}>
          <sphereGeometry args={[0.35, 7, 5]} />
          <meshLambertMaterial color="#3a6a35" />
        </mesh>
        <mesh position={[0.15, 0.45, 0.1]}>
          <sphereGeometry args={[0.2, 5, 4]} />
          <meshLambertMaterial color="#457040" />
        </mesh>
      </group>
    );
  }
}
