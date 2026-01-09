// Deterministic World Generator Source Code for NexArt
// This code uses NexArt's random() and noise() - never Math.random()

export const WORLD_SOURCE = `
// Deterministic World Generator
// Uses only NexArt-provided random() and noise() functions
// Canvas is pre-initialized by NexArt SDK - do NOT call createCanvas()

const GRID_SIZE = 32;
const TILE_WIDTH = 16;
const TILE_HEIGHT = 8;

// Variable mappings:
// VAR[0] -> object type (0-100 maps to 5 types)
// VAR[1] -> object X position (0-100 maps to grid)
// VAR[2] -> object Y position (0-100 maps to grid)
// VAR[3] -> terrain noise scale
// VAR[4] -> water level threshold
// VAR[5] -> forest density
// VAR[6] -> mountain height multiplier
// VAR[7] -> color hue shift
// VAR[8] -> terrain roughness
// VAR[9] -> landmark density

function setup() {
  colorMode(HSB, 360, 100, 100, 1);
  noStroke();
  
  // Background
  background(220, 20, 6);
  
  // Get variables with defaults
  var terrainScale = map(VAR[3], 0, 100, 0.02, 0.15);
  var waterLevel = map(VAR[4], 0, 100, 0.2, 0.6);
  var forestDensity = map(VAR[5], 0, 100, 0.1, 0.8);
  var mountainMult = map(VAR[6], 0, 100, 0.5, 2.0);
  var hueShift = map(VAR[7], 0, 100, -30, 30);
  var roughness = map(VAR[8], 0, 100, 0.5, 2.0);
  var landmarkDensity = map(VAR[9], 0, 100, 0.01, 0.15);
  
  // Object placement
  var objectType = floor(map(VAR[0], 0, 100, 0, 5));
  var objectX = floor(map(VAR[1], 0, 100, 2, GRID_SIZE - 2));
  var objectY = floor(map(VAR[2], 0, 100, 2, GRID_SIZE - 2));
  
  // Center offset for isometric view
  var offsetX = width / 2;
  var offsetY = 80;
  
  // Generate terrain data
  var terrain = [];
  
  for (var y = 0; y < GRID_SIZE; y++) {
    terrain[y] = [];
    for (var x = 0; x < GRID_SIZE; x++) {
      // Multi-octave noise for terrain
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
  
  // Draw tiles from back to front (isometric order)
  for (var y = 0; y < GRID_SIZE; y++) {
    for (var x = 0; x < GRID_SIZE; x++) {
      var tile = terrain[y][x];
      
      // Isometric coordinates
      var isoX = (x - y) * TILE_WIDTH / 2 + offsetX;
      var isoY = (x + y) * TILE_HEIGHT / 2 + offsetY;
      
      // Height offset based on elevation
      var heightOffset = tile.isWater ? 0 : tile.elevation * 20 * mountainMult;
      
      // Determine tile color
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
      
      // Draw tile top
      fill(tileHue, tileSat, tileBright);
      drawIsometricTile(isoX, isoY - heightOffset);
      
      // Draw tile sides if elevated
      if (heightOffset > 2 && !tile.isWater) {
        fill(tileHue, tileSat, tileBright * 0.7);
        drawIsometricSideLeft(isoX, isoY - heightOffset, heightOffset);
        fill(tileHue, tileSat, tileBright * 0.5);
        drawIsometricSideRight(isoX, isoY - heightOffset, heightOffset);
      }
      
      // Draw landmarks based on noise
      var landmarkNoise = noise(x * 0.2 + 200, y * 0.2 + 200);
      if (!tile.isWater && landmarkNoise < landmarkDensity && !tile.isMountain) {
        drawLandmark(isoX, isoY - heightOffset - 4, floor(landmarkNoise * 100) % 3, hueShift);
      }
      
      // Draw user-placed object
      if (x === objectX && y === objectY && !tile.isWater) {
        drawUserObject(isoX, isoY - heightOffset - 6, objectType, hueShift);
      }
    }
  }
  
  // Draw grid overlay (subtle)
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
  
  // Draw info overlay
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
    // Tree
    fill(120 + hueShift, 60, 25);
    triangle(0, -12, -4, 0, 4, 0);
    fill(30 + hueShift, 50, 30);
    rect(-1, 0, 2, 4);
  } else if (type === 1) {
    // Rock
    fill(0, 0, 50);
    ellipse(0, 0, 6, 4);
    fill(0, 0, 60);
    ellipse(-1, -1, 4, 3);
  } else {
    // Bush
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
  
  // Glow effect
  fill(170, 80, 50, 0.3);
  ellipse(0, 4, 20, 10);
  
  if (type === 0) {
    // Tower
    fill(50 + hueShift, 60, 70);
    rect(-4, -16, 8, 20);
    fill(50 + hueShift, 70, 80);
    triangle(0, -24, -6, -16, 6, -16);
    fill(50, 90, 90);
    rect(-2, -12, 4, 4);
  } else if (type === 1) {
    // Crystal
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
    // Monument
    fill(40, 30, 60);
    rect(-6, -12, 12, 16);
    fill(40, 25, 70);
    rect(-8, -14, 16, 4);
    rect(-8, 2, 16, 4);
    fill(170, 80, 50);
    ellipse(0, -4, 6, 6);
  } else if (type === 3) {
    // Flag
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
    // Beacon
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
