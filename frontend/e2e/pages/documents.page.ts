import { Locator, Page } from "@playwright/test";

/**
 * 文档集合抽屉 Page Object
 */
export class DocumentsPage {
  readonly page: Page;
  readonly drawer: Locator;

  readonly uploadButton: Locator;
  readonly uploadFolderButton: Locator;
  readonly refreshButton: Locator;
  readonly closeButton: Locator;

  constructor(page: Page) {
    this.page = page;
    this.drawer = page.locator(".ant-drawer-body").first();
    this.uploadButton = page.getByRole("button", { name: "上传文档" });
    this.uploadFolderButton = page.getByRole("button", { name: "上传文件夹" });
    this.refreshButton = page.getByRole("button", { name: "刷新" });
    this.closeButton = page.locator('button[title="关闭文档集合"]').first();
  }

  async close(): Promise<void> {
    await this.closeButton.click();
    await this.drawer.waitFor({ state: "hidden" });
  }

  async uploadFile(filePath: string): Promise<void> {
    const fileChooserPromise = this.page.waitForEvent("filechooser");
    await this.uploadButton.click();
    const fileChooser = await fileChooserPromise;
    await fileChooser.setFiles(filePath);
  }

  getDocumentItem(filename: string): Locator {
    return this.page.locator("article").filter({ hasText: filename });
  }

  async viewDocument(filename: string): Promise<void> {
    const item = this.getDocumentItem(filename);
    await item.locator("button", { hasText: "查看" }).click();
  }

  async downloadDocument(filename: string): Promise<void> {
    const item = this.getDocumentItem(filename);
    await item.locator("button", { hasText: "下载" }).click();
  }

  async deleteDocument(filename: string): Promise<void> {
    const item = this.getDocumentItem(filename);
    await item.locator("button", { hasText: "删除" }).click();
  }

  async waitForUploadComplete(timeout = 60_000): Promise<void> {
    await this.page.waitForFunction(
      () => {
        const progress = document.querySelector(".ant-progress");
        return progress === null;
      },
      null,
      { timeout }
    );
  }
}
