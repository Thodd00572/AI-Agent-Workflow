import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  root,
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      "/api": "http://127.0.0.1:3000",
      "/assets": "http://127.0.0.1:3000",
      "/health": "http://127.0.0.1:3000",
      "/webhooks": "http://127.0.0.1:3000",
      "/preview": "http://127.0.0.1:3000",
      "/signal-card.html": "http://127.0.0.1:3000"
    }
  },
  build: {
    outDir: resolve(root, "dist"),
    emptyOutDir: true
  }
});
