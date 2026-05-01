<template>
  <div class="flex h-full flex-col">
    <div class="mb-4 flex items-center justify-between">
      <div>
        <h2 class="text-lg font-bold uppercase tracking-wider text-ink-950">注册码管理</h2>
        <p class="mt-1 text-xs uppercase tracking-wider text-ink-500">
          生成一次性注册码，支持禁用和删除
        </p>
      </div>
      <a-space>
        <a-button :loading="loading" @click="fetchCodes">
          <template #icon><ReloadOutlined /></template>
          刷新
        </a-button>
        <a-button type="primary" @click="createModalOpen = true">
          <template #icon><PlusOutlined /></template>
          创建注册码
        </a-button>
      </a-space>
    </div>

    <a-spin :spinning="loading">
      <div class="border border-ink-300">
        <a-table
          row-key="id"
          :columns="columns"
          :data-source="codes"
          :pagination="{ pageSize: 10, showSizeChanger: true, showTotal: (t: number) => `共 ${t} 条` }"
          :scroll="{ x: 1200 }"
          size="middle"
        >
          <template #bodyCell="{ column, record }">
            <template v-if="column.key === 'code'">
              <span class="inline-flex items-center gap-1.5 bg-ink-950/6 px-3 py-0.5 text-xs font-semibold tracking-[0.14em] text-ink-900">
                <KeyOutlined class="text-[10px]" />
                {{ record.code }}
              </span>
            </template>
            <template v-else-if="column.key === 'note'">
              <span class="text-sm text-ink-700">{{ record.note || '—' }}</span>
            </template>
            <template v-else-if="column.key === 'createdAt'">
              <span class="text-sm text-ink-500">{{ formatDate(record.createdAt) }}</span>
            </template>
            <template v-else-if="column.key === 'expiresAt'">
              <span class="text-sm text-ink-500">{{ record.expiresAt ? formatDate(record.expiresAt) : '长期有效' }}</span>
            </template>
            <template v-else-if="column.key === 'status'">
              <a-tag :color="statusColor(record.status)" :bordered="false">{{ statusLabel(record.status) }}</a-tag>
            </template>
            <template v-else-if="column.key === 'usedBy'">
              <span class="text-sm text-ink-500">{{ record.usedBy || '—' }}</span>
            </template>
            <template v-else-if="column.key === 'actions'">
              <a-space :size="4">
                <a-button
                  size="small"
                  :disabled="record.status !== 'AVAILABLE'"
                  :loading="mutatingId === record.id"
                  @click="handleDisable(record.id)"
                >
                  <template #icon><StopOutlined /></template>
                  禁用
                </a-button>
                <a-popconfirm
                  title="确认删除此注册码？"
                  description="删除后无法恢复"
                  ok-text="删除"
                  cancel-text="取消"
                  @confirm="handleDelete(record.id)"
                >
                  <a-button
                    size="small"
                    danger
                    type="text"
                    :loading="mutatingId === record.id"
                  >
                    <template #icon><DeleteOutlined /></template>
                    删除
                  </a-button>
                </a-popconfirm>
              </a-space>
            </template>
          </template>
        </a-table>
      </div>
    </a-spin>

    <a-modal
      v-model:open="createModalOpen"
      title="创建注册码"
      :footer="null"
      :width="480"
      @cancel="handleCreateModalClose"
    >
      <a-form
        :model="createForm"
        layout="vertical"
        class="mt-4"
        @finish="handleCreate"
      >
        <a-form-item label="备注" name="note">
          <a-input v-model:value="createForm.note" placeholder="例如：运维同事 / 试用账号" />
        </a-form-item>
        <a-form-item label="有效期截止时间" name="expiresAt" extra="留空表示不限制有效期">
          <a-date-picker
            v-model:value="createForm.expiresAt"
            show-time
            class="w-full"
            format="YYYY-MM-DD HH:mm"
            placeholder="选择过期时间"
          />
        </a-form-item>
        <a-form-item class="mb-0">
          <a-space>
            <a-button type="primary" html-type="submit" :loading="creating">创建</a-button>
            <a-button @click="handleCreateModalClose">取消</a-button>
          </a-space>
        </a-form-item>
      </a-form>
    </a-modal>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from "vue";
