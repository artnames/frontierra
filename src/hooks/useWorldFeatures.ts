// World Features Hook
// Manages shared discovery naming (mountains, rivers, regions)

import { useState, useEffect, useCallback } from 'react';
import { PlayerLand } from '@/lib/multiplayer/types';
import {
  getFeaturesForLand,
  getAllFeatures,
  nameFeature,
  WorldFeature
} from '@/lib/multiplayer/socialRegistry';

export type FeatureType = 'peak' | 'river' | 'region' | 'landmark';

interface UseWorldFeaturesOptions {
  playerId: string | null;
  currentLand: PlayerLand | null;
  enabled?: boolean;
}

export function useWorldFeatures({
  playerId,
  currentLand,
  enabled = true
}: UseWorldFeaturesOptions) {
  const [landFeatures, setLandFeatures] = useState<WorldFeature[]>([]);
  const [allFeatures, setAllFeatures] = useState<WorldFeature[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Fetch features for current land
  useEffect(() => {
    if (!currentLand || !enabled) {
      setLandFeatures([]);
      return;
    }

    setIsLoading(true);
    getFeaturesForLand(currentLand.pos_x, currentLand.pos_y)
      .then(setLandFeatures)
      .finally(() => setIsLoading(false));
  }, [currentLand?.pos_x, currentLand?.pos_y, enabled]);

  // Fetch all features in World A (for map display)
  useEffect(() => {
    if (!enabled) return;
    getAllFeatures().then(setAllFeatures);
  }, [enabled]);

  // Check if a feature type is already named at current land
  const isFeatureNamed = useCallback((featureType: FeatureType): boolean => {
    return landFeatures.some(f => f.feature_type === featureType);
  }, [landFeatures]);

  // Get feature name by type at current land
  const getFeatureName = useCallback((featureType: FeatureType): string | null => {
    const feature = landFeatures.find(f => f.feature_type === featureType);
    return feature?.name ?? null;
  }, [landFeatures]);

  // Name a feature (one-time only)
  const createFeatureName = useCallback(async (
    featureType: FeatureType,
    name: string
  ): Promise<boolean> => {
    if (!playerId || !currentLand) return false;
    
    // Check if already named
    if (isFeatureNamed(featureType)) return false;

    const feature = await nameFeature(
      playerId,
      currentLand.pos_x,
      currentLand.pos_y,
      featureType,
      name
    );

    if (feature) {
      setLandFeatures(prev => [...prev, feature]);
      setAllFeatures(prev => [...prev, feature]);
      return true;
    }

    return false;
  }, [playerId, currentLand, isFeatureNamed]);

  // Get features by type across all of World A
  const getFeaturesByType = useCallback((featureType: FeatureType): WorldFeature[] => {
    return allFeatures.filter(f => f.feature_type === featureType);
  }, [allFeatures]);

  // Build a feature map for the World A grid
  const featureMap = new Map<string, WorldFeature[]>();
  for (const feature of allFeatures) {
    const key = `${feature.world_x},${feature.world_y}`;
    const existing = featureMap.get(key) || [];
    featureMap.set(key, [...existing, feature]);
  }

  return {
    landFeatures,
    allFeatures,
    featureMap,
    isLoading,
    isFeatureNamed,
    getFeatureName,
    createFeatureName,
    getFeaturesByType
  };
}
