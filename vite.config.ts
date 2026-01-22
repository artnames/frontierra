import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
  },

  plugins: [
    react(),
    mode === 'development' && componentTagger(),
  ].filter(Boolean),

  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },

  // Fix runtime "require is not defined" coming from Emotion / mixed CJS
  build: {
    commonjsOptions: {
      transformMixedEsModules: true,
    },
    // Manual chunk splitting to reduce main bundle size and improve JS execution time
    rollupOptions: {
      output: {
        manualChunks: {
          // Core React - small, loads first
          'vendor-react': ['react', 'react-dom', 'react-router-dom'],
          // Three.js ecosystem - largest, loads on demand
          'vendor-three': ['three'],
          'vendor-r3f': ['@react-three/fiber', '@react-three/drei', '@react-three/postprocessing'],
          // UI libraries
          'vendor-ui': ['@radix-ui/react-dialog', '@radix-ui/react-dropdown-menu', '@radix-ui/react-tabs', '@radix-ui/react-tooltip', '@radix-ui/react-popover'],
          // Animation
          'vendor-motion': ['framer-motion'],
        },
      },
    },
  },

  // Helps dev server prebundle these cleanly
  optimizeDeps: {
    include: ["@emotion/is-prop-valid"],
  },

  // If you have SSR in this project, keep this too
  ssr: {
    noExternal: ["@emotion/is-prop-valid", "@emotion/react", "@emotion/styled"],
  },
}));
