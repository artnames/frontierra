// useVisualSettings - React hook for visual settings state
// Settings are localStorage-only, never synced to backend

import { useState, useCallback, useEffect } from 'react';
import { 
  VisualSettings, 
  defaultVisualSettings, 
  loadVisualSettings, 
  saveVisualSettings 
} from '@/lib/visualSettings';

export function useVisualSettings() {
  const [settings, setSettings] = useState<VisualSettings>(defaultVisualSettings);
  const [isLoaded, setIsLoaded] = useState(false);
  
  // Load settings on mount
  useEffect(() => {
    const loaded = loadVisualSettings();
    setSettings(loaded);
    setIsLoaded(true);
  }, []);
  
  // Update a single setting
  const updateSetting = useCallback(<K extends keyof VisualSettings>(
    key: K, 
    value: VisualSettings[K]
  ) => {
    setSettings(prev => {
      const next = { ...prev, [key]: value };
      saveVisualSettings(next);
      return next;
    });
  }, []);
  
  // Toggle material richness specifically
  const toggleMaterialRichness = useCallback(() => {
    updateSetting('materialRichness', !settings.materialRichness);
  }, [settings.materialRichness, updateSetting]);
  
  return {
    settings,
    isLoaded,
    materialRichness: settings.materialRichness,
    toggleMaterialRichness,
    updateSetting
  };
}
