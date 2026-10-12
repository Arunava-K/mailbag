import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// Local dev: /api proxies to the Go collector (avoids CORS).
// Production (Cloudflare Pages): set VITE_COLLECTOR_URL to
// https://collect.yourdomain.com (needs /admin CORS — phase 2 API gap).
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    proxy: {
      "/api": {
        target: "http://localhost:8080",
        changeOrigin: true,
        rewrite: (p) => p.replace(/^\/api/, ""),
      },
    },
  },
});
