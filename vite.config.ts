import { defineConfig } from "vite";

export default defineConfig({
  base: "./",
  server: { port: 3002, host: true, strictPort: true },
  preview: { port: 3002, host: true, strictPort: true },
  build: {
    rollupOptions: {
      output: { manualChunks: { phaser: ["phaser"] } },
    },
  },
});
