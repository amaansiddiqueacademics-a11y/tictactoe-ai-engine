import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const api = process.env.API_PROXY_TARGET || 'http://localhost:3001';

export default defineConfig({
  plugins: [react()],
  // Relative asset paths, so the static build also works from a sub-folder (e.g. GitHub Pages).
  base: './',
  server: {
    port: 5173,
    proxy: {
      '/api': api,
      '/health': api,
      '/socket.io': { target: api, ws: true }
    }
  }
});
