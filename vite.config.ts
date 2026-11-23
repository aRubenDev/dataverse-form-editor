import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'node:path';
const root = import.meta.dirname;

export default defineConfig({
  plugins: [react()],
  server: { port: 5173, strictPort: true },
  build: {
    rollupOptions: {
      // redirect.html es la página puente que MSAL v5 necesita para el login con popup
      input: {
        main: resolve(root, 'index.html'),
        redirect: resolve(root, 'redirect.html'),
      },
    },
  },
  test: { environment: 'jsdom' },
});
