// V2 Refinement Pipeline
// V2 is a MICRO-REFINEMENT of V1, not a replacement
// With all vars at 0, V2 should produce the same world as V1
// 
// This module provides the refinement source that wraps V1 behavior
// UNIFIED: Solo and Multiplayer use the same generator entry point

// ============================================
// V2 REFINEMENT LAYOUT SOURCE
// 
// Key differences from V1:
// 1. Thinner paths (1-tile core with soft shoulder)
// 2. More organic path branching
// 3. Biome Richness (VAR[4]) affects vegetation variety, NOT water level
// 4. Visual Style (VAR[9]) does NOT affect mountains
// 5. No bridges - paths skip water
// 6. Explicit water level control via waterLevelOffset
// 7. Explicit river control via riverStrength and riverWidth
// ============================================

export const WORLD_V2_REFINEMENT_SOURCE = `
function setup() {
  colorMode("RGB");
  noStroke();
  background(0, 0, 0, 0);

  // ============================================
  // SEEDING (Protocol)
  // CodeMode runtime seeds random() + noise() from the host input.seed.
  // ============================================

  var seedOffsetA = random(0, 1000);
  var seedOffsetB = random(0, 1000);
  var seedOffsetC = random(0, 1000);
  var seedOffsetD = random(0, 1000);

  var GRID_SIZE = 64;
  
  // ============================================
  // V2 WATER LEVEL CONTROL
  // Base water level from V1 + configurable offset
  // At vars=0, baseWater=0.10 (matches V1)
  // waterLevelOffset allows ±0.08 adjustment
  // ============================================
  var baseWaterLevel = 0.10;  // V1 baseline at vars=0
  
  // MV[0] = Water Level Offset (-8 to +8 in normalized terms)
  // Maps micro var 0 (0-100) to offset (-0.08 to +0.08)
  var waterLevelOffset = 0;
  if (typeof MV !== 'undefined' && MV.length > 0) {
    waterLevelOffset = map(MV[0], 0, 100, -0.08, 0.08);
  }
  var waterLevel = baseWaterLevel + waterLevelOffset;
  waterLevel = constrain(waterLevel, 0.02, 0.55);
  
  // ============================================
  // V2 RIVER CONTROLS
  // riverStrength: 0-1, controls river presence (threshold)
  // riverWidth: 1-4 tiles
  // Rivers are VALLEY-CONSTRAINED: only below waterLevel + valleyCap
  // ============================================
  var riverStrength = 0.5;  // Default moderate rivers
  var riverWidthFactor = 1.0;  // Default 1 tile core
  
  if (typeof MV !== 'undefined' && MV.length > 1) {
    riverStrength = map(MV[1], 0, 100, 0, 1.0);
    riverWidthFactor = map(MV[2], 0, 100, 0.5, 2.0);
  }
  
  var valleyCap = 0.25;  // Rivers only in low areas
  
  // ============================================
  // VAR MAPPINGS - V2 uses SAME base mappings as V1
  // V1 behavior is preserved at vars=0
  // ============================================
  
  // VAR[3] = Terrain Detail (continent frequency)
  var continentScale = map(VAR[3], 0, 100, 0.02, 0.10);
  
  // VAR[4] = Biome Richness - controls vegetation variety
  var biomeRichness = VAR[4] / 100.0;
  
  // VAR[5] = Forest Density
  var forestDensity = map(VAR[5], 0, 100, 0.10, 0.85);
  
  // VAR[6] = Mountain Height (peak elevation from base floor)
  var mountainPeakHeight = map(VAR[6], 0, 100, 0.20, 1.00);
  
  // VAR[7] = Path Wear (affects branching and wear zones)
  var pathWearVal = map(VAR[7], 0, 100, 0.0, 1.0);
  
  // VAR[8] = Surface Roughness
  var terrainRoughness = map(VAR[8], 0, 100, 0.05, 1.50);
  
  // VAR[9] = Visual Style - Does NOT affect mountains
  var mountainDensity = map(VAR[6], 0, 100, 0.02, 0.80);
  var visualStyle = VAR[9] / 100.0;
  
  var objX = floor(map(VAR[1], 0, 100, 4, GRID_SIZE - 4));
  var objY = floor(map(VAR[2], 0, 100, 4, GRID_SIZE - 4));
  
  var BASE_FLOOR = 0.25;
  
  // ============================================
  // PATH GENERATION - V2: THINNER + MORE BRANCHING
  // ============================================
  var pathGrid = [];
  for (var py = 0; py < GRID_SIZE; py++) {
    pathGrid[py] = [];
    for (var px = 0; px < GRID_SIZE; px++) {
      pathGrid[py][px] = 0;
    }
  }
  
  var numPaths = floor(1 + pathWearVal * 4);
  numPaths = min(numPaths, 5);
  var flowScale = 0.03 + pathWearVal * 0.04;
  
  for (var p = 0; p < numPaths; p++) {
    var startEdge = floor(noise(p * 111 + seedOffsetA) * 4);
    var edgePos = noise(p * 222 + seedOffsetB) * 0.6 + 0.2;
    var cx = 0;
    var cy = 0;
    
    if (startEdge === 0) {
      cx = 0;
      cy = floor(edgePos * GRID_SIZE);
    } else if (startEdge === 1) {
      cx = GRID_SIZE - 1;
      cy = floor(edgePos * GRID_SIZE);
    } else if (startEdge === 2) {
      cx = floor(edgePos * GRID_SIZE);
      cy = 0;
    } else {
      cx = floor(edgePos * GRID_SIZE);
      cy = GRID_SIZE - 1;
    }
    
    var prevAngle = 0;
    var targetX = GRID_SIZE * 0.5 + (noise(p * 333 + seedOffsetC) - 0.5) * GRID_SIZE * 0.6;
    var targetY = GRID_SIZE * 0.5 + (noise(p * 444 + seedOffsetD) - 0.5) * GRID_SIZE * 0.6;
    
    for (var step = 0; step < GRID_SIZE * 2; step++) {
      if (cx < 0 || cx >= GRID_SIZE || cy < 0 || cy >= GRID_SIZE) {
        break;
      }
      
      var gxp = floor(cx);
      var gyp = floor(cy);
      if (gxp >= 0 && gxp < GRID_SIZE && gyp >= 0 && gyp < GRID_SIZE) {
        pathGrid[gyp][gxp] = max(pathGrid[gyp][gxp], 1.0);
        
        if (pathWearVal > 0.3) {
          var shoulderStrength = 0.15 + pathWearVal * 0.15;
          if (gxp > 0) pathGrid[gyp][gxp - 1] = max(pathGrid[gyp][gxp - 1], shoulderStrength);
          if (gxp < GRID_SIZE - 1) pathGrid[gyp][gxp + 1] = max(pathGrid[gyp][gxp + 1], shoulderStrength);
          if (gyp > 0) pathGrid[gyp - 1][gxp] = max(pathGrid[gyp - 1][gxp], shoulderStrength);
          if (gyp < GRID_SIZE - 1) pathGrid[gyp + 1][gxp] = max(pathGrid[gyp + 1][gxp], shoulderStrength);
        }
      }
      
      var n1 = noise(cx * flowScale + seedOffsetA, cy * flowScale);
      var n2 = noise(cx * flowScale * 2 + seedOffsetB, cy * flowScale * 2);
      var n3 = noise(cx * flowScale * 0.5 + seedOffsetC, cy * flowScale * 0.5);
      var flowAngle = (n1 * 0.4 + n2 * 0.35 + n3 * 0.25) * TWO_PI * 2;
      
      var toTarget = atan2(targetY - cy, targetX - cx);
      var blend = 0.35 + pathWearVal * 0.15;
      var angle = flowAngle * blend + toTarget * (1 - blend);
      angle = prevAngle * 0.55 + angle * 0.45;
      prevAngle = angle;
      
      var stepLen = 0.5 + noise(cx * 0.1 + seedOffsetD, cy * 0.1) * 0.4;
      cx = cx + cos(angle) * stepLen;
      cy = cy + sin(angle) * stepLen;
      
      if (pathWearVal > 0.2 && step > 6 && step % 8 === 0) {
        if (noise(cx * 0.3 + p * 50 + seedOffsetA, cy * 0.3) < 0.25 + pathWearVal * 0.2) {
          var bx = cx;
          var by = cy;
          var bAngle = angle + (noise(bx + seedOffsetB, by) > 0.5 ? PI * 0.35 : -PI * 0.35);
          var bPrev = bAngle;
          
          var branchLen = 8 + floor(noise(bx + p + seedOffsetC, by) * 18);
          for (var bs = 0; bs < branchLen; bs++) {
            var bgx = floor(bx);
            var bgy = floor(by);
            if (bgx >= 0 && bgx < GRID_SIZE && bgy >= 0 && bgy < GRID_SIZE) {
              pathGrid[bgy][bgx] = max(pathGrid[bgy][bgx], 0.9);
            }
            
            var bn1 = noise(bx * flowScale * 1.5 + seedOffsetD, by * flowScale * 1.5);
            var bn2 = noise(bx * flowScale * 3 + seedOffsetA, by * flowScale * 3);
            var bFlow = (bn1 * 0.55 + bn2 * 0.45) * TWO_PI * 2;
            bAngle = bPrev * 0.65 + bFlow * 0.35;
            bPrev = bAngle;
            
            bx = bx + cos(bAngle) * 0.55;
            by = by + sin(bAngle) * 0.55;
            
            if (bx < 0 || bx >= GRID_SIZE || by < 0 || by >= GRID_SIZE) {
              break;
            }
          }
        }
      }
    }
  }
  
  // ============================================
  // MOUNTAIN GENERATION - Not affected by VAR[9]
  // ============================================
  var mountainMask = [];
  for (var my = 0; my < GRID_SIZE; my++) {
    mountainMask[my] = [];
    for (var mx = 0; mx < GRID_SIZE; mx++) {
      mountainMask[my][mx] = 0;
    }
  }
  
  var mountainRegionMask = [];
  for (var ry = 0; ry < GRID_SIZE; ry++) {
    mountainRegionMask[ry] = [];
    for (var rx = 0; rx < GRID_SIZE; rx++) {
      var region1 = noise(rx * 0.03 + seedOffsetA, ry * 0.03 + seedOffsetB);
      var region2 = noise(rx * 0.06 + seedOffsetC, ry * 0.06 + seedOffsetD);
      var regionVal = region1 * 0.65 + region2 * 0.35;
      
      var regionThreshold = 0.70 - mountainDensity * 0.55;
      
      if (regionVal > regionThreshold) {
        var regionStrength = (regionVal - regionThreshold) / (1.0 - regionThreshold);
        mountainRegionMask[ry][rx] = pow(regionStrength, 0.7);
      } else {
        mountainRegionMask[ry][rx] = 0;
      }
    }
  }
  
  var numPatches = floor(3 + mountainDensity * 30);
  for (var mp = 0; mp < numPatches; mp++) {
    var patchX = noise(mp * 137 + seedOffsetA) * GRID_SIZE;
    var patchY = noise(mp * 251 + seedOffsetB) * GRID_SIZE;
    
    var pcx = floor(constrain(patchX, 0, GRID_SIZE - 1));
    var pcy = floor(constrain(patchY, 0, GRID_SIZE - 1));
    var patchCenterRegion = mountainRegionMask[pcy][pcx];
    
    if (patchCenterRegion < 0.15) {
      continue;
    }
    
    var patchRadius = 4 + mountainDensity * 18 + noise(mp * 373 + seedOffsetC) * 10;
    patchRadius = patchRadius * (0.5 + patchCenterRegion * 0.7);
    var patchStrength = 0.4 + noise(mp * 491 + seedOffsetD) * 0.6;
    
    for (var mpy = 0; mpy < GRID_SIZE; mpy++) {
      for (var mpx = 0; mpx < GRID_SIZE; mpx++) {
        var dx = mpx - patchX;
        var dy = mpy - patchY;
        var dist = sqrt(dx * dx + dy * dy);
        if (dist < patchRadius) {
          var falloff = 1.0 - (dist / patchRadius);
          falloff = pow(falloff, 1.2);
          
          var regionWeight = mountainRegionMask[mpy][mpx];
          var contribution = falloff * patchStrength * regionWeight;
          
          mountainMask[mpy][mpx] = max(mountainMask[mpy][mpx], contribution);
        }
      }
    }
  }
  
  var numRanges = floor(1 + mountainDensity * 5);
  for (var mr = 0; mr < numRanges; mr++) {
    var rangeStartX = noise(mr * 571 + seedOffsetC) * GRID_SIZE;
    var rangeStartY = noise(mr * 683 + seedOffsetD) * GRID_SIZE;
    
    var rsx = floor(constrain(rangeStartX, 0, GRID_SIZE - 1));
    var rsy = floor(constrain(rangeStartY, 0, GRID_SIZE - 1));
    if (mountainRegionMask[rsy][rsx] < 0.25) {
      continue;
    }
    
    var rangeAngle = noise(mr * 797 + seedOffsetA) * TWO_PI;
    var rangeLength = 12 + noise(mr * 911 + seedOffsetB) * 25;
    var rangeWidth = 3 + mountainDensity * 8;
    
    for (var rs = 0; rs < rangeLength; rs++) {
      var rx = rangeStartX + cos(rangeAngle) * rs * 1.1;
      var ry = rangeStartY + sin(rangeAngle) * rs * 1.1;
      
      var wobble = noise(rs * 0.2 + mr * 50 + seedOffsetC) * 5 - 2.5;
      rx = rx + cos(rangeAngle + HALF_PI) * wobble;
      ry = ry + sin(rangeAngle + HALF_PI) * wobble;
      
      var segRadius = rangeWidth * (0.5 + noise(rs * 0.15 + mr * 100 + seedOffsetD) * 0.7);
      var segStrength = 0.55 + noise(rs * 0.12 + mr * 200 + seedOffsetA) * 0.45;
      
      for (var sry = 0; sry < GRID_SIZE; sry++) {
        for (var srx = 0; srx < GRID_SIZE; srx++) {
          var sdx = srx - rx;
          var sdy = sry - ry;
          var sdist = sqrt(sdx * sdx + sdy * sdy);
          if (sdist < segRadius) {
            var sfall = 1.0 - (sdist / segRadius);
            sfall = pow(sfall, 1.1);
            
            var segRegion = mountainRegionMask[sry][srx];
            if (segRegion > 0.10) {
              var segContrib = sfall * segStrength * segRegion;
              mountainMask[sry][srx] = max(mountainMask[sry][srx], segContrib);
            }
          }
        }
      }
    }
  }
  
  // ============================================
  // PRE-COMPUTE ELEVATION FIELD
  // Needed for valley-constrained rivers
  // ============================================
  var elevationField = [];
  for (var ey = 0; ey < GRID_SIZE; ey++) {
    elevationField[ey] = [];
    for (var ex = 0; ex < GRID_SIZE; ex++) {
      var continental = noise(ex * continentScale + seedOffsetA, ey * continentScale + seedOffsetB);
      
      var roughFreq = 0.08 + terrainRoughness * 0.12;
      var roughAmp = 0.02 + terrainRoughness * 0.10;
      
      var hills = noise(ex * continentScale * 2 + seedOffsetC, ey * continentScale * 2);
      var detail = noise(ex * roughFreq + seedOffsetD, ey * roughFreq);
      var microDetail = noise(ex * roughFreq * 2.5 + seedOffsetA, ey * roughFreq * 2.5);
      
      var hillContrib = hills * 0.08 * (0.5 + terrainRoughness * 0.5);
      var detailContrib = detail * roughAmp + microDetail * roughAmp * 0.5;
      var baseElevation = BASE_FLOOR + continental * 0.12 + hillContrib + detailContrib;
      
      var mMask = mountainMask[ey][ex];
      var mountainNoise = noise(ex * 0.10 + seedOffsetB, ey * 0.10 + seedOffsetC);
      var mountainDetail = noise(ex * 0.22 + seedOffsetD, ey * 0.22 + seedOffsetA);
      var mountainShape = mountainNoise * 0.65 + mountainDetail * 0.35;
      
      var peakFactor = pow(mMask, 0.65) * pow(mountainShape, 0.45);
      var mountainElevation = peakFactor * mountainPeakHeight * 0.70;
      
      elevationField[ey][ex] = constrain(baseElevation + mountainElevation, 0, 1);
    }
  }
  
  // ============================================
  // RIVER MASK GENERATION - VALLEY-CONSTRAINED
  // Rivers only appear in low elevation areas
  // Uses wider threshold for better visibility
  // ============================================
  var riverMask = [];
  for (var rmy = 0; rmy < GRID_SIZE; rmy++) {
    riverMask[rmy] = [];
    for (var rmx = 0; rmx < GRID_SIZE; rmx++) {
      riverMask[rmy][rmx] = 0;
    }
  }
  
  // Generate river paths using noise with configurable threshold
  // Wider threshold = more rivers
  var riverThreshold = 0.025 + riverStrength * 0.035;  // 0.025 to 0.06
  
  for (var rgy = 0; rgy < GRID_SIZE; rgy++) {
    for (var rgx = 0; rgx < GRID_SIZE; rgx++) {
      // Multi-octave noise for river placement
      var riverN1 = noise(rgx * 0.04 + seedOffsetD, rgy * 0.04 + seedOffsetA);
      var riverN2 = noise(rgx * 0.08 + seedOffsetB, rgy * 0.08 + seedOffsetC);
      var riverNoise = riverN1 * 0.7 + riverN2 * 0.3;
      
      // River appears where noise is close to 0.5 (contour line)
      var distFromCenter = abs(riverNoise - 0.5);
      
      // Valley constraint: only in low areas
      var elev = elevationField[rgy][rgx];
      var inValley = elev < waterLevel + valleyCap;
      var notOnMountain = mountainMask[rgy][rgx] < 0.25;
      var notOnPath = pathGrid[rgy][rgx] < 0.5;
      var notInOcean = elev >= waterLevel;
      
      if (distFromCenter < riverThreshold && inValley && notOnMountain && notOnPath && notInOcean) {
        // Core river strength based on distance from contour line
        var riverCore = 1.0 - (distFromCenter / riverThreshold);
        riverMask[rgy][rgx] = riverCore;
      }
    }
  }
  
  // Dilate river mask for width control
  if (riverWidthFactor > 0.8) {
    var dilatedRiver = [];
    for (var ddy = 0; ddy < GRID_SIZE; ddy++) {
      dilatedRiver[ddy] = [];
      for (var ddx = 0; ddx < GRID_SIZE; ddx++) {
        var maxVal = riverMask[ddy][ddx];
        var radius = floor(riverWidthFactor);
        
        for (var ndy = -radius; ndy <= radius; ndy++) {
          for (var ndx = -radius; ndx <= radius; ndx++) {
            var ny = ddy + ndy;
            var nx = ddx + ndx;
            if (ny >= 0 && ny < GRID_SIZE && nx >= 0 && nx < GRID_SIZE) {
              var dist = sqrt(ndx * ndx + ndy * ndy);
              if (dist <= riverWidthFactor) {
                var falloff = 1.0 - (dist / (riverWidthFactor + 0.5));
                var neighbor = riverMask[ny][nx] * falloff;
                maxVal = max(maxVal, neighbor);
              }
            }
          }
        }
        dilatedRiver[ddy][ddx] = maxVal;
      }
    }
    riverMask = dilatedRiver;
  }
  
  // ============================================
  // MAIN TERRAIN LOOP
  // ============================================
  for (var gy = 0; gy < GRID_SIZE; gy++) {
    for (var gx = 0; gx < GRID_SIZE; gx++) {
      
      var shaped = elevationField[gy][gx];
      var mMask = mountainMask[gy][gx];
      
      var isWater = shaped < waterLevel;
      
      var displayElevation = shaped;
      if (!isWater && shaped < waterLevel + 0.03) {
        displayElevation = waterLevel + 0.03;
      }
      
      // Moisture for biome determination
      var moistBase = noise(gx * 0.05 + seedOffsetC, gy * 0.05 + seedOffsetD);
      var moistDetail = noise(gx * 0.12 + seedOffsetA, gy * 0.12);
      var moisture = moistBase * 0.55 + moistDetail * 0.45;
      if (isWater) {
        moisture = 1.0;
      } else if (displayElevation < waterLevel + 0.12) {
        moisture = moisture + (1 - (displayElevation - waterLevel) / 0.12) * 0.30;
      }
      moisture = constrain(moisture, 0, 1);
      
      // Forest
      var forestThreshold = forestDensity * (0.85 + biomeRichness * 0.30);
      var forestNoise = noise(gx * 0.08 + seedOffsetB, gy * 0.08 + seedOffsetC);
      var forestNoise2 = noise(gx * 0.16 + seedOffsetD, gy * 0.16);
      var forestVal = forestNoise * 0.55 + forestNoise2 * 0.45;
      var isForest = forestVal < forestThreshold && !isWater && mMask < 0.35 && moisture > 0.20;
      
      var mountainNoise = noise(gx * 0.10 + seedOffsetB, gy * 0.10 + seedOffsetC);
      var mountainDetail = noise(gx * 0.22 + seedOffsetD, gy * 0.22 + seedOffsetA);
      var mountainShape = mountainNoise * 0.65 + mountainDetail * 0.35;
      
      var isMountain = mMask > 0.20 && !isWater;
      var isSnowCap = mMask > 0.55 && mountainPeakHeight > 0.40 && mountainShape > 0.45;
      
      // Path - skip water
      var onPath = pathGrid[gy][gx] > 0.55 && !isWater;
      var isPathTile = onPath;
      
      var isObject = gx === objX && gy === objY;
      
      // River from mask
      var isRiver = riverMask[gy][gx] > 0.3 && !isWater && !onPath;
      
      // Elevation output
      var elevation = floor(displayElevation * 255);
      
      // ====== TILE TYPE PRIORITY (NO BRIDGES) ======
      // Object > Path > River > Water > Snow > Mountain > Forest > Ground
      var tileR = 0;
      var tileG = 0;
      var tileB = 0;
      
      if (isObject) {
        tileR = 255;
        tileG = 220;
        tileB = 60;
      } else if (isPathTile) {
        var pathVar = biomeRichness * 15;
        tileR = floor(175 + pathVar);
        tileG = floor(145 + pathVar * 0.5);
        tileB = floor(100 + pathVar * 0.3);
      } else if (isRiver) {
        tileR = 70;
        tileG = 160;
        tileB = 180;
      } else if (isWater) {
        var depthFactor = shaped / max(0.01, waterLevel);
        tileR = floor(20 + depthFactor * 15);
        tileG = floor(60 + depthFactor * 25);
        tileB = floor(120 + depthFactor * 25);
      } else if (isSnowCap) {
        tileR = 240;
        tileG = 245;
        tileB = 250;
      } else if (isMountain) {
        var mBlend = constrain(mMask, 0, 1);
        tileR = floor(100 + mBlend * 50);
        tileG = floor(95 + mBlend * 50);
        tileB = floor(90 + mBlend * 60);
      } else if (isForest) {
        var fMoist = moisture * 0.3;
        var richVar = biomeRichness * 20;
        tileR = floor(constrain(45 + fMoist * 25 + richVar * 0.3, 30, 80));
        tileG = floor(constrain(100 + moisture * 35 + richVar * 0.5, 80, 150));
        tileB = floor(constrain(40 + fMoist * 20 + richVar * 0.2, 30, 70));
      } else {
        // Ground with biome variation
        var gMoist = moisture * 0.25;
        var gRich = biomeRichness * 15;
        tileR = floor(constrain(145 + displayElevation * 20 - gMoist * 20 + gRich * 0.4, 120, 180));
        tileG = floor(constrain(125 + displayElevation * 15 + gMoist * 15 + gRich * 0.3, 100, 160));
        tileB = floor(constrain(85 + gMoist * 20 + gRich * 0.2, 70, 120));
      }
      
      fill(tileR, tileG, tileB, elevation);
      rect(gx, gy, 1, 1);
    }
  }
}
`;

// Derive solo world context from seed (for V2 unified mode)
export function deriveSoloWorldContextV2(seed: number): { worldX: number; worldY: number } {
  // Simple deterministic hash to derive world coordinates
  const WORLD_SIZE = 10;
  const hashX = (seed * 1664525 + 1013904223) >>> 0;
  const hashY = ((seed ^ 0xDEADBEEF) * 1664525 + 1013904223) >>> 0;
  
  return {
    worldX: hashX % WORLD_SIZE,
    worldY: hashY % WORLD_SIZE
  };
}
