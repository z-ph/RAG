import { resolve } from "node:path";
import { config as loadDotenv } from "dotenv";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
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
    plugins: [react(), tailwindcss()],
    server: {
      host: "0.0.0.0",
      port: 5173,
      proxy: {
        [process.env.VITE_API_BASE_URL || "/api"]: {
          target: process.env.VITE_PROXY_TARGET || "http://localhost:8080",
          changeOrigin: true
        }
      }
    }
  };
});
