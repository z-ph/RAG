<template>
  <div class="flex h-full flex-col">
    <div class="flex items-center justify-between border-b border-ink-100 px-5 py-3">
      <div class="min-w-0">
        <span class="font-semibold text-ink-950">文档管理</span>
        <span v-if="documentId" class="ml-2 text-sm text-ink-500">{{ documentId }}</span>
      </div>
      <a-space>
        <a-button size="small" :loading="segmentsLoading" @click="fetchSegments">
          <template #icon><ReloadOutlined /></template>
          刷新
        </a-button>
        <a-button
          v-if="documentId"
          size="small"
          :loading="reindexing"
          @click="handleReindex"
        >
          <template #icon><SyncOutlined /></template>
          重建索引
        </a-button>
        <a-button v-if="onClose" size="small" @click="emit('close')">
          <template #icon><CloseOutlined /></template>
        </a-button>
      </a-space>
    </div>

    <div v-if="!documentId" class="flex flex-1 items-center justify-center">
      <a-empty description="请选择一个文档" />
    </div>

    <div v-else class="flex-1 overflow-y-auto px-5 py-3">
      <a-spin :spinning="segmentsLoading">
        <a-list :data-source="segments" item-layout="vertical">
          <template #renderItem="{ item }">
            <a-list-item>
              <template #actions>
                <a-button
                  size="small"
                  @click="openEditModal(item)"
                >
                  <template #icon><EditOutlined /></template>
                  编辑
                </a-button>
                <a-popconfirm
                  title="确认删除此片段？"
                  description="删除后无法恢复"
                  ok-text="删除"
                  cancel-text="取消"
                  @confirm="handleDeleteSegment(item.pointId)"
                >
                  <a-button size="small" danger type="text">
                    <template #icon><DeleteOutlined /></template>
                    删除
                  </a-button>
                </a-popconfirm>
              </template>
              <a-list-item-meta>
                <template #title>
                  <span class="font-semibold text-ink-950">
                    {{ item.title || `片段 #${item.chunkIndex}` }}
                  </span>
                </template>
                <template #description>
                  <span class="text-xs text-ink-500">
                    #{{ item.chunkIndex }}
                    <span v-if="item.category"> · {{ item.category }}</span>
                    <span v-if="item.keywords"> · {{ item.keywords }}</span>
                  </span>
                </template>
              </a-list-item-meta>
              <div class="mt-1 whitespace-pre-wrap text-sm text-ink-700">{{ item.text }}</div>
            </a-list-item>
          </template>
        </a-list>
      </a-spin>
    </div>

    <a-modal
      v-model:open="editModalOpen"
      title="编辑片段内容"
      :width="720"
    >
      <template #footer>
        <a-button @click="editModalOpen = false">取消</a-button>
        <a-button type="primary" :loading="segmentSaving" @click="handleSaveSegment">
          <template #icon><SaveOutlined /></template>
          保存
        </a-button>
      </template>
      <a-textarea
        v-if="editingSegment"
        v-model:value="editingSegment.text"
        :rows="16"
        class="mt-4 font-mono text-sm"
      />
    </a-modal>
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from "vue";
import { message } from "ant-design-vue";
import {
  CloseOutlined,
  DeleteOutlined,
  EditOutlined,
  ReloadOutlined,
  SaveOutlined,
  SyncOutlined
} from "@ant-design/icons-vue";
import {
  adminListSegments,
  adminUpdateSegment,
  adminDeleteSegment,
  adminReindexDocument,
  type AdminSegmentInfo
} from "../../lib/api";

interface Props {
  documentId: string | null;
  onClose?: () => void;
}

const props = defineProps<Props>();
const emit = defineEmits<{
  (event: "close"): void;
  (event: "reindexed", documentId: string): void;
}>();

const segments = ref<AdminSegmentInfo[]>([]);
const segmentsLoading = ref(false);
const reindexing = ref(false);
const segmentSaving = ref(false);
const editModalOpen = ref(false);
const editingSegment = ref<AdminSegmentInfo | null>(null);

async function fetchSegments() {
  if (!props.documentId) return;
  segmentsLoading.value = true;
  try {
    const result = await adminListSegments(props.documentId);
    segments.value = result.segments;
  } catch (err) {
    message.error(err instanceof Error ? err.message : "加载片段失败");
  } finally {
    segmentsLoading.value = false;
  }
}

function openEditModal(segment: AdminSegmentInfo) {
  editingSegment.value = { ...segment };
  editModalOpen.value = true;
}

async function handleSaveSegment() {
  if (!editingSegment.value || !props.documentId) return;
  segmentSaving.value = true;
  try {
    await adminUpdateSegment(
      props.documentId,
      editingSegment.value.pointId,
      editingSegment.value.text
    );
    message.success("片段已更新");
    editModalOpen.value = false;
    editingSegment.value = null;
    await fetchSegments();
  } catch (err) {
    message.error(err instanceof Error ? err.message : "保存失败");
  } finally {
    segmentSaving.value = false;
  }
}

async function handleDeleteSegment(pointId: string) {
  if (!props.documentId) return;
  try {
    await adminDeleteSegment(props.documentId, pointId);
    message.success("片段已删除");
    await fetchSegments();
  } catch (err) {
    message.error(err instanceof Error ? err.message : "删除失败");
  }
}

async function handleReindex() {
  if (!props.documentId) return;
  reindexing.value = true;
  try {
    const result = await adminReindexDocument(props.documentId);
    message.success(result.message);
    emit("reindexed", props.documentId);
    await fetchSegments();
  } catch (err) {
    message.error(err instanceof Error ? err.message : "重建索引失败");
  } finally {
    reindexing.value = false;
  }
}

watch(
  () => props.documentId,
  (newId) => {
    if (newId) {
      fetchSegments();
    } else {
      segments.value = [];
    }
  },
  { immediate: true }
);
</script>