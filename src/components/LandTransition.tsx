// Land Transition Effect - Soft fade between lands
// Visual-only polish

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface LandTransitionProps {
  isTransitioning: boolean;
  children?: React.ReactNode;
}

export function LandTransition({ isTransitioning, children }: LandTransitionProps) {
  const [showFade, setShowFade] = useState(false);
  
  useEffect(() => {
    if (isTransitioning) {
      setShowFade(true);
    } else {
      // Keep fade visible briefly after transition completes
      const timer = setTimeout(() => setShowFade(false), 300);
      return () => clearTimeout(timer);
    }
  }, [isTransitioning]);
  
  return (
    <>
      {children}
      <AnimatePresence>
        {showFade && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="absolute inset-0 z-40 pointer-events-none bg-background/60 backdrop-blur-sm"
          />
        )}
      </AnimatePresence>
    </>
  );
}
