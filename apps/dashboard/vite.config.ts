import path from "path";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// Local dev: /api proxies to the Go API (avoids CORS).
// Production (Dokploy): VITE_MAILBAG_URL is baked in at build time.
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: { "@": path.resolve(__dirname, "src") },
  },
  server: {
    port: 5173,
    proxy: {
      "/api": {
        target: "http://localhost:8080",
        changeOrigin: true,
        rewrite: (p) => p.replace(/^\/api/, ""),
      },
      "/v1": {
        target: "http://localhost:8080",
        changeOrigin: true,
      },
    },
  },
});
