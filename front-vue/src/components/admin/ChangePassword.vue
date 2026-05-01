<template>
  <div class="mx-auto max-w-lg">
    <h1 class="mb-6 text-xl font-bold text-ink-900">修改密码</h1>
    <a-card>
      <a-form
        :model="formState"
        layout="vertical"
        @finish="handleSubmit"
      >
        <a-form-item
          label="当前密码"
          name="currentPassword"
          :rules="[{ required: true, message: '请输入当前密码' }]"
        >
          <a-input-password
            v-model:value="formState.currentPassword"
            placeholder="请输入当前密码"
          >
            <template #prefix><LockOutlined /></template>
          </a-input-password>
        </a-form-item>

        <a-form-item
          label="新密码"
          name="newPassword"
          :rules="[
            { required: true, message: '请输入新密码' },
            { min: 8, message: '密码长度至少 8 位' }
          ]"
        >
          <a-input-password
            v-model:value="formState.newPassword"
            placeholder="请输入新密码"
          >
            <template #prefix><LockOutlined /></template>
          </a-input-password>
        </a-form-item>

        <a-form-item
          label="确认新密码"
          name="confirmPassword"
          :rules="[
            { required: true, message: '请再次输入新密码' },
            { validator: confirmPasswordValidator }
          ]"
        >
          <a-input-password
            v-model:value="formState.confirmPassword"
            placeholder="请再次输入新密码"
          >
            <template #prefix><LockOutlined /></template>
          </a-input-password>
        </a-form-item>

        <a-form-item>
          <a-button
            type="primary"
            html-type="submit"
            :loading="submitting"
            class="!bg-accent-500 hover:!bg-accent-400"
          >
            <template #icon><SaveOutlined /></template>
            保存修改
          </a-button>
        </a-form-item>
      </a-form>
    </a-card>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive } from "vue";
import { message } from "ant-design-vue";
import { LockOutlined, SaveOutlined } from "@ant-design/icons-vue";
import type { Rule } from "ant-design-vue/es/form";
import { changePassword } from "../../lib/adminApi";

const submitting = ref(false);
const formState = reactive({
  currentPassword: "",
  newPassword: "",
  confirmPassword: ""
});

const confirmPasswordValidator = async (_rule: Rule, value: string) => {
  if (!value || formState.newPassword === value) {
    return Promise.resolve();
  }
  return Promise.reject(new Error("两次输入的密码不一致"));
};

async function handleSubmit() {
  if (formState.newPassword !== formState.confirmPassword) {
    message.error("两次输入的新密码不一致");
    return;
  }

  submitting.value = true;
  try {
    await changePassword({
      currentPassword: formState.currentPassword,
      newPassword: formState.newPassword
    });
    message.success("密码已修改成功");
    formState.currentPassword = "";
    formState.newPassword = "";
    formState.confirmPassword = "";
  } catch (error) {
    message.error(error instanceof Error ? error.message : "修改密码失败");
  } finally {
    submitting.value = false;
  }
}
</script>