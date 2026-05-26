<template>
    <section
        class="flex h-full min-h-0 flex-col overflow-hidden px-6 py-6 max-[720px]:px-[18px] max-[720px]:py-[18px]"
    >
        <div class="flex items-start justify-between gap-4">
            <div class="min-w-0">
                <p
                    class="text-xs font-bold uppercase tracking-[0.12em] text-ink-500"
                >
                    文档集合
                </p>
                <h2 class="mt-1 text-lg font-semibold text-ink-950">
                    浏览和下载知识库文档
                </h2>
            </div>
            <a-button
                type="text"
                shape="circle"
                class="!text-ink-500 hover:!bg-white/[0.8] hover:!text-ink-950"
                title="关闭文档集合"
                @click="emit('close')"
            >
                <template #icon>
                    <CloseOutlined />
                </template>
            </a-button>
        </div>

        <div
            v-if="authenticated"
            class="mt-4 flex flex-wrap items-center gap-2"
        >
            <a-upload
                :multiple="true"
                :show-upload-list="false"
                :before-upload="handleBeforeUpload"
            >
                <a-button
                    type="primary"
                    :loading="uploading"
                    :disabled="uploading"
                >
                    <template #icon>
                        <LoadingOutlined v-if="uploading" />
                        <CloudUploadOutlined v-else />
                    </template>
                    {{ uploading ? batchLabel : "上传文档" }}
                </a-button>
            </a-upload>
            <a-upload
                :directory="true"
                :show-upload-list="false"
                :before-upload="handleBeforeUpload"
            >
                <a-button :loading="uploading" :disabled="uploading">
                    <template #icon>
                        <LoadingOutlined v-if="uploading" />
                        <FolderOpenOutlined v-else />
                    </template>
                    {{ uploading ? batchLabel : "上传文件夹" }}
                </a-button>
            </a-upload>
            <a-button
                :loading="documentsLoading"
                :disabled="uploading"
                @click="emit('refresh-documents')"
            >
                <template #icon>
                    <ReloadOutlined />
                </template>
                刷新
            </a-button>
        </div>

        <!-- Upload progress -->
        <div
            v-if="uploading && fileUploads.length > 0"
            class="mt-4 border border-ink-300 bg-white px-4 py-3"
        >
            <div class="flex items-center justify-between gap-2">
                <span class="text-sm font-medium text-ink-900">
                    <span
                        v-if="fileUploads.length > 1"
                        class="mr-2 text-ink-500"
                    >
                        ({{
                            fileUploads.filter((f) => f.status === "complete")
                                .length
                        }}/{{ fileUploads.length }})
                    </span>
                    上传进度
                </span>
                <a-button
                    type="text"
                    size="small"
                    danger
                    @click="emit('cancel-upload')"
                >
                    <template #icon>
                        <StopOutlined />
                    </template>
                    取消
                </a-button>
            </div>
            <div class="mt-2 max-h-[260px] space-y-2 overflow-y-auto">
                <div
                    v-for="(entry, i) in fileUploads"
                    :key="`${entry.filename}-${i}`"
                >
                    <div class="flex items-center gap-1.5 text-xs">
                        <LoadingOutlined
                            v-if="entry.status === 'uploading'"
                            class="text-accent-500"
                        />
                        <CheckCircleOutlined
                            v-else-if="entry.status === 'complete'"
                            class="text-emerald-600"
                        />
                        <CloseCircleOutlined
                            v-else-if="entry.status === 'error'"
                            class="text-rose-600"
                        />
                        <span
                            class="truncate text-ink-900"
                            :title="entry.filename"
                            >{{ entry.filename }}</span
                        >
                        <span
                            v-if="
                                entry.status === 'error' && entry.errorMessage
                            "
                            class="text-rose-600"
                            >({{ entry.errorMessage }})</span
                        >
                    </div>
                    <a-progress
                        :percent="
                            entry.status === 'complete'
                                ? 100
                                : (entry.progress?.percent ?? 0)
                        "
                        :status="
                            entry.status === 'error'
                                ? 'exception'
                                : entry.status === 'complete'
                                  ? 'success'
                                  : 'active'
                        "
                        :stroke-color="{ from: '#f25b2a', to: '#ff894f' }"
                        size="small"
                    />
                </div>
            </div>
        </div>

        <div class="my-[18px] flex flex-wrap items-center gap-3">
            <HealthBadge label="RAG" :state="props.ragHealth" />
            <HealthBadge label="文档" :state="props.documentHealth" />
            <span
                class="inline-flex items-center gap-2 rounded-full bg-white/[0.72] px-3 py-1 text-sm font-medium text-ink-700 shadow-[inset_0_0_0_1px_rgba(19,34,56,0.08)]"
            >
                <DatabaseOutlined />
                {{ props.documents.length }} 份文档
            </span>
        </div>

        <div
            class="mt-[18px] flex min-h-0 flex-1 flex-col border-t border-ink-950/8 pt-[18px]"
        >
            <div
                class="mb-3 flex items-center justify-between gap-3 text-sm font-bold text-ink-900"
            >
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
                    重建
                </a-button>
            </div>

            <div
                v-if="documentsLoading"
                class="grid min-h-[180px] place-items-center"
            >
                <a-spin />
            </div>
            <div
                v-else-if="documents.length === 0"
                class="grid min-h-[180px] place-items-center"
            >
                <a-empty
                    :description="
                        authenticated
                            ? '还没有文档，先上传一份试试'
                            : '暂无文档'
                    "
                    :image="Empty.PRESENTED_IMAGE_SIMPLE"
                />
            </div>
            <div v-else class="flex min-h-0 flex-1 flex-col overflow-auto pr-1">
                <article
                    v-for="item in documents"
                    :key="item.documentId"
                    class="flex items-start gap-3 border-b border-ink-950/8 py-3 last:border-b-0"
                >
                    <div class="min-w-0 flex-1">
                        <h3 class="truncate text-sm font-semibold text-ink-900">
                            {{ item.filename }}
                        </h3>
                        <p class="mt-1 truncate text-xs text-ink-500">
                            文档 ID: {{ item.documentId }}
                        </p>
                    </div>
                    <div
                        class="flex shrink-0 flex-wrap items-center gap-2 max-[720px]:gap-1.5"
                    >
                        <span
                            class="inline-flex bg-ink-950/6 px-3 py-1 text-xs font-medium text-ink-700"
                        >
                            {{ item.segmentCount }} 段
                        </span>
                        <a-button
                            type="text"
                            size="small"
                            class="!min-h-[36px] !min-w-[36px] !text-ink-600 hover:!text-accent-500"
                            @click="emit('view-document', item.documentId)"
                        >
                            <template #icon>
                                <EyeOutlined />
                            </template>
                            查看
                        </a-button>
                        <a-button
                            type="text"
                            size="small"
                            class="!min-h-[36px] !min-w-[36px] !text-ink-600 hover:!text-accent-500"
                            @click="
                                emit(
                                    'show-download-link',
                                    item.documentId,
                                    item.filename,
                                )
                            "
                        >
                            <template #icon>
                                <DownloadOutlined />
                            </template>
                            下载
                        </a-button>
                        <a-button
                            v-if="authenticated"
                            type="text"
                            size="small"
                            class="!min-h-[36px] !min-w-[36px] !text-accent-500 hover:!text-accent-400"
                            :loading="deletingId === item.documentId"
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
import { computed, ref } from "vue";
import {
    CheckCircleOutlined,
    CloseCircleOutlined,
    CloseOutlined,
    CloudUploadOutlined,
    DatabaseOutlined,
    DeleteOutlined,
    DownloadOutlined,
    EyeOutlined,
    FolderOpenOutlined,
    LoadingOutlined,
    ReloadOutlined,
    StopOutlined,
} from "@ant-design/icons-vue";
import { Empty, type UploadProps } from "ant-design-vue";
import type {
    DocumentListItem,
    FileUploadEntry,
    HealthState,
    UploadProgressEvent,
} from "../types";
import HealthBadge from "./HealthBadge.vue";

