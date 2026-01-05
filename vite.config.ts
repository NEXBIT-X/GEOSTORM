import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { viteStaticCopy } from 'vite-plugin-static-copy';

// Cesium integration: copy Workers/Assets/Widgets so they can be served from /cesium
const cesiumCopyTargets = [
  { src: 'node_modules/cesium/Build/Cesium/Workers', dest: 'cesium' },
  { src: 'node_modules/cesium/Build/Cesium/ThirdParty', dest: 'cesium' },
  { src: 'node_modules/cesium/Build/Cesium/Assets', dest: 'cesium' },
  { src: 'node_modules/cesium/Build/Cesium/Widgets', dest: 'cesium' }
];

// https://vitejs.dev/config/
export default defineConfig({
  define: {
    CESIUM_BASE_URL: JSON.stringify('/cesium')
  },
  plugins: [
    react(),
    viteStaticCopy({ targets: cesiumCopyTargets })
  ],
  optimizeDeps: {
    exclude: ['lucide-react'],
  },
});
