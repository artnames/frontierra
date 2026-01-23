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

// Common helper functions to inject into sketches for isotropic patterns
const SKETCH_HELPERS = `
  // Domain rotation helpers
  function rotX(x, y, a) { return x * Math.cos(a) - y * Math.sin(a); }
  function rotY(x, y, a) { return x * Math.sin(a) + y * Math.cos(a); }
  
  // Fractal Brownian Motion - multi-octave noise for natural patterns
  function fbm(x, y) {
    var f = 0;
    var amp = 0.5;
    var freq = 1;
    for (var k = 0; k < 5; k = k + 1) {
      f = f + amp * noise(x * freq, y * freq);
      freq = freq * 2;
      amp = amp * 0.5;
    }
    return f;
  }
  
  // Domain warp using fbm for organic distortion
  function warpX(x, y, strength) {
    return x + (fbm(x * 0.02, y * 0.02) - 0.5) * strength;
  }
  function warpY(x, y, strength) {
    return y + (fbm(x * 0.02 + 100, y * 0.02 + 100) - 0.5) * strength;
  }
  
  // Ridge noise for dune/wave patterns (isotropic)
  function ridge(x, y, scale) {
    var n = noise(x * scale, y * scale);
    return 1 - Math.abs(2 * n - 1);
  }
`;

// ============================================================================
// ISOTROPIC MATERIAL SKETCHES
// Each material uses noise-based patterns to avoid axis-aligned striping
// ============================================================================

function generateGroundSketch(ctx: MaterialContext): string {
  const palette = MATERIAL_PALETTES.ground;
  const base = hexToRGB(palette.base);
  const dark = hexToRGB(palette.dark);
  const light = hexToRGB(palette.light);
  const textureSeed = Math.abs((ctx.seed * 1000 + ctx.worldX * 100 + ctx.worldY) % 100000);

  // GROUND: FBM-based soil with scattered pebbles and organic blotches
  return `
    function setup() {
      var SEED = ${textureSeed};
      randomSeed(SEED);
      noiseSeed(SEED);
      ${SKETCH_HELPERS}
      
      var baseR = ${base.r}; var baseG = ${base.g}; var baseB = ${base.b};
      var darkR = ${dark.r}; var darkG = ${dark.g}; var darkB = ${dark.b};
      var lightR = ${light.r}; var lightG = ${light.g}; var lightB = ${light.b};
      
      // Base fill
      background(baseR, baseG, baseB);
      noStroke();
      
      // FBM-based soil variation (isotropic)
      for (var py = 0; py < height; py = py + 2) {
        for (var px = 0; px < width; px = px + 2) {
          var wx = warpX(px, py, 30);
          var wy = warpY(px, py, 30);
          var n = fbm(wx * 0.025, wy * 0.025);
          
          if (n > 0.55) {
            fill(lightR, lightG, lightB, (n - 0.55) * 200);
            rect(px, py, 2, 2);
          } else if (n < 0.45) {
            fill(darkR, darkG, darkB, (0.45 - n) * 180);
            rect(px, py, 2, 2);
          }
        }
      }
      
      // Organic blotches using warped coordinates
      for (var blob = 0; blob < 25; blob = blob + 1) {
        var bx = random(width);
        var by = random(height);
        var bsize = 15 + random(30);
        fill(darkR - 15, darkG - 10, darkB - 5, 60);
        
        beginShape();
        for (var a = 0; a < TWO_PI; a = a + 0.4) {
          var r = bsize * (0.6 + noise(blob * 5 + a * 2, SEED * 0.001) * 0.8);
          vertex(bx + cos(a) * r, by + sin(a) * r);
        }
        endShape(CLOSE);
      }
      
      // Scattered pebbles (random placement, not grid)
      for (var p = 0; p < 80; p = p + 1) {
        var px = random(width);
        var py = random(height);
        var psize = 2 + random(5);
        var shade = random(-20, 10);
        fill(darkR + shade, darkG + shade, darkB + shade, 140);
        ellipse(px, py, psize, psize * (0.6 + random(0.4)));
      }
      
      // Subtle highlight specks
      for (var h = 0; h < 40; h = h + 1) {
        var hx = random(width);
        var hy = random(height);
        fill(lightR + 20, lightG + 15, lightB + 10, 80);
        ellipse(hx, hy, 1 + random(2), 1 + random(2));
      }
    }
  `;
}

