<template>
  <div class="flex h-full flex-col">
    <div class="mb-4 flex items-center justify-between">
      <h2 class="text-lg font-bold uppercase tracking-wider text-ink-950">角色管理</h2>
      <a-space>
        <a-button :loading="loading" @click="fetchRoles">
          <template #icon><ReloadOutlined /></template>
          刷新
        </a-button>
        <a-button type="primary" @click="openCreateModal">
          <template #icon><PlusOutlined /></template>
          创建角色
        </a-button>
      </a-space>
    </div>

    <a-spin :spinning="loading">
      <div class="border border-ink-300">
        <a-table
          row-key="id"
          :columns="columns"
          :data-source="roles"
          :pagination="{ pageSize: 10, showSizeChanger: true, showTotal: (total: number) => `共 ${total} 条` }"
          :locale="{ emptyText: '暂无角色数据' }"
        >
          <template #bodyCell="{ column, record }">
            <template v-if="column.dataIndex === 'code'">
              <a-tag :color="isBuiltinRole(record.code) ? 'red' : 'default'">{{ record.code }}</a-tag>
            </template>
            <template v-else-if="column.dataIndex === 'permissions'">
              <span v-if="record.permissions.length > 0" class="flex flex-wrap gap-1">
                <a-tag v-for="p in record.permissions" :key="p.id" color="blue">{{ p.name }}</a-tag>
              </span>
              <a-tag v-else>无权限</a-tag>
            </template>
            <template v-else-if="column.key === 'actions'">
              <a-space size="small">
                <a-button size="small" @click="openEditModal(record)">编辑</a-button>
                <a-tooltip v-if="isBuiltinRole(record.code)" title="内置角色不可删除">
                  <a-button size="small" danger disabled>删除</a-button>
                </a-tooltip>
                <a-popconfirm
                  v-else
                  title="确认删除该角色？"
                  description="此操作不可撤销"
                  @confirm="handleDelete(record.id)"
                >
                  <a-button size="small" danger>删除</a-button>
                </a-popconfirm>
              </a-space>
            </template>
          </template>
        </a-table>
      </div>
    </a-spin>

    <!-- Create Role Modal -->
    <a-modal
      v-model:open="createModalOpen"
      title="创建角色"
      :confirm-loading="createLoading"
      ok-text="创建"
      cancel-text="取消"
      @ok="handleCreate"
      @cancel="resetCreateForm"
    >
      <div class="flex flex-col gap-4 py-2">
        <div>
          <label class="mb-1 block text-sm font-medium text-ink-700">角色编码</label>
          <a-input v-model:value="createForm.code" placeholder="如: EDITOR" />
        </div>
        <div>
          <label class="mb-1 block text-sm font-medium text-ink-700">角色名称</label>
          <a-input v-model:value="createForm.name" placeholder="如: 编辑员" />
        </div>
        <div>
          <label class="mb-1 block text-sm font-medium text-ink-700">描述</label>
          <a-input v-model:value="createForm.description" placeholder="角色描述（可选）" />
        </div>
        <div>
          <label class="mb-1 block text-sm font-medium text-ink-700">权限</label>
          <a-select
            v-model:value="createForm.permissionIds"
            mode="multiple"
            class="w-full"
            placeholder="选择权限"
            :options="permissionOptions"
          />
        </div>
      </div>
    </a-modal>

    <!-- Edit Role Modal -->
    <a-modal
      v-model:open="editModalOpen"
      title="编辑角色"
      :confirm-loading="editLoading"
      ok-text="保存"
      cancel-text="取消"
      @ok="handleEdit"
      @cancel="closeEditModal"
    >
      <div v-if="editingRole" class="flex flex-col gap-4 py-2">
        <div>
          <label class="mb-1 block text-sm font-medium text-ink-700">角色名称</label>
          <a-input v-model:value="editingRole.name" />
        </div>
        <div>
          <label class="mb-1 block text-sm font-medium text-ink-700">描述</label>
          <a-input v-model:value="editingRole.description" />
        </div>
        <div>
          <label class="mb-1 block text-sm font-medium text-ink-700">权限</label>
          <a-select
            v-model:value="editingRole.permissionIds"
            mode="multiple"
            class="w-full"
            placeholder="选择权限"
            :options="permissionOptions"
          />
        </div>
      </div>
    </a-modal>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from "vue";
