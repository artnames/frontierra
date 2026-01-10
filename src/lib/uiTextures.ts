// UI Textures - High-Impact Procedural Material Generation
// Uses @nexart/ui-renderer for deterministic, identity-driven textures
// CRITICAL: All inputs must be deterministic. No Math.random(), no Date.

import { createSystem, previewSystem } from '@nexart/ui-renderer';
import { 
  MaterialKind, 
  MaterialContext, 
  TextureSet,
  TEXTURE_SIZE,
  MATERIAL_PALETTES,
  computeTextureHash,
  getCachedTexture,
  setCachedTexture
} from './materialRegistry';

// Convert hex color to RGB components
function hexToRGB(hex: string): { r: number; g: number; b: number } {
  const h = hex.replace('#', '');
  return {
    r: parseInt(h.substring(0, 2), 16),
    g: parseInt(h.substring(2, 4), 16),
    b: parseInt(h.substring(4, 6), 16)
  };
}

// ============================================================================
// HIGH-IMPACT MATERIAL SKETCHES
// Each material has a DISTINCT visual identity with strong mid-frequency structure
// ============================================================================

function generateGroundSketch(ctx: MaterialContext): string {
  const palette = MATERIAL_PALETTES.ground;
  const base = hexToRGB(palette.base);
  const dark = hexToRGB(palette.dark);
  const light = hexToRGB(palette.light);
  const offsetX = Math.abs((ctx.worldX * 127 + ctx.seed) % 1000);
  const offsetY = Math.abs((ctx.worldY * 131 + ctx.seed) % 1000);

  // GROUND: Sediment layers with erosion streaks and geological bands
  return `
    function setup() {
      noStroke();
      var baseR = ${base.r}; var baseG = ${base.g}; var baseB = ${base.b};
      var darkR = ${dark.r}; var darkG = ${dark.g}; var darkB = ${dark.b};
      var lightR = ${light.r}; var lightG = ${light.g}; var lightB = ${light.b};
      var offX = ${offsetX}; var offY = ${offsetY};
      
      // Base fill
      background(baseR, baseG, baseB);
      
      // SEDIMENT BANDS - horizontal geological strata
      for (var band = 0; band < 12; band = band + 1) {
        var bandY = band * (height / 12);
        var bandHeight = height / 12 + noise(band * 0.5 + offX * 0.01, 0) * 15;
        var bandShift = (noise(band * 0.3, offY * 0.01) - 0.5) * 40;
        
        // Alternate between lighter and darker strata
        if (band % 2 == 0) {
          fill(darkR - 15 + bandShift, darkG - 10 + bandShift, darkB - 5 + bandShift, 120);
        } else {
          fill(lightR + bandShift, lightG + bandShift, lightB + bandShift, 80);
        }
        rect(0, bandY, width, bandHeight);
      }
      
      // EROSION CHANNELS - diagonal flow patterns
      stroke(darkR - 30, darkG - 25, darkB - 20, 100);
      strokeWeight(2);
      for (var ch = 0; ch < 8; ch = ch + 1) {
        var startX = noise(ch * 7 + offX, 0) * width;
        var startY = 0;
        var px = startX;
        var py = startY;
        for (var step = 0; step < 20; step = step + 1) {
          var angle = PI * 0.4 + noise(px * 0.02 + offX * 0.01, py * 0.02 + offY * 0.01) * PI * 0.3;
          var nx = px + cos(angle) * 15;
          var ny = py + sin(angle) * 15;
          line(px, py, nx, ny);
          px = nx;
          py = ny;
          if (py > height) break;
        }
      }
      noStroke();
      
      // SOIL CLUMPS - chunky irregular patches
      for (var i = 0; i < 40; i = i + 1) {
        var cx = noise(i * 13 + offX, 0) * width;
        var cy = noise(0, i * 13 + offY) * height;
        var clumpSize = 8 + noise(i * 3, i * 3) * 20;
        fill(darkR - 20, darkG - 15, darkB - 10, 100);
        
        // Irregular blob shape
        beginShape();
        for (var a = 0; a < TWO_PI; a = a + 0.5) {
          var r = clumpSize * (0.6 + noise(i + a, offX * 0.01) * 0.8);
          vertex(cx + cos(a) * r, cy + sin(a) * r);
        }
        endShape(CLOSE);
      }
      
      // PEBBLE SCATTER
      for (var p = 0; p < 60; p = p + 1) {
        var px = noise(p * 11 + offX, 100) * width;
        var py = noise(100, p * 11 + offY) * height;
        var psize = 3 + noise(p, p) * 6;
        fill(darkR - 25, darkG - 20, darkB - 15, 150);
        ellipse(px, py, psize, psize * 0.7);
      }
    }
  `;
}

