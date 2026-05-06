import { Locator, Page } from "@playwright/test";

/**
 * 文档控制台 / 文档详情页面 Page Object
 */
export class DocumentsPage {
  readonly page: Page;
  readonly pageTitle: Locator;
  readonly refreshButton: Locator;
  readonly uploadButton: Locator;
  readonly uploadFolderButton: Locator;
  readonly backButton: Locator;

  constructor(page: Page) {
    this.page = page;
    this.pageTitle = page.getByRole("heading", { level: 2 });
    this.refreshButton = page.getByRole("button", { name: "刷新" });
    this.uploadButton = page.getByRole("button", { name: "上传文档" });
    this.uploadFolderButton = page.getByRole("button", { name: "上传文件夹" });
    this.backButton = page.locator('button[title="返回对话"], button[title="返回文档控制台"]').first();
  }

  async waitForConsole(): Promise<void> {
    await this.page.waitForURL("**/documents");
    await this.page.getByText("文档控制台").waitFor();
  }

  async waitForDetail(documentId?: string): Promise<void> {
    if (documentId) {
      await this.page.waitForURL(`**/documents/${documentId}`);
    } else {
      await this.page.waitForURL(/\/documents\/[^/]+$/);
    }
    await this.page.getByText("文档详情").waitFor();
  }

  async goBack(): Promise<void> {
    await this.backButton.click();
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
    await item.getByRole("button", { name: "查看" }).click();
  }

  async downloadDocument(filename: string): Promise<void> {
    const item = this.getDocumentItem(filename);
    await item.getByRole("button", { name: "下载" }).click();
  }

  async deleteDocument(filename: string): Promise<void> {
    const item = this.getDocumentItem(filename);
    await item.getByRole("button", { name: "删除" }).click();
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
