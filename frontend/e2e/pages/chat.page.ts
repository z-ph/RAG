import { Locator, Page } from "@playwright/test";

/**
 * 主聊天页面 Page Object
 */
export class ChatPage {
  readonly page: Page;

  // 顶部工具栏
  readonly documentsButton: Locator;
  readonly maxResultsInput: Locator;
  readonly clearConversationButton: Locator;
  readonly adminButton: Locator;
  readonly authButton: Locator;

  // 消息区域
  readonly messagesContainer: Locator;

  // 底部输入区
  readonly imageUploadButton: Locator;
  readonly promptInput: Locator;
  readonly sendButton: Locator;

  constructor(page: Page) {
    this.page = page;

    this.documentsButton = page.getByRole("button", { name: "文档集合" });
    this.maxResultsInput = page.locator('input[type="number"]');
    this.clearConversationButton = page.getByRole("button", { name: "清空对话" });
    this.adminButton = page.getByRole("button", { name: "管理" });
    this.authButton = page.getByRole("button", { name: /用户登录|已登录/ });

    this.messagesContainer = page.locator("section").filter({ has: page.locator("article") }).first();

    this.imageUploadButton = page.locator('input[type="file"]').first();
    this.promptInput = page.locator('input[placeholder*="问题"]').first();
    this.sendButton = page.locator('button').filter({ has: page.locator('.anticon-send') }).first();
  }

  async goto(): Promise<void> {
    await this.page.goto("/");
    await this.page.waitForLoadState("networkidle");
  }

  async sendMessage(text: string): Promise<void> {
    await this.promptInput.fill(text);
    await this.sendButton.click();
  }

  async sendMessageWithImage(filePath: string, text: string): Promise<void> {
    // 点击图片图标触发文件选择
    const imageButton = this.page.locator('button[title="上传图片提问"]');
    await imageButton.click();

    const fileChooserPromise = this.page.waitForEvent("filechooser");
    await imageButton.click();
    const fileChooser = await fileChooserPromise;
    await fileChooser.setFiles(filePath);

    // 等待预览出现
    await this.page.locator('img[alt="preview"]').waitFor({ state: "visible" });

    await this.promptInput.fill(text);
    await this.sendButton.click();
  }

  async clearConversation(): Promise<void> {
    await this.clearConversationButton.click();
  }

  async openDocuments(): Promise<void> {
    await this.documentsButton.click();
  }

  async openAuth(): Promise<void> {
    await this.authButton.click();
  }

  async openAdmin(): Promise<void> {
    await this.adminButton.click();
  }

  getUserMessage(text: string): Locator {
    return this.page.locator("article").filter({ hasText: text }).first();
  }

  getAssistantMessages(): Locator {
    return this.page.locator("article").filter({ hasText: "Knowledge Copilot" });
  }

  getLatestAssistantMessage(): Locator {
    return this.getAssistantMessages().last();
  }

  async waitForAssistantResponse(timeout = 30_000): Promise<void> {
    const assistant = this.getLatestAssistantMessage();
    // 等待流式完成（通过检查光标消失）
    await this.page.waitForFunction(
      () => {
        const cursors = document.querySelectorAll("span.animate-pulse");
        return cursors.length === 0;
      },
      null,
      { timeout }
    );
  }

  async copyLatestMessage(): Promise<void> {
    const latest = this.getLatestAssistantMessage();
    const copyBtn = latest.locator('button[aria-label*="复制"]').first();
    await copyBtn.click();
  }

  async expandSources(): Promise<void> {
    const latest = this.getLatestAssistantMessage();
    const details = latest.locator("details").first();
    if (await details.isVisible().catch(() => false)) {
      await details.locator("summary").click();
    }
  }
}
