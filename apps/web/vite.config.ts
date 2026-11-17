import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// MISSION_LAB_BASE is set only by the GitHub Pages workflow (ML-TASK-042), where the app is served
// from /<repo>/; local dev, preview and the e2e suite keep the root base.
export default defineConfig({
  base: process.env.MISSION_LAB_BASE ?? '/',
  plugins: [react(), tailwindcss()],
});
