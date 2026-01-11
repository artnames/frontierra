// World Variable Schema - Defines all macro and micro parameters
// This is the central definition for all world generation variables

// ============================================
// VARIABLE GROUPS
// ============================================

export type VarGroup = 
  | 'structure'     // Topology, coastlines, mountains
  | 'hydrology'     // Water, rivers, wetness
  | 'biome'         // Vegetation, forests, temperature
  | 'detail'        // Surface roughness, path wear
  | 'placement'     // Objects, landmarks, POIs
  | 'style';        // Visual expression, colors

// ============================================
// VARIABLE DEFINITION
// ============================================

export interface VarDefinition {
  id: string;
  index: number;          // Position in the vars array
  label: string;
  shortLabel: string;
  group: VarGroup;
  min: number;
  max: number;
  default: number;
  step: number;
  isMacro: boolean;       // true = user-facing, false = advanced
  affects: string[];      // What subsystems this var influences
  description?: string;
}

// ============================================
// MACRO VARIABLES (7-10) - User-facing front panel
// ============================================

export const MACRO_VARS: VarDefinition[] = [
  {
    id: 'landmark_type',
    index: 0,
    label: 'Landmark Archetype',
    shortLabel: 'Landmark',
    group: 'placement',
    min: 0,
    max: 100,
    default: 50,
    step: 1,
    isMacro: true,
    affects: ['landmarks', 'poi'],
    description: 'Type of special structures and objects'
  },
  {
    id: 'landmark_x',
    index: 1,
    label: 'Landmark X Position',
    shortLabel: 'LM X',
    group: 'placement',
    min: 0,
    max: 100,
    default: 50,
    step: 1,
    isMacro: false, // Hidden by default
    affects: ['landmarks'],
    description: 'Horizontal placement bias for landmarks'
  },
  {
    id: 'landmark_y',
    index: 2,
    label: 'Landmark Y Position',
    shortLabel: 'LM Y',
    group: 'placement',
    min: 0,
    max: 100,
    default: 50,
    step: 1,
    isMacro: false, // Hidden by default
    affects: ['landmarks'],
    description: 'Vertical placement bias for landmarks'
  },
  {
    id: 'terrain_scale',
    index: 3,
    label: 'Continent Scale',
    shortLabel: 'Scale',
    group: 'structure',
    min: 0,
    max: 100,
    default: 50,
    step: 1,
    isMacro: true,
    affects: ['topology', 'mountains', 'coastlines'],
    description: 'Size of continental features'
  },
  {
    id: 'water_level',
    index: 4,
    label: 'Sea Level',
    shortLabel: 'Sea',
    group: 'hydrology',
    min: 0,
    max: 100,
    default: 50,
    step: 1,
    isMacro: true,
    affects: ['water', 'coastlines', 'wetness'],
    description: 'Global water height - lower = more land'
  },
  {
    id: 'forest_density',
    index: 5,
    label: 'Forest Coverage',
    shortLabel: 'Forest',
    group: 'biome',
    min: 0,
    max: 100,
    default: 50,
    step: 1,
    isMacro: true,
    affects: ['vegetation', 'biomes'],
    description: 'Amount of forested areas'
  },
  {
    id: 'mountain_height',
    index: 6,
    label: 'Mountain Height',
    shortLabel: 'Peaks',
    group: 'structure',
    min: 0,
    max: 100,
    default: 50,
    step: 1,
    isMacro: true,
    affects: ['mountains', 'elevation', 'snow'],
    description: 'How tall mountains rise'
  },
  {
    id: 'path_density',
    index: 7,
    label: 'Trail Network',
    shortLabel: 'Trails',
    group: 'detail',
    min: 0,
    max: 100,
    default: 50,
    step: 1,
    isMacro: true,
    affects: ['paths', 'bridges', 'navigation'],
    description: 'Density of walkable paths'
  },
  {
    id: 'roughness',
    index: 8,
    label: 'Surface Roughness',
    shortLabel: 'Rough',
    group: 'detail',
    min: 0,
    max: 100,
    default: 50,
    step: 1,
    isMacro: true,
    affects: ['terrain', 'texture'],
    description: 'Ground bumpiness and detail'
  },
  {
    id: 'mountain_density',
    index: 9,
    label: 'Mountain Coverage',
    shortLabel: 'MtnArea',
    group: 'structure',
    min: 0,
    max: 100,
    default: 50,
    step: 1,
    isMacro: true,
    affects: ['mountains', 'topology'],
    description: 'How much area mountains cover'
  }
];

// ============================================
// MICRO VARIABLES (15-40) - Advanced/hidden controls
// These are derived from seed + macro vars unless overridden
// ============================================

