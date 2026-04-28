import { Locator, Page } from "@playwright/test";

/**
 * 管理后台抽屉 Page Object（提示词管理）
 */
export class AdminPage {
  readonly page: Page;
  readonly drawer: Locator;

  readonly refreshButton: Locator;
  readonly closeButton: Locator;

  constructor(page: Page) {
    this.page = page;
    this.drawer = page.locator(".ant-drawer-body").first();
    this.refreshButton = page.getByRole("button", { name: "刷新" });
    this.closeButton = page.locator('button').filter({ has: page.locator('.anticon-close') }).first();
  }

  async close(): Promise<void> {
    await this.closeButton.click();
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

    // 等待弹窗
    const modal = this.page.locator(".ant-modal-content").first();
    const textarea = modal.locator("textarea").first();
    await textarea.fill(content);
    await modal.locator("button", { hasText: "保存" }).click();
  }

  async resetPrompt(key: string): Promise<void> {
    const item = this.getPromptItem(key);
    await item.locator("button", { hasText: "重置" }).click();
    // 确认弹窗
    await this.page.getByRole("button", { name: "确定" }).click();
  }
}
