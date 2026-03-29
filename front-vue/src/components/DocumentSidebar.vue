<template>
  <section class="flex h-full min-h-0 flex-col overflow-hidden px-6 py-6 max-[720px]:px-[18px] max-[720px]:py-[18px]">
    <div class="flex items-start justify-between gap-4">
      <div class="min-w-0">
        <p class="text-xs font-bold uppercase tracking-[0.12em] text-ink-500">文档控制台</p>
        <h2 class="mt-1 text-lg font-semibold text-ink-950">管理知识库文档</h2>
      </div>
      <a-button
        type="text"
        shape="circle"
        class="!text-ink-500 hover:!bg-white/[0.8] hover:!text-ink-950"
        title="关闭文档控制台"
        @click="emit('close')"
      >
        <template #icon>
          <CloseOutlined />
        </template>
      </a-button>
    </div>

    <div class="mt-4 flex flex-wrap items-center gap-2">
      <a-upload
        accept=".pdf,.txt"
        :multiple="false"
        :show-upload-list="false"
        :before-upload="handleBeforeUpload"
      >
        <a-button type="primary" :loading="props.uploading">
          <template #icon>
            <LoadingOutlined v-if="props.uploading" />
            <CloudUploadOutlined v-else />
          </template>
          上传文档
        </a-button>
      </a-upload>
      <a-button :loading="refreshing" @click="refreshAll">
        <template #icon>
          <ReloadOutlined />
        </template>
        刷新
      </a-button>
    </div>

    <div class="my-[18px] flex flex-wrap items-center gap-3">
      <HealthBadge label="RAG" :state="props.ragHealth" />
      <HealthBadge label="文档" :state="props.documentHealth" />
      <span class="inline-flex items-center gap-2 rounded-full bg-white/[0.72] px-3 py-1 text-sm font-medium text-ink-700 shadow-[inset_0_0_0_1px_rgba(19,34,56,0.08)]">
        <DatabaseOutlined />
        {{ props.documents.length }} 份文档
      </span>
    </div>

    <div class="mt-[18px] flex min-h-0 flex-1 flex-col border-t border-ink-950/8 pt-[18px]">
      <div class="mb-3 flex items-center justify-between gap-3 text-sm font-bold text-ink-900">
        <span>已入库文档</span>
        <a-button
          type="text"
          size="small"
          class="!px-0 !text-ink-500 hover:!text-accent-500"
          @click="emit('refresh-documents')"
        >
          <template #icon>
            <ReloadOutlined />
          </template>
          重载
        </a-button>
      </div>

      <div v-if="props.documentsLoading" class="grid min-h-[180px] place-items-center">
        <a-spin />
      </div>
      <div v-else-if="props.documents.length === 0" class="grid min-h-[180px] place-items-center">
        <a-empty description="还没有文档，先上传一份试试" :image="Empty.PRESENTED_IMAGE_SIMPLE" />
      </div>
      <div v-else class="flex min-h-0 flex-1 flex-col overflow-auto pr-1">
        <article
          v-for="item in props.documents"
          :key="item.documentId"
          class="flex items-start gap-3 border-b border-ink-950/8 py-3 last:border-b-0"
        >
          <div class="min-w-0 flex-1">
            <h3 class="truncate text-sm font-semibold text-ink-900">{{ item.filename }}</h3>
            <p class="mt-1 truncate text-xs text-ink-500">文档 ID: {{ item.documentId }}</p>
          </div>
          <div class="flex shrink-0 items-center gap-3">
            <span class="inline-flex rounded-full bg-ink-950/6 px-3 py-1 text-xs font-medium text-ink-700">
              {{ item.segmentCount }} 段
            </span>
            <a-button
              type="text"
              class="!px-0 !text-rose-500 hover:!text-rose-600"
              :loading="props.deletingId === item.documentId"
              @click="emit('delete-document', item.documentId)"
            >
              <template #icon>
                <DeleteOutlined />
              </template>
              删除
            </a-button>
          </div>
        </article>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed } from "vue";
import {
  CloseOutlined,
  CloudUploadOutlined,
  DatabaseOutlined,
  DeleteOutlined,
  LoadingOutlined,
  ReloadOutlined
} from "@ant-design/icons-vue";
import { Empty, type UploadProps } from "ant-design-vue";
import type { DocumentListItem, HealthState } from "../types";
import HealthBadge from "./HealthBadge.vue";

const props = defineProps<{
  documents: DocumentListItem[];
  documentsLoading: boolean;
  uploading: boolean;
  deletingId: string | null;
  ragHealth: HealthState;
  documentHealth: HealthState;
  refreshingHealth: boolean;
}>();

const emit = defineEmits<{
  (event: "close"): void;
  (event: "refresh-documents"): void;
  (event: "refresh-health"): void;
  (event: "upload", file: File): void;
  (event: "delete-document", documentId: string): void;
}>();

const refreshing = computed(() => props.documentsLoading || props.refreshingHealth);

const handleBeforeUpload: UploadProps["beforeUpload"] = (file) => {
  emit("upload", file as File);
  return false;
};

function refreshAll() {
  emit("refresh-documents");
  emit("refresh-health");
}
</script>
