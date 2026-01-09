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
// NexArt Canonical World Layout Generator
// Outputs a 64x64 RGBA-encoded grid
// Red: elevation | Green: moisture | Blue: biome | Alpha: features

function setup() {
  colorMode("RGB");
  noStroke();
  background(0);
  
  var GRID_SIZE = 64;
  
  // Map VAR parameters to generation controls
  var terrainScale = map(VAR[3], 0, 100, 0.02, 0.08);
  var waterLevel = map(VAR[4], 0, 100, 0.25, 0.55);
  var forestDensity = map(VAR[5], 0, 100, 0.2, 0.9);
  // Reduced mountain height for more natural feel (0.2-0.5 instead of 0.6-1.0)
  var mountainHeight = map(VAR[6], 0, 100, 0.2, 0.5);
  var pathDensity = map(VAR[7], 0, 100, 0.0, 1.0);
  var roughness = map(VAR[8], 0, 100, 0.3, 0.9);
  // Increased landmark density range for more visible landmarks
  var landmarkDensity = map(VAR[9], 0, 100, 0.05, 0.35);
  
  // Object position from VAR
  var objX = floor(map(VAR[1], 0, 100, 4, GRID_SIZE - 4));
  var objY = floor(map(VAR[2], 0, 100, 4, GRID_SIZE - 4));
  
  // ========================================
  // PATH NETWORK (Flow-based simulation)
  // ========================================
  var pathPoints = [];
  var numPaths = 2 + floor(pathDensity * 4);
  var pathWidth = 1.2;
  
  for (var p = 0; p < numPaths; p++) {
    var points = [];
    var isHorizontal = noise(p * 100) > 0.4;
    var px = isHorizontal ? 0 : floor(noise(p * 200) * (GRID_SIZE - 10)) + 5;
    var py = isHorizontal ? floor(noise(p * 300) * (GRID_SIZE - 10)) + 5 : 0;
    var baseAngle = isHorizontal ? 0 : PI / 2;
    var angle = baseAngle + (noise(p * 400) - 0.5) * 0.4;
    var curviness = 0.5 + noise(p * 500) * 0.6;
    
    for (var s = 0; s < GRID_SIZE + 20; s++) {
      points.push({x: px, y: py});
      
      // Multi-layer flow noise for organic paths
      var flowNoise = noise(px * 0.05, py * 0.05);
      var waveNoise = noise(px * 0.1, py * 0.1 + 100);
      var microNoise = noise(px * 0.2, py * 0.2 + 200);
      var combined = flowNoise * 0.5 + waveNoise * 0.35 + microNoise * 0.15;
      var angleOffset = (combined - 0.5) * curviness * 1.5;
      
      var targetAngle = baseAngle + angleOffset;
      angle = angle * 0.75 + targetAngle * 0.25;
      
      px += cos(angle) * 0.7;
      py += sin(angle) * 0.7;
      
      // Branch creation
      if (pathDensity > 0.3 && s > 5 && s < GRID_SIZE && noise(px * 0.3, py * 0.3 + p) < 0.04) {
        var branchPts = [];
        var bx = px;
        var by = py;
        var bAngle = angle + (noise(bx, by) > 0.5 ? 0.6 : -0.6);
        
        for (var b = 0; b < 12 + floor(noise(bx, by + 100) * 18); b++) {
          branchPts.push({x: bx, y: by});
          var bn = noise(bx * 0.08, by * 0.08 + 300);
          bAngle = bAngle * 0.82 + (bAngle + (bn - 0.5) * 0.7) * 0.18;
          bx += cos(bAngle) * 0.65;
          by += sin(bAngle) * 0.65;
          if (bx < 0 || bx >= GRID_SIZE || by < 0 || by >= GRID_SIZE) break;
        }
        if (branchPts.length > 4) pathPoints.push(branchPts);
      }
      
      if (px < -2 || px >= GRID_SIZE + 2 || py < -2 || py >= GRID_SIZE + 2) break;
    }
    pathPoints.push(points);
  }
  
  // Check if point is on a path
  function isOnPath(x, y) {
    for (var i = 0; i < pathPoints.length; i++) {
      var pts = pathPoints[i];
      for (var j = 0; j < pts.length; j++) {
        var dx = x - pts[j].x;
        var dy = y - pts[j].y;
        if (sqrt(dx*dx + dy*dy) < pathWidth) return true;
      }
    }
    return false;
  }
  
  // ========================================
  // GENERATE EACH PIXEL (RGBA encoded)
  // ========================================
  for (var y = 0; y < GRID_SIZE; y++) {
    for (var x = 0; x < GRID_SIZE; x++) {
      
      // ---- RED CHANNEL: ELEVATION ----
      // Multi-octave Perlin noise with ridged component for mountains
      var baseElev = 0;
      baseElev += noise(x * terrainScale, y * terrainScale) * 1.0;
      baseElev += noise(x * terrainScale * 2, y * terrainScale * 2) * 0.5 * roughness;
      baseElev += noise(x * terrainScale * 4, y * terrainScale * 4) * 0.25 * roughness;
      baseElev = baseElev / (1.0 + 0.5 * roughness + 0.25 * roughness);
      
      // Ridged noise for mountain formation - smoother transitions
      var ridged = 1.0 - abs(noise(x * terrainScale * 1.5 + 500, y * terrainScale * 1.5) - 0.5) * 2;
      // Smoother mountain factor with less aggressive exponent and more gradual blending
      var mountainFactor = pow(max(0, baseElev - 0.55) * 2, 1.2) * mountainHeight;
      var elevation = baseElev + ridged * mountainFactor * 0.25;
      // Smooth the elevation to avoid cliff edges
      elevation = constrain(elevation, 0, 0.95);
      
      var redChannel = floor(elevation * 255);
      
      // ---- GREEN CHANNEL: MOISTURE/VEGETATION ----
      // Cellular-like noise for biome boundaries
      var moisture = noise(x * 0.06 + 1000, y * 0.06);
      moisture += noise(x * 0.12 + 1000, y * 0.12) * 0.4;
      moisture = moisture / 1.4;
      
      // Higher moisture near water
      var distToWater = max(0, (elevation - waterLevel) / (1 - waterLevel));
      moisture = moisture * (1 - distToWater * 0.3);
      moisture = constrain(moisture, 0, 1);
      
      var greenChannel = floor(moisture * 255);
      
      // ---- BLUE CHANNEL: BIOME/MATERIAL ----
      // 0-50: Water | 51-100: Ground | 101-150: Forest | 151-200: Mountain | 201-230: Path | 231-255: Bridge
      var isWater = elevation < waterLevel;
      var onPath = isOnPath(x, y);
      var isBridge = onPath && isWater;
      var isPath = onPath && !isWater && elevation < 0.7;
      // Lower mountain threshold for more gradual peaks
      var isMountain = elevation > 0.55;
      var isForest = !isWater && !isMountain && !isPath && moisture * forestDensity > 0.3 && noise(x * 0.1 + 2000, y * 0.1) < forestDensity * 0.8;
      
      var blueChannel;
      if (isBridge) {
        blueChannel = 240;
      } else if (isPath) {
        blueChannel = 210;
      } else if (isWater) {
        blueChannel = floor(25 + elevation / waterLevel * 25);
      } else if (isMountain) {
        blueChannel = floor(155 + (elevation - 0.55) / 0.4 * 45);
      } else if (isForest) {
        blueChannel = floor(105 + moisture * 45);
      } else {
        blueChannel = floor(55 + elevation * 45);
      }
      
      // ---- ALPHA CHANNEL: FEATURE MASK ----
      // 255: No feature
      // 250-254: Landmark types (0-4): Ruins, Crystal, Ancient Tree, Stone Circle, Obelisk
      // 245-249: River
      // 240-244: Reserved
      // 1: Planted object marker
      var alphaChannel = 255;
      
      // River detection FIRST (lower priority than landmarks)
      var riverNoise = noise(x * 0.04 + 5000, y * 0.04);
      var isRiver = !isWater && !onPath && abs(riverNoise - 0.5) < 0.03 && elevation < 0.5;
      if (isRiver) {
        alphaChannel = 245 + floor((riverNoise - 0.47) / 0.06 * 4);
      }
      
      // Landmark placement - HIGHER priority, uses cellular-like noise for clustering
      var landmarkNoise = noise(x * 0.08 + 3000, y * 0.08 + 3000);
      var landmarkNoise2 = noise(x * 0.15 + 3500, y * 0.15 + 3500);
      var combinedLandmark = landmarkNoise * 0.6 + landmarkNoise2 * 0.4;
      
      // Place landmarks on valid terrain with better distribution
      if (!isWater && !isMountain && !onPath && !isRiver && combinedLandmark < landmarkDensity) {
        // Use different noise for type to ensure variety
        var typeNoise = noise(x * 0.3 + 4000, y * 0.3 + 4000);
        var landmarkType = floor(typeNoise * 5);
        alphaChannel = 250 + constrain(landmarkType, 0, 4);
      }
      
      // Mark planted object position (highest priority)
      if (x === objX && y === objY) {
        alphaChannel = 1;
      }
      
      // Draw the encoded pixel
      fill(redChannel, greenChannel, blueChannel, alphaChannel);
      rect(x, y, 1, 1);
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
