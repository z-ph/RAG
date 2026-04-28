import { Locator, Page } from "@playwright/test";

/**
 * 用户认证抽屉 Page Object
 */
export class AuthPage {
  readonly page: Page;
  readonly drawer: Locator;

  readonly loginTab: Locator;
  readonly registerTab: Locator;
  readonly logoutButton: Locator;

  constructor(page: Page) {
    this.page = page;
    this.drawer = page.locator(".ant-drawer-body").first();
    this.loginTab = page.getByRole("tab", { name: "登录" });
    this.registerTab = page.getByRole("tab", { name: "注册码注册" });
    this.logoutButton = page.getByRole("button", { name: "退出" });
  }

  async close(): Promise<void> {
    const closeBtn = this.page.locator('button[title="关闭"]').first();
    await closeBtn.click();
  }

  async login(username: string, password: string): Promise<void> {
    await this.loginTab.click();
    await this.page.getByPlaceholder(/用户名/).fill(username);
    await this.page.getByPlaceholder(/密码/).first().fill(password);
    await this.page.getByRole("button", { name: "登录", exact: true }).click();
  }

  async register(
    username: string,
    password: string,
    registrationCode: string
  ): Promise<void> {
    await this.registerTab.click();
    await this.page.getByPlaceholder(/用户名/).fill(username);
    await this.page.getByPlaceholder(/密码/).nth(1).fill(password);
    await this.page.getByPlaceholder(/注册码/).fill(registrationCode);
    await this.page.getByRole("button", { name: "注册", exact: true }).click();
  }

  async logout(): Promise<void> {
    await this.logoutButton.click();
  }

  getRegistrationCodeForm(): Locator {
    return this.page.locator("form").filter({ hasText: "生成一次性注册码" });
  }

  async createRegistrationCode(note?: string): Promise<void> {
    const form = this.getRegistrationCodeForm();
    if (note) {
      await form.locator('input[placeholder*="备注"]').fill(note);
    }
    await form.locator('button[type="submit"]').click();
  }

  async disableRegistrationCode(code: string): Promise<void> {
    const codeItem = this.page
      .locator("article")
      .filter({ hasText: code })
      .first();
    await codeItem.locator("button", { hasText: "禁用" }).click();
  }

  async deleteRegistrationCode(code: string): Promise<void> {
    const codeItem = this.page
      .locator("article")
      .filter({ hasText: code })
      .first();
    await codeItem.locator("button", { hasText: "删除" }).click();
  }
}
