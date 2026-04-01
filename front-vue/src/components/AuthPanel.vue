<template>
  <section class="flex h-full min-h-0 flex-col overflow-hidden px-6 py-6 max-[720px]:px-[18px] max-[720px]:py-[18px]">
    <div class="flex items-start justify-between gap-4">
      <div class="min-w-0">
        <p class="text-xs font-bold uppercase tracking-[0.12em] text-ink-500">用户认证</p>
        <h2 class="mt-1 text-lg font-semibold text-ink-950">
          {{ authStatus.authenticated ? '已登录' : '登录 / 注册' }}
        </h2>
      </div>
      <a-button
        type="text"
        shape="circle"
        class="!text-ink-500 hover:!bg-white/[0.8] hover:!text-ink-950"
        title="关闭"
        @click="emit('close')"
      >
        <template #icon>
          <CloseOutlined />
        </template>
      </a-button>
    </div>

    <!-- Login Form -->
    <div v-if="!authStatus.authenticated" class="mt-6 flex flex-col gap-4">
      <a-segmented v-model:value="authMode" :options="[
        { label: '登录', value: 'login' },
        { label: '注册', value: 'register' }
      ]" />

      <a-form layout="vertical" class="mt-2">
        <a-form-item label="用户名">
          <a-input v-model:value="username" placeholder="请输入用户名" />
        </a-form-item>

        <a-form-item label="密码">
          <a-input-password v-model:value="password" placeholder="请输入密码" @pressEnter="handleSubmit" />
        </a-form-item>

        <a-form-item v-if="authMode === 'register'" label="注册码">
          <a-input v-model:value="registrationCode" placeholder="请输入注册码" />
        </a-form-item>

        <a-button
          type="primary"
          block
          size="large"
          :loading="props.authSubmitting"
          @click="handleSubmit"
        >
          {{ authMode === 'login' ? '登录' : '注册' }}
        </a-button>
      </a-form>
    </div>

    <!-- Logged in state -->
    <div v-else class="mt-6 flex flex-col gap-4">
      <div class="rounded-[16px] bg-white/[0.72] px-4 py-3 shadow-[inset_0_0_0_1px_rgba(19,34,56,0.08)]">
        <div class="flex items-center gap-3">
          <div class="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-accent-500 text-white">
            <UserOutlined />
          </div>
          <div>
            <p class="font-semibold text-ink-900">{{ authStatus.user?.username }}</p>
            <p class="text-xs text-ink-500">{{ authStatus.user?.role === 'ADMIN' ? '管理员' : '成员' }}</p>
          </div>
        </div>
      </div>

      <a-button :loading="authSubmitting" @click="emit('logout')">
        <template #icon>
          <LogoutOutlined />
        </template>
        退出登录
      </a-button>

      <!-- Admin: Registration codes -->
      <template v-if="authStatus.user?.role === 'ADMIN'">
        <a-divider />

        <div class="flex items-center justify-between">
          <h3 class="font-semibold text-ink-900">注册码管理</h3>
          <a-button type="primary" size="small" :loading="codeCreating" @click="showCreateCodeModal = true">
            <template #icon>
              <PlusOutlined />
            </template>
            创建
          </a-button>
        </div>

        <div v-if="props.registrationCodesLoading" class="grid min-h-[120px] place-items-center">
          <a-spin />
        </div>
        <div v-else-if="props.registrationCodes.length === 0" class="grid min-h-[120px] place-items-center">
          <a-empty description="暂无注册码" :image="Empty.PRESENTED_IMAGE_SIMPLE" />
        </div>
        <div v-else class="flex flex-col gap-2">
          <div
            v-for="code in props.registrationCodes"
            :key="code.id"
            class="flex items-center justify-between gap-2 rounded-[12px] bg-white/[0.72] px-3 py-2 shadow-[inset_0_0_0_1px_rgba(19,34,56,0.08)]"
          >
            <div class="min-w-0">
              <p class="truncate font-mono text-sm font-medium text-ink-900">{{ code.code }}</p>
              <p class="mt-0.5 truncate text-xs text-ink-500">{{ code.note || '无备注' }}</p>
              <p class="text-xs text-ink-400">
                {{ formatCodeStatus(code) }}
              </p>
            </div>
            <div class="flex shrink-0 gap-1">
              <a-button
                v-if="code.status === 'UNUSED'"
                type="text"
                size="small"
                :loading="props.codeMutatingId === code.id"
                @click="emit('disable-code', code.id)"
              >
                禁用
              </a-button>
              <a-button
                type="text"
                size="small"
                danger
                :loading="props.codeMutatingId === code.id"
                @click="emit('delete-code', code.id)"
              >
                删除
              </a-button>
            </div>
          </div>
        </div>
      </template>
    </div>

    <!-- Create code modal -->
    <a-modal
      v-model:open="showCreateCodeModal"
      title="创建注册码"
      @ok="handleCreateCode"
      @cancel="showCreateCodeModal = false"
    >
      <a-form layout="vertical">
        <a-form-item label="备注（可选）">
          <a-input v-model:value="newCodeNote" placeholder="请输入备注" />
        </a-form-item>
        <a-form-item label="过期时间（可选）">
          <a-date-picker v-model:value="newCodeExpiresAt" show-time class="w-full" />
        </a-form-item>
      </a-form>
    </a-modal>
  </section>
