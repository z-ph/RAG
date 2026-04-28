import { test, expect } from "../fixtures";
import { ChatPage } from "../pages/chat.page";
import { AuthPage } from "../pages/auth.page";
import { AdminPage } from "../pages/admin.page";
import {
  createRegistrationCode,
  deleteRegistrationCode,
  listRegistrationCodes,
} from "../utils/api";

test.describe("管理后台交互", () => {
  test("管理员可访问提示词管理", async ({ adminPage }) => {
    const chat = new ChatPage(adminPage);
    const admin = new AdminPage(adminPage);

    await chat.goto();
    await chat.openAdmin();

    await expect(admin.drawer).toBeVisible();
    await expect(
      adminPage.locator("text=提示词管理")
    ).toBeVisible();
  });

  test("管理员编辑并保存提示词", async ({ adminPage }) => {
    const chat = new ChatPage(adminPage);
    const admin = new AdminPage(adminPage);

    await chat.goto();
    await chat.openAdmin();

    // 等待列表加载
    await expect(adminPage.locator(".ant-list-item").first()).toBeVisible({
      timeout: 10_000,
    });

    // 找到第一个提示词项并编辑
    const firstItem = adminPage.locator(".ant-list-item").first();
    await firstItem.locator("button", { hasText: "编辑" }).click();

    // 等待弹窗
    const modal = adminPage.locator(".ant-modal-content").first();
    await expect(modal).toBeVisible();

    const textarea = modal.locator("textarea").first();
    const originalText = await textarea.inputValue();

    // 修改内容
    const newContent = originalText + "\n\n[E2E 测试追加内容]";
    await textarea.fill(newContent);
    await modal.locator("button", { hasText: "保存" }).click();

    // 验证保存成功提示
    await expect(
      adminPage.locator("text=提示词已更新")
    ).toBeVisible();

    // 关闭弹窗并验证列表刷新
    await expect(modal).not.toBeVisible();
  });

  test("管理员重置提示词", async ({ adminPage }) => {
    const chat = new ChatPage(adminPage);
    const admin = new AdminPage(adminPage);

    await chat.goto();
    await chat.openAdmin();

    await expect(adminPage.locator(".ant-list-item").first()).toBeVisible({
      timeout: 10_000,
    });

    const firstItem = adminPage.locator(".ant-list-item").first();
    await firstItem.locator("button", { hasText: "重置" }).click();

    // 确认弹窗
    await adminPage.getByRole("button", { name: "确定" }).click();

    // 验证重置成功
    await expect(
      adminPage.locator("text=已恢复默认提示词")
    ).toBeVisible();
  });

  test("管理员生成注册码", async ({ adminPage }) => {
    const chat = new ChatPage(adminPage);
    const auth = new AuthPage(adminPage);

    await chat.goto();
    await chat.openAuth();

    // 切换到注册码管理区域（已在登录状态下显示）
    await expect(auth.getRegistrationCodeForm()).toBeVisible();

    const note = `e2e-generated-${Date.now()}`;
    await auth.createRegistrationCode(note);

    // 验证成功提示
    await expect(
      adminPage.locator("text=注册码已创建")
    ).toBeVisible();

    // 验证注册码出现在列表中
    await expect(
      adminPage.locator("article").filter({ hasText: note }).first()
    ).toBeVisible();

    // 清理
    const codes = await listRegistrationCodes();
    const target = codes.codes.find((c) => c.note === note);
    if (target) {
      await deleteRegistrationCode(target.id);
    }
  });

  test("管理员禁用注册码", async ({ adminPage }) => {
    // 先创建一个可用注册码
    const regCode = await createRegistrationCode("e2e-disable-test");

    try {
      const chat = new ChatPage(adminPage);
      const auth = new AuthPage(adminPage);

      await chat.goto();
      await chat.openAuth();

      await expect(auth.getRegistrationCodeForm()).toBeVisible();

      // 禁用该注册码
      await auth.disableRegistrationCode(regCode.code);

      // 验证状态变为"已禁用"
      await expect(
        adminPage
          .locator("article")
          .filter({ hasText: regCode.code })
          .locator("text=已禁用")
      ).toBeVisible();
    } finally {
      try {
        await deleteRegistrationCode(regCode.id);
      } catch {
        // ignore
      }
    }
  });

  test("管理员删除注册码", async ({ adminPage }) => {
    // 先创建一个注册码
    const regCode = await createRegistrationCode("e2e-delete-test");

    const chat = new ChatPage(adminPage);
    const auth = new AuthPage(adminPage);

    await chat.goto();
    await chat.openAuth();

    await expect(auth.getRegistrationCodeForm()).toBeVisible();

    // 删除该注册码
    await auth.deleteRegistrationCode(regCode.code);

    // 验证已消失
    await expect(
      adminPage.locator("article").filter({ hasText: regCode.code })
    ).not.toBeVisible();
  });
});
