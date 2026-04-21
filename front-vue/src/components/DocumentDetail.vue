<template>
  <section class="flex h-full min-h-0 flex-col overflow-hidden px-6 py-6 max-[720px]:px-[18px] max-[720px]:py-[18px]">
    <div v-if="loading" class="grid h-full min-h-[300px] place-items-center">
      <a-spin :indicator="h(LoadingOutlined, { style: { fontSize: '24px' } })" />
    </div>

    <template v-else-if="detail">
      <div class="flex items-start justify-between gap-4">
        <div class="min-w-0">
          <p class="text-xs font-bold uppercase tracking-[0.12em] text-ink-500">文档详情</p>
          <h2 class="mt-1 text-lg font-semibold text-ink-950 truncate">
            {{ detail.title || detail.filename }}
          </h2>
        </div>
        <a-button
          type="text"
          shape="circle"
          class="!text-ink-500 hover:!bg-white/[0.8] hover:!text-ink-950"
          title="返回文档列表"
          @click="emit('close')"
        >
          <template #icon>
            <ArrowLeftOutlined />
          </template>
        </a-button>
      </div>

      <div class="mt-4 flex flex-wrap items-center gap-2">
        <span class="inline-flex items-center gap-1.5 rounded-full bg-ink-950/6 px-3 py-1 text-xs font-medium text-ink-700">
          <FileTextOutlined />
          {{ detail.filename }}
        </span>
        <span v-if="detail.category" class="inline-flex items-center gap-1.5 rounded-full bg-accent-100 px-3 py-1 text-xs font-medium text-accent-500">
          {{ detail.category }}
        </span>
        <span class="inline-flex rounded-full bg-ink-950/6 px-3 py-1 text-xs font-medium text-ink-700">
          {{ detail.segmentCount }} 段
        </span>
        <span v-if="detail.documentTime" class="inline-flex rounded-full bg-ink-950/6 px-3 py-1 text-xs font-medium text-ink-500">
          {{ detail.documentTime }}
        </span>
        <a-button
          type="text"
          size="small"
          class="!text-green-600 hover:!text-green-700"
          @click="emit('download', detail.documentId)"
        >
          <template #icon>
            <DownloadOutlined />
          </template>
          下载原文件
        </a-button>
      </div>

      <div v-if="detail.keywords" class="mt-3 flex flex-wrap items-center gap-1.5">
        <TagOutlined class="text-xs text-ink-500" />
        <span
          v-for="(kw, i) in detail.keywords.split(',')"
          :key="i"
          class="rounded-full bg-sky-100 px-2 py-0.5 text-xs text-sky-700"
        >
          {{ kw.trim() }}
        </span>
      </div>

      <div class="mt-4 flex-1 min-h-0 overflow-auto border-t border-ink-950/8 pt-4">
        <div class="flex flex-col gap-3">
          <div
            v-for="segment in detail.segments"
            :key="segment.chunkIndex"
            class="rounded-[12px] bg-white/[0.72] px-4 py-3 shadow-[inset_0_0_0_1px_rgba(19,34,56,0.08)]"
          >
            <div class="mb-2 flex items-center gap-2">
              <span class="inline-flex rounded-full bg-ink-950/6 px-2 py-0.5 text-[10px] font-medium text-ink-500">
                #{{ segment.chunkIndex }}
              </span>
            </div>
            <p class="text-sm leading-relaxed text-ink-900 whitespace-pre-wrap">
              {{ segment.text }}
            </p>
          </div>
          <p v-if="detail.segments.length === 0" class="py-8 text-center text-sm text-ink-500">
            暂无段落内容（文档需重新上传以启用文本存储）
          </p>
        </div>
      </div>
    </template>
  </section>
</template>

<script setup lang="ts">
import { h } from "vue";
import {
  ArrowLeftOutlined,
  DownloadOutlined,
  FileTextOutlined,
  LoadingOutlined,
  TagOutlined
} from "@ant-design/icons-vue";
import type { PublicDocumentDetailResponse } from "../types";

defineProps<{
  detail: PublicDocumentDetailResponse | null;
  loading: boolean;
}>();

const emit = defineEmits<{
  (event: "close"): void;
  (event: "download", documentId: string): void;
}>();
</script>
