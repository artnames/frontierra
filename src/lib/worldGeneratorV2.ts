// NexArt World Generator V2 - Archetype-Aware Structural Generation
// This sketch implements the V2 parameter system with regime switching
// that produces meaningfully different topologies based on archetype

// ============================================
// V2 WORLD LAYOUT SOURCE - Archetype-Driven Topology
// NEW: Injects ARCHETYPE_ID and MICRO_VARS for structural variety
//
// ARCHETYPE_ID values:
//   0 = Plateau  (flat highlands with steep edges)
//   1 = Basin    (lowland surrounded by mountains)
//   2 = Ridged   (long mountain ridges dividing regions)
//   3 = Fractured (broken terrain with many features)
//   4 = Archipelago (islands and water channels)
//   5 = Coastal  (large landmass with detailed coastline)
//   6 = Highlands (rolling hills and mountains throughout)
//
// MICRO_VARS injected:
//   MV[0]  = River threshold
//   MV[1]  = River width
//   MV[2]  = Lake tendency
//   MV[3]  = Wetland spread
//   MV[4]  = Erosion strength
//   MV[5]  = Coastline complexity
//   MV[6]  = Cliff frequency
//   MV[7]  = Plateau size
//   MV[8]  = Valley depth
//   MV[9]  = Ridge sharpness
//   MV[10] = Biome patchiness
//   MV[11] = Tree variety
//   MV[12] = Undergrowth density
//   MV[13] = Meadow frequency
// ============================================

