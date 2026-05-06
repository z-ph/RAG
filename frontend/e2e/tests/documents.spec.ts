import { test, expect } from "../fixtures";
import { ChatPage } from "../pages/chat.page";
import { DocumentsPage } from "../pages/documents.page";
import {
  uploadDocument,
  deleteDocument,
  listDocuments,
} from "../utils/api";

const TEST_DOC_CONTENT =
  "这是一个用于 E2E 测试的知识库文档。内容包含人工智能、机器学习、深度学习等关键词。";

test.describe("文档集合交互", () => {
  test("匿名访客可查看公开文档列表", async ({ anonymousPage }) => {
    const chat = new ChatPage(anonymousPage);
    const docs = new DocumentsPage(anonymousPage);

    await chat.goto();
    await chat.openDocuments();

    await docs.waitForConsole();
    await expect(anonymousPage).toHaveURL(/\/documents$/);
    await expect(
      anonymousPage.locator("text=已入库文档")
    ).toBeVisible();
  });

  test("匿名访客可查看文档详情", async ({ anonymousPage }) => {
    // 先通过 API 上传一个公开文档
    const fileBuffer = Buffer.from(TEST_DOC_CONTENT, "utf-8");
    const uploaded = await uploadDocument(fileBuffer, "e2e-test-doc.txt");
    expect(uploaded.documentId).toBeTruthy();

    try {
      const chat = new ChatPage(anonymousPage);
      const docs = new DocumentsPage(anonymousPage);

      await chat.goto();
      await chat.openDocuments();

      // 等待文档出现在列表中
      await expect(
        docs.getDocumentItem("e2e-test-doc.txt")
      ).toBeVisible({ timeout: 10_000 });

      await docs.viewDocument("e2e-test-doc.txt");
      await docs.waitForDetail(uploaded.documentId ?? undefined);

      // 验证详情页内容
      await expect(
        anonymousPage.locator("text=文档详情")
      ).toBeVisible();
      await expect(
        anonymousPage.locator("text=e2e-test-doc.txt")
      ).toBeVisible();
      await docs.goBack();
      await docs.waitForConsole();
    } finally {
      if (uploaded.documentId) {
        await deleteDocument(uploaded.documentId);
      }
    }
  });

  test("管理员上传文档", async ({ adminPage }) => {
    const chat = new ChatPage(adminPage);
    const docs = new DocumentsPage(adminPage);

    await chat.goto();
    await chat.openDocuments();
    await docs.waitForConsole();

    // 创建临时测试文件并通过 UI 上传
    const testContent = "E2E 上传测试文档内容。关键词：测试、上传、Playwright。";

    // 使用 hidden input 直接设置文件
    await adminPage.evaluate((content) => {
      const input = document.querySelector(
        'input[type="file"]'
      ) as HTMLInputElement;
      if (!input) return;
      const blob = new Blob([content], { type: "text/plain" });
      const file = new File([blob], "e2e-upload-test.txt", { type: "text/plain" });
      const dt = new DataTransfer();
      dt.items.add(file);
      input.files = dt.files;
      input.dispatchEvent(new Event("change", { bubbles: true }));
    }, testContent);

    // 等待上传完成
    await docs.waitForUploadComplete(60_000);

    // 验证文档出现在列表中
    await expect(
      docs.getDocumentItem("e2e-upload-test.txt")
    ).toBeVisible({ timeout: 10_000 });

    // 清理：通过 API 删除
    const docList = await listDocuments();
    const target = docList.documents.find((d) =>
      d.filename.includes("e2e-upload-test")
    );
    if (target) {
      await deleteDocument(target.documentId);
    }
  });

  test("管理员删除文档", async ({ adminPage }) => {
    // 先上传一个测试文档
    const fileBuffer = Buffer.from("待删除的测试文档", "utf-8");
    const uploaded = await uploadDocument(fileBuffer, "e2e-delete-me.txt");
    expect(uploaded.documentId).toBeTruthy();

    try {
      const chat = new ChatPage(adminPage);
      const docs = new DocumentsPage(adminPage);

      await chat.goto();
      await chat.openDocuments();
      await docs.waitForConsole();

      // 等待文档出现
      await expect(
        docs.getDocumentItem("e2e-delete-me.txt")
      ).toBeVisible({ timeout: 10_000 });

      await docs.deleteDocument("e2e-delete-me.txt");

      // 验证文档已消失
      await expect(
        docs.getDocumentItem("e2e-delete-me.txt")
      ).not.toBeVisible();
    } finally {
      // 兜底清理
      if (uploaded.documentId) {
        try {
          await deleteDocument(uploaded.documentId);
        } catch {
          // ignore
        }
      }
    }
  });

  test("已登录成员可查看完整文档列表", async ({ adminPage }) => {
    const chat = new ChatPage(adminPage);
    const docs = new DocumentsPage(adminPage);

    await chat.goto();
    await chat.openDocuments();
    await docs.waitForConsole();

    // 验证刷新按钮可用
    await docs.refreshButton.click();
    await expect(
      adminPage.locator("text=已入库文档")
    ).toBeVisible();
  });
});