function generateForestSketch(ctx: MaterialContext): string {
  const palette = MATERIAL_PALETTES.forest;
  const base = hexToRGB(palette.base);
  const dark = hexToRGB(palette.dark);
  const light = hexToRGB(palette.light);
  const offsetX = Math.abs((ctx.worldX * 127 + ctx.seed) % 1000);
  const offsetY = Math.abs((ctx.worldY * 131 + ctx.seed) % 1000);

  // FOREST: Flow-field canopy with layered organic filaments and leaf mass
  return `
    function setup() {
      var baseR = ${base.r}; var baseG = ${base.g}; var baseB = ${base.b};
      var darkR = ${dark.r}; var darkG = ${dark.g}; var darkB = ${dark.b};
      var lightR = ${light.r}; var lightG = ${light.g}; var lightB = ${light.b};
      var offX = ${offsetX}; var offY = ${offsetY};
      
      // Deep shadow base
      background(darkR - 10, darkG - 5, darkB - 10);
      
      // CANOPY MASS LAYER - large organic blobs of foliage
      noStroke();
      for (var blob = 0; blob < 15; blob = blob + 1) {
        var bx = noise(blob * 17 + offX, 0) * width;
        var by = noise(0, blob * 17 + offY) * height;
        var bsize = 40 + noise(blob * 3, blob * 3) * 80;
        
        // Gradient from center to edge
        for (var ring = 0; ring < 5; ring = ring + 1) {
          var ringSize = bsize * (1 - ring * 0.18);
          var greenShift = ring * 8;
          fill(baseR + greenShift, baseG + 15 + greenShift, baseB + greenShift, 60);
          ellipse(bx, by, ringSize, ringSize * 0.85);
        }
      }
      
      // FLOW-FIELD FILAMENTS - vein-like organic streams
      stroke(lightR, lightG + 30, lightB, 80);
      strokeWeight(1);
      for (var f = 0; f < 200; f = f + 1) {
        var fx = noise(f * 7 + offX, 500) * width;
        var fy = noise(500, f * 7 + offY) * height;
        var px = fx;
        var py = fy;
        
        for (var step = 0; step < 12; step = step + 1) {
          var flowAngle = noise(px * 0.015 + offX * 0.005, py * 0.015 + offY * 0.005) * TWO_PI * 2;
          var nx = px + cos(flowAngle) * 6;
          var ny = py + sin(flowAngle) * 6;
          line(px, py, nx, ny);
          px = nx;
          py = ny;
        }
      }
      
      // SECONDARY DARKER VEINS
      stroke(darkR, darkG + 10, darkB, 60);
      for (var v = 0; v < 80; v = v + 1) {
        var vx = noise(v * 11 + offX, 800) * width;
        var vy = noise(800, v * 11 + offY) * height;
        var px = vx;
        var py = vy;
        
        for (var step = 0; step < 8; step = step + 1) {
          var flowAngle = noise(px * 0.02, py * 0.02) * TWO_PI * 1.5 + PI;
          var nx = px + cos(flowAngle) * 8;
          var ny = py + sin(flowAngle) * 8;
          line(px, py, nx, ny);
          px = nx;
          py = ny;
        }
      }
      noStroke();
      
      // LEAF HIGHLIGHTS - scattered bright spots
      for (var leaf = 0; leaf < 100; leaf = leaf + 1) {
        var lx = noise(leaf * 5 + offX, 200) * width;
        var ly = noise(200, leaf * 5 + offY) * height;
        var lsize = 2 + noise(leaf, leaf) * 5;
        fill(lightR + 20, lightG + 40, lightB + 20, 120);
        ellipse(lx, ly, lsize, lsize);
      }
      
      // DAPPLED LIGHT PATCHES
      for (var d = 0; d < 25; d = d + 1) {
        var dx = noise(d * 19 + offX, 300) * width;
        var dy = noise(300, d * 19 + offY) * height;
        var dsize = 15 + noise(d * 2, d * 2) * 25;
        fill(lightR + 30, lightG + 50, lightB + 30, 40);
        ellipse(dx, dy, dsize, dsize * 0.8);
      }
    }
  `;
}

