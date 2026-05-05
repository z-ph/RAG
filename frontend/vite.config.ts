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
    base: process.env.VITE_BASE_ROUTE || "/",
    plugins: [react(), tailwindcss()],
    server: {
      host: "0.0.0.0",
      port: 5173,
    },
    build: {
      rollupOptions: {
        output: {
          manualChunks: (id) => {
            if (id.includes("node_modules")) {
              if (id.includes("react") && (id.includes("react-dom") || id.includes("react/cjs"))) {
                return "vendor";
              }
              if (id.includes("node_modules/antd")) {
                return "antd";
              }
              if (id.includes("node_modules/@ant-design")) {
                return "icons";
              }
            }
          }
        }
      }
    }
  };
});