import { message } from "ant-design-vue";
import { ReloadOutlined, PlusOutlined } from "@ant-design/icons-vue";
import type { TableColumnType } from "ant-design-vue";
import {
  listRoles,
  createRole,
  updateRole,
  deleteRole,
  listPermissions,
} from "../../lib/adminApi";
import type { Role, Permission, CreateRoleRequest } from "../../types/admin";

const BUILTIN_ROLES = new Set(["SUPER_ADMIN", "ADMIN", "USER"]);

const roles = ref<Role[]>([]);
const permissions = ref<Permission[]>([]);
const loading = ref(false);

const createModalOpen = ref(false);
const createLoading = ref(false);
const createForm = ref<CreateRoleRequest>({
  code: "",
  name: "",
  description: "",
  permissionIds: [],
});

const editModalOpen = ref(false);
const editLoading = ref(false);
const editingRole = ref<{
  id: number;
  name: string;
  description: string;
  permissionIds: number[];
} | null>(null);

const permissionOptions = ref<{ label: string; value: number }[]>([]);

const columns: TableColumnType[] = [
  { title: "ID", dataIndex: "id", key: "id", width: 64 },
  { title: "编码", dataIndex: "code", key: "code" },
  { title: "名称", dataIndex: "name", key: "name" },
  { title: "描述", dataIndex: "description", key: "description", ellipsis: true },
  { title: "权限", dataIndex: "permissions", key: "permissions", width: 280 },
  { title: "操作", key: "actions", width: 160 },
];

function isBuiltinRole(code: string): boolean {
  return BUILTIN_ROLES.has(code);
}

async function fetchRoles() {
  loading.value = true;
  try {
    roles.value = await listRoles();
  } catch (err) {
    message.error(err instanceof Error ? err.message : "加载角色列表失败");
  } finally {
    loading.value = false;
  }
}

async function fetchPermissions() {
  try {
    const result = await listPermissions();
    permissions.value = result;
    permissionOptions.value = result.map((p) => ({
      label: `${p.name} (${p.code})`,
      value: p.id,
    }));
  } catch {
    // Permissions are supplementary; don't block the UI on failure
  }
}

function openCreateModal() {
  createForm.value = { code: "", name: "", description: "", permissionIds: [] };
  createModalOpen.value = true;
}

function resetCreateForm() {
  createForm.value = { code: "", name: "", description: "", permissionIds: [] };
}

async function handleCreate() {
  if (!createForm.value.code.trim() || !createForm.value.name.trim()) {
    message.warning("请填写角色编码和名称");
    return;
  }
  createLoading.value = true;
  try {
    await createRole(createForm.value);
    message.success("角色创建成功");
    createModalOpen.value = false;
    createForm.value = { code: "", name: "", description: "", permissionIds: [] };
    await fetchRoles();
  } catch (err) {
    message.error(err instanceof Error ? err.message : "创建角色失败");
  } finally {
    createLoading.value = false;
  }
}

function openEditModal(record: Role) {
  editingRole.value = {
    id: record.id,
    name: record.name,
    description: record.description,
    permissionIds: record.permissions.map((p) => p.id),
  };
  editModalOpen.value = true;
}

function closeEditModal() {
  editModalOpen.value = false;
  editingRole.value = null;
}

async function handleEdit() {
  if (!editingRole.value) return;
  editLoading.value = true;
  try {
    await updateRole(editingRole.value.id, {
      name: editingRole.value.name,
      description: editingRole.value.description,
      permissionIds: editingRole.value.permissionIds,
    });
    message.success("角色更新成功");
    editModalOpen.value = false;
    editingRole.value = null;
    await fetchRoles();
  } catch (err) {
    message.error(err instanceof Error ? err.message : "更新角色失败");
  } finally {
    editLoading.value = false;
  }
}

async function handleDelete(id: number) {
  try {
    await deleteRole(id);
    message.success("角色已删除");
    await fetchRoles();
  } catch (err) {
    message.error(err instanceof Error ? err.message : "删除角色失败");
  }
}

onMounted(() => {
  fetchRoles();
  fetchPermissions();
});
</script>