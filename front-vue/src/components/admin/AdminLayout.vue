<template>
  <a-layout class="min-h-screen">
    <a-layout-sider
      v-model:collapsed="collapsed"
      :trigger="null"
      collapsible
      :collapsed-width="isMobile ? 0 : 64"
      :width="200"
      breakpoint="lg"
      @breakpoint="onBreakpoint"
    >
      <div class="flex h-12 items-center gap-3 border-b border-white/10 px-5">
        <template v-if="!collapsed">
          <div class="h-5 w-5 bg-accent-500" />
          <span class="text-sm font-bold uppercase tracking-wider text-white">Admin</span>
        </template>
        <template v-else>
          <div class="mx-auto h-5 w-5 bg-accent-500" />
        </template>
      </div>
      <a-menu
        theme="dark"
        mode="inline"
        :selected-keys="[selectedKey]"
        :items="menuItems"
        @click="onMenuClick"
      />
    </a-layout-sider>

    <a-layout>
      <a-layout-header class="admin-header">
        <a-button type="text" class="!text-ink-600" @click="collapsed = !collapsed">
          <template #icon>
            <MenuUnfoldOutlined v-if="collapsed" />
            <MenuFoldOutlined v-else />
          </template>
        </a-button>

        <div class="flex items-center gap-6">
          <router-link
            to="/"
            class="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wider text-ink-500 transition-colors hover:text-ink-900"
          >
            <CommentOutlined />
            返回对话
          </router-link>

          <a-dropdown>
            <div class="flex cursor-pointer items-center gap-2 py-1 pr-3 transition-colors hover:bg-black/[0.04]">
              <a-avatar :size="24" class="!bg-ink-800 !text-white !rounded-none">
                {{ avatarInitial }}
              </a-avatar>
              <span class="text-sm font-medium text-ink-900">
                {{ props.authStatus.user?.username }}
              </span>
            </div>
            <template #overlay>
              <a-menu :items="userMenuItems" @click="onUserMenuClick" />
            </template>
          </a-dropdown>
        </div>
      </a-layout-header>

      <a-layout-content class="admin-content">
        <router-view />
      </a-layout-content>
    </a-layout>
  </a-layout>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from "vue";
import { useRoute, useRouter } from "vue-router";
import {
  DashboardOutlined,
  UserOutlined,
  SafetyCertificateOutlined,
  KeyOutlined,
  FileTextOutlined,
  SettingOutlined,
  LogoutOutlined,
  LockOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  CommentOutlined
} from "@ant-design/icons-vue";
import type { AuthStatusResponse } from "../../types";
import { h } from "vue";

interface Props {
  authStatus: AuthStatusResponse;
}

const props = defineProps<Props>();
const emit = defineEmits<{
  (event: "logout"): void;
}>();

const route = useRoute();
const router = useRouter();
const collapsed = ref(false);
const windowWidth = ref(window.innerWidth);

const isMobile = computed(() => windowWidth.value < 992);

const menuItems = [
  { key: "/admin", icon: () => h(DashboardOutlined), label: "概览" },
  { key: "/admin/users", icon: () => h(UserOutlined), label: "用户管理" },
  { key: "/admin/roles", icon: () => h(SafetyCertificateOutlined), label: "角色管理" },
  { key: "/admin/permissions", icon: () => h(KeyOutlined), label: "权限管理" },
  { key: "/admin/registration-codes", icon: () => h(FileTextOutlined), label: "注册码管理" },
  { key: "/admin/prompts", icon: () => h(SettingOutlined), label: "提示词管理" }
];

const userMenuItems = [
  { key: "change-password", icon: () => h(LockOutlined), label: "修改密码" },
  { key: "logout", icon: () => h(LogoutOutlined), label: "退出登录" }
];

const selectedKey = computed(() => {
  const exact = menuItems.find(item => route.path === item.key);
  if (exact) return exact.key;
  const prefix = menuItems.find(item => route.path.startsWith(item.key + "/"));
  if (prefix) return prefix.key;
  return "/admin";
});

const avatarInitial = computed(() => {
  return props.authStatus.user?.username?.charAt(0).toUpperCase() || "?";
});

function onMenuClick({ key }: { key: string }) {
  void router.push(key);
}

function onUserMenuClick({ key }: { key: string }) {
  if (key === "change-password") {
    void router.push("/admin/change-password");
  } else if (key === "logout") {
    emit("logout");
  }
}

function onBreakpoint(broken: boolean) {
  collapsed.value = broken;
}

function onResize() {
  windowWidth.value = window.innerWidth;
}

onMounted(() => {
  window.addEventListener("resize", onResize);
});

onUnmounted(() => {
  window.removeEventListener("resize", onResize);
});
</script>

<style scoped>
.admin-header {
  background: #fff !important;
  border-bottom: 1px solid #e5e7eb;
  height: 48px;
  line-height: 48px;
  padding: 0 24px;
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.admin-content {
  flex: 1 1 0;
  min-height: 0;
  overflow: auto;
  background: #f9fafb;
  padding: 24px;
}
</style>