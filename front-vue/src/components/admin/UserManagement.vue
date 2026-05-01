<template>
  <div class="flex h-full flex-col">
    <div class="mb-4 flex items-center justify-between">
      <h2 class="text-lg font-bold uppercase tracking-wider text-ink-950">用户管理</h2>
      <a-space>
        <a-button :loading="loading" @click="fetchUsers">
          <template #icon><ReloadOutlined /></template>
          刷新
        </a-button>
        <a-button type="primary" @click="openCreateModal">
          <template #icon><PlusOutlined /></template>
          创建用户
        </a-button>
      </a-space>
    </div>

    <a-spin :spinning="loading">
      <div class="border border-ink-300">
        <a-table
          row-key="id"
          :columns="columns"
          :data-source="users"
          :pagination="{ pageSize: 10, showSizeChanger: true, showTotal: (total: number) => `共 ${total} 条` }"
          :locale="{ emptyText: '暂无用户数据' }"
        >
          <template #bodyCell="{ column, record }">
            <template v-if="column.dataIndex === 'roleName'">
              <a-tag :color="roleTagColor(record.role)">{{ record.roleName }}</a-tag>
            </template>
            <template v-else-if="column.dataIndex === 'enabled'">
              <a-tag :color="record.enabled ? 'green' : 'default'">{{ record.enabled ? '启用' : '禁用' }}</a-tag>
            </template>
            <template v-else-if="column.dataIndex === 'createdAt'">
              {{ formatDate(record.createdAt) }}
            </template>
            <template v-else-if="column.key === 'actions'">
              <a-space size="small">
                <a-button size="small" @click="openEditModal(record)">编辑</a-button>
                <a-button size="small" @click="openResetModal(record)">重置密码</a-button>
                <a-popconfirm
                  title="确认删除该用户？"
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

    <!-- Create User Modal -->
    <a-modal
      v-model:open="createModalOpen"
      title="创建用户"
      :confirm-loading="createLoading"
      ok-text="创建"
      cancel-text="取消"
      @ok="handleCreate"
      @cancel="resetCreateForm"
    >
      <div class="flex flex-col gap-4 py-2">
        <div>
          <label class="mb-1 block text-sm font-medium text-ink-700">用户名</label>
          <a-input v-model:value="createForm.username" placeholder="请输入用户名" />
        </div>
        <div>
          <label class="mb-1 block text-sm font-medium text-ink-700">密码</label>
          <a-input-password v-model:value="createForm.password" placeholder="请输入密码" />
        </div>
        <div>
          <label class="mb-1 block text-sm font-medium text-ink-700">角色</label>
          <a-select
            v-model:value="createForm.roleId"
            class="w-full"
            placeholder="请选择角色"
            :options="roleOptions"
          />
        </div>
      </div>
    </a-modal>

    <!-- Edit User Modal -->
    <a-modal
      v-model:open="editModalOpen"
      title="编辑用户"
      :confirm-loading="editLoading"
      ok-text="保存"
      cancel-text="取消"
      @ok="handleEdit"
      @cancel="closeEditModal"
    >
      <div v-if="editingUser" class="flex flex-col gap-4 py-2">
        <div>
          <label class="mb-1 block text-sm font-medium text-ink-700">角色</label>
          <a-select
            v-model:value="editingUser.roleId"
            class="w-full"
            :options="roleOptions"
          />
        </div>
        <div class="flex items-center justify-between">
          <label class="text-sm font-medium text-ink-700">启用状态</label>
          <a-switch v-model:checked="editingUser.enabled" />
        </div>
      </div>
    </a-modal>

    <!-- Reset Password Modal -->
    <a-modal
      v-model:open="resetModalOpen"
      title="重置密码"
      :confirm-loading="resetLoading"
      ok-text="重置"
      cancel-text="取消"
      @ok="handleResetPassword"
      @cancel="closeResetModal"
    >
      <div class="py-2">
        <label class="mb-1 block text-sm font-medium text-ink-700">新密码</label>
        <a-input-password v-model:value="newPassword" placeholder="请输入新密码" />
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
  listUsers,
  createUser,
  updateUser,
  deleteUser,
  resetUserPassword,
  listRoles,
} from "../../lib/adminApi";
import type { User, CreateUserRequest } from "../../types/admin";

const users = ref<User[]>([]);
const roles = ref<{ id: number; code: string; name: string }[]>([]);
const loading = ref(false);