function generateMountainSketch(ctx: MaterialContext): string {
  const palette = MATERIAL_PALETTES.mountain;
  const base = hexToRGB(palette.base);
  const dark = hexToRGB(palette.dark);
  const light = hexToRGB(palette.light);
  const offsetX = Math.abs((ctx.worldX * 127 + ctx.seed) % 1000);
  const offsetY = Math.abs((ctx.worldY * 131 + ctx.seed) % 1000);

  // MOUNTAIN: Fractured rock strata with bold diagonal ridges
  return `
    function setup() {
      var baseR = ${base.r}; var baseG = ${base.g}; var baseB = ${base.b};
      var darkR = ${dark.r}; var darkG = ${dark.g}; var darkB = ${dark.b};
      var lightR = ${light.r}; var lightG = ${light.g}; var lightB = ${light.b};
      var offX = ${offsetX}; var offY = ${offsetY};
      
      background(baseR, baseG, baseB);
      
      // BOLD DIAGONAL STRATA - major geological layers
      noStroke();
      var strataAngle = PI * 0.15 + noise(offX * 0.01, offY * 0.01) * PI * 0.1;
      for (var layer = 0; layer < 20; layer = layer + 1) {
        var layerOffset = layer * 15 - 50;
        var layerWidth = 10 + noise(layer * 0.5, 0) * 15;
        
        // Alternating light/dark bands
        if (layer % 3 == 0) {
          fill(lightR + 15, lightG + 15, lightB + 15, 150);
        } else if (layer % 3 == 1) {
          fill(darkR - 20, darkG - 20, darkB - 20, 130);
        } else {
          fill(baseR - 10, baseG - 10, baseB - 10, 100);
        }
        
        // Draw diagonal band
        push();
        translate(width / 2, height / 2);
        rotate(strataAngle);
        rect(-width, layerOffset, width * 2, layerWidth);
        pop();
      }
      
      // FRACTURE LINES - sharp cracks in rock
      stroke(darkR - 40, darkG - 40, darkB - 40, 180);
      strokeWeight(2);
      for (var crack = 0; crack < 12; crack = crack + 1) {
        var cx = noise(crack * 23 + offX, 0) * width;
        var cy = noise(0, crack * 23 + offY) * height;
        var clen = 30 + noise(crack * 5, crack * 5) * 60;
        var cang = noise(crack * 7, 100) * PI - PI * 0.5;
        
        // Jagged crack path
        var px = cx;
        var py = cy;
        for (var seg = 0; seg < 6; seg = seg + 1) {
          var segLen = clen / 6;
          var segAng = cang + (noise(crack + seg, seg) - 0.5) * PI * 0.4;
          var nx = px + cos(segAng) * segLen;
          var ny = py + sin(segAng) * segLen;
          line(px, py, nx, ny);
          px = nx;
          py = ny;
        }
      }
      
      // SECONDARY HAIRLINE CRACKS
      strokeWeight(1);
      stroke(darkR - 30, darkG - 30, darkB - 30, 100);
      for (var hc = 0; hc < 30; hc = hc + 1) {
        var hx = noise(hc * 11 + offX, 200) * width;
        var hy = noise(200, hc * 11 + offY) * height;
        var hlen = 10 + noise(hc, hc) * 25;
        var hang = noise(hc * 3, 50) * PI;
        line(hx, hy, hx + cos(hang) * hlen, hy + sin(hang) * hlen);
      }
      noStroke();
      
      // ROCK DEBRIS / LOOSE STONES
      for (var stone = 0; stone < 50; stone = stone + 1) {
        var sx = noise(stone * 9 + offX, 400) * width;
        var sy = noise(400, stone * 9 + offY) * height;
        var ssize = 4 + noise(stone * 2, stone * 2) * 10;
        var sshade = (noise(stone, 0) - 0.5) * 40;
        fill(baseR + sshade, baseG + sshade, baseB + sshade, 180);
        
        // Angular stone shape
        beginShape();
        for (var a = 0; a < TWO_PI; a = a + PI / 3) {
          var r = ssize * (0.7 + noise(stone + a, 0) * 0.6);
          vertex(sx + cos(a) * r, sy + sin(a) * r);
        }
        endShape(CLOSE);
      }
    }
  `;
}