function generateForestSketch(ctx: MaterialContext): string {
  const palette = MATERIAL_PALETTES.forest;
  const base = hexToRGB(palette.base);
  const dark = hexToRGB(palette.dark);
  const light = hexToRGB(palette.light);
  const textureSeed = Math.abs((ctx.seed * 1000 + ctx.worldX * 100 + ctx.worldY) % 100000);

  // FOREST: High contrast leaf litter with multi-scale speckles
  return `
    function setup() {
      var SEED = ${textureSeed};
      randomSeed(SEED);
      noiseSeed(SEED);
      ${SKETCH_HELPERS}
      
      var baseR = ${base.r}; var baseG = ${base.g}; var baseB = ${base.b};
      var darkR = ${dark.r}; var darkG = ${dark.g}; var darkB = ${dark.b};
      var lightR = ${light.r}; var lightG = ${light.g}; var lightB = ${light.b};
      
      // Deep shadow base
      background(darkR, darkG, darkB);
      noStroke();
      
      // Large organic shadow masses
      for (var mass = 0; mass < 12; mass = mass + 1) {
        var mx = random(width);
        var my = random(height);
        var msize = 40 + random(60);
        
        for (var ring = 4; ring >= 0; ring = ring - 1) {
          var ringSize = msize * (0.3 + ring * 0.18);
          var greenBoost = (4 - ring) * 12;
          fill(baseR + greenBoost, baseG + 20 + greenBoost, baseB + greenBoost, 80);
          
          beginShape();
          for (var a = 0; a < TWO_PI; a = a + 0.3) {
            var r = ringSize * (0.7 + noise(mass * 7 + a, ring * 3) * 0.6);
            vertex(mx + cos(a) * r, my + sin(a) * r);
          }
          endShape(CLOSE);
        }
      }
      
      // Multi-scale leaf litter speckles
      for (var layer = 0; layer < 3; layer = layer + 1) {
        var count = 80 + layer * 60;
        var maxSize = 8 - layer * 2;
        var alpha = 100 - layer * 20;
        
        for (var s = 0; s < count; s = s + 1) {
          var sx = random(width);
          var sy = random(height);
          var ssize = 1 + random(maxSize);
          
          if (random() > 0.5) {
            fill(darkR - 10, darkG, darkB - 5, alpha);
          } else {
            fill(baseR + 15, baseG + 25, baseB + 10, alpha);
          }
          ellipse(sx, sy, ssize, ssize * (0.6 + random(0.4)));
        }
      }
      
      // Bright highlight flecks (sunlight through canopy)
      for (var h = 0; h < 60; h = h + 1) {
        var hx = random(width);
        var hy = random(height);
        var hsize = 1 + random(4);
        fill(lightR + 30, lightG + 50, lightB + 20, 100 + random(80));
        ellipse(hx, hy, hsize, hsize);
      }
      
      // Dark patches for depth
      for (var d = 0; d < 20; d = d + 1) {
        var dx = random(width);
        var dy = random(height);
        var dsize = 10 + random(25);
        fill(darkR - 15, darkG - 10, darkB - 10, 50);
        ellipse(dx, dy, dsize, dsize * (0.7 + random(0.3)));
      }
    }
  `;
}

