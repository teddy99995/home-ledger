import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({ 
      registerType: 'autoUpdate',
      devOptions: {
        enabled: true
      }
    })
  ],
  build: {
    // 解決 Chunk 大小警告，將門檻提高到 1000kB
    chunkSizeWarningLimit: 1000,
    rollupOptions: {
      output: {
        // 自動將 node_modules 中的第三方套件拆分為獨立的 vendor chunk
        manualChunks(id) {
          if (id.includes('node_modules')) {
            return 'vendor';
          }
        }
      }
    }
  }
});