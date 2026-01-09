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
  
  var GRID_SIZE = 64;
  
  // VAR mappings:
  // VAR[3] = Continent Scale (terrain frequency)
  // VAR[4] = Water Level (0=very low, 50=normal, 100=very high)
  // VAR[5] = Forest Density
  // VAR[6] = Mountain Height (peak elevation from base floor)
  // VAR[7] = Path Density
  // VAR[8] = Terrain Roughness
  // VAR[9] = Mountain Density (number of mountain patches)
  
  var continentScale = map(VAR[3], 0, 100, 0.025, 0.08);
  var waterLevel = map(VAR[4], 0, 100, 0.15, 0.65);
  var forestDensity = map(VAR[5], 0, 100, 0.15, 0.80);
  var mountainPeakHeight = map(VAR[6], 0, 100, 0.15, 0.70);
  var pathDensityVal = map(VAR[7], 0, 100, 0.0, 1.0);
  var terrainRoughness = map(VAR[8], 0, 100, 0.25, 0.80);
  var mountainDensity = map(VAR[9], 0, 100, 0.05, 0.50);
  
  var objX = floor(map(VAR[1], 0, 100, 4, GRID_SIZE - 4));
  var objY = floor(map(VAR[2], 0, 100, 4, GRID_SIZE - 4));
  
  // Fixed base floor level - never changes
  var BASE_FLOOR = 0.30;
  
  // Path generation grid
  var pathGrid = [];
  for (var py = 0; py < GRID_SIZE; py++) {
    pathGrid[py] = [];
    for (var px = 0; px < GRID_SIZE; px++) {
      pathGrid[py][px] = 0;
    }
  }
  
  // Path generation - minimum 2 paths always
  var numPaths = floor(2 + pathDensityVal * 6);
  var flowScale = 0.04 + pathDensityVal * 0.04;
  
  for (var p = 0; p < numPaths; p++) {
    var startEdge = floor(noise(p * 111 + 500) * 4);
    var edgePos = noise(p * 222 + 600) * 0.6 + 0.2;
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
    var targetX = GRID_SIZE * 0.5 + (noise(p * 333) - 0.5) * GRID_SIZE * 0.5;
    var targetY = GRID_SIZE * 0.5 + (noise(p * 444) - 0.5) * GRID_SIZE * 0.5;
    
    for (var step = 0; step < GRID_SIZE * 2.5; step++) {
      if (cx < 0 || cx >= GRID_SIZE || cy < 0 || cy >= GRID_SIZE) {
        break;
      }
      
      var gxp = floor(cx);
      var gyp = floor(cy);
      if (gxp >= 0 && gxp < GRID_SIZE && gyp >= 0 && gyp < GRID_SIZE) {
        pathGrid[gyp][gxp] = 1;
        if (gxp > 0) pathGrid[gyp][gxp - 1] = max(pathGrid[gyp][gxp - 1], 0.5);
        if (gxp < GRID_SIZE - 1) pathGrid[gyp][gxp + 1] = max(pathGrid[gyp][gxp + 1], 0.5);
        if (gyp > 0) pathGrid[gyp - 1][gxp] = max(pathGrid[gyp - 1][gxp], 0.5);
        if (gyp < GRID_SIZE - 1) pathGrid[gyp + 1][gxp] = max(pathGrid[gyp + 1][gxp], 0.5);
      }
      
      var n1 = noise(cx * flowScale, cy * flowScale);
      var n2 = noise(cx * flowScale * 2.5 + 100, cy * flowScale * 2.5);
      var n3 = noise(cx * flowScale * 0.4 + 200, cy * flowScale * 0.4);
      var flowAngle = (n1 * 0.45 + n2 * 0.35 + n3 * 0.20) * TWO_PI * 2.5;
      
      var toTarget = atan2(targetY - cy, targetX - cx);
      var blend = 0.35 + pathDensityVal * 0.15;
      var angle = flowAngle * blend + toTarget * (1 - blend);
      angle = prevAngle * 0.55 + angle * 0.45;
      prevAngle = angle;
      
      var stepLen = 0.6 + noise(cx * 0.15, cy * 0.15) * 0.25;
      cx = cx + cos(angle) * stepLen;
      cy = cy + sin(angle) * stepLen;
      
      // Branching paths
      if (pathDensityVal > 0.30 && step > 10 && step % 12 === 0) {
        if (noise(cx * 0.5 + p * 50, cy * 0.5) < 0.25) {
          var bx = cx;
          var by = cy;
          var bAngle = angle + (noise(bx, by) > 0.5 ? PI * 0.35 : -PI * 0.35);
          var bPrev = bAngle;
          
          for (var bs = 0; bs < 12 + floor(noise(bx + p, by) * 15); bs++) {
            var bgx = floor(bx);
            var bgy = floor(by);
            if (bgx >= 0 && bgx < GRID_SIZE && bgy >= 0 && bgy < GRID_SIZE) {
              pathGrid[bgy][bgx] = max(pathGrid[bgy][bgx], 0.8);
            }
            
            var bn1 = noise(bx * flowScale * 1.8, by * flowScale * 1.8 + 300);
            var bn2 = noise(bx * flowScale * 3.5 + 400, by * flowScale * 3.5);
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
  
  // Generate mountain mask - discrete patches with natural shapes
  var mountainMask = [];
  for (var my = 0; my < GRID_SIZE; my++) {
    mountainMask[my] = [];
    for (var mx = 0; mx < GRID_SIZE; mx++) {
      mountainMask[my][mx] = 0;
    }
  }
  
  // Create mountain patches based on density
  var numMountainPatches = floor(2 + mountainDensity * 12);
  for (var mp = 0; mp < numMountainPatches; mp++) {
    var patchX = noise(mp * 137 + 9000) * GRID_SIZE;
    var patchY = noise(mp * 251 + 9500) * GRID_SIZE;
    var patchRadius = 4 + noise(mp * 373 + 9800) * 10;
    var patchStrength = 0.5 + noise(mp * 491 + 9200) * 0.5;
    
    for (var mpy = 0; mpy < GRID_SIZE; mpy++) {
      for (var mpx = 0; mpx < GRID_SIZE; mpx++) {
        var dx = mpx - patchX;
        var dy = mpy - patchY;
        var dist = sqrt(dx * dx + dy * dy);
        if (dist < patchRadius) {
          var falloff = 1.0 - (dist / patchRadius);
          falloff = pow(falloff, 1.5);
          mountainMask[mpy][mpx] = max(mountainMask[mpy][mpx], falloff * patchStrength);
        }
      }
    }
  }
  
  for (var gy = 0; gy < GRID_SIZE; gy++) {
    for (var gx = 0; gx < GRID_SIZE; gx++) {
      
      // Base terrain - consistent floor with gentle variation
      var continental = noise(gx * continentScale, gy * continentScale);
      var hills = noise(gx * continentScale * 2.5 + 500, gy * continentScale * 2.5);
      var detail = noise(gx * continentScale * 5.0 + 1000, gy * continentScale * 5.0);
      
      // Floor elevation with gentle hills (never goes below BASE_FLOOR)
      var floorVariation = hills * terrainRoughness * 0.08 + detail * terrainRoughness * 0.04;
      var baseElevation = BASE_FLOOR + continental * 0.15 + floorVariation;
      
      // Mountain elevation - added ON TOP of floor
      var mMask = mountainMask[gy][gx];
      var mountainNoise = noise(gx * 0.12 + 8000, gy * 0.12);
      var mountainDetail = noise(gx * 0.25 + 8500, gy * 0.25);
      var mountainShape = mountainNoise * 0.7 + mountainDetail * 0.3;
      
      // Natural mountain profile - steep near peak, gradual at base
      var peakFactor = pow(mMask, 0.7) * pow(mountainShape, 0.5);
      var mountainElevation = peakFactor * mountainPeakHeight;
      
      // Combined elevation
      var shaped = baseElevation + mountainElevation;
      shaped = constrain(shaped, 0, 1);
      
      // Water check - water level is absolute
      var isWater = shaped < waterLevel;
      
      // Moisture for forests
      var moistBase = noise(gx * 0.06 + 3000, gy * 0.06);
      var moistDetail = noise(gx * 0.14 + 3500, gy * 0.14);
      var moisture = moistBase * 0.60 + moistDetail * 0.40;
      if (isWater) {
        moisture = 1.0;
      } else if (shaped < waterLevel + 0.10) {
        moisture = moisture + (1 - (shaped - waterLevel) / 0.10) * 0.25;
      }
      moisture = constrain(moisture, 0, 1);
      
      // Forest detection
      var forestNoise = noise(gx * 0.09 + 7000, gy * 0.09);
      var forestNoise2 = noise(gx * 0.18 + 7500, gy * 0.18);
      var forestVal = forestNoise * 0.6 + forestNoise2 * 0.4;
      var isForest = forestVal < forestDensity && !isWater && mMask < 0.3 && moisture > 0.25;
      
      // Mountain tile detection - where mountain mask is strong
      var isMountain = mMask > 0.25 && !isWater;
      var isSnowCap = mMask > 0.6 && mountainPeakHeight > 0.45 && mountainShape > 0.5;
      
      // Path and bridge
      var onPath = pathGrid[gy][gx] > 0.4;
      var isBridge = onPath && isWater;
      var isPathTile = onPath && !isWater;
      
      var isObject = gx === objX && gy === objY;
      
      // Rivers
      var riverN = noise(gx * 0.045 + 5000, gy * 0.045);
      var isRiver = abs(riverN - 0.5) < 0.015 && !isWater && shaped < waterLevel + 0.15 && !onPath;
      
      // Alpha = elevation (0-255)
      var elevation = floor(shaped * 255);
      
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
        // Snow-capped peaks
        tileR = 240;
        tileG = 245;
        tileB = 250;
      } else if (isMountain) {
        // Rocky mountain gradient
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
        tileR = floor(145 + shaped * 20 - gMoist * 20);
        tileG = floor(125 + shaped * 15 + gMoist * 15);
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
      var elevation = 0;
      elevation += noise(x * terrainScale, y * terrainScale) * 1.0;
      elevation += noise(x * terrainScale * 2, y * terrainScale * 2) * 0.5 * roughness;
      elevation += noise(x * terrainScale * 4, y * terrainScale * 4) * 0.25 * roughness;
      elevation = elevation / (1.0 + 0.5 * roughness + 0.25 * roughness);
      
      terrain[y][x] = {
        elevation: elevation,
        isWater: elevation < waterLevel,
        isForest: elevation >= waterLevel && noise(x * 0.1 + 100, y * 0.1) < forestDensity * elevation,
        isMountain: elevation > (1 - waterLevel) * mountainMult * 0.4 + 0.4
      };
    }
  }
  
  for (var y = 0; y < GRID_SIZE; y++) {
    for (var x = 0; x < GRID_SIZE; x++) {
      var tile = terrain[y][x];
      var isoX = (x - y) * TILE_WIDTH / 2 + offsetX;
      var isoY = (x + y) * TILE_HEIGHT / 2 + offsetY;
      var heightOffset = tile.isWater ? 0 : tile.elevation * 20 * mountainMult;
      
      var tileHue, tileSat, tileBright;
      
      if (tile.isWater) {
        tileHue = 200 + hueShift;
        tileSat = 70;
        tileBright = 35 + tile.elevation * 20;
      } else if (tile.isMountain) {
        tileHue = 220 + hueShift;
        tileSat = 10;
        tileBright = 40 + tile.elevation * 30;
      } else if (tile.isForest) {
        tileHue = 120 + hueShift;
        tileSat = 50;
        tileBright = 25 + tile.elevation * 25;
      } else {
        tileHue = 30 + hueShift;
        tileSat = 40;
        tileBright = 25 + tile.elevation * 30;
      }
      
      fill(tileHue, tileSat, tileBright);
      drawIsometricTile(isoX, isoY - heightOffset);
      
      if (heightOffset > 2 && !tile.isWater) {
        fill(tileHue, tileSat, tileBright * 0.7);
        drawIsometricSideLeft(isoX, isoY - heightOffset, heightOffset);
        fill(tileHue, tileSat, tileBright * 0.5);
        drawIsometricSideRight(isoX, isoY - heightOffset, heightOffset);
      }
      
      var landmarkNoise = noise(x * 0.2 + 200, y * 0.2 + 200);
      if (!tile.isWater && landmarkNoise < landmarkDensity && !tile.isMountain) {
        drawLandmark(isoX, isoY - heightOffset - 4, floor(landmarkNoise * 100) % 3, hueShift);
      }
      
      if (x === objectX && y === objectY && !tile.isWater) {
        drawUserObject(isoX, isoY - heightOffset - 6, objectType, hueShift);
      }
    }
  }
  
  stroke(180, 100, 95);
  strokeWeight(0.3);
  for (var i = 0; i <= GRID_SIZE; i++) {
    var startX = (0 - i) * TILE_WIDTH / 2 + offsetX;
    var startY = (0 + i) * TILE_HEIGHT / 2 + offsetY;
    var endX = (GRID_SIZE - i) * TILE_WIDTH / 2 + offsetX;
    var endY = (GRID_SIZE + i) * TILE_HEIGHT / 2 + offsetY;
    line(startX, startY, endX, endY);
    
    var startX2 = (i - 0) * TILE_WIDTH / 2 + offsetX;
    var startY2 = (i + 0) * TILE_HEIGHT / 2 + offsetY;
    var endX2 = (i - GRID_SIZE) * TILE_WIDTH / 2 + offsetX;
    var endY2 = (i + GRID_SIZE) * TILE_HEIGHT / 2 + offsetY;
    line(startX2, startY2, endX2, endY2);
  }
  noStroke();
  
  fill(0, 0, 10);
  rect(8, 8, 145, 26, 2);
  
  fill(170, 80, 70);
  textSize(10);
  textFont('monospace');
  text('SEED', 14, 26);
  
  fill(85, 70, 60);
  text('DETERMINISTIC', 80, 26);
}

function drawIsometricTile(x, y) {
  beginShape();
  vertex(x, y);
  vertex(x + TILE_WIDTH / 2, y + TILE_HEIGHT / 2);
  vertex(x, y + TILE_HEIGHT);
  vertex(x - TILE_WIDTH / 2, y + TILE_HEIGHT / 2);
  endShape(CLOSE);
}

function drawIsometricSideLeft(x, y, h) {
  beginShape();
  vertex(x - TILE_WIDTH / 2, y + TILE_HEIGHT / 2);
  vertex(x, y + TILE_HEIGHT);
  vertex(x, y + TILE_HEIGHT + h);
  vertex(x - TILE_WIDTH / 2, y + TILE_HEIGHT / 2 + h);
  endShape(CLOSE);
}

function drawIsometricSideRight(x, y, h) {
  beginShape();
  vertex(x + TILE_WIDTH / 2, y + TILE_HEIGHT / 2);
  vertex(x, y + TILE_HEIGHT);
  vertex(x, y + TILE_HEIGHT + h);
  vertex(x + TILE_WIDTH / 2, y + TILE_HEIGHT / 2 + h);
  endShape(CLOSE);
}

function drawLandmark(x, y, type, hueShift) {
  push();
  translate(x, y);
  
  if (type === 0) {
    fill(120 + hueShift, 60, 25);
    triangle(0, -12, -4, 0, 4, 0);
    fill(30 + hueShift, 50, 30);
    rect(-1, 0, 2, 4);
  } else if (type === 1) {
    fill(0, 0, 50);
    ellipse(0, 0, 6, 4);
    fill(0, 0, 60);
    ellipse(-1, -1, 4, 3);
  } else {
    fill(100 + hueShift, 50, 35);
    ellipse(0, 0, 8, 5);
    fill(110 + hueShift, 55, 40);
    ellipse(-2, -1, 5, 4);
  }
  
  pop();
}

function drawUserObject(x, y, type, hueShift) {
  push();
  translate(x, y);
  
  fill(170, 80, 50, 0.3);
  ellipse(0, 4, 20, 10);
  
  if (type === 0) {
    fill(50 + hueShift, 60, 70);
    rect(-4, -16, 8, 20);
    fill(50 + hueShift, 70, 80);
    triangle(0, -24, -6, -16, 6, -16);
    fill(50, 90, 90);
    rect(-2, -12, 4, 4);
  } else if (type === 1) {
    fill(280, 70, 70);
    beginShape();
    vertex(0, -20);
    vertex(-5, -5);
    vertex(-3, 4);
    vertex(3, 4);
    vertex(5, -5);
    endShape(CLOSE);
    fill(280, 60, 85);
    triangle(0, -20, -3, -5, 2, -8);
  } else if (type === 2) {
    fill(40, 30, 60);
    rect(-6, -12, 12, 16);
    fill(40, 25, 70);
    rect(-8, -14, 16, 4);
    rect(-8, 2, 16, 4);
    fill(170, 80, 50);
    ellipse(0, -4, 6, 6);
  } else if (type === 3) {
    fill(30, 40, 40);
    rect(-1, -24, 2, 28);
    fill(0, 80, 60);
    beginShape();
    vertex(1, -24);
    vertex(12, -20);
    vertex(12, -12);
    vertex(1, -16);
    endShape(CLOSE);
  } else {
    fill(60, 20, 50);
    rect(-5, -8, 10, 12);
    fill(170, 90, 80);
    ellipse(0, -12, 8, 8);
    stroke(170, 80, 70);
    strokeWeight(1);
    for (var i = 0; i < 8; i++) {
      var angle = (i / 8) * TWO_PI;
      line(
        cos(angle) * 6, -12 + sin(angle) * 6,
        cos(angle) * 12, -12 + sin(angle) * 12
      );
    }
    noStroke();
  }
  
  pop();
}
`;

export interface WorldParams {
  seed: number;
  vars: number[];
}

export const DEFAULT_PARAMS: WorldParams = {
  seed: 42,
  vars: [50, 50, 50, 50, 30, 40, 50, 50, 50, 20]
};

export const VAR_LABELS = [
  'Object Type',
  'Object X',
  'Object Y',
  'Terrain Scale',
  'Water Level',
  'Forest Density',
  'Mountain Height',
  'Path Density',
  'Roughness',
  'Mountain Density'
];