const props = defineProps<{
    documents: DocumentListItem[];
    documentsLoading: boolean;
    uploading: boolean;
    uploadProgress: UploadProgressEvent | null;
    fileUploads: FileUploadEntry[];
    deletingId: string | null;
    ragHealth: HealthState;
    documentHealth: HealthState;
    refreshingHealth: boolean;
    authenticated: boolean;
}>();

const emit = defineEmits<{
    (event: "close"): void;
    (event: "refresh-documents"): void;
    (event: "refresh-health"): void;
    (event: "upload", fileOrFiles: File | File[]): void;
    (event: "cancel-upload"): void;
    (event: "delete-document", documentId: string): void;
    (event: "view-document", documentId: string): void;
    (event: "show-download-link", documentId: string, filename: string): void;
}>();

const fileQueue = ref<File[]>([]);
let batchTimer: ReturnType<typeof setTimeout> | null = null;

const batchLabel = computed(() => {
    return props.fileUploads.length > 1
        ? `上传中 (${props.fileUploads.filter((f) => f.status === "complete").length}/${props.fileUploads.length})...`
        : "上传中...";
});

const handleBeforeUpload: UploadProps["beforeUpload"] = (file) => {
    fileQueue.value.push(file as File);
    if (batchTimer != null) clearTimeout(batchTimer);
    batchTimer = setTimeout(() => {
        const files = fileQueue.value;
        fileQueue.value = [];
        emit("upload", files);
    }, 0);
    return false;
};
</script>