function generateMountainSketch(ctx: MaterialContext): string {
  const palette = MATERIAL_PALETTES.mountain;
  const base = hexToRGB(palette.base);
  const dark = hexToRGB(palette.dark);
  const light = hexToRGB(palette.light);
  const textureSeed = Math.abs((ctx.seed * 1000 + ctx.worldX * 100 + ctx.worldY) % 100000);

  // MOUNTAIN: Warped/rotated strata with angular rock debris
  return `
    function setup() {
      var SEED = ${textureSeed};
      randomSeed(SEED);
      noiseSeed(SEED);
      ${SKETCH_HELPERS}
      
      var baseR = ${base.r}; var baseG = ${base.g}; var baseB = ${base.b};
      var darkR = ${dark.r}; var darkG = ${dark.g}; var darkB = ${dark.b};
      var lightR = ${light.r}; var lightG = ${light.g}; var lightB = ${light.b};
      
      background(baseR, baseG, baseB);
      noStroke();
      
      // Rotation angle for this tile (varies per seed)
      var tileAngle = (noise(SEED * 0.001, 0) - 0.5) * PI * 0.4;
      
      // Warped strata using rotated/warped domain
      for (var py = 0; py < height; py = py + 2) {
        for (var px = 0; px < width; px = px + 2) {
          // Rotate domain to break horizontal alignment
          var rx = rotX(px - width/2, py - height/2, tileAngle) + width/2;
          var ry = rotY(px - width/2, py - height/2, tileAngle) + height/2;
          
          // Warp for organic feel
          var wx = warpX(rx, ry, 40);
          var wy = warpY(rx, ry, 40);
          
          // Strata based on warped Y
          var strataVal = (wy * 0.05) % 1;
          var n = noise(wx * 0.02, wy * 0.01);
          
          if (strataVal < 0.3 && n > 0.4) {
            fill(lightR + 10, lightG + 10, lightB + 10, 100);
            rect(px, py, 2, 2);
          } else if (strataVal > 0.7 && n < 0.6) {
            fill(darkR - 15, darkG - 15, darkB - 15, 90);
            rect(px, py, 2, 2);
          }
        }
      }
      
      // Fracture lines (random angles, not axis-aligned)
      stroke(darkR - 35, darkG - 35, darkB - 35, 150);
      strokeWeight(1.5);
      for (var crack = 0; crack < 18; crack = crack + 1) {
        var cx = random(width);
        var cy = random(height);
        var cang = random(TWO_PI);
        var px = cx;
        var py = cy;
        
        for (var seg = 0; seg < 6; seg = seg + 1) {
          var segLen = 8 + random(15);
          var segAng = cang + (random() - 0.5) * PI * 0.5;
          var nx = px + cos(segAng) * segLen;
          var ny = py + sin(segAng) * segLen;
          line(px, py, nx, ny);
          px = nx;
          py = ny;
          cang = segAng;
        }
      }
      noStroke();
      
      // Angular rock debris
      for (var stone = 0; stone < 50; stone = stone + 1) {
        var sx = random(width);
        var sy = random(height);
        var ssize = 4 + random(10);
        var shade = (random() - 0.5) * 40;
        fill(baseR + shade, baseG + shade, baseB + shade, 160);
        
        beginShape();
        var sides = 4 + int(random(3));
        var startAng = random(TWO_PI);
        for (var s = 0; s < sides; s = s + 1) {
          var ang = startAng + s * TWO_PI / sides + random(-0.3, 0.3);
          var r = ssize * (0.5 + random(0.5));
          vertex(sx + cos(ang) * r, sy + sin(ang) * r);
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
  const textureSeed = Math.abs((ctx.seed * 1000 + ctx.worldX * 100 + ctx.worldY) % 100000);

  // SNOW: Soft warped drifts with ice sparkles
  return `
    function setup() {
      var SEED = ${textureSeed};
      randomSeed(SEED);
      noiseSeed(SEED);
      ${SKETCH_HELPERS}
      
      var baseR = ${base.r}; var baseG = ${base.g}; var baseB = ${base.b};
      var darkR = ${dark.r}; var darkG = ${dark.g}; var darkB = ${dark.b};
      
      background(baseR, baseG, baseB);
      noStroke();
      
      // Soft shadow undulations using fbm
      for (var py = 0; py < height; py = py + 2) {
        for (var px = 0; px < width; px = px + 2) {
          var wx = warpX(px, py, 50);
          var wy = warpY(px, py, 50);
          var n = fbm(wx * 0.015, wy * 0.015);
          
          if (n < 0.45) {
            fill(darkR - 10, darkG - 5, darkB + 5, (0.45 - n) * 120);
            rect(px, py, 2, 2);
          }
        }
      }
      
      // Drift shadow blobs
      for (var drift = 0; drift < 15; drift = drift + 1) {
        var dx = random(width);
        var dy = random(height);
        var dw = 30 + random(50);
        var dh = 8 + random(15);
        var dang = random(-0.3, 0.3);
        
        push();
        translate(dx, dy);
        rotate(dang);
        fill(darkR - 15, darkG - 10, darkB, 40);
        ellipse(0, 0, dw, dh);
        pop();
      }
      
      // Ice crystal sparkles
      for (var ice = 0; ice < 100; ice = ice + 1) {
        var ix = random(width);
        var iy = random(height);
        var isize = 1 + random(2);
        fill(255, 255, 255, 180 + random(75));
        ellipse(ix, iy, isize, isize);
      }
      
      // Subtle blue shadow spots
      for (var sh = 0; sh < 12; sh = sh + 1) {
        var shx = random(width);
        var shy = random(height);
        var shsize = 15 + random(30);
        fill(darkR - 25, darkG - 15, darkB + 15, 30);
        ellipse(shx, shy, shsize, shsize * 0.6);
      }
    }
  `;
}

function generateWaterSketch(ctx: MaterialContext): string {
  const palette = MATERIAL_PALETTES.water;
  const base = hexToRGB(palette.base);
  const dark = hexToRGB(palette.dark);
  const light = hexToRGB(palette.light);
  const textureSeed = Math.abs((ctx.seed * 1000 + ctx.worldX * 100 + ctx.worldY) % 100000);

  // WATER: Smooth warped caustics, no grid patterns
  return `
    function setup() {
      var SEED = ${textureSeed};
      randomSeed(SEED);
      noiseSeed(SEED);
      ${SKETCH_HELPERS}
      
      var baseR = ${base.r}; var baseG = ${base.g}; var baseB = ${base.b};
      var darkR = ${dark.r}; var darkG = ${dark.g}; var darkB = ${dark.b};
      var lightR = ${light.r}; var lightG = ${light.g}; var lightB = ${light.b};
      
      // Smooth depth gradient base
      for (var py = 0; py < height; py = py + 1) {
        for (var px = 0; px < width; px = px + 1) {
          var n = fbm(px * 0.02, py * 0.02);
          var depthMod = 0.9 + n * 0.2;
          fill(baseR * depthMod, baseG * depthMod, baseB * depthMod);
          rect(px, py, 1, 1);
        }
      }
      noStroke();
      
      // Soft caustic highlights (organic blobs)
      for (var c = 0; c < 50; c = c + 1) {
        var cx = random(width);
        var cy = random(height);
        var csize = 8 + random(20);
        
        fill(lightR + 30, lightG + 40, lightB + 50, 50);
        beginShape();
        for (var a = 0; a < TWO_PI; a = a + 0.5) {
          var r = csize * (0.5 + noise(c * 3 + a, SEED * 0.001) * 0.8);
          vertex(cx + cos(a) * r, cy + sin(a) * r);
        }
        endShape(CLOSE);
      }
      
      // Deep spots
      for (var deep = 0; deep < 12; deep = deep + 1) {
        var dx = random(width);
        var dy = random(height);
        var dsize = 20 + random(35);
        fill(darkR - 15, darkG - 10, darkB - 5, 45);
        ellipse(dx, dy, dsize, dsize * (0.6 + random(0.3)));
      }
      
      // Subtle surface shimmer points
      for (var sh = 0; sh < 40; sh = sh + 1) {
        var shx = random(width);
        var shy = random(height);
        fill(lightR + 50, lightG + 60, lightB + 70, 60 + random(40));
        ellipse(shx, shy, 2 + random(3), 2 + random(3));
      }
    }
  `;
}

function generatePathSketch(ctx: MaterialContext): string {
  const palette = MATERIAL_PALETTES.path;
  const base = hexToRGB(palette.base);
  const dark = hexToRGB(palette.dark);
  const light = hexToRGB(palette.light);
  const textureSeed = Math.abs((ctx.seed * 1000 + ctx.worldX * 100 + ctx.worldY) % 100000);

  // PATH: Warped compacted dirt with scattered footprints
  return `
    function setup() {
      var SEED = ${textureSeed};
      randomSeed(SEED);
      noiseSeed(SEED);
      ${SKETCH_HELPERS}
      
      var baseR = ${base.r}; var baseG = ${base.g}; var baseB = ${base.b};
      var darkR = ${dark.r}; var darkG = ${dark.g}; var darkB = ${dark.b};
      var lightR = ${light.r}; var lightG = ${light.g}; var lightB = ${light.b};
      
      background(baseR, baseG, baseB);
      noStroke();
      
      // Worn center zone using fbm (not axis-aligned)
      for (var py = 0; py < height; py = py + 2) {
        for (var px = 0; px < width; px = px + 2) {
          var wx = warpX(px, py, 25);
          var wy = warpY(px, py, 25);
          var n = fbm(wx * 0.02, wy * 0.02);
          
          // Center is lighter (more worn)
          var distFromCenter = Math.abs(px - width/2) / (width/2);
          var wearFactor = (1 - distFromCenter) * 0.5;
          
          if (n > 0.5 - wearFactor * 0.2) {
            fill(lightR, lightG, lightB, (n - 0.4) * 80 * (1 - distFromCenter));
            rect(px, py, 2, 2);
          }
        }
      }
      
      // Scattered darker footprint impressions
      for (var fp = 0; fp < 15; fp = fp + 1) {
        var fx = random(width * 0.3, width * 0.7);
        var fy = random(height);
        var fsize = 6 + random(8);
        fill(darkR - 15, darkG - 10, darkB - 5, 70);
        ellipse(fx, fy, fsize * 0.6, fsize);
      }
      
      // Embedded stones
      for (var stone = 0; stone < 40; stone = stone + 1) {
        var sx = random(width);
        var sy = random(height);
        var ssize = 3 + random(7);
        var shade = random(-15, 10);
        fill(darkR + shade, darkG + shade, darkB + shade, 130);
        ellipse(sx, sy, ssize, ssize * (0.6 + random(0.3)));
      }
      
      // Edge debris (biased to edges)
      for (var ed = 0; ed < 35; ed = ed + 1) {
        var ex = random() < 0.5 ? random(width * 0.25) : width - random(width * 0.25);
        var ey = random(height);
        var esize = 2 + random(5);
        fill(darkR - 5, darkG, darkB + 5, 90);
        rect(ex, ey, esize, esize * 0.7);
      }
    }
  `;
}

function generateRockSketch(ctx: MaterialContext): string {
  const palette = MATERIAL_PALETTES.rock;
  const base = hexToRGB(palette.base);
  const dark = hexToRGB(palette.dark);
  const light = hexToRGB(palette.light);
  const textureSeed = Math.abs((ctx.seed * 1000 + ctx.worldX * 100 + ctx.worldY) % 100000);

  // ROCK: Angular plates with random-angle cracks
  return `
    function setup() {
      var SEED = ${textureSeed};
      randomSeed(SEED);
      noiseSeed(SEED);
      ${SKETCH_HELPERS}
      
      var baseR = ${base.r}; var baseG = ${base.g}; var baseB = ${base.b};
      var darkR = ${dark.r}; var darkG = ${dark.g}; var darkB = ${dark.b};
      var lightR = ${light.r}; var lightG = ${light.g}; var lightB = ${light.b};
      
      background(baseR, baseG, baseB);
      noStroke();
      
      // Large angular plate regions
      for (var plate = 0; plate < 20; plate = plate + 1) {
        var px = random(width);
        var py = random(height);
        var psize = 25 + random(50);
        var shade = (random() - 0.5) * 45;
        
        fill(baseR + shade, baseG + shade, baseB + shade, 180);
        
        beginShape();
        var sides = 4 + int(random(4));
        var startAng = random(TWO_PI);
        for (var s = 0; s < sides; s = s + 1) {
          var ang = startAng + s * TWO_PI / sides + random(-0.4, 0.4);
          var r = psize * (0.5 + random(0.6));
          vertex(px + cos(ang) * r, py + sin(ang) * r);
        }
        endShape(CLOSE);
      }
      
      // Crack network
      stroke(darkR - 35, darkG - 35, darkB - 35, 170);
      strokeWeight(1.5);
      for (var crack = 0; crack < 25; crack = crack + 1) {
        var cx = random(width);
        var cy = random(height);
        var cang = random(TWO_PI);
        var cpx = cx;
        var cpy = cy;
        
        for (var seg = 0; seg < 5; seg = seg + 1) {
          var segLen = 6 + random(12);
          var segAng = cang + (random() - 0.5) * PI * 0.6;
          var nx = cpx + cos(segAng) * segLen;
          var ny = cpy + sin(segAng) * segLen;
          line(cpx, cpy, nx, ny);
          cpx = nx;
          cpy = ny;
          cang = segAng;
        }
      }
      noStroke();
      
      // Mineral veins (lighter streaks)
      stroke(lightR + 15, lightG + 15, lightB + 15, 90);
      strokeWeight(1);
      for (var vein = 0; vein < 10; vein = vein + 1) {
        var vx = random(width);
        var vy = random(height);
        var vang = random(TWO_PI);
        
        beginShape();
        noFill();
        for (var vs = 0; vs < 7; vs = vs + 1) {
          var vwx = vx + vs * cos(vang) * 7 + random(-6, 6);
          var vwy = vy + vs * sin(vang) * 7 + random(-6, 6);
          vertex(vwx, vwy);
        }
        endShape();
      }
      noStroke();
      
      // Surface pits
      for (var pit = 0; pit < 50; pit = pit + 1) {
        var pitx = random(width);
        var pity = random(height);
        var pitsize = 2 + random(4);
        fill(darkR - 20, darkG - 20, darkB - 20, 110);
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
  const textureSeed = Math.abs((ctx.seed * 1000 + ctx.worldX * 100 + ctx.worldY) % 100000);

  // SAND: Warped ridge noise for organic dune ripples
  return `
    function setup() {
      var SEED = ${textureSeed};
      randomSeed(SEED);
      noiseSeed(SEED);
      ${SKETCH_HELPERS}
      
      var baseR = ${base.r}; var baseG = ${base.g}; var baseB = ${base.b};
      var darkR = ${dark.r}; var darkG = ${dark.g}; var darkB = ${dark.b};
      var lightR = ${light.r}; var lightG = ${light.g}; var lightB = ${light.b};
      
      background(baseR, baseG, baseB);
      noStroke();
      
      // Dominant wind angle for this tile
      var windAngle = noise(SEED * 0.001, 0) * PI;
      
      // Warped ridge patterns for dunes
      for (var py = 0; py < height; py = py + 2) {
        for (var px = 0; px < width; px = px + 2) {
          // Rotate domain by wind angle
          var rx = rotX(px, py, windAngle);
          var ry = rotY(px, py, windAngle);
          
          // Warp for organic look
          var wx = warpX(rx, ry, 35);
          var wy = warpY(rx, ry, 35);
          
          // Ridge noise
          var r = ridge(wx, wy, 0.04);
          
          if (r > 0.7) {
            fill(lightR + 10, lightG + 8, lightB, (r - 0.7) * 250);
            rect(px, py, 2, 2);
          } else if (r < 0.4) {
            fill(darkR, darkG, darkB, (0.4 - r) * 150);
            rect(px, py, 2, 2);
          }
        }
      }
      
      // Grain variation specks
      for (var g = 0; g < 120; g = g + 1) {
        var gx = random(width);
        var gy = random(height);
        var gsize = 1 + random(2);
        
        if (random() > 0.5) {
          fill(lightR + 15, lightG + 10, lightB + 5, 70);
        } else {
          fill(darkR - 5, darkG - 3, darkB, 60);
        }
        rect(gx, gy, gsize, gsize);
      }
      
      // Shell fragments
      for (var shell = 0; shell < 15; shell = shell + 1) {
        var sx = random(width);
        var sy = random(height);
        var ssize = 3 + random(5);
        fill(lightR + 35, lightG + 30, lightB + 20, 130);
        ellipse(sx, sy, ssize, ssize * 0.5);
      }
      
      // Small pebbles
      for (var peb = 0; peb < 20; peb = peb + 1) {
        var px = random(width);
        var py = random(height);
        var psize = 2 + random(3);
        fill(darkR + 25, darkG + 20, darkB + 15, 100);
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

// Internal render size for supersampling (2x for anti-aliasing)
const SUPERSAMPLE_SCALE = 2;

// Generate a single texture using @nexart/ui-renderer with 2x supersample
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
  
  // Final output canvas at TEXTURE_SIZE
  const canvas = document.createElement('canvas');
  canvas.width = TEXTURE_SIZE;
  canvas.height = TEXTURE_SIZE;

  // Hi-res render canvas at 2x for supersampling
  const hiResSize = TEXTURE_SIZE * SUPERSAMPLE_SCALE;
  const renderCanvas = document.createElement('canvas');
  renderCanvas.width = hiResSize;
  renderCanvas.height = hiResSize;

  // Generate sketch source
  const source = generateTextureSketch(kind, ctx);

  // Compute deterministic seed from context
  const textureSeed = Math.abs(
    (ctx.seed * 1000 + ctx.worldX * 100 + ctx.worldY) % 100000
  );

  // FIX: Helper to cleanup render canvas after use
  const cleanupRenderCanvas = () => {
    // Zero out canvas dimensions to release GPU memory
    renderCanvas.width = 0;
    renderCanvas.height = 0;
  };

  try {
    const system = createSystem({
      type: 'code',
      mode: 'static',
      width: hiResSize,
      height: hiResSize,
      seed: textureSeed,
      vars: ctx.vars.slice(0, 10),
      source
    });

    const renderer = previewSystem(system, renderCanvas, { showBadge: false });
    renderer.render();

    // Downsample from hi-res to final size (anti-aliasing)
    const out2d = canvas.getContext('2d');
    if (out2d) {
      out2d.imageSmoothingEnabled = true;
      out2d.imageSmoothingQuality = 'high';
      out2d.drawImage(renderCanvas, 0, 0, hiResSize, hiResSize, 0, 0, TEXTURE_SIZE, TEXTURE_SIZE);
    }

    renderer.destroy();
    
    // FIX: Cleanup temporary render canvas to release memory
    cleanupRenderCanvas();
    
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
    
    // FIX: Cleanup render canvas even on error
    cleanupRenderCanvas();
    
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
