// 1. Texture Influences (Fixes Error at line 38)
const TEXTURE_INFLUENCES: Record<MaterialKind, number> = {
  ground: 0.5,
  forest: 0.7,
  mountain: 0.8,
  snow: 0.4,
  water: 1.0,
  path: 0.6,
  rock: 0.9,
  sand: 0.5,
  riverbed: 0.85, // New property
};

// 2. PBR Settings (Fixes Error at line 64)
const MATERIAL_PBR_SETTINGS: Record<
  MaterialKind,
  {
    roughness: number;
    metalness: number;
    detailScale: number;
    albedoVar: number;
    roughVar: number;
    slopeAO: number;
  }
> = {
  ground: { roughness: 0.88, metalness: 0.02, detailScale: 0.9, albedoVar: 0.08, roughVar: 0.18, slopeAO: 0.12 },
  forest: { roughness: 0.95, metalness: 0.01, detailScale: 0.8, albedoVar: 0.1, roughVar: 0.2, slopeAO: 0.05 },
  mountain: { roughness: 0.8, metalness: 0.05, detailScale: 1.1, albedoVar: 0.12, roughVar: 0.25, slopeAO: 0.3 },
  snow: { roughness: 0.9, metalness: 0.0, detailScale: 0.7, albedoVar: 0.05, roughVar: 0.1, slopeAO: 0.1 },
  water: { roughness: 0.15, metalness: 0.6, detailScale: 1.0, albedoVar: 0.05, roughVar: 0.05, slopeAO: 0.0 },
  path: { roughness: 0.85, metalness: 0.03, detailScale: 0.9, albedoVar: 0.08, roughVar: 0.15, slopeAO: 0.05 },
  rock: { roughness: 0.75, metalness: 0.08, detailScale: 1.2, albedoVar: 0.15, roughVar: 0.3, slopeAO: 0.4 },
  sand: { roughness: 0.92, metalness: 0.01, detailScale: 0.8, albedoVar: 0.05, roughVar: 0.12, slopeAO: 0.05 },
  // Added riverbed
  riverbed: { roughness: 0.65, metalness: 0.1, detailScale: 1.0, albedoVar: 0.05, roughVar: 0.15, slopeAO: 0.2 },
};

// 3. Sorting Logic (Fixes Error at line 147)
// Inside your useMemo for cellGroups:
const cellGroups: Record<MaterialKind, any[]> = {
  ground: [],
  forest: [],
  mountain: [],
  snow: [],
  water: [],
  path: [],
  rock: [],
  sand: [],
  riverbed: [], // Added riverbed list
};