import { message } from "ant-design-vue";
import {
  DeleteOutlined,
  KeyOutlined,
  PlusOutlined,
  ReloadOutlined,
  StopOutlined
} from "@ant-design/icons-vue";
import type { TableColumnType } from "ant-design-vue";
import {
  listRegistrationCodes,
  createRegistrationCode,
  disableRegistrationCode,
  deleteRegistrationCode
} from "../../lib/api";
import type { RegistrationCode } from "../../types";

const dateFormatter = new Intl.DateTimeFormat("zh-CN", {
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit"
});

function formatDate(value?: string | null): string {
  if (!value) return "—";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return dateFormatter.format(parsed);
}

function statusLabel(status: string): string {
  switch (status) {
    case "USED": return "已使用";
    case "DISABLED": return "已禁用";
    case "EXPIRED": return "已过期";
    default: return "可用";
  }
}

function statusColor(status: string): string {
  switch (status) {
    case "USED": return "blue";
    case "DISABLED": return "red";
    case "EXPIRED": return "orange";
    default: return "green";
  }
}

const codes = ref<RegistrationCode[]>([]);
const loading = ref(false);
const creating = ref(false);
const mutatingId = ref<number | null>(null);
const createModalOpen = ref(false);
const createForm = ref<{ note: string; expiresAt: any }>({ note: "", expiresAt: null });

const columns: TableColumnType[] = [
  { title: "注册码", dataIndex: "code", key: "code", width: 200 },
  { title: "备注", dataIndex: "note", key: "note", width: 180 },
  { title: "创建者", dataIndex: "createdBy", key: "createdBy", width: 100 },
  { title: "创建时间", dataIndex: "createdAt", key: "createdAt", width: 160 },
  { title: "过期时间", dataIndex: "expiresAt", key: "expiresAt", width: 160 },
  { title: "状态", dataIndex: "status", key: "status", width: 100 },
  { title: "使用者", dataIndex: "usedBy", key: "usedBy", width: 100 },
  { title: "操作", key: "actions", width: 180 }
];

async function fetchCodes() {
  loading.value = true;
  try {
    const result = await listRegistrationCodes();
    codes.value = result.codes;
  } catch (err) {
    message.error(err instanceof Error ? err.message : "加载注册码失败");
  } finally {
    loading.value = false;
  }
}

async function handleCreate() {
  creating.value = true;
  try {
    const expiresAt = createForm.value.expiresAt
      ? createForm.value.expiresAt.toISOString()
      : null;
    const result = await createRegistrationCode({
      note: createForm.value.note?.trim() || null,
      expiresAt
    });
    message.success(`注册码已创建：${result.code}`);
    createModalOpen.value = false;
    createForm.value = { note: "", expiresAt: null };
    await fetchCodes();
  } catch (err) {
    message.error(err instanceof Error ? err.message : "创建注册码失败");
  } finally {
    creating.value = false;
  }
}

async function handleDisable(id: number) {
  mutatingId.value = id;
  try {
    await disableRegistrationCode(id);
    message.success("注册码已禁用");
    await fetchCodes();
  } catch (err) {
    message.error(err instanceof Error ? err.message : "禁用注册码失败");
  } finally {
    mutatingId.value = null;
  }
}

async function handleDelete(id: number) {
  mutatingId.value = id;
  try {
    const result = await deleteRegistrationCode(id);
    message.success(result.message);
    await fetchCodes();
  } catch (err) {
    message.error(err instanceof Error ? err.message : "删除注册码失败");
  } finally {
    mutatingId.value = null;
  }
}

function handleCreateModalClose() {
  createModalOpen.value = false;
  createForm.value = { note: "", expiresAt: null };
}

onMounted(() => {
  fetchCodes();
});
</script>