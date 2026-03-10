import path from "node:path";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react()],
  build: {
    sourcemap: false,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes("node_modules")) return;
          if (id.includes("/react/") || id.includes("/react-dom/") || id.includes("scheduler")) return "react-vendor";
          if (id.includes("socket.io-client")) return "socket-vendor";
          if (id.includes("lucide-react")) return "icons-vendor";
          if (id.includes("@radix-ui")) return "ui-vendor";
          if (id.includes("jalaali-js")) return "jalaali-vendor";
          if (id.includes("react-day-picker") || id.includes("date-fns")) return "calendar-vendor";
          if (id.includes("clsx") || id.includes("tailwind-merge") || id.includes("class-variance-authority")) return "styling-vendor";
          if (id.includes("animate-ui") || id.includes("tailwindcss-animate")) return "motion-vendor";
        },
      },
    },
  },
  server: {
    proxy: {
      "/api": "http://127.0.0.1:8787",
      "/uploads": "http://127.0.0.1:8787",
      "/socket.io": {
        target: "http://127.0.0.1:8787",
        ws: true,
      },
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
