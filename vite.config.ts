import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  // Un único paquete a propósito (prototipo local); ~150 KB comprimido.
  build: { chunkSizeWarningLimit: 700 },
  server: { port: 5173, host: true },
  preview: { port: 4173, host: true },
  test: {
    include: ['src/**/*.test.ts'],
    environment: 'node',
  },
});