</template>

<script setup lang="ts">
import { ref } from "vue";
import {
  CloseOutlined,
  LogoutOutlined,
  PlusOutlined,
  UserOutlined
} from "@ant-design/icons-vue";
import { Empty } from "ant-design-vue";
import type { AuthStatusResponse, RegistrationCode } from "../types";

interface Props {
  authStatus: AuthStatusResponse;
  authSubmitting: boolean;
  registrationCodes: RegistrationCode[];
  registrationCodesLoading: boolean;
  codeCreating: boolean;
  codeMutatingId: number | null;
}

const props = defineProps<Props>();

const emit = defineEmits<{
  (event: "close"): void;
  (event: "login", username: string, password: string): void;
  (event: "register", username: string, password: string, code: string): void;
  (event: "logout"): void;
  (event: "create-code", note: string, expiresAt: string | null): void;
  (event: "disable-code", id: number): void;
  (event: "delete-code", id: number): void;
}>();

const authMode = ref<"login" | "register">("login");
const username = ref("");
const password = ref("");
const registrationCode = ref("");
const showCreateCodeModal = ref(false);
const newCodeNote = ref("");
const newCodeExpiresAt = ref<string | null>(null);

function handleSubmit() {
  if (authMode.value === "login") {
    emit("login", username.value, password.value);
  } else {
    emit("register", username.value, password.value, registrationCode.value);
  }
}

function handleCreateCode() {
  const expiresAt = newCodeExpiresAt.value
    ? new Date(newCodeExpiresAt.value).toISOString()
    : null;
  emit("create-code", newCodeNote.value, expiresAt);
  showCreateCodeModal.value = false;
  newCodeNote.value = "";
  newCodeExpiresAt.value = null;
}

function formatCodeStatus(code: RegistrationCode): string {
  if (code.status === "USED") {
    return `已使用 · ${code.usedBy} · ${formatDate(code.usedAt || "")}`;
  }
  if (code.status === "DISABLED") {
    return `已禁用 · ${formatDate(code.disabledAt || "")}`;
  }
  if (code.status === "EXPIRED") {
    return `已过期 · ${formatDate(code.expiresAt || "")}`;
  }
  return `有效期至 ${code.expiresAt ? formatDate(code.expiresAt) : "永久"}`;
}

function formatDate(iso: string): string {
  if (!iso) return "-";
  return new Date(iso).toLocaleDateString("zh-CN");
}
</script>