function generateSnowSketch(ctx: MaterialContext): string {
  const palette = MATERIAL_PALETTES.snow;
  const base = hexToRGB(palette.base);
  const dark = hexToRGB(palette.dark);
  const offsetX = Math.abs((ctx.worldX * 127 + ctx.seed) % 1000);
  const offsetY = Math.abs((ctx.worldY * 131 + ctx.seed) % 1000);

  // SNOW: Wind-scoured surface with drift patterns and ice highlights
  return `
    function setup() {
      var baseR = ${base.r}; var baseG = ${base.g}; var baseB = ${base.b};
      var darkR = ${dark.r}; var darkG = ${dark.g}; var darkB = ${dark.b};
      var offX = ${offsetX}; var offY = ${offsetY};
      
      background(baseR, baseG, baseB);
      
      // WIND-SCOURED DRIFT LINES - parallel curved streaks
      noFill();
      stroke(darkR - 10, darkG - 10, darkB, 80);
      strokeWeight(2);
      for (var drift = 0; drift < 40; drift = drift + 1) {
        var dy = drift * (height / 40) + noise(drift * 0.3, offX * 0.01) * 20 - 10;
        beginShape();
        for (var x = 0; x < width; x = x + 10) {
          var waveY = dy + sin(x * 0.02 + noise(drift, 0) * 5) * 8 + noise(x * 0.01 + offX * 0.01, drift * 0.1) * 15;
          vertex(x, waveY);
        }
        endShape();
      }
      
      // DEEPER SHADOW DRIFTS
      stroke(darkR - 30, darkG - 25, darkB - 10, 60);
      strokeWeight(3);
      for (var sd = 0; sd < 15; sd = sd + 1) {
        var sdy = noise(sd * 7 + offX, 0) * height;
        beginShape();
        for (var x = 0; x < width; x = x + 15) {
          var waveY = sdy + sin(x * 0.015 + noise(sd, 100) * 10) * 12;
          vertex(x, waveY);
        }
        endShape();
      }
      noStroke();
      
      // ICE CRYSTAL HIGHLIGHTS - bright sparkle points
      for (var ice = 0; ice < 80; ice = ice + 1) {
        var ix = noise(ice * 13 + offX, 500) * width;
        var iy = noise(500, ice * 13 + offY) * height;
        var isize = 1 + noise(ice, ice) * 3;
        fill(255, 255, 255, 200 + noise(ice * 2, 0) * 55);
        ellipse(ix, iy, isize, isize);
      }
      
      // SUBTLE BLUE SHADOWS in depressions
      for (var sh = 0; sh < 20; sh = sh + 1) {
        var shx = noise(sh * 19 + offX, 700) * width;
        var shy = noise(700, sh * 19 + offY) * height;
        var shsize = 20 + noise(sh * 4, sh * 4) * 40;
        fill(darkR - 20, darkG - 15, darkB + 10, 35);
        ellipse(shx, shy, shsize, shsize * 0.5);
      }
      
      // FROST TEXTURE OVERLAY
      for (var fy = 0; fy < height; fy = fy + 4) {
        for (var fx = 0; fx < width; fx = fx + 4) {
          var fn = noise((fx + offX) * 0.03, (fy + offY) * 0.03);
          if (fn > 0.6) {
            fill(255, 255, 255, 40);
            rect(fx, fy, 3, 3);
          }
        }
      }
    }
  `;
}

