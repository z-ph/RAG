import { Locator, Page } from "@playwright/test";

/**
 * 管理后台页面 Page Object
 */
export class AdminPage {
  readonly page: Page;

  constructor(page: Page) {
    this.page = page;
  }

  async goto(): Promise<void> {
    await this.page.goto("/admin");
    await this.page.waitForLoadState("networkidle");
  }

  async gotoPrompts(): Promise<void> {
    await this.page.goto("/admin/prompts");
    await this.page.waitForLoadState("networkidle");
  }

  async gotoRegistrationCodes(): Promise<void> {
    await this.page.goto("/admin/registration-codes");
    await this.page.waitForLoadState("networkidle");
  }

  getPromptItem(key: string): Locator {
    return this.page
      .locator(".ant-list-item")
      .filter({ hasText: key })
      .first();
  }

  async editPrompt(key: string, content: string): Promise<void> {
    const item = this.getPromptItem(key);
    await item.locator("button", { hasText: "编辑" }).click();

    const modal = this.page.locator(".ant-modal-content").first();
    const textarea = modal.locator("textarea").first();
    await textarea.fill(content);
    await modal.locator("button", { hasText: "保存" }).click();
  }

  async resetPrompt(key: string): Promise<void> {
    const item = this.getPromptItem(key);
    await item.locator("button", { hasText: "重置" }).click();
    await this.page.getByRole("button", { name: "确定" }).click();
  }

  getRegistrationCodeForm(): Locator {
    return this.page.locator("form").filter({ hasText: "生成注册码" });
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
      .locator("tr")
      .filter({ hasText: code })
      .first();
    await codeItem.locator("button", { hasText: "禁用" }).click();
  }

  async deleteRegistrationCode(code: string): Promise<void> {
    const codeItem = this.page
      .locator("tr")
      .filter({ hasText: code })
      .first();
    await codeItem.locator("button", { hasText: "删除" }).click();
    await this.page.getByRole("button", { name: "确定" }).click();
  }
}
