// NexArt World Generator - Canonical Source
// This sketch defines the ONLY valid world layout
// 3D rendering must derive from this output, never independently

// ============================================
// WORLD LAYOUT SOURCE - Outputs 64x64 encoded grid
// NEW RGBA Channel Encoding:
//   RGB   = Tile Type (categorical color)
//   Alpha = Elevation (0-255, continuous)
//
// Tile Colors (RGB):
//   Water:    (30, 80, 140)
//   Ground:   (160, 140, 100)
//   Forest:   (60, 120, 50)
//   Mountain: (130, 125, 120)
//   Path:     (180, 150, 100)
//   Bridge:   (120, 80, 50)
//   Landmark: (220, 80, 80)
//   River:    (70, 160, 180)
//   Object:   (255, 220, 60)
// ============================================

export const WORLD_LAYOUT_SOURCE = `
function setup() {
  colorMode("RGB");
  noStroke();
  background(0, 0, 0, 0);

  // ============================================
  // SEEDING (Protocol)
  // CodeMode runtime seeds random() + noise() from the host input.seed.
  // IMPORTANT: Do NOT call noiseSeed()/randomSeed() here unless you have the seed value.
  // ============================================

  // Seed-derived offsets (deterministic via seeded random()).
  // Used to decorrelate multiple noise fields while still being seed-stable.
  var seedOffsetA = random(0, 1000);
  var seedOffsetB = random(0, 1000);
  var seedOffsetC = random(0, 1000);
  var seedOffsetD = random(0, 1000);

  var GRID_SIZE = 64;
  
  // ============================================
  // VAR MAPPINGS - All ranges tuned for visible effects
  // ============================================
  // VAR[3] = Continent Scale (terrain frequency)
  // VAR[4] = Water Level (0=very low, 50=normal, 100=very high)
  // VAR[5] = Forest Density
  // VAR[6] = Mountain Height (peak elevation from base floor)
  // VAR[7] = Path Density
  // VAR[8] = Terrain Roughness (ground bumpiness and detail)
  // VAR[9] = Mountain Density (number of mountain patches)
  
  var continentScale = map(VAR[3], 0, 100, 0.02, 0.10);
  var waterLevel = map(VAR[4], 0, 100, 0.10, 0.55);
  var forestDensity = map(VAR[5], 0, 100, 0.10, 0.85);
  
  // Mountain height: from flat hills (0.2) to dramatic peaks (1.0)
  var mountainPeakHeight = map(VAR[6], 0, 100, 0.20, 1.00);
  
  var pathDensityVal = map(VAR[7], 0, 100, 0.0, 1.0);
  
  // Roughness affects both frequency and amplitude of terrain detail
  var terrainRoughness = map(VAR[8], 0, 100, 0.05, 1.50);
  
  // Mountain density: from sparse isolated peaks to 70% coverage
  var mountainDensity = map(VAR[9], 0, 100, 0.02, 1.00);
  
  var objX = floor(map(VAR[1], 0, 100, 4, GRID_SIZE - 4));
  var objY = floor(map(VAR[2], 0, 100, 4, GRID_SIZE - 4));
  
  // Base floor level - provides stable ground plane
  var BASE_FLOOR = 0.25;
  
  // ============================================
  // PATH GENERATION - Always visible paths
  // ============================================
  var pathGrid = [];
  for (var py = 0; py < GRID_SIZE; py++) {
    pathGrid[py] = [];
    for (var px = 0; px < GRID_SIZE; px++) {
      pathGrid[py][px] = 0;
    }
  }
  
  // Minimum 2 paths, up to 8 at high density
  var numPaths = floor(2 + pathDensityVal * 6);
  var flowScale = 0.03 + pathDensityVal * 0.05;
  
  for (var p = 0; p < numPaths; p++) {
    // Use seed offsets for path positions
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
        // Wider paths for visibility
        if (gxp > 0) pathGrid[gyp][gxp - 1] = max(pathGrid[gyp][gxp - 1], 0.6);
        if (gxp < GRID_SIZE - 1) pathGrid[gyp][gxp + 1] = max(pathGrid[gyp][gxp + 1], 0.6);
        if (gyp > 0) pathGrid[gyp - 1][gxp] = max(pathGrid[gyp - 1][gxp], 0.6);
        if (gyp < GRID_SIZE - 1) pathGrid[gyp + 1][gxp] = max(pathGrid[gyp + 1][gxp], 0.6);
      }
      
      // Use seed-dependent noise for flow
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
      
      // Branching paths at higher density
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
  // MOUNTAIN GENERATION - Seed-dependent clustering
  // ============================================
  var mountainMask = [];
  for (var my = 0; my < GRID_SIZE; my++) {
    mountainMask[my] = [];
    for (var mx = 0; mx < GRID_SIZE; mx++) {
      mountainMask[my][mx] = 0;
    }
  }
  
  // FIRST: Create low-frequency region mask - WHERE mountains CAN form
  // Using seed offsets for unique patterns per seed
  var mountainRegionMask = [];
  for (var ry = 0; ry < GRID_SIZE; ry++) {
    mountainRegionMask[ry] = [];
    for (var rx = 0; rx < GRID_SIZE; rx++) {
      // Very low frequency for large-scale clustering with seed variation
      var region1 = noise(rx * 0.03 + seedOffsetA, ry * 0.03 + seedOffsetB);
      var region2 = noise(rx * 0.06 + seedOffsetC, ry * 0.06 + seedOffsetD);
      var regionVal = region1 * 0.65 + region2 * 0.35;
      
      // Threshold: higher density = lower threshold = more area
      // At 0% density: threshold = 0.70 (very few mountains)
      // At 100% density: threshold = 0.15 (mountains everywhere)
      var regionThreshold = 0.70 - mountainDensity * 0.55;
      
      if (regionVal > regionThreshold) {
        var regionStrength = (regionVal - regionThreshold) / (1.0 - regionThreshold);
        mountainRegionMask[ry][rx] = pow(regionStrength, 0.7);
      } else {
        mountainRegionMask[ry][rx] = 0;
      }
    }
  }
  
  // SECOND: Create circular mountain patches within eligible regions
  // More patches at high density
  var numPatches = floor(3 + mountainDensity * 30);
  for (var mp = 0; mp < numPatches; mp++) {
    // Use seed for patch positions
    var patchX = noise(mp * 137 + seedOffsetA) * GRID_SIZE;
    var patchY = noise(mp * 251 + seedOffsetB) * GRID_SIZE;
    
    var pcx = floor(constrain(patchX, 0, GRID_SIZE - 1));
    var pcy = floor(constrain(patchY, 0, GRID_SIZE - 1));
    var patchCenterRegion = mountainRegionMask[pcy][pcx];
    
    // Skip if not in eligible region
    if (patchCenterRegion < 0.15) {
      continue;
    }
    
    // Larger patches at higher density
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
  
  // THIRD: Add elongated ranges within regions
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
  // MAIN TERRAIN LOOP - Apply all effects
  // ============================================
  for (var gy = 0; gy < GRID_SIZE; gy++) {
    for (var gx = 0; gx < GRID_SIZE; gx++) {
      
      // Base terrain with seed-dependent noise
      var continental = noise(gx * continentScale + seedOffsetA, gy * continentScale + seedOffsetB);
      
      // Roughness affects detail frequency and amplitude
      var roughFreq = 0.08 + terrainRoughness * 0.12;
      var roughAmp = 0.02 + terrainRoughness * 0.10;
      
      var hills = noise(gx * continentScale * 2 + seedOffsetC, gy * continentScale * 2);
      var detail = noise(gx * roughFreq + seedOffsetD, gy * roughFreq);
      var microDetail = noise(gx * roughFreq * 2.5 + seedOffsetA, gy * roughFreq * 2.5);
      
      // Floor elevation with roughness-controlled variation
      var hillContrib = hills * 0.08 * (0.5 + terrainRoughness * 0.5);
      var detailContrib = detail * roughAmp + microDetail * roughAmp * 0.5;
      var baseElevation = BASE_FLOOR + continental * 0.12 + hillContrib + detailContrib;
      
      // Mountain elevation - scaled by mountainPeakHeight
      var mMask = mountainMask[gy][gx];
      var mountainNoise = noise(gx * 0.10 + seedOffsetB, gy * 0.10 + seedOffsetC);
      var mountainDetail = noise(gx * 0.22 + seedOffsetD, gy * 0.22 + seedOffsetA);
      var mountainShape = mountainNoise * 0.65 + mountainDetail * 0.35;
      
      // Peak factor with height control
      var peakFactor = pow(mMask, 0.65) * pow(mountainShape, 0.45);
      var mountainElevation = peakFactor * mountainPeakHeight * 0.70;
      
      // Combined elevation
      var shaped = baseElevation + mountainElevation;
      shaped = constrain(shaped, 0, 1);
      
      // ====== WATER SEMANTICS ======
      var isWater = shaped < waterLevel;
      
      var displayElevation = shaped;
      if (!isWater && shaped < waterLevel + 0.03) {
        displayElevation = waterLevel + 0.03;
      }
      
      // Moisture from green tones
      var moistBase = noise(gx * 0.05 + seedOffsetC, gy * 0.05 + seedOffsetD);
      var moistDetail = noise(gx * 0.12 + seedOffsetA, gy * 0.12);
      var moisture = moistBase * 0.55 + moistDetail * 0.45;
      if (isWater) {
        moisture = 1.0;
      } else if (displayElevation < waterLevel + 0.12) {
        moisture = moisture + (1 - (displayElevation - waterLevel) / 0.12) * 0.30;
      }
      moisture = constrain(moisture, 0, 1);
      
      // Forest detection
      var forestNoise = noise(gx * 0.08 + seedOffsetB, gy * 0.08 + seedOffsetC);
      var forestNoise2 = noise(gx * 0.16 + seedOffsetD, gy * 0.16);
      var forestVal = forestNoise * 0.55 + forestNoise2 * 0.45;
      var isForest = forestVal < forestDensity && !isWater && mMask < 0.35 && moisture > 0.20;
      
      // Mountain and snow detection
      var isMountain = mMask > 0.20 && !isWater;
      var isSnowCap = mMask > 0.55 && mountainPeakHeight > 0.40 && mountainShape > 0.45;
      
      // Path and bridge detection - lowered threshold for visibility
      var onPath = pathGrid[gy][gx] > 0.30;
      var isBridge = onPath && isWater;
      var isPathTile = onPath && !isWater;
      
      var isObject = gx === objX && gy === objY;
      
      // Rivers
      var riverN = noise(gx * 0.04 + seedOffsetD, gy * 0.04 + seedOffsetA);
      var isRiver = abs(riverN - 0.5) < 0.018 && !isWater && displayElevation < waterLevel + 0.18 && !onPath;
      
      // ====== ELEVATION OUTPUT ======
      var elevation = floor(displayElevation * 255);
      
      // ====== TILE TYPE PRIORITY (RGB) ======
      var tileR = 0;
      var tileG = 0;
      var tileB = 0;
      
      if (isObject) {
        tileR = 255;
        tileG = 220;
        tileB = 60;
      } else if (isBridge) {
        tileR = 120;
        tileG = 80;
        tileB = 50;
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

// ============================================
// ISOMETRIC PREVIEW SOURCE - Visual only
// ============================================

export const WORLD_SOURCE = `
// Isometric Preview (visual representation only)
// The canonical layout comes from WORLD_LAYOUT_SOURCE

