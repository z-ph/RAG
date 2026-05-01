<template>
  <div class="flex h-full flex-col">
    <div class="mb-4 flex items-center justify-between">
      <div>
        <h2 class="text-lg font-bold uppercase tracking-wider text-ink-950">提示词管理</h2>
        <p class="mt-1 text-xs uppercase tracking-wider text-ink-500">
          查看、编辑和重置系统提示词配置
        </p>
      </div>
      <a-button :loading="loading" @click="fetchPrompts">
        <template #icon><ReloadOutlined /></template>
        刷新
      </a-button>
    </div>

    <a-spin :spinning="loading">
      <div class="border border-ink-300">
        <a-table
          row-key="id"
          :columns="columns"
          :data-source="prompts"
          :pagination="{ pageSize: 10, showSizeChanger: true, showTotal: (t: number) => `共 ${t} 条` }"
          :scroll="{ x: 920 }"
          size="middle"
        >
          <template #bodyCell="{ column, record }">
            <template v-if="column.key === 'description'">
              <span class="font-semibold text-ink-950">{{ record.description || record.promptKey }}</span>
            </template>
            <template v-else-if="column.key === 'promptKey'">
              <span class="font-mono text-xs text-ink-500">{{ record.promptKey }}</span>
            </template>
            <template v-else-if="column.key === 'updatedAt'">
              <span class="text-sm text-ink-500">{{ record.updatedAt ? new Date(record.updatedAt).toLocaleString("zh-CN") : '—' }}</span>
            </template>
            <template v-else-if="column.key === 'updatedBy'">
              <span class="text-sm text-ink-500">{{ record.updatedBy || '—' }}</span>
            </template>
            <template v-else-if="column.key === 'actions'">
              <a-space :size="4">
                <a-button
                  size="small"
                  @click="openEditModal(record)"
                >
                  <template #icon><EditOutlined /></template>
                  编辑
                </a-button>
                <a-popconfirm
                  title="确认恢复默认值？"
                  description="此操作将覆盖当前自定义内容"
                  ok-text="恢复"
                  cancel-text="取消"
                  @confirm="handleReset(record.promptKey)"
                >
                  <a-button size="small">
                    <template #icon><ReloadOutlined /></template>
                    重置
                  </a-button>
                </a-popconfirm>
              </a-space>
            </template>
          </template>
        </a-table>
      </div>
    </a-spin>

    <a-modal
      v-model:open="editModalOpen"
      :title="`编辑提示词 - ${editingPrompt?.description || editingPrompt?.key}`"
      :width="720"
    >
      <template #footer>
        <a-button @click="editModalOpen = false">取消</a-button>
        <a-button type="primary" :loading="saving" @click="handleSave">
          <template #icon><SaveOutlined /></template>
          保存
        </a-button>
      </template>
      <a-textarea
        v-if="editingPrompt"
        v-model:value="editingPrompt.content"
        :rows="16"
        class="mt-4 font-mono text-sm"
      />
    </a-modal>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from "vue";
import { message } from "ant-design-vue";
import {
  EditOutlined,
  ReloadOutlined,
  SaveOutlined
} from "@ant-design/icons-vue";
import type { TableColumnType } from "ant-design-vue";
import {
  listPrompts,
  updatePrompt,
  resetPrompt,
  type PromptInfo
} from "../../lib/api";

const prompts = ref<PromptInfo[]>([]);
const loading = ref(false);
const saving = ref(false);
const editModalOpen = ref(false);
const editingPrompt = ref<{ key: string; content: string; description: string } | null>(null);

const columns: TableColumnType[] = [
  { title: "描述", dataIndex: "description", key: "description", width: 240 },
  { title: "Key", dataIndex: "promptKey", key: "promptKey", width: 200 },
  { title: "更新时间", dataIndex: "updatedAt", key: "updatedAt", width: 180 },
  { title: "更新者", dataIndex: "updatedBy", key: "updatedBy", width: 120 },
  { title: "操作", key: "actions", width: 180 }
];

async function fetchPrompts() {
  loading.value = true;
  try {
    const result = await listPrompts();
    prompts.value = result;
  } catch (err) {
    message.error(err instanceof Error ? err.message : "加载提示词失败");
  } finally {
    loading.value = false;
  }
}

function openEditModal(record: PromptInfo) {
  editingPrompt.value = {
    key: record.promptKey,
    content: record.promptContent,
    description: record.description || ""
  };
  editModalOpen.value = true;
}

async function handleSave() {
  if (!editingPrompt.value) return;
  saving.value = true;
  try {
    await updatePrompt(
      editingPrompt.value.key,
      editingPrompt.value.content,
      editingPrompt.value.description
    );
    message.success("提示词已更新");
    editModalOpen.value = false;
    editingPrompt.value = null;
    await fetchPrompts();
  } catch (err) {
    message.error(err instanceof Error ? err.message : "保存失败");
  } finally {
    saving.value = false;
  }
}

async function handleReset(key: string) {
  try {
    await resetPrompt(key);
    message.success("已恢复默认提示词");
    await fetchPrompts();
  } catch (err) {
    message.error(err instanceof Error ? err.message : "重置失败");
  }
}

onMounted(() => {
  fetchPrompts();
});
</script>