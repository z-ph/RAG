import { test as base, BrowserContext, Page } from "@playwright/test";

export interface TestFixtures {
  /** 匿名访客 page */
  anonymousPage: Page;
  /** 已登录管理员 page */
  adminPage: Page;
  /** 已登录普通成员 page */
  memberPage: Page;
}

const ADMIN_USER = process.env.PLAYWRIGHT_ADMIN_USER || "admin";
const ADMIN_PASSWORD = process.env.PLAYWRIGHT_ADMIN_PASSWORD || "ChangeMe123!";

/**
 * 通过 API 登录并将 cookie 注入到 BrowserContext 中。
 */
async function createAuthenticatedPage(
  context: BrowserContext,
  username: string,
  password: string
): Promise<Page> {
  const page = await context.newPage();

  // 通过 Playwright 的 request API 登录，cookie 会自动保存到 browser context
  const response = await page.request.post("/auth/login", {
    data: { username, password },
  });
  if (!response.ok()) {
    throw new Error(
      `Login API failed for ${username}: ${response.status()} ${await response.text()}`
    );
  }

  // 刷新页面以应用登录状态
  await page.goto("/");
  await page.waitForLoadState("networkidle");

  return page;
}

export const test = base.extend<TestFixtures>({
  anonymousPage: async ({ page }, use) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");
    await use(page);
  },

  adminPage: async ({ context }, use) => {
    const page = await createAuthenticatedPage(context, ADMIN_USER, ADMIN_PASSWORD);
    await use(page);
    await page.close();
  },

  memberPage: async ({ context }, use) => {
    // 成员账号通过注册码注册创建（在测试中按需创建）
    // 这里 fixture 暂时复用 admin，实际测试中可动态注册成员
    const page = await createAuthenticatedPage(context, ADMIN_USER, ADMIN_PASSWORD);
    await use(page);
    await page.close();
  },
});

export { expect } from "@playwright/test";
