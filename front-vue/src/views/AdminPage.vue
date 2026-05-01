<template>
  <div v-if="authLoading" class="flex h-screen items-center justify-center">
    <div class="text-center">
      <div class="mb-2 h-8 w-8 animate-spin border-2 border-accent-500 border-t-transparent mx-auto" />
      <p class="text-sm text-ink-500">加载中...</p>
    </div>
  </div>
  <div v-else-if="!authStatus.authenticated" class="flex h-screen items-center justify-center">
    <div class="text-center">
      <h1 class="mb-2 text-2xl font-bold text-ink-900">未登录</h1>
      <p class="text-ink-500">请先登录后再访问管理后台</p>
    </div>
  </div>
  <div v-else-if="!isAdmin" class="flex h-screen items-center justify-center">
    <div class="text-center">
      <h1 class="mb-2 text-2xl font-bold text-ink-900">403</h1>
      <p class="text-ink-500">您没有权限访问管理后台</p>
    </div>
  </div>
  <AdminLayout v-else :auth-status="authStatus" @logout="handleLogout" />
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { useRouter } from "vue-router";
import AdminLayout from "../components/admin/AdminLayout.vue";
import { getAuthStatus, logout } from "../lib/api";
import type { AuthStatusResponse } from "../types";

const router = useRouter();
const authLoading = ref(true);
const authStatus = ref<AuthStatusResponse>({
  authenticated: false,
  user: null
});

const isAdmin = computed(() =>
  authStatus.value.user?.roleCode === "ADMIN" ||
  authStatus.value.user?.roleCode === "SUPER_ADMIN"
);

onMounted(async () => {
  try {
    authStatus.value = await getAuthStatus();
  } catch {
    // not authenticated
  } finally {
    authLoading.value = false;
  }
});

async function handleLogout() {
  try {
    await logout();
  } catch {
    // ignore
  }
  authStatus.value = { authenticated: false, user: null };
  void router.push("/");
}
</script>
