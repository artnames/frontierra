// NexArt World Generator - Canonical Source
// This sketch defines the ONLY valid world layout
// 3D rendering must derive from this output, never independently

// ============================================
// WORLD LAYOUT SOURCE - Outputs 64x64 encoded grid
// Each pixel encodes: tile type (RGB) + landmark (Alpha)
// ============================================

export const WORLD_LAYOUT_SOURCE = `
// NexArt Canonical World Layout Generator
// Outputs a 64x64 grid where each pixel represents a tile
// RGB encodes tile type, Alpha encodes landmark presence

// Tile type colors (must match nexartWorld.ts classification):
// Water:    RGB ~(0, 50, 200)  - Blue
// Ground:   RGB ~(180, 140, 100) - Tan
// Forest:   RGB ~(60, 140, 60)  - Green  
// Mountain: RGB ~(140, 140, 160) - Gray
// Path:     RGB ~(200, 180, 140) - Light brown
// Bridge:   RGB ~(100, 70, 40)  - Dark brown

const GRID_SIZE = 64;

// Color definitions
const WATER_COLOR = [0, 50, 200];
const GROUND_COLOR = [180, 140, 100];
const FOREST_COLOR = [60, 140, 60];
const MOUNTAIN_COLOR = [140, 140, 160];
const PATH_COLOR = [200, 180, 140];
const BRIDGE_COLOR = [100, 70, 40];

function setup() {
  colorMode(255, 255, 255, 255);
  noStroke();
  background(0);
  
  // Map VAR parameters
  var terrainScale = map(VAR[3], 0, 100, 0.02, 0.1);
  var waterLevel = map(VAR[4], 0, 100, 0.2, 0.55);
  var forestDensity = map(VAR[5], 0, 100, 0.1, 0.8);
  var heightMult = map(VAR[6], 0, 100, 0.5, 2.0);
  var pathDensity = map(VAR[7], 0, 100, 0.0, 1.0);
  var roughness = map(VAR[8], 0, 100, 0.3, 0.9);
  var landmarkDensity = map(VAR[9], 0, 100, 0.02, 0.2);
  
  // Object position from VAR
  var objX = floor(map(VAR[1], 0, 100, 4, GRID_SIZE - 4));
  var objY = floor(map(VAR[2], 0, 100, 4, GRID_SIZE - 4));
  
  // Generate path network using flow simulation
  var pathPoints = [];
  var numPaths = 2 + floor(pathDensity * 4);
  var pathWidth = 0.7;
  
  for (var p = 0; p < numPaths; p++) {
    var points = [];
    var isHorizontal = random() > 0.4;
    var px = isHorizontal ? 0 : floor(random() * (GRID_SIZE - 10)) + 5;
    var py = isHorizontal ? floor(random() * (GRID_SIZE - 10)) + 5 : 0;
    var baseAngle = isHorizontal ? 0 : PI / 2;
    var angle = baseAngle + (random() - 0.5) * 0.4;
    var curviness = 0.6 + random() * 0.6;
    
    for (var s = 0; s < GRID_SIZE + 20; s++) {
      points.push({x: px, y: py});
      
      var n1 = noise(px * 0.06, py * 0.06);
      var n2 = noise(px * 0.1, py * 0.1 + 100);
      var combined = n1 * 0.6 + n2 * 0.4;
      var angleOffset = (combined - 0.5) * curviness * 1.2;
      
      var targetAngle = baseAngle + angleOffset;
      angle = angle * 0.7 + targetAngle * 0.3;
      
      px += cos(angle) * 0.8;
      py += sin(angle) * 0.8;
      
      // Branching
      if (pathDensity > 0.3 && s > 5 && s < GRID_SIZE && random() < 0.04) {
        var branchPts = [];
        var bx = px;
        var by = py;
        var bAngle = angle + (random() > 0.5 ? 0.5 : -0.5);
        
        for (var b = 0; b < 15 + floor(random() * 20); b++) {
          branchPts.push({x: bx, y: by});
          var bn = noise(bx * 0.08, by * 0.08 + 200);
          bAngle = bAngle * 0.8 + (bAngle + (bn - 0.5) * 0.8) * 0.2;
          bx += cos(bAngle) * 0.7;
          by += sin(bAngle) * 0.7;
          if (bx < 0 || bx >= GRID_SIZE || by < 0 || by >= GRID_SIZE) break;
        }
        if (branchPts.length > 5) pathPoints.push(branchPts);
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
  
  // Generate each tile
  for (var y = 0; y < GRID_SIZE; y++) {
    for (var x = 0; x < GRID_SIZE; x++) {
      // Multi-octave noise for elevation
      var elev = 0;
      elev += noise(x * terrainScale, y * terrainScale) * 1.0;
      elev += noise(x * terrainScale * 2, y * terrainScale * 2) * 0.5 * roughness;
      elev += noise(x * terrainScale * 4, y * terrainScale * 4) * 0.25 * roughness;
      elev = elev / (1.0 + 0.5 * roughness + 0.25 * roughness);
      
      var isWater = elev < waterLevel;
      var onPath = isOnPath(x, y);
      var isBridge = onPath && isWater;
      var isPath = onPath && !isWater && elev < 0.65;
      
      // Determine tile type
      var tileColor;
      if (isBridge) {
        tileColor = BRIDGE_COLOR;
      } else if (isPath) {
        tileColor = PATH_COLOR;
      } else if (isWater) {
        tileColor = WATER_COLOR;
      } else if (elev > 0.65) {
        tileColor = MOUNTAIN_COLOR;
      } else {
        var forestNoise = noise(x * 0.1 + 100, y * 0.1);
        if (forestNoise < forestDensity * elev) {
          tileColor = FOREST_COLOR;
        } else {
          tileColor = GROUND_COLOR;
        }
      }
      
      // Brightness variation based on elevation
      var brightness = 0.7 + elev * 0.3;
      var r = floor(tileColor[0] * brightness);
      var g = floor(tileColor[1] * brightness);
      var b = floor(tileColor[2] * brightness);
      
      // Landmark encoding in alpha (< 255 means landmark)
      var alpha = 255;
      var landmarkNoise = noise(x * 0.15 + 200, y * 0.15 + 200);
      if (!isWater && elev < 0.65 && !onPath && landmarkNoise < landmarkDensity) {
        alpha = 200 + floor(landmarkNoise * 50); // 200-249 encodes landmark type
      }
      
      // Draw pixel
      fill(r, g, b, alpha);
      rect(x, y, 1, 1);
    }
  }
  
  // Mark planted object position with special color (magenta)
  fill(255, 0, 255, 255);
  rect(objX, objY, 1, 1);
}
`;

// ============================================
// ISOMETRIC PREVIEW SOURCE - Visual only
// ============================================

export const WORLD_SOURCE = `
// Isometric Preview (visual representation only)
// The canonical layout comes from WORLD_LAYOUT_SOURCE

const GRID_SIZE = 32;
const TILE_WIDTH = 16;
const TILE_HEIGHT = 8;

function setup() {
  colorMode(360, 100, 100, 1);
  noStroke();
  background(220, 20, 6);
  
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
