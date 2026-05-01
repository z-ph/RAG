<template>
  <div>
    <h1 class="mb-6 text-lg font-bold uppercase tracking-wider text-ink-950">管理后台概览</h1>
    <a-spin :spinning="loading">
      <div class="grid grid-cols-2 gap-px bg-ink-300 lg:grid-cols-4">
        <div
          v-for="item in stats"
          :key="item.label"
          class="bg-white px-5 py-5"
        >
          <div class="mb-2 flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-ink-500">
            <component :is="item.icon" />
            {{ item.label }}
          </div>
          <div class="text-3xl font-bold tabular-nums text-ink-950">{{ item.value }}</div>
        </div>
      </div>
    </a-spin>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, type Component } from "vue";
import {
  UserOutlined,
  SafetyCertificateOutlined,
  KeyOutlined,
  FileTextOutlined
} from "@ant-design/icons-vue";
import { listUsers, listRoles, listPermissions } from "../../lib/adminApi";
import { listRegistrationCodes } from "../../lib/api";

interface StatItem {
  label: string;
  value: number;
  icon: Component;
}

const loading = ref(true);
const stats = ref<StatItem[]>([]);

onMounted(async () => {
  try {
    const [users, roles, permissions, codesResp] = await Promise.all([
      listUsers(),
      listRoles(),
      listPermissions(),
      listRegistrationCodes()
    ]);
    stats.value = [
      { label: "用户总数", value: users.length, icon: UserOutlined },
      { label: "角色总数", value: roles.length, icon: SafetyCertificateOutlined },
      { label: "权限总数", value: permissions.length, icon: KeyOutlined },
      { label: "注册码总数", value: codesResp.codes.length, icon: FileTextOutlined }
    ];
  } catch {
    // ignore
  } finally {
    loading.value = false;
  }
});
</script>