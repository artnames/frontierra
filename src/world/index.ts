// World Parameter System - Main exports
// Re-exports all var schema, mapping, and field utilities

// Types
export type { MappingVersion, WorldArchetype, WorldPreset } from './vars/mapping_v2';

// Schema
export * from './vars/schema';

// Mixer utilities
export * from './vars/mixer';

// V1 legacy mapping
export * from './vars/mapping_v1';

// V2 new mapping with archetypes
export * from './vars/mapping_v2';

// Derived fields
export * from './fields/index';