function generateWaterSketch(ctx: MaterialContext): string {
  const palette = MATERIAL_PALETTES.water;
  const base = hexToRGB(palette.base);
  const dark = hexToRGB(palette.dark);
  const light = hexToRGB(palette.light);
  const offsetX = Math.abs((ctx.worldX * 127 + ctx.seed) % 1000);
  const offsetY = Math.abs((ctx.worldY * 131 + ctx.seed) % 1000);

  // WATER: Directional flow lines with depth gradient and caustic highlights
  return `
    function setup() {
      var baseR = ${base.r}; var baseG = ${base.g}; var baseB = ${base.b};
      var darkR = ${dark.r}; var darkG = ${dark.g}; var darkB = ${dark.b};
      var lightR = ${light.r}; var lightG = ${light.g}; var lightB = ${light.b};
      var offX = ${offsetX}; var offY = ${offsetY};
      
      // DEPTH GRADIENT - darker at edges
      for (var gy = 0; gy < height; gy = gy + 1) {
        var depthFactor = 1 - abs(gy - height / 2) / (height / 2) * 0.3;
        var r = baseR * depthFactor;
        var g = baseG * depthFactor;
        var b = baseB * depthFactor;
        stroke(r, g, b);
        line(0, gy, width, gy);
      }
      noStroke();
      
      // HORIZONTAL FLOW LINES - strong directional current
      stroke(lightR, lightG + 20, lightB + 30, 100);
      strokeWeight(1);
      for (var flow = 0; flow < 60; flow = flow + 1) {
        var fy = flow * (height / 60) + noise(flow * 0.5, offX * 0.01) * 15;
        var flen = 30 + noise(flow * 0.3, 0) * 50;
        var fx = noise(flow * 3 + offX, 0) * width;
        
        // Wavy flow line
        beginShape();
        for (var x = 0; x < flen; x = x + 5) {
          var wy = fy + sin(x * 0.1 + noise(flow, 0) * 5) * 3;
          vertex(fx + x, wy);
        }
        endShape();
      }
      
      // SECONDARY FLOW (perpendicular hints)
      stroke(lightR - 10, lightG + 10, lightB + 20, 50);
      for (var sf = 0; sf < 25; sf = sf + 1) {
        var sfx = noise(sf * 11 + offX, 200) * width;
        var sfy = noise(200, sf * 11 + offY) * height;
        var sflen = 15 + noise(sf, sf) * 20;
        line(sfx, sfy, sfx + sflen, sfy + noise(sf * 2, 0) * 10 - 5);
      }
      noStroke();
      
      // CAUSTIC LIGHT PATTERNS - bright refracted spots
      for (var c = 0; c < 80; c = c + 1) {
        var cx = noise(c * 7 + offX, 400) * width;
        var cy = noise(400, c * 7 + offY) * height;
        var csize = 5 + noise(c * 2, c * 2) * 15;
        
        // Irregular caustic shape
        fill(lightR + 40, lightG + 50, lightB + 60, 60);
        beginShape();
        for (var a = 0; a < TWO_PI; a = a + 0.7) {
          var r = csize * (0.5 + noise(c + a * 0.5, 0) * 1);
          vertex(cx + cos(a) * r, cy + sin(a) * r);
        }
        endShape(CLOSE);
      }
      
      // DEEP SPOTS
      for (var deep = 0; deep < 15; deep = deep + 1) {
        var dx = noise(deep * 17 + offX, 600) * width;
        var dy = noise(600, deep * 17 + offY) * height;
        var dsize = 25 + noise(deep * 3, deep * 3) * 35;
        fill(darkR - 20, darkG - 15, darkB - 10, 50);
        ellipse(dx, dy, dsize, dsize * 0.6);
      }
    }
  `;
}

