// NexArt World Generator V2 Unified - Shared between Solo & Multiplayer
// This uses World A macro geography for BOTH modes
// Solo derives WORLD_X/Y deterministically from seed

// ============================================
// UNIFIED V2 WORLD LAYOUT SOURCE
// 
// This generator is used for BOTH Solo and Multiplayer in V2:
// - Multiplayer: WORLD_X/Y injected from server land state
// - Solo: WORLD_X/Y derived deterministically from seed
//
// KEY FEATURES:
// - World A macro geography (continental masks, rivers, mountains)
// - Archetype-driven topology (ARCHETYPE_ID injection)
// - Realistic variable interactions (non-linear coupling)
// - Priority-based tile classification
// ============================================

export const WORLD_UNIFIED_LAYOUT_SOURCE_V2 = `
function setup() {
  colorMode("RGB");
  noStroke();
  background(0, 0, 0, 0);

  var GRID_SIZE = 64;
  var LAND_SIZE = 64;
  var WORLD_SIZE = 10;
  
  // ============================================
  // WORLD CONTEXT - Injected by host
  // For Solo: derived from seed
  // For Multiplayer: from server land state
  // ============================================
  var worldX = typeof WORLD_X !== 'undefined' ? WORLD_X : 0;
  var worldY = typeof WORLD_Y !== 'undefined' ? WORLD_Y : 0;
  
  // Seed-derived offsets for local variation
  var seedOffsetA = random(0, 1000);
  var seedOffsetB = random(0, 1000);
  var seedOffsetC = random(0, 1000);
  var seedOffsetD = random(0, 1000);
  var seedOffsetE = random(0, 1000);
  
  // ============================================
  // ARCHETYPE (injected by host as ARCHETYPE_ID)
  // ============================================
  var archetype = typeof ARCHETYPE_ID !== 'undefined' ? ARCHETYPE_ID : 0;
  
  // ============================================
  // MACRO VAR MAPPINGS with V2 REALISTIC INTERACTIONS
  // Non-linear curves and cross-coupling for believable worlds
  // ============================================
  
  // Base values from VAR[0-9]
  var landmarkType = floor(map(VAR[0], 0, 100, 0, 5));
  var objX = floor(map(VAR[1], 0, 100, 4, GRID_SIZE - 4));
  var objY = floor(map(VAR[2], 0, 100, 4, GRID_SIZE - 4));
  
  // Shaped values using smoothstep for more natural midpoint behavior
  var terrainDetailRaw = VAR[3] / 100.0;
  var terrainDetailShaped = terrainDetailRaw * terrainDetailRaw * (3.0 - 2.0 * terrainDetailRaw);
  var continentScale = 0.02 + terrainDetailShaped * 0.10;
  
  var biomeRichnessRaw = VAR[4] / 100.0;
  var biomeRichnessShaped = biomeRichnessRaw * biomeRichnessRaw * (3.0 - 2.0 * biomeRichnessRaw);
  var waterLevelBase = 0.10 + biomeRichnessShaped * 0.45;
  
  var forestRaw = VAR[5] / 100.0;
  var forestShaped = forestRaw * forestRaw * (3.0 - 2.0 * forestRaw);
  // COUPLING: Forest density influenced by biome richness
  var forestDensity = (0.10 + forestShaped * 0.75) * (0.85 + biomeRichnessShaped * 0.30);
  
  var mountainRaw = VAR[6] / 100.0;
  var mountainShaped = pow(mountainRaw, 1.3);
  // COUPLING: Mountain steepness influenced by terrain detail
  var mountainPeakHeight = (0.20 + mountainShaped * 0.80) * (0.95 + terrainDetailShaped * 0.15);
  
  var pathRaw = VAR[7] / 100.0;
  var pathShaped = pathRaw * pathRaw * (3.0 - 2.0 * pathRaw);
  var pathDensityVal = pathShaped;
  // COUPLING: Path wear influenced by visual style
  var visualStyleRaw = VAR[9] / 100.0;
  var pathWear = (0.5 + pathShaped * 1.5) * (0.9 + visualStyleRaw * 0.2);
  
  var roughnessRaw = VAR[8] / 100.0;
  var roughnessShaped = pow(roughnessRaw, 1.4);
  var terrainRoughness = 0.05 + roughnessShaped * 1.45;
  
  var mountainDensityRaw = VAR[9] / 100.0;
  var mountainDensityShaped = mountainDensityRaw * mountainDensityRaw * (3.0 - 2.0 * mountainDensityRaw);
  var mountainDensityBase = 0.02 + mountainDensityShaped * 0.98;
  
  // ============================================
  // V2 DERIVED CONTROLS (not in V1)
  // Computed from MICRO_VARS if available, else defaults
  // ============================================
  var riverWidth = typeof MV !== 'undefined' ? map(MV[0], 0, 100, 0.8, 2.5) : 1.2;
  var riverContinuity = typeof MV !== 'undefined' ? map(MV[1], 0, 100, 0.3, 0.95) : 0.7;
  var riverBankLift = typeof MV !== 'undefined' ? map(MV[2], 0, 100, 0.02, 0.12) : 0.05;
  var coastBuffer = typeof MV !== 'undefined' ? map(MV[3], 0, 100, 1.0, 4.0) : 2.0;
  var pathWidth = typeof MV !== 'undefined' ? map(MV[4], 0, 100, 0.8, 2.0) : 1.2;
  var erosionStrength = typeof MV !== 'undefined' ? map(MV[5], 0, 100, 0.0, 0.6) : 0.3;
  var coastlineComplexity = typeof MV !== 'undefined' ? map(MV[6], 0, 100, 0.02, 0.15) : 0.06;
  var cliffFrequency = typeof MV !== 'undefined' ? map(MV[7], 0, 100, 0.0, 0.5) : 0.2;
  var plateauSize = typeof MV !== 'undefined' ? map(MV[8], 0, 100, 0.0, 1.0) : 0.3;
  var valleyDepth = typeof MV !== 'undefined' ? map(MV[9], 0, 100, 0.0, 0.4) : 0.2;
  var ridgeSharpness = typeof MV !== 'undefined' ? map(MV[10], 0, 100, 0.3, 1.8) : 1.0;
  var lakeTendency = typeof MV !== 'undefined' ? map(MV[11], 0, 100, 0.0, 0.4) : 0.15;
  var wetlandSpread = typeof MV !== 'undefined' ? map(MV[12], 0, 100, 0.0, 0.20) : 0.08;
  var snowlineOffset = typeof MV !== 'undefined' ? map(MV[13], 0, 100, -0.1, 0.2) : 0.0;
  
  // ============================================
  // ARCHETYPE MODIFIERS - Structural Regime Switching
  // ============================================
  var waterLevelMod = 0;
  var mountainHeightMod = 1.0;
  var mountainDensityMod = 1.0;
  var centralMassBias = 0.0;
  var edgeFalloff = 0.0;
  var ridgeDirection = random(0, TWO_PI);
  var basinInversion = 0.0;
  var islandFragmentation = 0.0;
  
  // Apply archetype-specific modifiers
  if (archetype === 0) {
    // PLATEAU: Flat highlands with steep cliff edges
    waterLevelMod = -0.08;
    mountainHeightMod = 0.6;
    mountainDensityMod = 1.4;
    centralMassBias = 0.25;
    plateauSize = plateauSize * 1.5 + 0.3;
    cliffFrequency = cliffFrequency * 1.8 + 0.15;
  } else if (archetype === 1) {
    // BASIN: Central lowland ringed by mountains
    waterLevelMod = 0.05;
    mountainHeightMod = 1.3;
    mountainDensityMod = 0.7;
    basinInversion = 0.6;
    valleyDepth = valleyDepth * 1.5 + 0.2;
    edgeFalloff = -0.3;
  } else if (archetype === 2) {
    // RIDGED: Long mountain chains dividing regions
    waterLevelMod = -0.03;
    mountainHeightMod = 1.5;
    mountainDensityMod = 0.5;
    ridgeSharpness = ridgeSharpness * 1.4;
    centralMassBias = -0.1;
  } else if (archetype === 3) {
    // FRACTURED: Broken terrain with many varied features
    waterLevelMod = 0.0;
    mountainHeightMod = 1.0;
    mountainDensityMod = 1.3;
    erosionStrength = erosionStrength * 1.5 + 0.2;
    coastlineComplexity = coastlineComplexity * 1.6;
  } else if (archetype === 4) {
    // ARCHIPELAGO: Many islands and water channels
    waterLevelMod = 0.15;
    mountainHeightMod = 0.8;
    mountainDensityMod = 0.4;
    islandFragmentation = 0.7;
    coastlineComplexity = coastlineComplexity * 2.0 + 0.05;
    lakeTendency = lakeTendency * 0.3;
  } else if (archetype === 5) {
    // COASTAL: Large landmass with detailed shoreline
    waterLevelMod = 0.02;
    mountainHeightMod = 1.1;
    mountainDensityMod = 0.6;
    centralMassBias = 0.35;
    coastlineComplexity = coastlineComplexity * 1.5 + 0.03;
  } else if (archetype === 6) {
    // HIGHLANDS: Rolling hills and mountains everywhere
    waterLevelMod = -0.06;
    mountainHeightMod = 1.2;
    mountainDensityMod = 1.8;
    terrainRoughness = terrainRoughness * 1.3;
  }
  
  // Apply modifiers to final values
  var waterLevel = constrain(waterLevelBase + waterLevelMod, 0.08, 0.65);
  var mountainDensity = mountainDensityBase * mountainDensityMod;
  var mountainHeight = mountainPeakHeight * mountainHeightMod;
  
  var BASE_FLOOR = 0.25;
  
  // ============================================
  // MACRO GEOGRAPHY - COMPUTED FROM WORLD-SPACE
  // Same for all players at same world coordinates
  // ============================================
  
  var continentMask = [];
  var mountainRegionMask = [];
  var riverFlowMask = [];
  var climateGradient = [];
  var majorPathMask = [];
  
  for (var py = 0; py < GRID_SIZE; py++) {
    continentMask[py] = [];
    mountainRegionMask[py] = [];
    riverFlowMask[py] = [];
    climateGradient[py] = [];
    majorPathMask[py] = [];
    
    for (var px = 0; px < GRID_SIZE; px++) {
      // Convert to world-space coordinates
      var worldGX = worldX * LAND_SIZE + px;
      var worldGY = worldY * LAND_SIZE + py;
      
      // Normalize to 0-1 range across entire world
      var normWX = worldGX / (WORLD_SIZE * LAND_SIZE);
      var normWY = worldGY / (WORLD_SIZE * LAND_SIZE);
      
      // CONTINENTAL MASK - Very low frequency, spans entire world
      var continentNoise1 = noise(normWX * 2.5 + 500, normWY * 2.5 + 500);
      var continentNoise2 = noise(normWX * 5 + 1000, normWY * 5 + 1000);
      var distFromCenter = sqrt(pow(normWX - 0.5, 2) + pow(normWY - 0.5, 2)) * 1.8;
      var continentBase = continentNoise1 * 0.6 + continentNoise2 * 0.3 - distFromCenter * 0.5;
      
      // Apply archetype modifiers
      if (centralMassBias !== 0) {
        continentBase += (1.0 - distFromCenter * 2) * centralMassBias;
      }
      if (basinInversion > 0) {
        continentBase = continentBase * (1.0 - basinInversion) + (1.0 - continentBase) * basinInversion * (1.0 - distFromCenter);
      }
      if (islandFragmentation > 0) {
        var fragNoise = noise(normWX * 12 + 2000, normWY * 12 + 2000);
        continentBase = continentBase * (1.0 - islandFragmentation * 0.5) + fragNoise * islandFragmentation * 0.4;
      }
      
      continentMask[py][px] = constrain(continentBase + 0.35, 0, 1);
      
      // MOUNTAIN REGIONS - Medium frequency, creates ranges
      var mtnNoise1 = noise(normWX * 4 + 200, normWY * 4 + 200);
      var mtnNoise2 = noise(normWX * 8 + 400, normWY * 8 + 400);
      
      // Ridge-based mountains for ridged archetype
      var ridgeValue = 0;
      if (archetype === 2) {
        var ridgeCoord = normWX * cos(ridgeDirection) + normWY * sin(ridgeDirection);
        ridgeValue = sin(ridgeCoord * 15) * 0.5 + 0.5;
        ridgeValue = pow(ridgeValue, ridgeSharpness);
      }
      
      var mtnRegion = mtnNoise1 * 0.6 + mtnNoise2 * 0.4;
      mtnRegion = mtnRegion * (1.0 - ridgeValue * 0.5) + ridgeValue * 0.5;
      
      // Mountains fade near coasts (coastBuffer)
      var coastDist = continentMask[py][px] - waterLevel;
      var coastFade = constrain(coastDist * coastBuffer * 2, 0, 1);
      mountainRegionMask[py][px] = mtnRegion * coastFade;
      
      // RIVER FLOW - Low frequency, continuous corridors
      var riverNoise1 = noise(normWX * 3 + 300, normWY * 3 + 300);
      var riverNoise2 = noise(normWX * 6 + 600, normWY * 6 + 600);
      var riverBase = riverNoise1 * 0.7 + riverNoise2 * 0.3;
      
      // Continuity bias - rivers follow low areas between mountains
      var lowAreaBias = 1.0 - mountainRegionMask[py][px];
      riverFlowMask[py][px] = riverBase * 0.5 + lowAreaBias * riverContinuity * 0.5;
      
      // CLIMATE GRADIENT - Simple north-south + elevation
      climateGradient[py][px] = normWY * 0.6 + noise(normWX * 2 + 100, normWY * 2 + 100) * 0.4;
      
      // MAJOR PATH NETWORK - Low frequency connections
      var pathNoise = noise(normWX * 4 + 800, normWY * 4 + 800);
      majorPathMask[py][px] = pathNoise;
    }
  }
  
  // ============================================
  // PATH GENERATION - Thin readable paths (NO BRIDGES)
  // Paths SKIP water tiles entirely
  // ============================================
  
  var pathMask = [];
  for (var i = 0; i < GRID_SIZE; i++) {
    pathMask[i] = [];
    for (var j = 0; j < GRID_SIZE; j++) {
      pathMask[i][j] = 0;
    }
  }
  
  // Generate paths using major network as guide
  // Reduced count and thinner width
  if (pathDensityVal > 0.1) {
    var numPaths = 1 + floor(pathDensityVal * 4); // Reduced from 2 + val * 4
    numPaths = min(numPaths, 5); // Cap at 5
    
    for (var p = 0; p < numPaths; p++) {
      var startX = floor(random(4, GRID_SIZE - 4));
      var startY = floor(random(4, GRID_SIZE - 4));
      var endX = floor(random(4, GRID_SIZE - 4));
      var endY = floor(random(4, GRID_SIZE - 4));
      
      // Carve path - THIN version
      var cx = startX;
      var cy = startY;
      var steps = 0;
      var maxSteps = GRID_SIZE * 2; // Reduced from 3
      
      while ((abs(cx - endX) > 1 || abs(cy - endY) > 1) && steps < maxSteps) {
        // Mark ONLY the center cell at full strength
        if (cx >= 0 && cx < GRID_SIZE && cy >= 0 && cy < GRID_SIZE) {
          pathMask[cy][cx] = max(pathMask[cy][cx], 1.0);
          
          // Soft shoulder for direct neighbors only (much smaller values)
          for (var dx = -1; dx <= 1; dx++) {
            for (var dy = -1; dy <= 1; dy++) {
              if (dx === 0 && dy === 0) continue;
              var nx = cx + dx;
              var ny = cy + dy;
              if (nx >= 0 && nx < GRID_SIZE && ny >= 0 && ny < GRID_SIZE) {
                var isDiag = (abs(dx) + abs(dy)) === 2;
                var shoulder = isDiag ? 0.15 : 0.25; // Very soft falloff
                pathMask[ny][nx] = max(pathMask[ny][nx], shoulder);
              }
            }
          }
        }
        
        // Move towards end with some wander
        var moveX = cx < endX ? 1 : (cx > endX ? -1 : 0);
        var moveY = cy < endY ? 1 : (cy > endY ? -1 : 0);
        
        if (random(1) < 0.25) { // Reduced wander frequency
          if (random(1) < 0.5) moveX = floor(random(-1, 2));
          else moveY = floor(random(-1, 2));
        }
        
        cx = constrain(cx + moveX, 0, GRID_SIZE - 1);
        cy = constrain(cy + moveY, 0, GRID_SIZE - 1);
        steps++;
      }
    }
  }
  
  // ============================================
  // MAIN TERRAIN GENERATION LOOP
  // ============================================
  
  for (var gy = 0; gy < GRID_SIZE; gy++) {
    for (var gx = 0; gx < GRID_SIZE; gx++) {
      // Get macro geography values
      var continent = continentMask[gy][gx];
      var mtnRegion = mountainRegionMask[gy][gx];
      var riverFlow = riverFlowMask[gy][gx];
      var climate = climateGradient[gy][gx];
      var majorPath = majorPathMask[gy][gx];
      
      // Local noise for detail
      var localNoise1 = noise(gx * continentScale + seedOffsetA, gy * continentScale + seedOffsetA);
      var localNoise2 = noise(gx * terrainRoughness * 0.5 + seedOffsetB, gy * terrainRoughness * 0.5 + seedOffsetB);
      var localNoise3 = noise(gx * 0.15 + seedOffsetC, gy * 0.15 + seedOffsetC);
      
      // Combine macro + local for elevation
      var baseElev = continent * 0.6 + localNoise1 * 0.3 + localNoise2 * 0.1;
      
      // Mountain contribution
      var mtnContrib = 0;
      if (mtnRegion > 0.4 && continent > waterLevel + 0.1) {
        var mtnNoise = noise(gx * 0.12 + seedOffsetD, gy * 0.12 + seedOffsetD);
        mtnContrib = (mtnRegion - 0.4) * mountainHeight * mtnNoise * mountainDensity;
      }
      
      // Apply erosion
      var erosion = 0;
      if (erosionStrength > 0) {
        var erosionNoise = noise(gx * 0.2 + seedOffsetE, gy * 0.2 + seedOffsetE);
        erosion = erosionNoise * erosionStrength * 0.15;
      }
      
      var elevation = constrain(baseElev + mtnContrib - erosion, 0, 1);
      
      // ============================================
      // TILE CLASSIFICATION - Priority Order (NO BRIDGES)
      // Object > Path > River > Water > Snow > Mountain > Forest > Ground
      // ============================================
      
      var tileR = 100;
      var tileG = 130;
      var tileB = 80;
      var tileType = "ground";
      
      // Check object placement
      var isObject = (gx === objX && gy === objY);
      
      // Check river (continuous, believable corridors)
      var isRiver = false;
      var riverThreshold = 0.02 + (1.0 - riverContinuity) * 0.02;
      if (elevation > waterLevel && elevation < waterLevel + 0.25) {
        var riverNoise = noise(gx * 0.08 + seedOffsetC * 2, gy * 0.08 + seedOffsetC * 2);
        var riverTest = abs(riverFlow - 0.5) * 2;
        if (riverTest < riverThreshold * riverWidth && riverNoise > 0.3) {
          isRiver = true;
          // River banks get slight lift
          var bankDist = riverTest / (riverThreshold * riverWidth);
          elevation = elevation + riverBankLift * (1.0 - bankDist);
        }
      }
      
      // Check path - SKIP WATER (no bridges)
      // Only mark as path if on solid ground (above water level and not river)
      var isWaterTile = elevation < waterLevel;
      var isPath = pathMask[gy][gx] > 0.55 && !isWaterTile && !isRiver;
      
      // Determine tile type by priority (NO BRIDGES)
      if (isObject) {
        tileR = 255;
        tileG = 220;
        tileB = 50;
        tileType = "object";
      } else if (isPath) {
        tileR = 170;
        tileG = 145;
        tileB = 100;
        tileType = "path";
      } else if (isRiver) {
        tileR = 50;
        tileG = 160;
        tileB = 180;
        tileType = "river";
      } else if (elevation < waterLevel) {
        tileR = 40;
        tileG = 90;
        tileB = 160;
        tileType = "water";
      } else if (elevation > 0.75 + snowlineOffset && climate < 0.4) {
        tileR = 240;
        tileG = 245;
        tileB = 250;
        tileType = "snow";
      } else if (elevation > 0.5 && mtnRegion > 0.5) {
        tileR = 140;
        tileG = 130;
        tileB = 120;
        tileType = "mountain";
      } else {
        // Check forest (depends on moisture + biome + avoids mountains)
        var moisture = climate * 0.5 + localNoise3 * 0.5;
        // Wetness boost near rivers
        if (isRiver || (gx > 0 && riverFlowMask[gy][gx-1] > 0.45)) {
          moisture = moisture + wetlandSpread;
        }
        
        var forestTest = noise(gx * 0.1 + seedOffsetB, gy * 0.1 + seedOffsetB);
        var canForest = mtnRegion < 0.6 && elevation < 0.65;
        
        if (canForest && forestTest < forestDensity && moisture > 0.3) {
          tileR = 50;
          tileG = 100;
          tileB = 60;
          tileType = "forest";
        }
      }
      
      // Encode elevation in alpha
      var alpha = floor(elevation * 255);
      alpha = constrain(alpha, 0, 255);
      
      fill(tileR, tileG, tileB, alpha);
      rect(gx, gy, 1, 1);
    }
  }
}
`;