function setup() {
  colorMode("HSB");
  noStroke();
  background(220, 20, 6);
  
  var GRID_SIZE = 32;
  var TILE_WIDTH = 16;
  var TILE_HEIGHT = 8;
  
  var terrainScale = map(VAR[3], 0, 100, 0.02, 0.15);
  var waterLevel = map(VAR[4], 0, 100, 0.2, 0.6);
  var forestDensity = map(VAR[5], 0, 100, 0.1, 0.8);
  var mountainMult = map(VAR[6], 0, 100, 0.5, 2.0);
  var hueShift = map(VAR[7], 0, 100, -30, 30);
  var roughness = map(VAR[8], 0, 100, 0.5, 2.0);
  var landmarkDensity = map(VAR[9], 0, 100, 0.01, 0.15);
  
  var objectType = floor(map(VAR[0], 0, 100, 0, 5));
  var objectX = floor(map(VAR[1], 0, 100, 2, GRID_SIZE - 2));
  var objectY = floor(map(VAR[2], 0, 100, 2, GRID_SIZE - 2));
  
  var offsetX = width / 2;
  var offsetY = 80;
  
  var terrain = [];
  
  for (var y = 0; y < GRID_SIZE; y++) {
    terrain[y] = [];
    for (var x = 0; x < GRID_SIZE; x++) {
      var nx = x * terrainScale;
      var ny = y * terrainScale;
      
      var elevation = noise(nx, ny) * 0.5;
      elevation = elevation + noise(nx * 2, ny * 2) * 0.25 * roughness;
      elevation = elevation + noise(nx * 4, ny * 4) * 0.125 * roughness;
      
      var moisture = noise(nx + 100, ny + 100);
      
      terrain[y][x] = {
        elevation: elevation * mountainMult,
        moisture: moisture,
        isWater: elevation < waterLevel
      };
    }
  }
  
  for (var y = 0; y < GRID_SIZE; y++) {
    for (var x = 0; x < GRID_SIZE; x++) {
      var cell = terrain[y][x];
      
      var isoX = (x - y) * (TILE_WIDTH / 2) + offsetX;
      var isoY = (x + y) * (TILE_HEIGHT / 2) + offsetY;
      
      var heightOffset = cell.elevation * 30;
      isoY = isoY - heightOffset;
      
      var hue = 0;
      var sat = 0;
      var bri = 0;
      
      if (cell.isWater) {
        hue = 210 + hueShift;
        sat = 60;
        bri = 40 + cell.elevation * 20;
      } else if (cell.elevation > 0.7) {
        hue = 30 + hueShift;
        sat = 10;
        bri = 85 + cell.elevation * 15;
      } else if (cell.moisture > forestDensity) {
        hue = 120 + hueShift;
        sat = 50 + cell.moisture * 30;
        bri = 35 + cell.elevation * 25;
      } else {
        hue = 80 + hueShift;
        sat = 30 + cell.moisture * 20;
        bri = 50 + cell.elevation * 30;
      }
      
      hue = hue % 360;
      if (hue < 0) hue = hue + 360;
      
      fill(hue, sat, bri);
      
      beginShape();
      vertex(isoX, isoY);
      vertex(isoX + TILE_WIDTH / 2, isoY + TILE_HEIGHT / 2);
      vertex(isoX, isoY + TILE_HEIGHT);
      vertex(isoX - TILE_WIDTH / 2, isoY + TILE_HEIGHT / 2);
      endShape(CLOSE);
      
      if (cell.elevation > 0.3 && !cell.isWater) {
        fill(hue, sat, bri * 0.7);
        beginShape();
        vertex(isoX, isoY + TILE_HEIGHT);
        vertex(isoX + TILE_WIDTH / 2, isoY + TILE_HEIGHT / 2);
        vertex(isoX + TILE_WIDTH / 2, isoY + TILE_HEIGHT / 2 + heightOffset * 0.3);
        vertex(isoX, isoY + TILE_HEIGHT + heightOffset * 0.3);
        endShape(CLOSE);
      }
    }
  }
  
  if (terrain[objectY] && terrain[objectY][objectX]) {
    var objCell = terrain[objectY][objectX];
    var objIsoX = (objectX - objectY) * (TILE_WIDTH / 2) + offsetX;
    var objIsoY = (objectX + objectY) * (TILE_HEIGHT / 2) + offsetY - objCell.elevation * 30;
    
    fill(50, 80, 95);
    ellipse(objIsoX, objIsoY - 5, 8, 12);
    
    stroke(45, 70, 40);
    strokeWeight(2);
    line(objIsoX, objIsoY - 5, objIsoX, objIsoY + 3);
    noStroke();
  }
}
`;

// ============================================
// WORLD PARAMS INTERFACE
// ============================================

export interface WorldParams {
  seed: number;
  vars: number[];
  // World A context - when provided, enables shared macro geography
  worldContext?: {
    worldX: number;  // 0-9
    worldY: number;  // 0-9
  };
}

// ============================================
// VAR LABELS FOR UI - EXPRESSION ONLY
// In World A mode, these control local expression, NOT geography
// ============================================

export const VAR_LABELS: string[] = [
  'Landmark Archetype',      // VAR[0] - Structure/object type
  'Landmark X Bias',         // VAR[1] - Micro offset for placement
  'Landmark Y Bias',         // VAR[2] - Micro offset for placement
  'Terrain Detail',          // VAR[3] - Local noise frequency (micro-bumps)
  'Biome Richness',          // VAR[4] - Color & vegetation variation
  'Forest Density',          // VAR[5] - Tree clustering within fixed forest regions
  'Mountain Steepness',      // VAR[6] - Slope curves, snow caps (NOT placement)
  'Path Wear',               // VAR[7] - Width, erosion, smoothing (NOT routing)
  'Surface Roughness',       // VAR[8] - Normal variation texture
  'Visual Style'             // VAR[9] - Tone / saturation / contrast
];

// ============================================
// DEFAULT PARAMETERS
// ============================================

export const DEFAULT_PARAMS: WorldParams = {
  seed: 12345,
  vars: [50, 50, 50, 50, 50, 50, 50, 50, 50, 50]
};

// ============================================
// WORLD A LAYOUT SOURCE - Shared Macro Geography
// 
// KEY DIFFERENCES FROM SOLO MODE:
// - Continental elevation, major rivers, mountain ranges, coastlines 
//   are derived from WORLD-SPACE coordinates (worldGX, worldGY)
// - Player VARs only control LOCAL EXPRESSION (steepness, texture, etc.)
// - All players in the same grid cell see identical macro features
// ============================================

export const WORLD_A_LAYOUT_SOURCE = `
function setup() {
  colorMode("RGB");
  noStroke();
  background(0, 0, 0, 0);

  // ============================================
  // WORLD A CONTEXT - Injected by host
  // WORLD_X, WORLD_Y = grid position (0-9)
  // LAND_SIZE = 64 (pixels per land)
  // WORLD_SIZE = 10 (lands per axis)
  // ============================================
  
  var GRID_SIZE = 64;
  var LAND_SIZE = 64;
  var WORLD_SIZE = 10;
  
  // World coordinates (injected by host as WORLD_X, WORLD_Y)
  var worldX = typeof WORLD_X !== 'undefined' ? WORLD_X : 0;
  var worldY = typeof WORLD_Y !== 'undefined' ? WORLD_Y : 0;
  
  // Seed-derived offsets for local variation
  var seedOffsetA = random(0, 1000);
  var seedOffsetB = random(0, 1000);
  var seedOffsetC = random(0, 1000);
  var seedOffsetD = random(0, 1000);
  
  // ============================================
  // EXPRESSION-ONLY VAR MAPPINGS
  // These affect intensity/texture, NEVER topology
  // ============================================
  
  var landmarkType = floor(map(VAR[0], 0, 100, 0, 5));
  var landmarkXBias = map(VAR[1], 0, 100, -8, 8);
  var landmarkYBias = map(VAR[2], 0, 100, -8, 8);
  var terrainDetail = map(VAR[3], 0, 100, 0.02, 0.15);
  var biomeRichness = map(VAR[4], 0, 100, 0.3, 1.0);
  var forestDensity = map(VAR[5], 0, 100, 0.15, 0.85);
  var mountainSteepness = map(VAR[6], 0, 100, 0.3, 1.5);
  var pathWear = map(VAR[7], 0, 100, 0.5, 2.0);
  var surfaceRoughness = map(VAR[8], 0, 100, 0.02, 0.12);
  var visualStyle = map(VAR[9], 0, 100, 0.7, 1.3);
  
  // Landmark position with micro-offset
  var objX = floor(GRID_SIZE / 2 + landmarkXBias);
  var objY = floor(GRID_SIZE / 2 + landmarkYBias);
  objX = constrain(objX, 4, GRID_SIZE - 4);
  objY = constrain(objY, 4, GRID_SIZE - 4);
  
  var BASE_FLOOR = 0.25;
  
  // ============================================
  // MACRO GEOGRAPHY - FIXED FOR ALL PLAYERS
  // Computed from WORLD-SPACE coordinates
  // ============================================
  
  // Pre-compute macro masks for this land
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
      // Creates central landmass with coastal fringes
      var continentNoise1 = noise(normWX * 2.5 + 500, normWY * 2.5 + 500);
      var continentNoise2 = noise(normWX * 5 + 1000, normWY * 5 + 1000);
      var distFromCenter = sqrt(pow(normWX - 0.5, 2) + pow(normWY - 0.5, 2)) * 1.8;
      var continentBase = continentNoise1 * 0.6 + continentNoise2 * 0.3 - distFromCenter * 0.5;
      continentMask[py][px] = constrain(continentBase + 0.35, 0, 1);
      
      // MOUNTAIN REGION MASK - Low frequency, creates ranges
      // Fixed positions independent of player
      var mtn1 = noise(normWX * 3 + 2000, normWY * 3 + 2000);
      var mtn2 = noise(normWX * 6 + 3000, normWY * 6 + 3000);
      var mtnBase = mtn1 * 0.65 + mtn2 * 0.35;
      
      // Mountains avoid edges and cluster in ridges
      var edgeDist = min(normWX, normWY, 1 - normWX, 1 - normWY);
      var edgeFalloff = constrain(edgeDist * 5, 0, 1);
      
      if (mtnBase > 0.55 && continentMask[py][px] > 0.4) {
        mountainRegionMask[py][px] = pow((mtnBase - 0.55) / 0.45, 0.6) * edgeFalloff;
      } else {
        mountainRegionMask[py][px] = 0;
      }
      
      // RIVER FLOW MASK - Creates major drainage basins
      var river1 = noise(normWX * 4 + 4000, normWY * 4 + 4000);
      var river2 = noise(normWX * 8 + 5000, normWY * 8 + 5000);
      var riverBase = river1 * 0.5 + river2 * 0.5;
      riverFlowMask[py][px] = abs(riverBase - 0.5) < 0.025 ? 1 : 0;
      
      // CLIMATE GRADIENT - North/south temperature/moisture
      climateGradient[py][px] = normWY;
      
      // MAJOR PATH NETWORK - Fixed trade routes
      var path1 = noise(normWX * 3 + 6000, normWY * 3 + 6000);
      var path2 = noise(normWX * 6 + 7000, normWY * 6 + 7000);
      var pathBase = path1 * 0.6 + path2 * 0.4;
      majorPathMask[py][px] = abs(pathBase - 0.5) < 0.03 ? 1 : 0;
    }
  }
  
  // ============================================
  // PATH GENERATION - Fixed routes + local wear
  // ============================================
  var pathGrid = [];
  for (var py = 0; py < GRID_SIZE; py++) {
    pathGrid[py] = [];
    for (var px = 0; px < GRID_SIZE; px++) {
      // Start with major path network (fixed)
      pathGrid[py][px] = majorPathMask[py][px] * pathWear;
    }
  }
  
  // Add local path details based on wear VAR
  var numLocalPaths = floor(1 + pathWear * 1.5);
  for (var p = 0; p < numLocalPaths; p++) {
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
    
    var targetX = GRID_SIZE * 0.5 + (noise(p * 333 + seedOffsetC) - 0.5) * GRID_SIZE * 0.4;
    var targetY = GRID_SIZE * 0.5 + (noise(p * 444 + seedOffsetD) - 0.5) * GRID_SIZE * 0.4;
    var prevAngle = 0;
    
    for (var step = 0; step < GRID_SIZE * 2; step++) {
      if (cx < 0 || cx >= GRID_SIZE || cy < 0 || cy >= GRID_SIZE) break;
      
      var gxp = floor(cx);
      var gyp = floor(cy);
      if (gxp >= 0 && gxp < GRID_SIZE && gyp >= 0 && gyp < GRID_SIZE) {
        pathGrid[gyp][gxp] = max(pathGrid[gyp][gxp], 0.7 * pathWear);
      }
      
      var flowScale = 0.04 + pathWear * 0.02;
      var n1 = noise(cx * flowScale + seedOffsetA, cy * flowScale);
      var flowAngle = n1 * TWO_PI * 2;
      var toTarget = atan2(targetY - cy, targetX - cx);
      var angle = flowAngle * 0.3 + toTarget * 0.7;
      angle = prevAngle * 0.5 + angle * 0.5;
      prevAngle = angle;
      
      cx = cx + cos(angle) * 0.6;
      cy = cy + sin(angle) * 0.6;
    }
  }
  
  // ============================================
  // MAIN TERRAIN LOOP
  // ============================================
  for (var gy = 0; gy < GRID_SIZE; gy++) {
    for (var gx = 0; gx < GRID_SIZE; gx++) {
      
      // Get macro masks for this position
      var continent = continentMask[gy][gx];
      var mtnRegion = mountainRegionMask[gy][gx];
      var riverFlow = riverFlowMask[gy][gx];
      var climate = climateGradient[gy][gx];
      
      // Base elevation from continental mask (FIXED)
      var baseElevation = BASE_FLOOR + continent * 0.15;
      
      // Add local terrain detail (VAR-controlled)
      var localDetail = noise(gx * terrainDetail + seedOffsetA, gy * terrainDetail);
      var microDetail = noise(gx * surfaceRoughness * 5 + seedOffsetC, gy * surfaceRoughness * 5);
      baseElevation = baseElevation + localDetail * 0.05 + microDetail * surfaceRoughness * 0.3;
      
      // Mountain elevation from region mask (FIXED position, VAR-controlled steepness)
      var mountainNoise = noise(gx * 0.08 + seedOffsetB, gy * 0.08 + seedOffsetC);
      var mountainDetail = noise(gx * 0.18 + seedOffsetD, gy * 0.18 + seedOffsetA);
      var mountainShape = mountainNoise * 0.6 + mountainDetail * 0.4;
      var peakFactor = pow(mtnRegion, 0.5) * pow(mountainShape, 0.4);
      var mountainElevation = peakFactor * mountainSteepness * 0.5;
      
      var shaped = baseElevation + mountainElevation;
      shaped = constrain(shaped, 0, 1);
      
      // Water level from continent mask (FIXED - sea is where continent is low)
      var waterThreshold = 0.32;
      var isWater = continent < 0.25 || shaped < waterThreshold;
      
      // River from macro mask (FIXED)
      var isRiver = riverFlow > 0.5 && !isWater && shaped < waterThreshold + 0.18;
      
      var displayElevation = shaped;
      if (!isWater && shaped < waterThreshold + 0.03) {
        displayElevation = waterThreshold + 0.03;
      }
      
      // Moisture from climate gradient + local variation
      var moistBase = noise(gx * 0.05 + seedOffsetC, gy * 0.05 + seedOffsetD);
      var moisture = moistBase * 0.4 + (1 - climate) * 0.3 + biomeRichness * 0.3;
      if (isWater) moisture = 1.0;
      moisture = constrain(moisture, 0, 1);
      
      // Forest from moisture + fixed mask
      var forestNoise = noise(gx * 0.07 + seedOffsetB, gy * 0.07 + seedOffsetC);
      var isForest = forestNoise < forestDensity && !isWater && mtnRegion < 0.35 && moisture > 0.25;
      
      // Mountain and snow detection
      var isMountain = mtnRegion > 0.15 && !isWater;
      var isSnowCap = mtnRegion > 0.45 && mountainShape > 0.5 && mountainSteepness > 0.6;
      
      // Paths
      var onPath = pathGrid[gy][gx] > 0.3;
      var isBridge = onPath && isWater;
      var isPathTile = onPath && !isWater;
      
      var isObject = gx === objX && gy === objY;
      
      // ====== ELEVATION OUTPUT ======
      var elevation = floor(displayElevation * 255);
      
      // ====== TILE TYPE PRIORITY (RGB) ======
      var tileR = 0;
      var tileG = 0;
      var tileB = 0;
      
      // Apply visual style adjustment
      var styleR = visualStyle;
      var styleG = visualStyle;
      var styleB = visualStyle;
      
      if (isObject) {
        tileR = 255;
        tileG = 220;
        tileB = 60;
      } else if (isBridge) {
        tileR = floor(120 * styleR);
        tileG = floor(80 * styleG);
        tileB = floor(50 * styleB);
      } else if (isPathTile) {
        tileR = floor(180 * styleR);
        tileG = floor(150 * styleG);
        tileB = floor(100 * styleB);
      } else if (isRiver) {
        tileR = 70;
        tileG = 160;
        tileB = 180;
      } else if (isWater) {
        var depthFactor = continent / 0.25;
        tileR = floor((20 + depthFactor * 15) * styleB);
        tileG = floor((60 + depthFactor * 25) * styleB);
        tileB = floor((120 + depthFactor * 25));
      } else if (isSnowCap) {
        tileR = floor(240 * styleR);
        tileG = floor(245 * styleG);
        tileB = 250;
      } else if (isMountain) {
        var mBlend = constrain(mtnRegion, 0, 1);
        tileR = floor((100 + mBlend * 50) * styleR);
        tileG = floor((95 + mBlend * 50) * styleG);
        tileB = floor((90 + mBlend * 60) * styleB);
      } else if (isForest) {
        var fMoist = moisture * biomeRichness * 0.4;
        tileR = floor((45 + fMoist * 30) * styleR);
        tileG = floor((100 + moisture * 40) * styleG);
        tileB = floor((40 + fMoist * 25) * styleB);
      } else {
        var gMoist = moisture * biomeRichness * 0.3;
        tileR = floor((145 + displayElevation * 20 - gMoist * 20) * styleR);
        tileG = floor((125 + displayElevation * 15 + gMoist * 15) * styleG);
        tileB = floor((85 + gMoist * 20) * styleB);
      }
      
      tileR = constrain(tileR, 0, 255);
      tileG = constrain(tileG, 0, 255);
      tileB = constrain(tileB, 0, 255);
      
      fill(tileR, tileG, tileB, elevation);
      rect(gx, gy, 1, 1);
    }
  }
}
`;
