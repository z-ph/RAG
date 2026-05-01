<template>
  <div class="flex h-full flex-col">
    <div class="mb-4 flex items-center justify-between">
      <h2 class="text-lg font-bold uppercase tracking-wider text-ink-950">权限管理</h2>
      <a-button :loading="loading" @click="fetchPermissions">
        <template #icon><ReloadOutlined /></template>
        刷新
      </a-button>
    </div>

    <a-spin :spinning="loading">
      <div class="border border-ink-300">
        <a-table
          row-key="id"
          :columns="columns"
          :data-source="permissions"
          :pagination="{ pageSize: 10, showSizeChanger: true, showTotal: (total: number) => `共 ${total} 条` }"
          :locale="{ emptyText: '暂无权限数据' }"
        >
          <template #bodyCell="{ column, record }">
            <template v-if="column.dataIndex === 'code'">
              <a-tag color="blue">{{ record.code }}</a-tag>
            </template>
            <template v-else-if="column.dataIndex === 'module'">
              <a-tag color="geekblue">{{ record.module }}</a-tag>
            </template>
          </template>
        </a-table>
      </div>
    </a-spin>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from "vue";
import { message } from "ant-design-vue";
import { ReloadOutlined } from "@ant-design/icons-vue";
import type { TableColumnType } from "ant-design-vue";
import { listPermissions } from "../../lib/adminApi";
import type { Permission } from "../../types/admin";

const permissions = ref<Permission[]>([]);
const loading = ref(false);

const columns: TableColumnType[] = [
  { title: "ID", dataIndex: "id", key: "id", width: 64 },
  { title: "编码", dataIndex: "code", key: "code" },
  { title: "名称", dataIndex: "name", key: "name" },
  { title: "描述", dataIndex: "description", key: "description", ellipsis: true },
  { title: "模块", dataIndex: "module", key: "module" },
];

async function fetchPermissions() {
  loading.value = true;
  try {
    permissions.value = await listPermissions();
  } catch (err) {
    message.error(err instanceof Error ? err.message : "加载权限列表失败");
  } finally {
    loading.value = false;
  }
}

onMounted(() => {
  fetchPermissions();
});
</script>