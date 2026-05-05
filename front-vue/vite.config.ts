import { resolve } from "node:path";
import { config as loadDotenv } from "dotenv";
import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
import tailwindcss from "@tailwindcss/vite";

function loadNodeEnv(mode: string) {
  const envFiles = [
    ".env",
    ".env.local",
    `.env.${mode}`,
    `.env.${mode}.local`
  ];

  for (const file of envFiles) {
    loadDotenv({
      path: resolve(process.cwd(), file),
      override: true
    });
  }
}

export default defineConfig(({ mode }) => {
  loadNodeEnv(mode);

  return {
    base: process.env.VITE_BASE_ROUTE || "/",
    plugins: [vue(), tailwindcss()],
    server: {
      host: "0.0.0.0",
      port: 5174,
      proxy: {
        [process.env.VITE_API_BASE_URL || "/api"]: {
          target: process.env.VITE_BACKEND_URL || "http://localhost:8080",
          changeOrigin: true,
          rewrite: (path) => path.replace(new RegExp(`^${process.env.VITE_API_BASE_URL || "/api"}`), ""),
          configure: (proxy) => {
            proxy.on("proxyRes", (proxyRes, _req, res) => {
              const contentType = proxyRes.headers["content-type"];
              if (typeof contentType === "string" && contentType.includes("text/event-stream")) {
                res.setHeader("Cache-Control", "no-cache");
                res.setHeader("X-Accel-Buffering", "no");
                proxyRes.headers["cache-control"] = "no-cache";
                proxyRes.headers["x-accel-buffering"] = "no";
              }
            });
          }
        }
      }
    },
    build: {
      rollupOptions: {
        output: {
          manualChunks(id: string) {
            if (id.includes("node_modules")) {
              if (id.includes("vue") || id.includes("vue-router")) {
                return "vendor";
              }
              if (id.includes("node_modules/ant-design-vue")) {
                return "antd";
              }
              if (id.includes("node_modules/@ant-design/icons-vue")) {
                return "icons";
              }
            }
          }
        }
      }
    }
  };
});
