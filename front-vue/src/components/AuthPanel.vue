<template>
  <section class="flex h-full min-h-0 flex-col overflow-hidden px-6 py-6 max-[720px]:px-[18px] max-[720px]:py-[18px]">
    <div class="flex items-start justify-between gap-4">
      <div class="min-w-0">
        <p class="text-xs font-bold uppercase tracking-[0.12em] text-ink-500">用户认证</p>
        <h2 class="mt-1 text-lg font-semibold text-ink-950">
          {{ props.authenticated ? '用户管理' : '登录 / 注册' }}
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

    <div class="mt-6 flex-1 overflow-auto">
      <div v-if="props.authLoading" class="grid min-h-[200px] place-items-center">
        <a-spin />
      </div>
      <template v-else-if="props.authenticated && props.authUser">
        <div class="space-y-6">
          <div class="border border-ink-300 bg-white px-5 py-5">
            <div class="flex items-start justify-between gap-3">
              <div class="min-w-0">
                <p class="text-xs font-bold uppercase tracking-[0.12em] text-ink-500">已登录</p>
                <div class="mt-2 flex flex-wrap items-center gap-2">
                  <span class="inline-flex items-center gap-2 text-sm font-semibold text-ink-950">
                    <UserOutlined />
                    {{ props.authUser.username }}
                  </span>
                  <a-tag :color="isAdmin ? 'volcano' : 'gold'" :bordered="false">
                    {{ roleLabel }}
                  </a-tag>
                </div>
                <p class="mt-2 text-xs leading-6 text-ink-500">
                  文档上传、删除需要管理员权限。
                </p>
              </div>
              <a-button @click="emit('logout')" :loading="props.authSubmitting">
                <template #icon>
                  <LogoutOutlined />
                </template>
                退出
              </a-button>
            </div>
          </div>

          <div v-if="isAdmin" class="border border-ink-300 bg-white px-5 py-5">
            <p class="text-sm font-semibold text-ink-950">管理后台</p>
            <p class="mt-1 text-xs leading-6 text-ink-500">
              进入后台管理系统，进行用户、角色、权限、注册码等高级管理操作。
            </p>
            <a-button
              type="primary"
              class="mt-3 !bg-accent-500 hover:!bg-accent-400"
              @click="handleGoAdmin"
            >
              <template #icon>
                <SettingOutlined />
              </template>
              进入管理后台
            </a-button>
          </div>
        </div>
      </template>
      <template v-else>
        <div class="border border-ink-300 bg-white px-5 py-5">
          <p class="text-sm leading-7 text-ink-700">
            文档管理需要登录。新用户必须使用管理员发放的一次性注册码注册。
          </p>
          <a-tabs v-model:activeKey="activeTab" class="mt-4">
            <a-tab-pane key="login" tab="登录">
              <a-form layout="vertical" @finish="handleLogin">
                <a-form-item
                  label="用户名"
                  name="username"
                  :rules="[{ required: true, message: '请输入用户名' }]"
                >
                  <a-input v-model:value="loginForm.username" placeholder="例如：admin">
                    <template #prefix>
                      <UserOutlined />
                    </template>
                  </a-input>
                </a-form-item>
                <a-form-item
                  label="密码"
                  name="password"
                  :rules="[{ required: true, message: '请输入密码' }]"
                >
                  <a-input-password v-model:value="loginForm.password" placeholder="请输入密码">
                    <template #prefix>
                      <LockOutlined />
                    </template>
                  </a-input-password>
                </a-form-item>
                <a-button type="primary" html-type="submit" :loading="props.authSubmitting" class="!bg-accent-500 hover:!bg-accent-400">
                  登录
                </a-button>
              </a-form>
            </a-tab-pane>
            <a-tab-pane key="register" tab="注册码注册">
              <a-form layout="vertical" @finish="handleRegister">
                <a-form-item
                  label="用户名"
                  name="username"
                  :rules="[{ required: true, message: '请输入用户名' }]"
                >
                  <a-input v-model:value="registerForm.username" placeholder="3-32 位小写字母、数字或 ._-">
                    <template #prefix>
                      <UserOutlined />
                    </template>
                  </a-input>
                </a-form-item>
                <a-form-item
                  label="密码"
                  name="password"
                  :rules="[{ required: true, message: '请输入密码' }]"
                >
                  <a-input-password v-model:value="registerForm.password" placeholder="8-72 位密码">
                    <template #prefix>
                      <LockOutlined />
                    </template>
                  </a-input-password>
                </a-form-item>
                <a-form-item
                  label="注册码"
                  name="registrationCode"
                  :rules="[{ required: true, message: '请输入注册码' }]"
                >
                  <a-input v-model:value="registerForm.registrationCode" placeholder="例如：ABCD-EFGH-JKLM">
                    <template #prefix>
                      <KeyOutlined />
                    </template>
                  </a-input>
                </a-form-item>
                <a-button type="primary" html-type="submit" :loading="props.authSubmitting" class="!bg-accent-500 hover:!bg-accent-400">
                  注册
                </a-button>
              </a-form>
            </a-tab-pane>
          </a-tabs>
        </div>
      </template>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed, reactive, ref } from "vue";
import { useRouter } from "vue-router";
import {
  CloseOutlined,
  KeyOutlined,
  LockOutlined,
  LogoutOutlined,
  SettingOutlined,
  UserOutlined
} from "@ant-design/icons-vue";
import type { AuthUser } from "../types";

const props = defineProps<{
  authenticated: boolean;
  authLoading: boolean;
  authSubmitting: boolean;
  authUser: AuthUser | null;
}>();

const emit = defineEmits<{
  (event: "close"): void;
  (event: "login", username: string, password: string): void;
  (event: "register", username: string, password: string, registrationCode: string): void;
  (event: "logout"): void;
}>();

const router = useRouter();
const activeTab = ref("login");

const loginForm = reactive({
  username: "",
  password: ""
});

const registerForm = reactive({
  username: "",
  password: "",
  registrationCode: ""
});

const isAdmin = computed(() =>
  props.authUser?.roleCode === "ADMIN" || props.authUser?.roleCode === "SUPER_ADMIN"
);

const roleLabel = computed(() =>
  props.authUser?.roleCode === "ADMIN" || props.authUser?.roleCode === "SUPER_ADMIN"
    ? "管理员"
    : "成员"
);

function handleLogin() {
  emit("login", loginForm.username, loginForm.password);
}

function handleRegister() {
  emit("register", registerForm.username, registerForm.password, registerForm.registrationCode);
}

function handleGoAdmin() {
  emit("close");
  router.push("/admin");
}
</script>