export const MICRO_VARS: VarDefinition[] = [
  // Hydrology micro vars (indices 10-14)
  {
    id: 'river_threshold',
    index: 10,
    label: 'River Threshold',
    shortLabel: 'RiverThr',
    group: 'hydrology',
    min: 0,
    max: 100,
    default: 50,
    step: 1,
    isMacro: false,
    affects: ['rivers'],
    description: 'How easily rivers form'
  },
  {
    id: 'river_width',
    index: 11,
    label: 'River Width',
    shortLabel: 'RiverW',
    group: 'hydrology',
    min: 0,
    max: 100,
    default: 50,
    step: 1,
    isMacro: false,
    affects: ['rivers'],
    description: 'Average width of rivers'
  },
  {
    id: 'lake_tendency',
    index: 12,
    label: 'Lake Formation',
    shortLabel: 'Lakes',
    group: 'hydrology',
    min: 0,
    max: 100,
    default: 50,
    step: 1,
    isMacro: false,
    affects: ['water', 'wetness'],
    description: 'Likelihood of inland lakes'
  },
  {
    id: 'wetland_spread',
    index: 13,
    label: 'Wetland Spread',
    shortLabel: 'Wetland',
    group: 'hydrology',
    min: 0,
    max: 100,
    default: 50,
    step: 1,
    isMacro: false,
    affects: ['wetness', 'biomes'],
    description: 'How far moisture spreads from water'
  },
  {
    id: 'erosion_strength',
    index: 14,
    label: 'Erosion Strength',
    shortLabel: 'Erosion',
    group: 'structure',
    min: 0,
    max: 100,
    default: 50,
    step: 1,
    isMacro: false,
    affects: ['terrain', 'rivers'],
    description: 'How much water carves the land'
  },
  
  // Structure micro vars (indices 15-19)
  {
    id: 'coastline_complexity',
    index: 15,
    label: 'Coastline Complexity',
    shortLabel: 'Coast',
    group: 'structure',
    min: 0,
    max: 100,
    default: 50,
    step: 1,
    isMacro: false,
    affects: ['coastlines', 'topology'],
    description: 'How jagged coastlines are'
  },
  {
    id: 'cliff_frequency',
    index: 16,
    label: 'Cliff Frequency',
    shortLabel: 'Cliffs',
    group: 'structure',
    min: 0,
    max: 100,
    default: 50,
    step: 1,
    isMacro: false,
    affects: ['terrain', 'mountains'],
    description: 'How often steep cliffs form'
  },
  {
    id: 'plateau_size',
    index: 17,
    label: 'Plateau Size',
    shortLabel: 'Plateau',
    group: 'structure',
    min: 0,
    max: 100,
    default: 50,
    step: 1,
    isMacro: false,
    affects: ['topology'],
    description: 'Size of flat elevated areas'
  },
  {
    id: 'valley_depth',
    index: 18,
    label: 'Valley Depth',
    shortLabel: 'Valley',
    group: 'structure',
    min: 0,
    max: 100,
    default: 50,
    step: 1,
    isMacro: false,
    affects: ['topology', 'rivers'],
    description: 'How deep valleys cut'
  },
  {
    id: 'ridge_sharpness',
    index: 19,
    label: 'Ridge Sharpness',
    shortLabel: 'Ridge',
    group: 'structure',
    min: 0,
    max: 100,
    default: 50,
    step: 1,
    isMacro: false,
    affects: ['mountains'],
    description: 'How sharp mountain ridges are'
  },
  
  // Biome micro vars (indices 20-24)
  {
    id: 'biome_patchiness',
    index: 20,
    label: 'Biome Patchiness',
    shortLabel: 'Patchy',
    group: 'biome',
    min: 0,
    max: 100,
    default: 50,
    step: 1,
    isMacro: false,
    affects: ['biomes', 'vegetation'],
    description: 'How fragmented biome regions are'
  },
  {
    id: 'tree_variety',
    index: 21,
    label: 'Tree Species Variety',
    shortLabel: 'TreeVar',
    group: 'biome',
    min: 0,
    max: 100,
    default: 50,
    step: 1,
    isMacro: false,
    affects: ['vegetation'],
    description: 'Diversity of tree species'
  },
  {
    id: 'undergrowth_density',
    index: 22,
    label: 'Undergrowth Density',
    shortLabel: 'Under',
    group: 'biome',
    min: 0,
    max: 100,
    default: 50,
    step: 1,
    isMacro: false,
    affects: ['vegetation'],
    description: 'Amount of bushes and ferns'
  },
  {
    id: 'meadow_frequency',
    index: 23,
    label: 'Meadow Frequency',
    shortLabel: 'Meadow',
    group: 'biome',
    min: 0,
    max: 100,
    default: 50,
    step: 1,
    isMacro: false,
    affects: ['biomes'],
    description: 'How often open meadows appear'
  },
  {
    id: 'temperature_variance',
    index: 24,
    label: 'Temperature Variance',
    shortLabel: 'TempVar',
    group: 'biome',
    min: 0,
    max: 100,
    default: 50,
    step: 1,
    isMacro: false,
    affects: ['temperature', 'snow'],
    description: 'Range of temperature zones'
  },
  
  // Detail micro vars (indices 25-29)
  {
    id: 'path_branching',
    index: 25,
    label: 'Trail Branching',
    shortLabel: 'Branch',
    group: 'detail',
    min: 0,
    max: 100,
    default: 50,
    step: 1,
    isMacro: false,
    affects: ['paths'],
    description: 'How much trails split'
  },
  {
    id: 'path_curvature',
    index: 26,
    label: 'Trail Curvature',
    shortLabel: 'Curve',
    group: 'detail',
    min: 0,
    max: 100,
    default: 50,
    step: 1,
    isMacro: false,
    affects: ['paths'],
    description: 'How winding trails are'
  },
  {
    id: 'rock_frequency',
    index: 27,
    label: 'Rock Frequency',
    shortLabel: 'Rocks',
    group: 'detail',
    min: 0,
    max: 100,
    default: 50,
    step: 1,
    isMacro: false,
    affects: ['terrain'],
    description: 'Amount of rock formations'
  },
  {
    id: 'micro_elevation',
    index: 28,
    label: 'Micro Elevation',
    shortLabel: 'MicroE',
    group: 'detail',
    min: 0,
    max: 100,
    default: 50,
    step: 1,
    isMacro: false,
    affects: ['terrain'],
    description: 'Small-scale height variations'
  },
  {
    id: 'surface_texture',
    index: 29,
    label: 'Surface Texture',
    shortLabel: 'Texture',
    group: 'detail',
    min: 0,
    max: 100,
    default: 50,
    step: 1,
    isMacro: false,
    affects: ['terrain'],
    description: 'Visual surface detail level'
  },
  
  // Placement micro vars (indices 30-34)
  {
    id: 'poi_density',
    index: 30,
    label: 'POI Density',
    shortLabel: 'POI',
    group: 'placement',
    min: 0,
    max: 100,
    default: 50,
    step: 1,
    isMacro: false,
    affects: ['poi', 'landmarks'],
    description: 'How many points of interest'
  },
  {
    id: 'poi_clustering',
    index: 31,
    label: 'POI Clustering',
    shortLabel: 'POIClust',
    group: 'placement',
    min: 0,
    max: 100,
    default: 50,
    step: 1,
    isMacro: false,
    affects: ['poi'],
    description: 'Whether POIs group together'
  },
  {
    id: 'ruin_frequency',
    index: 32,
    label: 'Ruin Frequency',
    shortLabel: 'Ruins',
    group: 'placement',
    min: 0,
    max: 100,
    default: 50,
    step: 1,
    isMacro: false,
    affects: ['landmarks'],
    description: 'Amount of ancient structures'
  },
  {
    id: 'resource_density',
    index: 33,
    label: 'Resource Density',
    shortLabel: 'Resource',
    group: 'placement',
    min: 0,
    max: 100,
    default: 50,
    step: 1,
    isMacro: false,
    affects: ['resources'],
    description: 'Density of collectible resources'
  },
  {
    id: 'spawn_safety',
    index: 34,
    label: 'Spawn Safety',
    shortLabel: 'Safety',
    group: 'placement',
    min: 0,
    max: 100,
    default: 50,
    step: 1,
    isMacro: false,
    affects: ['spawn'],
    description: 'How safe spawn areas are'
  }
];

// ============================================
// COMBINED VAR ARRAY
// ============================================

export const ALL_VARS: VarDefinition[] = [...MACRO_VARS, ...MICRO_VARS];
export const TOTAL_VAR_COUNT = ALL_VARS.length; // 35 total

// Get macro vars only (for UI)
export function getMacroVars(): VarDefinition[] {
  return ALL_VARS.filter(v => v.isMacro);
}

// Get micro vars only (for advanced panel)
export function getMicroVars(): VarDefinition[] {
  return ALL_VARS.filter(v => !v.isMacro);
}

// Get vars by group
export function getVarsByGroup(group: VarGroup): VarDefinition[] {
  return ALL_VARS.filter(v => v.group === group);
}

// Get default values array
export function getDefaultVars(): number[] {
  return ALL_VARS.map(v => v.default);
}

// Validate and clamp vars
export function clampVars(vars: number[]): number[] {
  return ALL_VARS.map((def, i) => {
    const value = vars[i] ?? def.default;
    return Math.max(def.min, Math.min(def.max, value));
  });
}

// ============================================
// LABELS (backwards compatible)
// ============================================

export const VAR_LABELS_V2: string[] = ALL_VARS.map(v => v.label);
