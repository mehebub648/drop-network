import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig } from 'vite';

export default defineConfig(() => {
  const usePolling = process.env.VITE_USE_POLLING === 'true' || process.env.CHOKIDAR_USE_POLLING === 'true';

  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    build: {
      rollupOptions: {
        output: {
          manualChunks(id) {
            const moduleId = id.replaceAll('\\', '/');
            if (
              moduleId.includes('/node_modules/react/') ||
              moduleId.includes('/node_modules/react-dom/') ||
              moduleId.includes('/node_modules/react-router/') ||
              moduleId.includes('/node_modules/scheduler/')
            ) return 'react-vendor';
            if (
              moduleId.includes('/node_modules/motion/') ||
              moduleId.includes('/node_modules/motion-dom/') ||
              moduleId.includes('/node_modules/motion-utils/')
            ) return 'motion-vendor';
            if (moduleId.includes('/node_modules/lucide-react/')) return 'icons-vendor';
            if (moduleId.includes('/node_modules/date-fns/')) return 'date-vendor';
          },
        },
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      hmr: process.env.DISABLE_HMR !== 'true',
      watch: usePolling
        ? {
            usePolling: true,
            interval: 300,
          }
        : undefined,
    },
  };
});
