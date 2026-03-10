import path from "node:path";
import react from "@vitejs/plugin-react";
import { defineConfig, loadEnv } from "vite";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const apiBase = String(env.VITE_API_BASE || "").trim();
  const devApiProxy = String(env.VITE_DEV_API_PROXY || "http://127.0.0.1:8787").trim();
  const useDevProxy = !apiBase && /^https?:\/\//i.test(devApiProxy);

  return {
    root: __dirname,
    plugins: [react()],
    css: {
      postcss: path.resolve(__dirname, "postcss.config.js"),
    },
    build: {
      outDir: path.resolve(__dirname, "dist"),
      emptyOutDir: true,
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
    server: useDevProxy
      ? {
          proxy: {
            "/api": devApiProxy,
            "/uploads": devApiProxy,
            "/socket.io": {
              target: devApiProxy,
              ws: true,
            },
          },
        }
      : undefined,
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "src"),
      },
    },
  };
});
