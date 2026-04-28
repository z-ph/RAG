import { test, expect } from "../fixtures";
import { ChatPage } from "../pages/chat.page";
import { AuthPage } from "../pages/auth.page";
import {
  createRegistrationCode,
  deleteRegistrationCode,
} from "../utils/api";

const ADMIN_USER = process.env.PLAYWRIGHT_ADMIN_USER || "admin";
const ADMIN_PASSWORD = process.env.PLAYWRIGHT_ADMIN_PASSWORD || "ChangeMe123!";

async function verifyAuthStatus(page: import("@playwright/test").Page, expectedAuthenticated: boolean, expectedUsername?: string) {
  const response = await page.request.get("/api/auth/me");
  const status = await response.json();
  expect(status.authenticated).toBe(expectedAuthenticated);
  if (expectedUsername) {
    expect(status.user?.username).toBe(expectedUsername);
  }
}

test.describe("认证交互", () => {
  test("匿名访客首页显示登录按钮", async ({ anonymousPage }) => {
    const chat = new ChatPage(anonymousPage);
    await chat.goto();

    await expect(chat.authButton).toBeVisible();
    await expect(chat.documentsButton).toBeVisible();
    await expect(chat.promptInput).toBeVisible();
  });

  test("管理员登录流程", async ({ anonymousPage }) => {
    const chat = new ChatPage(anonymousPage);
    const auth = new AuthPage(anonymousPage);

    await chat.goto();
    await chat.openAuth();

    await auth.login(ADMIN_USER, ADMIN_PASSWORD);

    // 登录成功后抽屉应自动关闭或显示已登录状态
    await expect(
      anonymousPage.getByText(ADMIN_USER).first()
    ).toBeVisible();

    // 验证后端 session 已建立
    await verifyAuthStatus(anonymousPage, true, ADMIN_USER);
  });

  test("登录后登出流程", async ({ adminPage }) => {
    const chat = new ChatPage(adminPage);
    const auth = new AuthPage(adminPage);

    await chat.goto();
    await chat.openAuth();
    await auth.logout();

    // 登出后应显示登录按钮
    await expect(chat.authButton).toContainText("用户登录");
  });

  test("注册码注册流程", async ({ anonymousPage }) => {
    const chat = new ChatPage(anonymousPage);
    const auth = new AuthPage(anonymousPage);

    // 管理员先创建一个注册码（通过 API）
    const regCode = await createRegistrationCode("e2e-test-register");
    const testUsername = `e2euser_${Date.now()}`;

    try {
      await chat.goto();
      await chat.openAuth();
      await auth.register(testUsername, "TestPass123!", regCode.code);

      // 注册成功后应显示已登录状态
      await expect(
        anonymousPage.getByText(testUsername).first()
      ).toBeVisible();

      await verifyAuthStatus(anonymousPage, true, testUsername);
    } finally {
      // 清理：尝试删除注册码（即使已使用也尝试）
      try {
        await deleteRegistrationCode(regCode.id);
      } catch {
        // ignore cleanup errors
      }
    }
  });

  test("管理员可看到管理按钮", async ({ adminPage }) => {
    const chat = new ChatPage(adminPage);
    await chat.goto();
    await expect(chat.adminButton).toBeVisible();
  });

  test("普通成员看不到管理按钮", async ({ anonymousPage }) => {
    // 注册一个成员账号
    const regCode = await createRegistrationCode("e2e-test-member");
    const testUsername = `member_${Date.now()}`;

    try {
      const chat = new ChatPage(anonymousPage);
      const auth = new AuthPage(anonymousPage);

      await chat.goto();
      await chat.openAuth();
      await auth.register(testUsername, "TestPass123!", regCode.code);

      // 成员登录后不应看到管理按钮
      await expect(chat.adminButton).not.toBeVisible();
    } finally {
      try {
        await deleteRegistrationCode(regCode.id);
      } catch {
        // ignore
      }
    }
  });
});
