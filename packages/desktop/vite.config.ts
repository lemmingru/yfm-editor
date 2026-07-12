import {defineConfig} from 'vite';
import react from '@vitejs/plugin-react';

// The Tauri core (src-tauri) provides file access via the read_file/write_file
// commands, so the dev server only needs to serve the React app. Tauri loads
// this fixed URL in the native WKWebView window.
export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: './src/test/setup.ts',
  },
  // Prevent Vite from obscuring Rust compile errors.
  clearScreen: false,
  server: {
    port: 5173,
    strictPort: true,
  },
});
