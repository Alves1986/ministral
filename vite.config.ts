
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { fileURLToPath } from 'url';
import { VitePWA } from 'vite-plugin-pwa';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Leia a versão do package.json para usar como cache estável
const pkg = JSON.parse(fs.readFileSync(path.resolve(__dirname, './package.json'), 'utf-8'));

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, (process as any).cwd(), '');

  return {
    plugins: [
      react(),
      VitePWA({
        strategies: 'generateSW',
        registerType: 'autoUpdate',
        injectRegister: 'auto',
        manifest: false, // Use existing manifest.json in root
        workbox: {
          globPatterns: ['**/*.{js,css,html,ico,png,svg,json}'],
          cleanupOutdatedCaches: true,
          clientsClaim: true,
          skipWaiting: true
        }
      })
    ],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './'),
        'querystring': 'querystring-es3'
      },
    },
    optimizeDeps: {
      exclude: ['canvg', 'jspdf']
    },
    envPrefix: ['VITE_', 'NEXT_PUBLIC_'],
    define: {
      'global': 'globalThis',
      '__SUPABASE_URL__': JSON.stringify(env.VITE_SUPABASE_URL || env.NEXT_PUBLIC_SUPABASE_URL || ''),
      '__SUPABASE_KEY__': JSON.stringify(env.VITE_SUPABASE_KEY || env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''),
      'process.env.API_KEY': JSON.stringify(env.VITE_GEMINI_API_KEY || env.API_KEY || ''),
      'process.env.GEMINI_API_KEY': JSON.stringify(env.VITE_GEMINI_API_KEY || ''),
      '__SW_CACHE_VERSION__': JSON.stringify(`v${pkg.version}`),
    },
    build: {
      outDir: 'dist',
      rollupOptions: {
        output: {
          manualChunks: {
            'react-vendor': ['react', 'react-dom'],
            'query-vendor': ['@tanstack/react-query'],
            'supabase-vendor': ['@supabase/supabase-js'],
            'ui-vendor': ['lucide-react']
          }
        }
      }
    },
    publicDir: 'public',
    test: {
        globals: true,
        environment: 'jsdom',
        setupFiles: './tests/setup.ts',
    }
  };
});
