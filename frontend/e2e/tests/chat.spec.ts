import { test, expect } from "../fixtures";
import { ChatPage } from "../pages/chat.page";
import { DocumentsPage } from "../pages/documents.page";

test.describe("智能问答交互", () => {
  test("匿名访客发送文本问题，AI 流式回答", async ({ anonymousPage }) => {
    const chat = new ChatPage(anonymousPage);
    await chat.goto();

    const question = "你好，请简单介绍一下自己";
    await chat.sendMessage(question);

    // 验证用户消息出现
    await expect(chat.getUserMessage(question)).toBeVisible();

    // 验证 AI 消息气泡出现
    const assistant = chat.getLatestAssistantMessage();
    await expect(assistant).toBeVisible();

    // 等待流式完成（光标消失）
    await chat.waitForAssistantResponse(60_000);

    // 验证最终有内容
    const content = assistant.locator(".text-sm").first();
    await expect(content).not.toBeEmpty();
  });

  test("已登录用户发送文本问题", async ({ adminPage }) => {
    const chat = new ChatPage(adminPage);
    await chat.goto();

    const question = "什么是 RAG 技术？";
    await chat.sendMessage(question);

    await expect(chat.getUserMessage(question)).toBeVisible();
    await expect(chat.getLatestAssistantMessage()).toBeVisible();

    await chat.waitForAssistantResponse(60_000);
  });

  test("流式回答时切换到文档控制台再返回，不丢失已生成内容", async ({ adminPage }) => {
    const chat = new ChatPage(adminPage);
    const docs = new DocumentsPage(adminPage);
    await chat.goto();

    const question = "请持续详细介绍一下当前知识库系统的能力与适用场景";
    await chat.sendMessage(question);
    await expect(chat.getUserMessage(question)).toBeVisible();

    const assistant = chat.getLatestAssistantMessage();
    await expect(assistant).toBeVisible();
    await expect
      .poll(async () => {
        const content = await assistant.locator(".text-sm").first().textContent();
        return (content ?? "").trim().length;
      }, { timeout: 30_000 })
      .toBeGreaterThan(0);

    const partialContent = ((await assistant.locator(".text-sm").first().textContent()) ?? "").trim();

    await chat.openDocuments();
    await docs.waitForConsole();
    await docs.goBack();
    await chat.page.waitForURL("**/");

    await expect(chat.getUserMessage(question)).toBeVisible();
    await expect(chat.getLatestAssistantMessage()).toBeVisible();
    await expect(chat.getLatestAssistantMessage()).toContainText(partialContent);
  });

  test("清空对话", async ({ adminPage }) => {
    const chat = new ChatPage(adminPage);
    await chat.goto();

    await chat.sendMessage("测试消息");
    await expect(chat.getLatestAssistantMessage()).toBeVisible();

    await chat.clearConversation();

    // 等待确认 toast
    await expect(
      adminPage.locator("text=会话上下文已清空")
    ).toBeVisible();

    // 消息列表应为空
    await expect(chat.getAssistantMessages()).toHaveCount(0);
  });

  test("展开来源片段", async ({ adminPage }) => {
    const chat = new ChatPage(adminPage);
    await chat.goto();

    // 先确保知识库有文档，否则可能无来源
    await chat.sendMessage("请介绍一下知识库");
    await chat.waitForAssistantResponse(60_000);

    const assistant = chat.getLatestAssistantMessage();

    // 检查是否存在来源片段
    const details = assistant.locator("details").first();
    if (await details.isVisible().catch(() => false)) {
      await chat.expandSources();
      await expect(
        assistant.locator("section").first()
      ).toBeVisible();
    }
  });

  test("复制回答按钮", async ({ adminPage }) => {
    const chat = new ChatPage(adminPage);
    await chat.goto();

    await chat.sendMessage("复制测试");
    await chat.waitForAssistantResponse(60_000);

    const assistant = chat.getLatestAssistantMessage();
    const copyBtn = assistant.locator('button[aria-label*="复制"]').first();
    await expect(copyBtn).toBeVisible();

    await copyBtn.click();

    // 验证按钮文案变为"已复制"
    await expect(
      assistant.locator("text=已复制")
    ).toBeVisible();
  });

  test("图片问答", async ({ adminPage }) => {
    const chat = new ChatPage(adminPage);
    await chat.goto();

    // 创建一个简单的测试图片（1x1 像素 PNG）
    // Playwright 可以通过 setInputFiles 直接上传 Buffer
    const testImageBuffer = Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==",
      "base64"
    );

    // 使用 hidden file input 直接设置文件
    await adminPage.evaluate((bytes) => {
      const input = document.querySelector('input[type="file"]') as HTMLInputElement;
      if (!input) return;
      const blob = new Blob([new Uint8Array(bytes)], { type: "image/png" });
      const file = new File([blob], "test.png", { type: "image/png" });
      const dt = new DataTransfer();
      dt.items.add(file);
      input.files = dt.files;
      input.dispatchEvent(new Event("change", { bubbles: true }));
    }, Array.from(testImageBuffer));

    // 等待预览出现
    await expect(adminPage.locator('img[alt="preview"]')).toBeVisible();

    await chat.sendMessage("这张图片里有什么？");

    // 验证用户消息中包含图片
    const userMsg = chat.getUserMessage("这张图片里有什么？");
    await expect(userMsg).toBeVisible();

    // 验证 AI 回答出现
    await expect(chat.getLatestAssistantMessage()).toBeVisible();
  });
});
