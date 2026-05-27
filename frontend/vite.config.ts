import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";
import compression from "vite-plugin-compression";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  envDir: "../",
  server: {
    host: "::",
    port: 8080,
    hmr: {
      overlay: false,
    },
    proxy: {
      "/api": {
        target: "http://127.0.0.1:5000",
        changeOrigin: true,
        secure: false,
        ws: true,
      },
      "/socket.io": {
        target: "http://127.0.0.1:5000",
        changeOrigin: true,
        secure: false,
        ws: true,
      },
    },
  },
  plugins: [
    react(),
    mode === "development" && componentTagger(),
    mode === "production" && compression({ algorithm: "gzip", ext: ".gz" }),
    mode === "production" && compression({ algorithm: "brotliCompress", ext: ".br" }),
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    // Use terser for better dead-code elimination and smaller output (~5-15% vs esbuild)
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: mode === 'production',
        drop_debugger: true,
        pure_funcs: ['console.log', 'console.info', 'console.debug'],
        passes: 2,
      },
      mangle: {
        safari10: true,
      },
      format: {
        comments: false,
      },
    },
    cssMinify: true,
    sourcemap: false,
    // Target modern browsers to avoid unnecessary polyfills
    target: 'es2020',
    // Reduce chunk size warning threshold
    chunkSizeWarningLimit: 500,
    rollupOptions: {
      output: {
        manualChunks(id) {
          // Core React runtime — always needed
          if (id.includes('react-dom') || id.includes('react/')) {
            return 'react-vendor';
          }
          // Router — needed for any navigation
          if (id.includes('react-router')) {
            return 'router';
          }
          // Framer Motion — only landing page needs it eagerly
          if (id.includes('framer-motion')) {
            return 'framer';
          }
          // Radix UI primitives — used by many components but can be separate chunk
          if (id.includes('@radix-ui')) {
            return 'radix-ui';
          }
          // TanStack Query — only authenticated pages
          if (id.includes('@tanstack')) {
            return 'tanstack';
          }
          // Lucide icons — tree-shaken but still significant
          if (id.includes('lucide-react')) {
            return 'icons';
          }
          // Date utilities — only certain pages
          if (id.includes('date-fns')) {
            return 'date-utils';
          }
          // Socket.io — only chat pages
          if (id.includes('socket.io')) {
            return 'socket';
          }
          // Charts — only admin dashboard
          if (id.includes('recharts') || id.includes('d3-')) {
            return 'charts';
          }
          // Form libraries
          if (id.includes('react-hook-form') || id.includes('@hookform') || id.includes('zod')) {
            return 'forms';
          }
          // Other vendor libs
          if (id.includes('node_modules')) {
            return 'vendor';
          }
        },
      },
    },
  },
}));
