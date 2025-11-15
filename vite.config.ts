import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    return {
      server: {
        port: 3000,
        host: '0.0.0.0',
      },
      plugins: [react()],
      define: {
        'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
        'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY)
      },
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      },
      // Produce a content-hashed client bundle placed under dist/public
      build: {
        outDir: 'dist',
        rollupOptions: {
          output: {
            // Put the main entry file where the server expects it: dist/public/app.[hash].js
            entryFileNames: 'public/app.[hash].js',
            chunkFileNames: 'public/chunk-[name].[hash].js',
            assetFileNames: 'public/[name].[hash].[ext]'
          }
        }
      }
    };
});