function generatePathSketch(ctx: MaterialContext): string {
  const palette = MATERIAL_PALETTES.path;
  const base = hexToRGB(palette.base);
  const dark = hexToRGB(palette.dark);
  const light = hexToRGB(palette.light);
  const offsetX = Math.abs((ctx.worldX * 127 + ctx.seed) % 1000);
  const offsetY = Math.abs((ctx.worldY * 131 + ctx.seed) % 1000);

  // PATH: Worn compacted surface with directional abrasion and wheel ruts
  return `
    function setup() {
      var baseR = ${base.r}; var baseG = ${base.g}; var baseB = ${base.b};
      var darkR = ${dark.r}; var darkG = ${dark.g}; var darkB = ${dark.b};
      var lightR = ${light.r}; var lightG = ${light.g}; var lightB = ${light.b};
      var offX = ${offsetX}; var offY = ${offsetY};
      
      background(baseR, baseG, baseB);
      
      // CENTER WEAR ZONE - lighter compacted center
      noStroke();
      for (var wy = 0; wy < height; wy = wy + 1) {
        var wearWidth = width * 0.6 + noise(wy * 0.02 + offY * 0.01, 0) * width * 0.2;
        var wearX = (width - wearWidth) / 2;
        var wearIntensity = 1 - abs(wy - height / 2) / (height / 2) * 0.3;
        fill(lightR, lightG, lightB, 50 * wearIntensity);
        rect(wearX, wy, wearWidth, 1);
      }
      
      // WHEEL RUTS - parallel darker grooves
      stroke(darkR - 20, darkG - 15, darkB - 10, 120);
      strokeWeight(3);
      var rutOffset = width * 0.15;
      for (var ry = 0; ry < height; ry = ry + 2) {
        var wobble1 = noise(ry * 0.02 + offY * 0.01, offX * 0.01) * 8 - 4;
        var wobble2 = noise(ry * 0.02 + offY * 0.01, offX * 0.01 + 100) * 8 - 4;
        point(width / 2 - rutOffset + wobble1, ry);
        point(width / 2 + rutOffset + wobble2, ry);
      }
      
      // DIRECTIONAL ABRASION LINES
      strokeWeight(1);
      stroke(darkR - 10, darkG - 5, darkB, 80);
      for (var ab = 0; ab < 100; ab = ab + 1) {
        var ax = noise(ab * 9 + offX, 0) * width;
        var ay = noise(0, ab * 9 + offY) * height;
        var alen = 10 + noise(ab, ab) * 30;
        // Mostly vertical (direction of travel)
        var aang = PI * 0.5 + (noise(ab * 2, 50) - 0.5) * PI * 0.3;
        line(ax, ay, ax + cos(aang) * alen, ay + sin(aang) * alen);
      }
      noStroke();
      
      // EMBEDDED STONES
      for (var stone = 0; stone < 35; stone = stone + 1) {
        var sx = noise(stone * 11 + offX, 300) * width;
        var sy = noise(300, stone * 11 + offY) * height;
        var ssize = 4 + noise(stone * 2, stone * 2) * 8;
        fill(darkR - 15, darkG - 10, darkB - 5, 150);
        ellipse(sx, sy, ssize, ssize * 0.7);
      }
      
      // EDGE DEBRIS - rougher at path edges
      for (var ed = 0; ed < 50; ed = ed + 1) {
        var ex = noise(ed * 7 + offX, 500);
        // Bias towards edges
        if (ex > 0.3 && ex < 0.7) continue;
        ex = ex * width;
        var ey = noise(500, ed * 7 + offY) * height;
        var esize = 3 + noise(ed, ed) * 6;
        fill(darkR, darkG, darkB, 100);
        rect(ex, ey, esize, esize * 0.8);
      }
    }
  `;
}

function generateRockSketch(ctx: MaterialContext): string {
  const palette = MATERIAL_PALETTES.rock;
  const base = hexToRGB(palette.base);
  const dark = hexToRGB(palette.dark);
  const light = hexToRGB(palette.light);
  const offsetX = Math.abs((ctx.worldX * 127 + ctx.seed) % 1000);
  const offsetY = Math.abs((ctx.worldY * 131 + ctx.seed) % 1000);

  // ROCK: Broken plate texture with sharp edges and mineral veins
  return `
    function setup() {
      var baseR = ${base.r}; var baseG = ${base.g}; var baseB = ${base.b};
      var darkR = ${dark.r}; var darkG = ${dark.g}; var darkB = ${dark.b};
      var lightR = ${light.r}; var lightG = ${light.g}; var lightB = ${light.b};
      var offX = ${offsetX}; var offY = ${offsetY};
      
      background(baseR, baseG, baseB);
      
      // PLATE REGIONS - distinct rock slabs with different shades
      noStroke();
      for (var plate = 0; plate < 25; plate = plate + 1) {
        var px = noise(plate * 17 + offX, 0) * width;
        var py = noise(0, plate * 17 + offY) * height;
        var psize = 30 + noise(plate * 3, plate * 3) * 60;
        var pshade = (noise(plate * 5, 100) - 0.5) * 50;
        
        fill(baseR + pshade, baseG + pshade, baseB + pshade, 200);
        
        // Angular polygon plate
        beginShape();
        var sides = 5 + int(noise(plate, 200) * 3);
        for (var s = 0; s < sides; s = s + 1) {
          var ang = s * TWO_PI / sides + noise(plate + s, 0) * 0.5;
          var r = psize * (0.6 + noise(plate + s * 0.5, 50) * 0.8);
          vertex(px + cos(ang) * r, py + sin(ang) * r);
        }
        endShape(CLOSE);
      }
      
      // PLATE EDGES - dark crevices between plates
      stroke(darkR - 40, darkG - 40, darkB - 40, 200);
      strokeWeight(2);
      for (var edge = 0; edge < 40; edge = edge + 1) {
        var ex = noise(edge * 13 + offX, 300) * width;
        var ey = noise(300, edge * 13 + offY) * height;
        var elen = 15 + noise(edge * 2, edge * 2) * 40;
        var eang = noise(edge * 4, 150) * PI;
        
        // Jagged edge
        var px = ex;
        var py = ey;
        for (var seg = 0; seg < 4; seg = seg + 1) {
          var segAng = eang + (noise(edge + seg, seg * 10) - 0.5) * PI * 0.5;
          var nx = px + cos(segAng) * (elen / 4);
          var ny = py + sin(segAng) * (elen / 4);
          line(px, py, nx, ny);
          px = nx;
          py = ny;
        }
      }
      noStroke();
      
      // MINERAL VEINS - lighter streaks
      stroke(lightR + 20, lightG + 20, lightB + 20, 100);
      strokeWeight(1);
      for (var vein = 0; vein < 15; vein = vein + 1) {
        var vx = noise(vein * 19 + offX, 500) * width;
        var vy = noise(500, vein * 19 + offY) * height;
        var vang = noise(vein * 3, 250) * PI;
        
        beginShape();
        noFill();
        for (var vs = 0; vs < 8; vs = vs + 1) {
          var vwx = vx + vs * cos(vang) * 8 + noise(vein + vs, 0) * 10 - 5;
          var vwy = vy + vs * sin(vang) * 8 + noise(vein, vs) * 10 - 5;
          vertex(vwx, vwy);
        }
        endShape();
      }
      noStroke();
      
      // SURFACE PITTING
      for (var pit = 0; pit < 60; pit = pit + 1) {
        var pitx = noise(pit * 7 + offX, 700) * width;
        var pity = noise(700, pit * 7 + offY) * height;
        var pitsize = 2 + noise(pit, pit) * 4;
        fill(darkR - 20, darkG - 20, darkB - 20, 120);
        ellipse(pitx, pity, pitsize, pitsize);
      }
    }
  `;
}

