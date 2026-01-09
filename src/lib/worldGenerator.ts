// NexArt World Generator - Canonical Source
// This sketch defines the ONLY valid world layout
// 3D rendering must derive from this output, never independently

// ============================================
// WORLD LAYOUT SOURCE - Outputs 64x64 encoded grid
// RGBA Channel Encoding:
//   Red   = Elevation (0-255)
//   Green = Moisture/Vegetation (0-255)
//   Blue  = Biome/Material (0-255)
//   Alpha = Feature Mask (path, river, landmark)
// ============================================

export const WORLD_LAYOUT_SOURCE = `
function setup() {
  colorMode("RGB");
  noStroke();
  background(0);
  
  var GRID_SIZE = 64;
  
  var continentScale = map(VAR[3], 0, 100, 0.02, 0.06);
  var waterThreshold = map(VAR[4], 0, 100, 0.25, 0.50);
  var forestDensity = map(VAR[5], 0, 100, 0.15, 0.85);
  var mountainScale = map(VAR[6], 0, 100, 0.6, 1.8);
  var pathDensityVal = map(VAR[7], 0, 100, 0.0, 1.0);
  var terrainRoughness = map(VAR[8], 0, 100, 0.15, 0.55);
  var landmarkDensity = map(VAR[9], 0, 100, 0.02, 0.35);
  
  var objX = floor(map(VAR[1], 0, 100, 4, GRID_SIZE - 4));
  var objY = floor(map(VAR[2], 0, 100, 4, GRID_SIZE - 4));
  
  var pathPoints = [];
  var numPaths = floor(1 + pathDensityVal * 5);
  var pathWidth = 1.2 + pathDensityVal * 0.3;
  
  if (pathDensityVal > 0.05) {
    for (var p = 0; p < numPaths; p++) {
      var points = [];
      var isHoriz = noise(p * 100 + seed * 0.01) > 0.4;
      var px = isHoriz ? 0 : floor(noise(p * 200 + seed * 0.01) * (GRID_SIZE - 10)) + 5;
      var py = isHoriz ? floor(noise(p * 300 + seed * 0.01) * (GRID_SIZE - 10)) + 5 : 0;
      var baseAngle = isHoriz ? 0 : PI / 2;
      var angle = baseAngle + (noise(p * 400 + seed * 0.01) - 0.5) * 0.4;
      var curviness = 0.5 + noise(p * 500 + seed * 0.01) * 0.6;
      
      for (var s = 0; s < GRID_SIZE + 20; s++) {
        points.push({x: px, y: py});
        var flowNoise = noise(px * 0.05, py * 0.05);
        var waveNoise = noise(px * 0.1, py * 0.1 + 100);
        var combined = flowNoise * 0.6 + waveNoise * 0.4;
        var angleOffset = (combined - 0.5) * curviness * 1.5;
        var targetAngle = baseAngle + angleOffset;
        angle = angle * 0.75 + targetAngle * 0.25;
        px = px + cos(angle) * 0.7;
        py = py + sin(angle) * 0.7;
        
        if (pathDensityVal > 0.4 && s > 5 && s < GRID_SIZE && noise(px * 0.3, py * 0.3 + p) < 0.05) {
          var branchPts = [];
          var bx = px;
          var by = py;
          var bAngle = angle + (noise(bx, by) > 0.5 ? 0.6 : -0.6);
          for (var b = 0; b < 12 + floor(noise(bx, by + 100) * 18); b++) {
            branchPts.push({x: bx, y: by});
            var bn = noise(bx * 0.08, by * 0.08 + 300);
            bAngle = bAngle * 0.82 + (bAngle + (bn - 0.5) * 0.7) * 0.18;
            bx = bx + cos(bAngle) * 0.65;
            by = by + sin(bAngle) * 0.65;
            if (bx < 0 || bx >= GRID_SIZE || by < 0 || by >= GRID_SIZE) {
              break;
            }
          }
          if (branchPts.length > 4) {
            pathPoints.push(branchPts);
          }
        }
        
        if (px < -2 || px >= GRID_SIZE + 2 || py < -2 || py >= GRID_SIZE + 2) {
          break;
        }
      }
      pathPoints.push(points);
    }
  }
  
  for (var gy = 0; gy < GRID_SIZE; gy++) {
    for (var gx = 0; gx < GRID_SIZE; gx++) {
      
      var continental = noise(gx * continentScale, gy * continentScale);
      var hills = noise(gx * continentScale * 2.5 + 500, gy * continentScale * 2.5);
      hills = hills * terrainRoughness;
      var detail = noise(gx * continentScale * 5 + 1000, gy * continentScale * 5);
      detail = detail * terrainRoughness * 0.5;
      var ridgeNoise = noise(gx * continentScale * 3.5 + 2000, gy * continentScale * 3.5);
      var ridged = 1.0 - abs(ridgeNoise - 0.5) * 2;
      ridged = ridged * ridged * mountainScale * 0.3;
      
      var rawElev = continental * 0.5 + hills * 0.25 + detail * 0.15 + ridged * 0.1;
      rawElev = rawElev * (0.7 + mountainScale * 0.3);
      rawElev = constrain(rawElev, 0, 1);
      var redChannel = floor(rawElev * 255);
      
      var baseMoisture = noise(gx * 0.055 + 3000, gy * 0.055);
      var moistDetail = noise(gx * 0.12 + 3500, gy * 0.12);
      var moisture = baseMoisture * 0.65 + moistDetail * 0.35;
      var elevInfluence = max(0, rawElev - waterThreshold) / max(0.01, 1 - waterThreshold);
      moisture = moisture * (1 - elevInfluence * 0.35);
      if (rawElev < waterThreshold + 0.1) {
        var waterProx = 1 - (rawElev / (waterThreshold + 0.1));
        moisture = moisture + waterProx * 0.2;
      }
      moisture = constrain(moisture, 0, 1);
      
      var forestChance = noise(gx * 0.08 + 7000, gy * 0.08);
      var hasForest = forestChance < forestDensity && rawElev > waterThreshold && rawElev < 0.7 && moisture > 0.3;
      if (hasForest) {
        moisture = moisture * 0.7 + 0.3;
      }
      var greenChannel = floor(moisture * 255);
      
      var isUnderwater = rawElev < waterThreshold;
      var biomeVal = 0;
      if (isUnderwater) {
        var waterDepth = rawElev / max(0.01, waterThreshold);
        biomeVal = floor(waterDepth * 60);
      } else if (hasForest) {
        biomeVal = floor(100 + moisture * 50);
      } else if (rawElev > 0.7) {
        var peakBlend = (rawElev - 0.7) / 0.3;
        biomeVal = floor(180 + peakBlend * 75);
      } else {
        var landElev = (rawElev - waterThreshold) / max(0.01, 0.7 - waterThreshold);
        biomeVal = floor(61 + landElev * 80 + (1 - moisture) * 40);
      }
      var blueChannel = constrain(biomeVal, 0, 255);
      
      var alphaChannel = 255;
      
      var minPathDist = 9999.0;
      for (var pi = 0; pi < pathPoints.length; pi++) {
        var pts = pathPoints[pi];
        for (var pj = 0; pj < pts.length; pj++) {
          var pdx = gx - pts[pj].x;
          var pdy = gy - pts[pj].y;
          var pd = sqrt(pdx * pdx + pdy * pdy);
          if (pd < minPathDist) {
            minPathDist = pd;
          }
        }
      }
      
      var onPath = minPathDist < pathWidth;
      
      if (onPath) {
        if (isUnderwater) {
          var bridgeGrad = floor((1 - minPathDist / pathWidth) * 9);
          alphaChannel = 220 + constrain(bridgeGrad, 0, 9);
        } else {
          var pathGrad = floor((1 - minPathDist / pathWidth) * 9);
          alphaChannel = 230 + constrain(pathGrad, 0, 9);
        }
      }
      
      var riverNoise = noise(gx * 0.04 + 5000, gy * 0.04);
      var isRiverSpot = abs(riverNoise - 0.5) < 0.02;
      var validRiverElev = rawElev > waterThreshold && rawElev < waterThreshold + 0.2;
      
      if (!onPath && isRiverSpot && validRiverElev) {
        var riverInt = 1 - abs(riverNoise - 0.5) / 0.02;
        alphaChannel = 245 + floor(riverInt * 4);
      }
      
      var lmNoise = noise(gx * 0.1 + 4000, gy * 0.1 + 4000);
      var lmNoise2 = noise(gx * 0.2 + 4500, gy * 0.2 + 4500);
      var combinedLm = lmNoise * 0.5 + lmNoise2 * 0.5;
      
      var validLmTerrain = !isUnderwater && rawElev < 0.8 && !onPath && alphaChannel === 255;
      if (validLmTerrain && combinedLm < landmarkDensity) {
        var typeNoise = noise(gx * 0.25 + 6000, gy * 0.25 + 6000);
        var lmType = floor(typeNoise * 5);
        alphaChannel = 250 + constrain(lmType, 0, 4);
      }
      
      if (gx === objX && gy === objY) {
        alphaChannel = 1;
      }
      
      fill(redChannel, greenChannel, blueChannel, alphaChannel);
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
  text('SEED: ' + seed, 14, 26);
  
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
  'Landmarks'
];
