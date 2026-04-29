import { defineConfig, devices } from "@playwright/test";

/**
 * Playwright E2E 测试配置
 *
 * 环境变量：
 *   PLAYWRIGHT_BASE_URL - 前端地址，默认 http://localhost:5174
 *   PLAYWRIGHT_API_URL  - 后端 API 地址，默认 http://localhost:8082
 *   PLAYWRIGHT_ADMIN_USER     - 测试管理员用户名，默认 admin
 *   PLAYWRIGHT_ADMIN_PASSWORD - 测试管理员密码，默认 ChangeMe123!
 */

const baseURL = process.env.PLAYWRIGHT_BASE_URL || "http://localhost:5178/rag";
const apiURL = process.env.PLAYWRIGHT_API_URL || "http://localhost:8081";

export default defineConfig({
  testDir: "./e2e/tests",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 1,
  workers: 1,
  reporter: [
    ["html", { open: "never" }],
    ["list"],
  ],
  use: {
    baseURL,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "on-first-retry",
    actionTimeout: 15_000,
    navigationTimeout: 15_000,
    viewport: { width: 1280, height: 720 },
  },

  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],

  expect: {
    timeout: 10_000,
  },
});