function generateSandSketch(ctx: MaterialContext): string {
  const palette = MATERIAL_PALETTES.sand;
  const base = hexToRGB(palette.base);
  const dark = hexToRGB(palette.dark);
  const light = hexToRGB(palette.light);
  const offsetX = Math.abs((ctx.worldX * 127 + ctx.seed) % 1000);
  const offsetY = Math.abs((ctx.worldY * 131 + ctx.seed) % 1000);

  // SAND: Wind ripples with strong parallel ridges and grain variation
  return `
    function setup() {
      var baseR = ${base.r}; var baseG = ${base.g}; var baseB = ${base.b};
      var darkR = ${dark.r}; var darkG = ${dark.g}; var darkB = ${dark.b};
      var lightR = ${light.r}; var lightG = ${light.g}; var lightB = ${light.b};
      var offX = ${offsetX}; var offY = ${offsetY};
      
      background(baseR, baseG, baseB);
      
      // WIND RIPPLE PATTERN - strong parallel curved lines
      noFill();
      for (var ripple = 0; ripple < 50; ripple = ripple + 1) {
        var ry = ripple * (height / 50);
        var phase = noise(ripple * 0.3, offX * 0.01) * TWO_PI;
        
        // Light crest
        stroke(lightR + 15, lightG + 10, lightB, 120);
        strokeWeight(2);
        beginShape();
        for (var x = 0; x < width; x = x + 8) {
          var waveY = ry + sin(x * 0.025 + phase) * 6 + noise(x * 0.01 + offX * 0.01, ripple * 0.1) * 8;
          vertex(x, waveY);
        }
        endShape();
        
        // Dark trough
        stroke(darkR, darkG, darkB, 80);
        strokeWeight(1);
        beginShape();
        for (var x = 0; x < width; x = x + 8) {
          var waveY = ry + 4 + sin(x * 0.025 + phase) * 6 + noise(x * 0.01 + offX * 0.01, ripple * 0.1) * 8;
          vertex(x, waveY);
        }
        endShape();
      }
      noStroke();
      
      // GRAIN VARIATION - scattered darker/lighter patches
      for (var gy = 0; gy < height; gy = gy + 3) {
        for (var gx = 0; gx < width; gx = gx + 3) {
          var gn = noise((gx + offX) * 0.04, (gy + offY) * 0.04);
          if (gn > 0.65) {
            fill(lightR + 10, lightG + 5, lightB, 60);
            rect(gx, gy, 2, 2);
          } else if (gn < 0.35) {
            fill(darkR - 10, darkG - 5, darkB, 50);
            rect(gx, gy, 2, 2);
          }
        }
      }
      
      // SHELL FRAGMENTS AND DEBRIS
      for (var shell = 0; shell < 20; shell = shell + 1) {
        var sx = noise(shell * 13 + offX, 400) * width;
        var sy = noise(400, shell * 13 + offY) * height;
        var ssize = 3 + noise(shell * 2, shell * 2) * 5;
        fill(lightR + 30, lightG + 25, lightB + 15, 140);
        ellipse(sx, sy, ssize, ssize * 0.6);
      }
      
      // SMALL PEBBLES
      for (var peb = 0; peb < 25; peb = peb + 1) {
        var px = noise(peb * 9 + offX, 600) * width;
        var py = noise(600, peb * 9 + offY) * height;
        var psize = 2 + noise(peb, peb) * 4;
        fill(darkR + 20, darkG + 15, darkB + 10, 120);
        ellipse(px, py, psize, psize);
      }
    }
  `;
}