// ============================================
// SOLO WORLD CONTEXT DERIVATION
// Deterministically derives WORLD_X/Y from seed
// ============================================

/**
 * Deterministic hash for deriving world position from seed
 * Uses a simple integer mixing function
 */
function deterministicHash(seed: number, salt: string): number {
  let h = seed;
  for (let i = 0; i < salt.length; i++) {
    h = Math.imul(h ^ salt.charCodeAt(i), 0x5bd1e995);
    h ^= h >>> 15;
  }
  h = Math.imul(h ^ (h >>> 13), 0x5bd1e995);
  return (h ^ (h >>> 15)) >>> 0;
}

/**
 * Derive world X/Y coordinates for Solo mode from seed
 * Always returns deterministic values in [0, 9] range
 */
export function deriveSoloWorldContext(seed: number): { worldX: number; worldY: number } {
  const WORLD_SIZE = 10;
  const hashX = deterministicHash(seed, 'solo-world-x-v2');
  const hashY = deterministicHash(seed, 'solo-world-y-v2');
  
  return {
    worldX: hashX % WORLD_SIZE,
    worldY: hashY % WORLD_SIZE
  };
}

/**
 * Check if V2 unified mode should be used
 * @param searchParams - URL search params
 * @returns true if V2 should be used
 */
export function shouldUseV2Unified(searchParams: URLSearchParams): boolean {
  const versionParam = searchParams.get('v');
  const varsParam = searchParams.get('vars');
  
  // Explicit v=1 → use V1
  if (versionParam === 'v1' || versionParam === '1') {
    return false;
  }
  
  // Explicit v=2 → use V2
  if (versionParam === 'v2' || versionParam === '2') {
    return true;
  }
  
  // Legacy shared links (has vars but no version) → use V1 for backwards compat
  if (varsParam && !versionParam) {
    return false;
  }
  
  // Default: new sessions use V2
  return true;
}