export const WORLD_LAYOUT_SOURCE_V2 = `
function setup() {
  colorMode("RGB");
  noStroke();
  background(0, 0, 0, 0);

  // Seed-derived offsets
  var seedOffsetA = random(0, 1000);
  var seedOffsetB = random(0, 1000);
  var seedOffsetC = random(0, 1000);
  var seedOffsetD = random(0, 1000);
  var seedOffsetE = random(0, 1000);

  var GRID_SIZE = 64;
  
  // ============================================
  // ARCHETYPE (injected by host as ARCHETYPE_ID)
  // ============================================
  var archetype = typeof ARCHETYPE_ID !== 'undefined' ? ARCHETYPE_ID : 0;
  
  // ============================================
  // MACRO VAR MAPPINGS - Base values from VAR[0-9]
  // ============================================
  var continentScale = map(VAR[3], 0, 100, 0.02, 0.12);
  var waterLevelBase = map(VAR[4], 0, 100, 0.10, 0.55);
  var forestDensity = map(VAR[5], 0, 100, 0.10, 0.85);
  var mountainPeakHeight = map(VAR[6], 0, 100, 0.20, 1.00);
  var pathDensityVal = map(VAR[7], 0, 100, 0.0, 1.0);
  var terrainRoughness = map(VAR[8], 0, 100, 0.05, 1.50);
  var mountainDensityBase = map(VAR[9], 0, 100, 0.02, 1.00);
  
  var objX = floor(map(VAR[1], 0, 100, 4, GRID_SIZE - 4));
  var objY = floor(map(VAR[2], 0, 100, 4, GRID_SIZE - 4));
  
  // ============================================
  // MICRO VAR MAPPINGS - Advanced params (injected)
  // ============================================
  var riverThreshold = typeof MV !== 'undefined' ? map(MV[0], 0, 100, 0.010, 0.035) : 0.018;
  var riverWidth = typeof MV !== 'undefined' ? map(MV[1], 0, 100, 0.4, 2.5) : 1.0;
  var lakeTendency = typeof MV !== 'undefined' ? map(MV[2], 0, 100, 0.0, 0.4) : 0.15;
  var wetlandSpread = typeof MV !== 'undefined' ? map(MV[3], 0, 100, 0.0, 0.20) : 0.08;
  var erosionStrength = typeof MV !== 'undefined' ? map(MV[4], 0, 100, 0.0, 0.6) : 0.3;
  var coastlineComplexity = typeof MV !== 'undefined' ? map(MV[5], 0, 100, 0.02, 0.15) : 0.06;
  var cliffFrequency = typeof MV !== 'undefined' ? map(MV[6], 0, 100, 0.0, 0.5) : 0.2;
  var plateauSize = typeof MV !== 'undefined' ? map(MV[7], 0, 100, 0.0, 1.0) : 0.3;
  var valleyDepth = typeof MV !== 'undefined' ? map(MV[8], 0, 100, 0.0, 0.4) : 0.2;
  var ridgeSharpness = typeof MV !== 'undefined' ? map(MV[9], 0, 100, 0.3, 1.8) : 1.0;
  var biomePatchiness = typeof MV !== 'undefined' ? map(MV[10], 0, 100, 0.02, 0.12) : 0.06;
  var treeVariety = typeof MV !== 'undefined' ? map(MV[11], 0, 100, 0.3, 1.0) : 0.6;
  var undergrowthDensity = typeof MV !== 'undefined' ? map(MV[12], 0, 100, 0.1, 0.8) : 0.4;
  var meadowFrequency = typeof MV !== 'undefined' ? map(MV[13], 0, 100, 0.05, 0.5) : 0.2;
  
  // ============================================
  // ARCHETYPE MODIFIERS - Structural Regime Switching
  // These dramatically change the world topology
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
    biomePatchiness = biomePatchiness * 1.4;
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
    valleyDepth = valleyDepth * 0.6;
  }
  
  // Apply modifiers to base values
  var waterLevel = constrain(waterLevelBase + waterLevelMod, 0.08, 0.65);
  mountainPeakHeight = mountainPeakHeight * mountainHeightMod;
  var mountainDensity = mountainDensityBase * mountainDensityMod;
  
  var BASE_FLOOR = 0.25;
  
  // ============================================
  // PATH GENERATION with archetype influence
  // ============================================
  var pathGrid = [];
  for (var py = 0; py < GRID_SIZE; py++) {
    pathGrid[py] = [];
    for (var px = 0; px < GRID_SIZE; px++) {
      pathGrid[py][px] = 0;
    }
  }
  
  var numPaths = floor(2 + pathDensityVal * 6);
  var flowScale = 0.03 + pathDensityVal * 0.05;
  
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
    
    for (var step = 0; step < GRID_SIZE * 3; step++) {
      if (cx < 0 || cx >= GRID_SIZE || cy < 0 || cy >= GRID_SIZE) {
        break;
      }
      
      var gxp = floor(cx);
      var gyp = floor(cy);
      if (gxp >= 0 && gxp < GRID_SIZE && gyp >= 0 && gyp < GRID_SIZE) {
        pathGrid[gyp][gxp] = 1;
        if (gxp > 0) pathGrid[gyp][gxp - 1] = max(pathGrid[gyp][gxp - 1], 0.6);
        if (gxp < GRID_SIZE - 1) pathGrid[gyp][gxp + 1] = max(pathGrid[gyp][gxp + 1], 0.6);
        if (gyp > 0) pathGrid[gyp - 1][gxp] = max(pathGrid[gyp - 1][gxp], 0.6);
        if (gyp < GRID_SIZE - 1) pathGrid[gyp + 1][gxp] = max(pathGrid[gyp + 1][gxp], 0.6);
      }
      
      var n1 = noise(cx * flowScale + seedOffsetA, cy * flowScale);
      var n2 = noise(cx * flowScale * 2 + seedOffsetB, cy * flowScale * 2);
      var n3 = noise(cx * flowScale * 0.5 + seedOffsetC, cy * flowScale * 0.5);
      var flowAngle = (n1 * 0.4 + n2 * 0.35 + n3 * 0.25) * TWO_PI * 2;
      
      var toTarget = atan2(targetY - cy, targetX - cx);
      var blend = 0.30 + pathDensityVal * 0.20;
      var angle = flowAngle * blend + toTarget * (1 - blend);
      angle = prevAngle * 0.50 + angle * 0.50;
      prevAngle = angle;
      
      var stepLen = 0.5 + noise(cx * 0.1 + seedOffsetD, cy * 0.1) * 0.3;
      cx = cx + cos(angle) * stepLen;
      cy = cy + sin(angle) * stepLen;
      
      // Path branching
      if (pathDensityVal > 0.25 && step > 8 && step % 10 === 0) {
        if (noise(cx * 0.4 + p * 50 + seedOffsetA, cy * 0.4) < 0.30) {
          var bx = cx;
          var by = cy;
          var bAngle = angle + (noise(bx + seedOffsetB, by) > 0.5 ? PI * 0.4 : -PI * 0.4);
          var bPrev = bAngle;
          
          for (var bs = 0; bs < 15 + floor(noise(bx + p + seedOffsetC, by) * 20); bs++) {
            var bgx = floor(bx);
            var bgy = floor(by);
            if (bgx >= 0 && bgx < GRID_SIZE && bgy >= 0 && bgy < GRID_SIZE) {
              pathGrid[bgy][bgx] = max(pathGrid[bgy][bgx], 0.85);
            }
            
            var bn1 = noise(bx * flowScale * 1.5 + seedOffsetD, by * flowScale * 1.5);
            var bn2 = noise(bx * flowScale * 3 + seedOffsetA, by * flowScale * 3);
            var bFlow = (bn1 * 0.55 + bn2 * 0.45) * TWO_PI * 2;
            bAngle = bPrev * 0.60 + bFlow * 0.40;
            bPrev = bAngle;
            
            bx = bx + cos(bAngle) * 0.5;
            by = by + sin(bAngle) * 0.5;
            
            if (bx < 0 || bx >= GRID_SIZE || by < 0 || by >= GRID_SIZE) {
              break;
            }
          }
        }
      }
    }
  }
  
  // ============================================
  // MOUNTAIN GENERATION with Archetype Influence
  // ============================================
  var mountainMask = [];
  for (var my = 0; my < GRID_SIZE; my++) {
    mountainMask[my] = [];
    for (var mx = 0; mx < GRID_SIZE; mx++) {
      mountainMask[my][mx] = 0;
    }
  }
  
  // Create mountain region mask with archetype-specific patterns
  var mountainRegionMask = [];
  for (var ry = 0; ry < GRID_SIZE; ry++) {
    mountainRegionMask[ry] = [];
    for (var rx = 0; rx < GRID_SIZE; rx++) {
      var normX = rx / GRID_SIZE;
      var normY = ry / GRID_SIZE;
      var distFromCenter = sqrt(pow(normX - 0.5, 2) + pow(normY - 0.5, 2)) * 2;
      
      // Base region noise
      var region1 = noise(rx * 0.03 + seedOffsetA, ry * 0.03 + seedOffsetB);
      var region2 = noise(rx * 0.06 + seedOffsetC, ry * 0.06 + seedOffsetD);
      var regionVal = region1 * 0.65 + region2 * 0.35;
      
      // Apply archetype-specific shaping
      if (archetype === 1) {
        // BASIN: Mountains on edges, clear center
        regionVal = regionVal * (0.3 + distFromCenter * 0.7);
      } else if (archetype === 2) {
        // RIDGED: Mountains along ridges
        var ridgeNoise = abs(sin(normX * 3 + normY * 2 + ridgeDirection) * cos(normY * 4 - normX * 1.5 + ridgeDirection * 0.7));
        regionVal = regionVal * 0.4 + ridgeNoise * ridgeSharpness * 0.6;
      } else if (archetype === 4) {
        // ARCHIPELAGO: Fragmented mountain islands
        var fragmentNoise = noise(rx * 0.08 + seedOffsetE, ry * 0.08);
        regionVal = regionVal * (1 - islandFragmentation * 0.5) + fragmentNoise * islandFragmentation * 0.5;
      } else if (archetype === 5) {
        // COASTAL: Mountains away from one edge
        var coastalBias = pow(normX, 1.5);
        regionVal = regionVal * (0.3 + coastalBias * 0.7);
      } else if (archetype === 6) {
        // HIGHLANDS: Boost overall mountain coverage
        regionVal = regionVal * 0.6 + 0.4;
      }
      
      // Apply central mass bias
      if (centralMassBias > 0) {
        regionVal = regionVal * (1 - centralMassBias) + (1 - distFromCenter) * centralMassBias;
      } else if (centralMassBias < 0) {
        regionVal = regionVal * (1 + centralMassBias) + distFromCenter * abs(centralMassBias);
      }
      
      // Threshold
      var regionThreshold = 0.70 - mountainDensity * 0.55;
      if (regionVal > regionThreshold) {
        var regionStrength = (regionVal - regionThreshold) / (1.0 - regionThreshold);
        mountainRegionMask[ry][rx] = pow(regionStrength, 0.7);
      } else {
        mountainRegionMask[ry][rx] = 0;
      }
    }
  }
  
  // Create mountain patches
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
  
  // Mountain ridges (enhanced for ridged archetype)
  var numRanges = floor(1 + mountainDensity * 5);
  if (archetype === 2) {
    numRanges = floor(3 + mountainDensity * 8);
  }
  
  for (var mr = 0; mr < numRanges; mr++) {
    var rangeStartX = noise(mr * 571 + seedOffsetC) * GRID_SIZE;
    var rangeStartY = noise(mr * 683 + seedOffsetD) * GRID_SIZE;
    
    var rsx = floor(constrain(rangeStartX, 0, GRID_SIZE - 1));
    var rsy = floor(constrain(rangeStartY, 0, GRID_SIZE - 1));
    if (archetype !== 2 && mountainRegionMask[rsy][rsx] < 0.25) {
      continue;
    }
    
    var rangeAngle = archetype === 2 ? ridgeDirection + noise(mr * 100) * 0.5 : noise(mr * 797 + seedOffsetA) * TWO_PI;
    var rangeLength = 12 + noise(mr * 911 + seedOffsetB) * 25;
    if (archetype === 2) {
      rangeLength = rangeLength * 1.8;
    }
    var rangeWidth = 3 + mountainDensity * 8;
    
    for (var rs = 0; rs < rangeLength; rs++) {
      var rxPos = rangeStartX + cos(rangeAngle) * rs * 1.1;
      var ryPos = rangeStartY + sin(rangeAngle) * rs * 1.1;
      
      var wobble = noise(rs * 0.2 + mr * 50 + seedOffsetC) * 5 - 2.5;
      rxPos = rxPos + cos(rangeAngle + HALF_PI) * wobble;
      ryPos = ryPos + sin(rangeAngle + HALF_PI) * wobble;
      
      var segRadius = rangeWidth * (0.5 + noise(rs * 0.15 + mr * 100 + seedOffsetD) * 0.7);
      var segStrength = 0.55 + noise(rs * 0.12 + mr * 200 + seedOffsetA) * 0.45;
      
      for (var sry = 0; sry < GRID_SIZE; sry++) {
        for (var srx = 0; srx < GRID_SIZE; srx++) {
          var sdx = srx - rxPos;
          var sdy = sry - ryPos;
          var sdist = sqrt(sdx * sdx + sdy * sdy);
          if (sdist < segRadius) {
            var sfall = 1.0 - (sdist / segRadius);
            sfall = pow(sfall, 1.1);
            
            var segContrib = sfall * segStrength;
            if (archetype !== 2) {
              var segRegion = mountainRegionMask[sry][srx];
              if (segRegion < 0.10) {
                segContrib = 0;
              } else {
                segContrib = segContrib * segRegion;
              }
            }
            
            mountainMask[sry][srx] = max(mountainMask[sry][srx], segContrib);
          }
        }
      }
    }
  }
  
  // ============================================
  // MAIN TERRAIN LOOP - Archetype-aware generation
  // ============================================
  for (var gy = 0; gy < GRID_SIZE; gy++) {
    for (var gx = 0; gx < GRID_SIZE; gx++) {
      var normX = gx / GRID_SIZE;
      var normY = gy / GRID_SIZE;
      var distFromCenter = sqrt(pow(normX - 0.5, 2) + pow(normY - 0.5, 2)) * 2;
      
      // Base terrain
      var continental = noise(gx * continentScale + seedOffsetA, gy * continentScale + seedOffsetB);
      
      // Apply archetype-specific continental shaping
      if (archetype === 0) {
        // PLATEAU: Flatten central area, steep edges
        var plateauNoise = noise(gx * 0.04 + seedOffsetE, gy * 0.04);
        var plateauMask = 1 - pow(distFromCenter, 0.8 + plateauSize * 0.4);
        plateauMask = constrain(plateauMask * 1.3, 0, 1);
        continental = continental * (1 - plateauMask * plateauSize) + plateauNoise * 0.3 * plateauMask + 0.4 * plateauMask;
      } else if (archetype === 1) {
        // BASIN: Lower center, higher edges
        continental = continental * (0.5 + distFromCenter * 0.5) * (1 - basinInversion * 0.3);
        if (distFromCenter < 0.4) {
          continental = continental - valleyDepth * (0.4 - distFromCenter);
        }
      } else if (archetype === 4) {
        // ARCHIPELAGO: Fragment the landmass
        var fragmentNoise = noise(gx * coastlineComplexity * 2 + seedOffsetC, gy * coastlineComplexity * 2 + seedOffsetD);
        continental = continental * (1 - islandFragmentation * 0.4) + fragmentNoise * islandFragmentation * 0.4;
      } else if (archetype === 5) {
        // COASTAL: Create strong coastal gradient
        var coastGradient = pow(normX, 0.8) * 0.4 + 0.3;
        continental = continental * 0.5 + coastGradient * 0.5;
      }
      
      // Roughness affects detail
      var roughFreq = 0.08 + terrainRoughness * 0.12;
      var roughAmp = 0.02 + terrainRoughness * 0.10;
      
      var hills = noise(gx * continentScale * 2 + seedOffsetC, gy * continentScale * 2);
      var detail = noise(gx * roughFreq + seedOffsetD, gy * roughFreq);
      var microDetail = noise(gx * roughFreq * 2.5 + seedOffsetA, gy * roughFreq * 2.5);
      
      var hillContrib = hills * 0.08 * (0.5 + terrainRoughness * 0.5);
      var detailContrib = detail * roughAmp + microDetail * roughAmp * 0.5;
      var baseElevation = BASE_FLOOR + continental * 0.12 + hillContrib + detailContrib;
      
      // Apply erosion
      if (erosionStrength > 0.1) {
        var erosionNoise = noise(gx * 0.1 + seedOffsetE, gy * 0.1);
        baseElevation = baseElevation * (1 - erosionStrength * 0.3) + erosionNoise * erosionStrength * 0.1;
      }
      
      // Mountain elevation
      var mMask = mountainMask[gy][gx];
      var mountainNoise = noise(gx * 0.10 + seedOffsetB, gy * 0.10 + seedOffsetC);
      var mountainDetail = noise(gx * 0.22 + seedOffsetD, gy * 0.22 + seedOffsetA);
      var mountainShape = mountainNoise * 0.65 + mountainDetail * 0.35;
      
      var peakFactor = pow(mMask, 0.65) * pow(mountainShape, 0.45);
      var mountainElevation = peakFactor * mountainPeakHeight * 0.70;
      
      // Combined elevation
      var shaped = baseElevation + mountainElevation;
      shaped = constrain(shaped, 0, 1);
      
      // ====== WATER SEMANTICS ======
      var isWater = shaped < waterLevel;
      
      // Lake generation
      if (!isWater && lakeTendency > 0.1) {
        var lakeNoise = noise(gx * 0.06 + seedOffsetE, gy * 0.06);
        if (lakeNoise > (1 - lakeTendency) && shaped < waterLevel + 0.08) {
          isWater = true;
        }
      }
      
      var displayElevation = shaped;
      if (!isWater && shaped < waterLevel + 0.03) {
        displayElevation = waterLevel + 0.03;
      }
      
      // Moisture
      var moistBase = noise(gx * 0.05 + seedOffsetC, gy * 0.05 + seedOffsetD);
      var moistDetail = noise(gx * biomePatchiness * 2 + seedOffsetA, gy * biomePatchiness * 2);
      var moisture = moistBase * 0.55 + moistDetail * 0.45;
      if (isWater) {
        moisture = 1.0;
      } else if (displayElevation < waterLevel + 0.12) {
        moisture = moisture + (1 - (displayElevation - waterLevel) / 0.12) * 0.30;
        moisture = moisture + wetlandSpread;
      }
      moisture = constrain(moisture, 0, 1);
      
      // Forest detection with variety
      var forestNoise = noise(gx * 0.08 + seedOffsetB, gy * 0.08 + seedOffsetC);
      var forestNoise2 = noise(gx * biomePatchiness + seedOffsetD, gy * biomePatchiness);
      var forestVal = forestNoise * (1 - treeVariety * 0.3) + forestNoise2 * treeVariety * 0.3;
      var isForest = forestVal < forestDensity && !isWater && mMask < 0.35 && moisture > 0.20;
      
      // Meadow patches in forest
      if (isForest && meadowFrequency > 0.1) {
        var meadowNoise = noise(gx * 0.12 + seedOffsetE, gy * 0.12);
        if (meadowNoise > (1 - meadowFrequency * 0.5)) {
          isForest = false;
        }
      }
      
      // Mountain and snow detection
      var isMountain = mMask > 0.20 && !isWater;
      var isSnowCap = mMask > 0.55 && mountainPeakHeight > 0.40 && mountainShape > 0.45;
      
      // Path - paths stop at water (no bridges)
      var onPath = pathGrid[gy][gx] > 0.30;
      var isPathTile = onPath && !isWater;
      
      var isObject = gx === objX && gy === objY;
      
      // Rivers with variable width
      var riverN = noise(gx * 0.04 + seedOffsetD, gy * 0.04 + seedOffsetA);
      var riverThresholdLocal = riverThreshold * (0.7 + riverWidth * 0.3);
      var isRiver = abs(riverN - 0.5) < riverThresholdLocal && !isWater && displayElevation < waterLevel + 0.18 && !onPath;
      
      // ====== ELEVATION OUTPUT ======
      var elevation = floor(displayElevation * 255);
      
      // ====== TILE TYPE PRIORITY (RGB) - NO BRIDGES ======
      var tileR = 0;
      var tileG = 0;
      var tileB = 0;
      
      if (isObject) {
        tileR = 255;
        tileG = 220;
        tileB = 60;
      } else if (isPathTile) {
        tileR = 180;
        tileG = 150;
        tileB = 100;
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
        tileR = floor(45 + fMoist * 25);
        tileG = floor(100 + moisture * 35);
        tileB = floor(40 + fMoist * 20);
      } else {
        var gMoist = moisture * 0.25;
        tileR = floor(145 + displayElevation * 20 - gMoist * 20);
        tileG = floor(125 + displayElevation * 15 + gMoist * 15);
        tileB = floor(85 + gMoist * 20);
      }
      
      fill(tileR, tileG, tileB, elevation);
      rect(gx, gy, 1, 1);
    }
  }
}
`;
