// Deterministic World Data Generator
// Produces a queryable world map from seed + vars

export interface TerrainCell {
  x: number;
  y: number;
  elevation: number;
  type: 'water' | 'ground' | 'forest' | 'mountain';
  hasLandmark: boolean;
  landmarkType: number;
}

export interface WorldObject {
  x: number;
  y: number;
  z: number;
  type: number;
}

export interface SpawnPoint {
  x: number;
  y: number;
  z: number;
  rotationY: number;
}

export interface WorldData {
  seed: number;
  vars: number[];
  gridSize: number;
  terrain: TerrainCell[][];
  plantedObject: WorldObject;
  spawnPoint: SpawnPoint;
}

// Mulberry32 PRNG - deterministic
function mulberry32(seed: number) {
  return () => {
    let t = seed += 0x6D2B79F5;
    t = Math.imul(t ^ t >>> 15, t | 1);
    t ^= t + Math.imul(t ^ t >>> 7, t | 61);
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

// Seeded noise function with interpolation
function createNoise2D(seed: number) {
  const rng = mulberry32(seed);
  const permutation: number[] = [];
  for (let i = 0; i < 256; i++) permutation[i] = i;
  
  // Shuffle using seed
  for (let i = 255; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [permutation[i], permutation[j]] = [permutation[j], permutation[i]];
  }
  
  const perm = [...permutation, ...permutation];
  
  const fade = (t: number) => t * t * t * (t * (t * 6 - 15) + 10);
  const lerp = (a: number, b: number, t: number) => a + t * (b - a);
  const grad = (hash: number, x: number, y: number) => {
    const h = hash & 3;
    const u = h < 2 ? x : y;
    const v = h < 2 ? y : x;
    return ((h & 1) ? -u : u) + ((h & 2) ? -v : v);
  };
  
  return (x: number, y: number): number => {
    const X = Math.floor(x) & 255;
    const Y = Math.floor(y) & 255;
    const xf = x - Math.floor(x);
    const yf = y - Math.floor(y);
    const u = fade(xf);
    const v = fade(yf);
    
    const aa = perm[perm[X] + Y];
    const ab = perm[perm[X] + Y + 1];
    const ba = perm[perm[X + 1] + Y];
    const bb = perm[perm[X + 1] + Y + 1];
    
    return lerp(
      lerp(grad(aa, xf, yf), grad(ba, xf - 1, yf), u),
      lerp(grad(ab, xf, yf - 1), grad(bb, xf - 1, yf - 1), u),
      v
    ) * 0.5 + 0.5;
  };
}

// FBM (Fractal Brownian Motion) for terrain
function fbm(noise: (x: number, y: number) => number, x: number, y: number, octaves: number, roughness: number): number {
  let value = 0;
  let amplitude = 1;
  let frequency = 1;
  let maxValue = 0;
  
  for (let i = 0; i < octaves; i++) {
    value += noise(x * frequency, y * frequency) * amplitude;
    maxValue += amplitude;
    amplitude *= roughness;
    frequency *= 2;
  }
  
  return value / maxValue;
}

export function generateWorldData(seed: number, vars: number[]): WorldData {
  const GRID_SIZE = 64;
  const rng = mulberry32(seed);
  const noise = createNoise2D(seed);
  const noise2 = createNoise2D(seed + 1000);
  const noise3 = createNoise2D(seed + 2000);
  
  // Map variables
  const terrainScale = (vars[3] ?? 50) / 100 * 0.08 + 0.02;
  const waterLevel = (vars[4] ?? 30) / 100 * 0.35 + 0.15;
  const forestDensity = (vars[5] ?? 40) / 100;
  const heightMultiplier = (vars[6] ?? 50) / 100 * 2.0 + 0.5; // VAR[6] now affects actual height
  const roughness = (vars[8] ?? 50) / 100 * 0.6 + 0.3;
  const landmarkDensity = (vars[9] ?? 20) / 100 * 0.12;
  
  // Generate terrain
  const terrain: TerrainCell[][] = [];
  
  for (let y = 0; y < GRID_SIZE; y++) {
    terrain[y] = [];
    for (let x = 0; x < GRID_SIZE; x++) {
      // Multi-octave noise for base elevation
      let baseElevation = fbm(noise, x * terrainScale, y * terrainScale, 4, roughness);
      
      // Apply height multiplier to non-water areas
      const scaledElevation = baseElevation * heightMultiplier;
      
      // Determine terrain type based on base elevation (before scaling)
      let type: TerrainCell['type'];
      if (baseElevation < waterLevel) {
        type = 'water';
      } else if (baseElevation > 0.65) {
        type = 'mountain';
      } else {
        const forestNoise = noise2(x * 0.1, y * 0.1);
        type = forestNoise < forestDensity * baseElevation ? 'forest' : 'ground';
      }
      
      // Landmarks
      const landmarkNoise = noise3(x * 0.15, y * 0.15);
      const hasLandmark = type !== 'water' && type !== 'mountain' && landmarkNoise < landmarkDensity;
      
      // Final elevation - water stays low, land gets height multiplier
      const finalElevation = type === 'water' ? waterLevel * 0.3 : scaledElevation;
      
      terrain[y][x] = {
        x,
        y,
        elevation: finalElevation,
        type,
        hasLandmark,
        landmarkType: hasLandmark ? Math.floor(landmarkNoise * 100) % 3 : 0
      };
    }
  }
  
  // Planted object position (deterministic from vars)
  const objGridX = Math.floor((vars[1] ?? 50) / 100 * (GRID_SIZE - 8)) + 4;
  const objGridY = Math.floor((vars[2] ?? 50) / 100 * (GRID_SIZE - 8)) + 4;
  const objCell = terrain[objGridY]?.[objGridX];
  const objElevation = objCell?.type === 'water' ? waterLevel : (objCell?.elevation ?? 0.3);
  
  const plantedObject: WorldObject = {
    x: objGridX,
    y: objGridY,
    z: objElevation * 20 + 2,
    type: Math.floor((vars[0] ?? 50) / 100 * 5)
  };
  
  // Spawn point (deterministic from vars + seed)
  // Start away from the object to encourage exploration
  const spawnOffsetX = ((seed % 100) / 100 - 0.5) * 20;
  const spawnOffsetY = (((seed >> 8) % 100) / 100 - 0.5) * 20;
  let spawnGridX = Math.floor(GRID_SIZE / 2 + spawnOffsetX);
  let spawnGridY = Math.floor(GRID_SIZE / 2 + spawnOffsetY);
  
  // Ensure spawn is on valid ground
  spawnGridX = Math.max(2, Math.min(GRID_SIZE - 3, spawnGridX));
  spawnGridY = Math.max(2, Math.min(GRID_SIZE - 3, spawnGridY));
  
  // Find nearest non-water cell
  let attempts = 0;
  while (terrain[spawnGridY]?.[spawnGridX]?.type === 'water' && attempts < 100) {
    spawnGridX = (spawnGridX + 1) % GRID_SIZE;
    if (spawnGridX === 0) spawnGridY = (spawnGridY + 1) % GRID_SIZE;
    attempts++;
  }
  
  const spawnCell = terrain[spawnGridY]?.[spawnGridX];
  const spawnElevation = spawnCell?.elevation ?? 0.3;
  
  // Calculate rotation to face center initially
  const toCenterX = GRID_SIZE / 2 - spawnGridX;
  const toCenterY = GRID_SIZE / 2 - spawnGridY;
  const rotationY = Math.atan2(toCenterX, toCenterY);
  
  const spawnPoint: SpawnPoint = {
    x: spawnGridX,
    y: spawnGridY,
    z: spawnElevation * 20 + 2,
    rotationY
  };
  
  return {
    seed,
    vars,
    gridSize: GRID_SIZE,
    terrain,
    plantedObject,
    spawnPoint
  };
}

// Get elevation at any world position (with interpolation)
export function getElevationAt(world: WorldData, worldX: number, worldY: number): number {
  const gridX = Math.floor(worldX);
  const gridY = Math.floor(worldY);
  
  if (gridX < 0 || gridX >= world.gridSize - 1 || gridY < 0 || gridY >= world.gridSize - 1) {
    return 0;
  }
  
  const fx = worldX - gridX;
  const fy = worldY - gridY;
  
  const e00 = world.terrain[gridY][gridX].elevation;
  const e10 = world.terrain[gridY][gridX + 1].elevation;
  const e01 = world.terrain[gridY + 1][gridX].elevation;
  const e11 = world.terrain[gridY + 1][gridX + 1].elevation;
  
  // Bilinear interpolation
  const e0 = e00 * (1 - fx) + e10 * fx;
  const e1 = e01 * (1 - fx) + e11 * fx;
  
  return (e0 * (1 - fy) + e1 * fy) * 20;
}

// Check if position is walkable
export function isWalkable(world: WorldData, worldX: number, worldY: number): boolean {
  const gridX = Math.floor(worldX);
  const gridY = Math.floor(worldY);
  
  if (gridX < 0 || gridX >= world.gridSize || gridY < 0 || gridY >= world.gridSize) {
    return false;
  }
  
  const cell = world.terrain[gridY]?.[gridX];
  return cell?.type !== 'water';
}

// Calculate distance to planted object
export function distanceToObject(world: WorldData, worldX: number, worldY: number): number {
  const dx = worldX - world.plantedObject.x;
  const dy = worldY - world.plantedObject.y;
  return Math.sqrt(dx * dx + dy * dy);
}
