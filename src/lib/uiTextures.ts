// UI Textures - Procedural texture generation using @nexart/ui-renderer
// Generates deterministic textures for terrain materials.
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

// Generate sketch source for each material kind
function generateTextureSketch(kind: MaterialKind, ctx: MaterialContext): string {
  const palette = MATERIAL_PALETTES[kind];
  const base = hexToRGB(palette.base);
  const accent = hexToRGB(palette.accent);
  const dark = hexToRGB(palette.dark);
  const light = hexToRGB(palette.light);
  
  // Deterministic offset from world coordinates
  const offsetX = Math.abs((ctx.worldX * 127 + ctx.seed) % 1000);
  const offsetY = Math.abs((ctx.worldY * 131 + ctx.seed) % 1000);
  
  switch (kind) {
    case 'ground':
      return `
        function setup() {
          noStroke();
          var baseR = ${base.r};
          var baseG = ${base.g};
          var baseB = ${base.b};
          var darkR = ${dark.r};
          var darkG = ${dark.g};
          var darkB = ${dark.b};
          var lightR = ${light.r};
          var lightG = ${light.g};
          var lightB = ${light.b};
          var offX = ${offsetX};
          var offY = ${offsetY};
          
          background(baseR, baseG, baseB);
          
          // Soil grain pattern using noise
          for (var y = 0; y < height; y = y + 2) {
            for (var x = 0; x < width; x = x + 2) {
              var nx = (x + offX) * 0.02;
              var ny = (y + offY) * 0.02;
              var n = noise(nx, ny);
              
              if (n > 0.6) {
                fill(darkR, darkG, darkB, 80);
                rect(x, y, 2, 2);
              } else if (n > 0.4) {
                fill(lightR, lightG, lightB, 40);
                rect(x, y, 1, 1);
              }
            }
          }
          
          // Scattered pebbles
          for (var i = 0; i < 15; i = i + 1) {
            var px = noise(i * 10 + offX, 0) * width;
            var py = noise(0, i * 10 + offY) * height;
            var size = 2 + noise(i, i) * 4;
            fill(darkR - 10, darkG - 10, darkB - 10, 120);
            ellipse(px, py, size, size * 0.8);
          }
        }
      `;
      
    case 'forest':
      return `
        function setup() {
          noStroke();
          var baseR = ${base.r};
          var baseG = ${base.g};
          var baseB = ${base.b};
          var darkR = ${dark.r};
          var darkG = ${dark.g};
          var darkB = ${dark.b};
          var lightR = ${light.r};
          var lightG = ${light.g};
          var lightB = ${light.b};
          var offX = ${offsetX};
          var offY = ${offsetY};
          
          background(darkR, darkG, darkB);
          
          // Leaf litter and moss pattern
          for (var y = 0; y < height; y = y + 3) {
            for (var x = 0; x < width; x = x + 3) {
              var nx = (x + offX) * 0.015;
              var ny = (y + offY) * 0.015;
              var n = noise(nx, ny);
              var n2 = noise(nx * 2, ny * 2);
              
              if (n > 0.55) {
                fill(baseR, baseG + 10, baseB, 150);
                rect(x, y, 3, 3);
              }
              if (n2 > 0.6) {
                fill(lightR, lightG + 20, lightB, 100);
                ellipse(x + 1, y + 1, 2, 2);
              }
            }
          }
          
          // Fallen leaves
          for (var i = 0; i < 20; i = i + 1) {
            var lx = noise(i * 7 + offX, 0) * width;
            var ly = noise(0, i * 7 + offY) * height;
            var leafHue = noise(i, i + 50) * 30;
            fill(80 + leafHue, 50 + leafHue, 20, 60);
            ellipse(lx, ly, 4, 2);
          }
        }
      `;
      
    case 'mountain':
      return `
        function setup() {
          noStroke();
          var baseR = ${base.r};
          var baseG = ${base.g};
          var baseB = ${base.b};
          var darkR = ${dark.r};
          var darkG = ${dark.g};
          var darkB = ${dark.b};
          var lightR = ${light.r};
          var lightG = ${light.g};
          var lightB = ${light.b};
          var offX = ${offsetX};
          var offY = ${offsetY};
          
          background(baseR, baseG, baseB);
          
          // Rock strata layers
          for (var y = 0; y < height; y = y + 1) {
            var strataOffset = noise((y + offY) * 0.05, offX * 0.01) * 20;
            for (var x = 0; x < width; x = x + 2) {
              var nx = (x + offX + strataOffset) * 0.03;
              var ny = (y + offY) * 0.01;
              var n = noise(nx, ny);
              
              if (n > 0.5) {
                var shade = n * 40;
                fill(darkR + shade, darkG + shade, darkB + shade, 100);
                rect(x, y, 2, 1);
              }
            }
          }
          
          // Surface cracks
          stroke(darkR - 20, darkG - 20, darkB - 20, 60);
          strokeWeight(1);
          for (var i = 0; i < 8; i = i + 1) {
            var cx = noise(i * 13 + offX, 0) * width;
            var cy = noise(0, i * 13 + offY) * height;
            var clen = 10 + noise(i, i) * 30;
            var cang = noise(i + 5, i + 5) * TWO_PI;
            line(cx, cy, cx + cos(cang) * clen, cy + sin(cang) * clen);
          }
          noStroke();
        }
      `;
      
    case 'snow':
      return `
        function setup() {
          noStroke();
          var baseR = ${base.r};
          var baseG = ${base.g};
          var baseB = ${base.b};
          var darkR = ${dark.r};
          var darkG = ${dark.g};
          var darkB = ${dark.b};
          var offX = ${offsetX};
          var offY = ${offsetY};
          
          background(baseR, baseG, baseB);
          
          // Snow crystal patterns
          for (var y = 0; y < height; y = y + 2) {
            for (var x = 0; x < width; x = x + 2) {
              var nx = (x + offX) * 0.025;
              var ny = (y + offY) * 0.025;
              var n = noise(nx, ny);
              
              if (n > 0.55) {
                fill(255, 255, 255, 80);
                rect(x, y, 2, 2);
              } else if (n < 0.35) {
                fill(darkR, darkG, darkB, 30);
                rect(x, y, 1, 1);
              }
            }
          }
          
          // Sparkle highlights
          for (var i = 0; i < 25; i = i + 1) {
            var sx = noise(i * 11 + offX, 0) * width;
            var sy = noise(0, i * 11 + offY) * height;
            fill(255, 255, 255, 150 + noise(i, i) * 100);
            ellipse(sx, sy, 1, 1);
          }
        }
      `;
      
    case 'water':
      return `
        function setup() {
          noStroke();
          var baseR = ${base.r};
          var baseG = ${base.g};
          var baseB = ${base.b};
          var lightR = ${light.r};
          var lightG = ${light.g};
          var lightB = ${light.b};
          var offX = ${offsetX};
          var offY = ${offsetY};
          
          background(baseR, baseG, baseB);
          
          // Caustic patterns
          for (var y = 0; y < height; y = y + 2) {
            for (var x = 0; x < width; x = x + 2) {
              var nx = (x + offX) * 0.02;
              var ny = (y + offY) * 0.02;
              var n = noise(nx, ny);
              var n2 = noise(nx * 1.5 + 100, ny * 1.5 + 100);
              
              var combined = (n + n2) * 0.5;
              if (combined > 0.55) {
                fill(lightR, lightG, lightB, 60 + combined * 40);
                rect(x, y, 2, 2);
              }
            }
          }
          
          // Depth variation
          for (var y = 0; y < height; y = y + 4) {
            for (var x = 0; x < width; x = x + 4) {
              var dn = noise((x + offX) * 0.01, (y + offY) * 0.01);
              if (dn < 0.4) {
                fill(baseR - 20, baseG - 20, baseB - 10, 50);
                rect(x, y, 4, 4);
              }
            }
          }
        }
      `;
      
    case 'path':
      return `
        function setup() {
          noStroke();
          var baseR = ${base.r};
          var baseG = ${base.g};
          var baseB = ${base.b};
          var darkR = ${dark.r};
          var darkG = ${dark.g};
          var darkB = ${dark.b};
          var lightR = ${light.r};
          var lightG = ${light.g};
          var lightB = ${light.b};
          var offX = ${offsetX};
          var offY = ${offsetY};
          
          background(baseR, baseG, baseB);
          
          // Worn dirt pattern
          for (var y = 0; y < height; y = y + 2) {
            for (var x = 0; x < width; x = x + 2) {
              var nx = (x + offX) * 0.02;
              var ny = (y + offY) * 0.02;
              var n = noise(nx, ny);
              
              if (n > 0.6) {
                fill(lightR, lightG, lightB, 70);
                rect(x, y, 2, 2);
              } else if (n < 0.35) {
                fill(darkR, darkG, darkB, 50);
                rect(x, y, 2, 2);
              }
            }
          }
          
          // Footprint impressions
          for (var i = 0; i < 5; i = i + 1) {
            var fx = noise(i * 17 + offX, 0) * width;
            var fy = noise(0, i * 17 + offY) * height;
            fill(darkR, darkG, darkB, 40);
            ellipse(fx, fy, 8, 12);
          }
        }
      `;
      
    case 'rock':
      return `
        function setup() {
          noStroke();
          var baseR = ${base.r};
          var baseG = ${base.g};
          var baseB = ${base.b};
          var darkR = ${dark.r};
          var darkG = ${dark.g};
          var darkB = ${dark.b};
          var lightR = ${light.r};
          var lightG = ${light.g};
          var lightB = ${light.b};
          var offX = ${offsetX};
          var offY = ${offsetY};
          
          background(baseR, baseG, baseB);
          
          // Rough rock surface
          for (var y = 0; y < height; y = y + 2) {
            for (var x = 0; x < width; x = x + 2) {
              var nx = (x + offX) * 0.03;
              var ny = (y + offY) * 0.03;
              var n = noise(nx, ny);
              var shade = (n - 0.5) * 60;
              
              fill(baseR + shade, baseG + shade, baseB + shade, 180);
              rect(x, y, 2, 2);
            }
          }
          
          // Lichen patches
          for (var i = 0; i < 10; i = i + 1) {
            var lx = noise(i * 9 + offX, 0) * width;
            var ly = noise(0, i * 9 + offY) * height;
            var lsize = 5 + noise(i, i) * 15;
            fill(80, 90 + noise(i, 0) * 30, 70, 40);
            ellipse(lx, ly, lsize, lsize * 0.7);
          }
        }
      `;
      
    case 'sand':
      return `
        function setup() {
          noStroke();
          var baseR = ${base.r};
          var baseG = ${base.g};
          var baseB = ${base.b};
          var darkR = ${dark.r};
          var darkG = ${dark.g};
          var darkB = ${dark.b};
          var lightR = ${light.r};
          var lightG = ${light.g};
          var lightB = ${light.b};
          var offX = ${offsetX};
          var offY = ${offsetY};
          
          background(baseR, baseG, baseB);
          
          // Sand grain ripples
          for (var y = 0; y < height; y = y + 1) {
            var ripple = sin((y + offY) * 0.1 + noise(y * 0.05 + offX, 0) * 10) * 0.5 + 0.5;
            for (var x = 0; x < width; x = x + 2) {
              var nx = (x + offX) * 0.02;
              var ny = (y + offY) * 0.02;
              var n = noise(nx, ny);
              
              var shade = (n + ripple - 1) * 30;
              fill(baseR + shade, baseG + shade, baseB + shade, 100);
              rect(x, y, 2, 1);
            }
          }
          
          // Shell fragments
          for (var i = 0; i < 8; i = i + 1) {
            var sx = noise(i * 15 + offX, 0) * width;
            var sy = noise(0, i * 15 + offY) * height;
            fill(lightR + 20, lightG + 20, lightB + 20, 100);
            ellipse(sx, sy, 3, 2);
          }
        }
      `;
      
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
  
  kinds.forEach((kind, i) => {
    textures.set(kind, results[i]);
  });
  
  return textures;
}
