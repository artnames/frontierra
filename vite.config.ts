import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
  },

  plugins: [react(), mode === "development" && componentTagger()].filter(Boolean),

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
  },

  build: {
    sourcemap: true,
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
