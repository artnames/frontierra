// Discovery Toast - Quiet text on new land entry
// Visual-only, no gameplay systems

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface DiscoveryToastProps {
  worldX: number;
  worldY: number;
  landName?: string;
  isOwnLand?: boolean; // If true, don't show toast (player is on their own land)
}

// Deterministic land description based on coordinates
function getLandDescription(worldX: number, worldY: number): string {
  const descriptions = [
    'You arrive somewhere unfamiliar.',
    'A new horizon stretches before you.',
    'The land feels different here.',
    'Something in the air has changed.',
    'Unfamiliar terrain greets you.',
    'The path leads to unknown places.',
    'A quiet corner of the world.',
    'The landscape shifts around you.'
  ];
  
  // Deterministic selection based on coordinates
  const index = Math.abs((worldX * 31 + worldY * 17) % descriptions.length);
  return descriptions[index];
}

export function DiscoveryToast({ worldX, worldY, landName, isOwnLand = false }: DiscoveryToastProps) {
  const [show, setShow] = useState(false);
  const [lastCoords, setLastCoords] = useState({ x: worldX, y: worldY });
  const [visitedLands] = useState<Set<string>>(() => new Set());
  
  useEffect(() => {
    // Never show toast on your own land
    if (isOwnLand) {
      setShow(false);
      return;
    }
    
    const landKey = `${worldX},${worldY}`;
    
    // Only show for new lands (first visit in session) when visiting OTHER players' lands
    if (!visitedLands.has(landKey) && (worldX !== lastCoords.x || worldY !== lastCoords.y)) {
      visitedLands.add(landKey);
      setLastCoords({ x: worldX, y: worldY });
      setShow(true);
      
      // Auto-hide after 4 seconds
      const timer = setTimeout(() => setShow(false), 4000);
      return () => clearTimeout(timer);
    }
  }, [worldX, worldY, lastCoords, visitedLands, isOwnLand]);
  
  const description = getLandDescription(worldX, worldY);
  
  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
          className="absolute bottom-20 left-1/2 -translate-x-1/2 z-20 pointer-events-none"
        >
          <div className="text-center">
            <p className="text-sm text-foreground/80 font-light italic">
              {description}
            </p>
            {landName && (
              <p className="text-xs text-muted-foreground mt-1 uppercase tracking-widest">
                {landName}
              </p>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