// Generate sketch source for each material kind
function generateTextureSketch(kind: MaterialKind, ctx: MaterialContext): string {
  switch (kind) {
    case 'ground':
      return generateGroundSketch(ctx);
    case 'forest':
      return generateForestSketch(ctx);
    case 'mountain':
      return generateMountainSketch(ctx);
    case 'snow':
      return generateSnowSketch(ctx);
    case 'water':
      return generateWaterSketch(ctx);
    case 'path':
      return generatePathSketch(ctx);
    case 'rock':
      return generateRockSketch(ctx);
    case 'sand':
      return generateSandSketch(ctx);
    default:
      return `
        function setup() {
          background(128, 128, 128);
        }
      `;
  }
}

// Generate a single texture using @nexart/ui-renderer
export async function generateMaterialTexture(
  kind: MaterialKind,
  ctx: MaterialContext
): Promise<TextureSet> {
  const hash = computeTextureHash(kind, ctx);
  
  // Check cache first
  const cached = getCachedTexture(hash);
  if (cached) {
    return cached;
  }
  
  // Create canvas for texture
  const canvas = document.createElement('canvas');
  canvas.width = TEXTURE_SIZE;
  canvas.height = TEXTURE_SIZE;
  
  // Generate sketch source
  const source = generateTextureSketch(kind, ctx);
  
  // Compute deterministic seed from context
  const textureSeed = Math.abs(
    (ctx.seed * 1000 + ctx.worldX * 100 + ctx.worldY) % 100000
  );
  
  try {
    const system = createSystem({
      type: 'code',
      mode: 'static',
      width: TEXTURE_SIZE,
      height: TEXTURE_SIZE,
      seed: textureSeed,
      vars: ctx.vars.slice(0, 10),
      source
    });
    
    const renderer = previewSystem(system, canvas, { showBadge: false });
    renderer.render();
    renderer.destroy();
    
    const textureSet: TextureSet = {
      diffuse: canvas,
      kind,
      context: ctx
    };
    
    // Cache the result
    setCachedTexture(hash, textureSet);
    
    return textureSet;
  } catch (error) {
    console.error(`[uiTextures] Failed to generate ${kind} texture:`, error);
    
    // Return fallback solid color texture
    const ctx2d = canvas.getContext('2d');
    if (ctx2d) {
      const palette = MATERIAL_PALETTES[kind];
      ctx2d.fillStyle = palette.base;
      ctx2d.fillRect(0, 0, TEXTURE_SIZE, TEXTURE_SIZE);
    }
    
    const textureSet: TextureSet = {
      diffuse: canvas,
      kind,
      context: ctx
    };
    
    setCachedTexture(hash, textureSet);
    return textureSet;
  }
}

// Generate all terrain textures for a world
export async function generateWorldTextures(
  worldId: string,
  worldX: number,
  worldY: number,
  seed: number,
  vars: number[]
): Promise<Map<MaterialKind, TextureSet>> {
  const textures = new Map<MaterialKind, TextureSet>();
  const kinds: MaterialKind[] = ['ground', 'forest', 'mountain', 'snow', 'water', 'path', 'rock', 'sand'];
  
  const baseContext: Omit<MaterialContext, 'tileType' | 'elevation' | 'moisture'> = {
    worldId,
    worldX,
    worldY,
    seed,
    vars
  };
  
  // Generate all textures in parallel
  const results = await Promise.all(
    kinds.map(kind => 
      generateMaterialTexture(kind, {
        ...baseContext,
        tileType: kind,
        elevation: 0.5,
        moisture: 0.5
      })
    )
  );
  
  results.forEach(textureSet => {
    textures.set(textureSet.kind, textureSet);
  });
  
  return textures;
}