const createModalOpen = ref(false);
const createLoading = ref(false);
const createForm = ref<CreateUserRequest>({ username: "", password: "", roleId: 0 });

const editModalOpen = ref(false);
const editLoading = ref(false);
const editingUser = ref<{ id: number; roleId: number; enabled: boolean } | null>(null);

const resetModalOpen = ref(false);
const resetLoading = ref(false);
const resettingUserId = ref<number | null>(null);
const newPassword = ref("");

const roleOptions = ref<{ label: string; value: number }[]>([]);

const columns: TableColumnType[] = [
  { title: "ID", dataIndex: "id", key: "id", width: 64 },
  { title: "用户名", dataIndex: "username", key: "username" },
  { title: "角色", dataIndex: "roleName", key: "roleName" },
  { title: "状态", dataIndex: "enabled", key: "enabled", width: 80 },
  { title: "创建时间", dataIndex: "createdAt", key: "createdAt", width: 180 },
  { title: "操作", key: "actions", width: 240 },
];

function roleTagColor(role: string): string {
  if (role === "SUPER_ADMIN") return "red";
  if (role === "ADMIN") return "orange";
  return "blue";
}

function formatDate(val: string): string {
  return new Date(val).toLocaleString();
}

async function fetchUsers() {
  loading.value = true;
  try {
    users.value = await listUsers();
  } catch (err) {
    message.error(err instanceof Error ? err.message : "加载用户列表失败");
  } finally {
    loading.value = false;
  }
}

async function fetchRoles() {
  try {
    const result = await listRoles();
    roles.value = result.map((r) => ({ id: r.id, code: r.code, name: r.name }));
    roleOptions.value = result.map((r) => ({ label: r.name, value: r.id }));
  } catch {
    // Roles are supplementary; don't block the UI on failure
  }
}

function openCreateModal() {
  createForm.value = { username: "", password: "", roleId: 0 };
  createModalOpen.value = true;
}

function resetCreateForm() {
  createForm.value = { username: "", password: "", roleId: 0 };
}

async function handleCreate() {
  if (!createForm.value.username.trim() || !createForm.value.password.trim() || !createForm.value.roleId) {
    message.warning("请填写完整信息");
    return;
  }
  createLoading.value = true;
  try {
    await createUser(createForm.value);
    message.success("用户创建成功");
    createModalOpen.value = false;
    createForm.value = { username: "", password: "", roleId: 0 };
    await fetchUsers();
  } catch (err) {
    message.error(err instanceof Error ? err.message : "创建用户失败");
  } finally {
    createLoading.value = false;
  }
}

function openEditModal(record: User) {
  editingUser.value = {
    id: record.id,
    roleId: roles.value.find((r) => r.code === record.role)?.id ?? record.id,
    enabled: record.enabled,
  };
  editModalOpen.value = true;
}

function closeEditModal() {
  editModalOpen.value = false;
  editingUser.value = null;
}

async function handleEdit() {
  if (!editingUser.value) return;
  editLoading.value = true;
  try {
    await updateUser(editingUser.value.id, {
      roleId: editingUser.value.roleId,
      enabled: editingUser.value.enabled,
    });
    message.success("用户更新成功");
    editModalOpen.value = false;
    editingUser.value = null;
    await fetchUsers();
  } catch (err) {
    message.error(err instanceof Error ? err.message : "更新用户失败");
  } finally {
    editLoading.value = false;
  }
}

async function handleDelete(id: number) {
  try {
    await deleteUser(id);
    message.success("用户已删除");
    await fetchUsers();
  } catch (err) {
    message.error(err instanceof Error ? err.message : "删除用户失败");
  }
}

function openResetModal(record: User) {
  resettingUserId.value = record.id;
  newPassword.value = "";
  resetModalOpen.value = true;
}

function closeResetModal() {
  resetModalOpen.value = false;
  resettingUserId.value = null;
  newPassword.value = "";
}

async function handleResetPassword() {
  if (!resettingUserId.value || !newPassword.value.trim()) {
    message.warning("请输入新密码");
    return;
  }
  resetLoading.value = true;
  try {
    await resetUserPassword(resettingUserId.value, { newPassword: newPassword.value });
    message.success("密码重置成功");
    resetModalOpen.value = false;
    resettingUserId.value = null;
    newPassword.value = "";
  } catch (err) {
    message.error(err instanceof Error ? err.message : "重置密码失败");
  } finally {
    resetLoading.value = false;
  }
}

onMounted(() => {
  fetchUsers();
  fetchRoles();
});
</script>