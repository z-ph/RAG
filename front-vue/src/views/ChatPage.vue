<template>
  <main
    class="relative isolate h-screen min-h-dvh overflow-hidden p-7 max-[1120px]:p-5 max-[720px]:p-3.5 [--message-shell-max:clamp(760px,96%,1440px)] max-[1120px]:[--message-shell-max:min(100%,920px)] max-[720px]:[--message-shell-max:100%]"
  >
    <div class="relative z-10 mx-auto flex h-full min-h-0 w-full max-w-[1600px]">
      <ChatWorkspace
        :messages="messages"
        :prompt="prompt"
        :max-results="maxResults"
        :streaming="streaming"
        :authenticated="authStatus.authenticated"
        :auth-user="authStatus.user || null"
        @open-documents="documentDrawerOpen = true"
        @open-auth="authDrawerOpen = true"
        @open-admin="handleOpenAdmin"
        @update:prompt="setPrompt"
        @update:max-results="setMaxResults"
        @send="handleSend"
        @send-with-image="handleSendWithImage"
        @cancel="handleCancel"
        @clear-conversation="handleClearConversation"
      />
    </div>

    <!-- Document Drawer -->
    <a-drawer
      v-model:open="documentDrawerOpen"
      placement="left"
      :width="documentDrawerWidth"
      :closable="false"
      :title="null"
      :body-style="{ padding: 0, height: '100%' }"
      :mask-style="{ backdropFilter: 'blur(3px)' }"
    >
      <DocumentSidebar
        :documents="documents"
        :documents-loading="documentsLoading"
        :uploading="uploading"
        :upload-progress="null"
        :file-uploads="fileUploads"
        :deleting-id="deletingId"
        :rag-health="ragHealth"
        :document-health="documentHealth"
        :refreshing-health="refreshingHealth"
        :authenticated="authStatus.authenticated"
        @close="documentDrawerOpen = false"
        @refresh-documents="handleRefreshDocuments"
        @refresh-health="handleRefreshHealth"
        @upload="handleUpload"
        @cancel-upload="cancelUpload"
        @delete-document="handleDeleteDocument"
        @view-document="handleViewDocument"
        @show-download-link="handleShowDownloadLink"
      />
    </a-drawer>

    <!-- Document Detail Drawer -->
    <a-drawer
      :open="!!viewingDocument"
      placement="left"
      :width="documentDrawerWidth"
      :closable="false"
      :title="null"
      :body-style="{ padding: 0, height: '100%' }"
      :mask-style="{ backdropFilter: 'blur(3px)' }"
      @close="handleCloseDocumentDetail"
    >
      <DocumentDetail
        :detail="viewingDocument"
        :loading="viewingLoading"
        @close="handleCloseDocumentDetail"
        @download="handleDocumentDownload"
      />
    </a-drawer>

    <!-- Download Link Modal -->
    <a-modal
      :open="!!downloadLinkInfo"
      :footer="null"
      :closable="false"
      width="420"
      @cancel="handleCloseDownloadLink"
    >
      <div v-if="downloadLinkInfo" class="py-2">
        <div class="mb-3 flex items-start gap-2">
          <LinkOutlined class="mt-1 text-accent-500" />
          <div class="min-w-0">
            <p class="text-sm font-medium text-ink-900">下载链接</p>
            <p class="truncate text-xs text-ink-500">{{ downloadLinkInfo.filename }}</p>
          </div>
        </div>
        <a-space-compact class="w-full">
          <a-input :value="downloadLinkInfo.downloadUrl" readonly class="bg-ink-50" />
          <a-button @click="handleCopyDownloadLink">
            <template #icon>
              <CopyOutlined />
            </template>
            复制
          </a-button>
          <a-button type="primary" @click="handleDownloadFile">
            <template #icon>
              <DownloadOutlined />
            </template>
            下载
          </a-button>
        </a-space-compact>
        <p class="mt-2 text-xs text-ink-500">
          点击"下载"按钮将触发文件下载（部分浏览器可能不支持）
        </p>
      </div>
    </a-modal>

    <!-- Auth Drawer -->
    <a-drawer
      v-model:open="authDrawerOpen"
      placement="right"
      :width="authDrawerWidth"
      :closable="false"
      :title="null"
      :body-style="{ padding: 0, height: '100%' }"
      :mask-style="{ backdropFilter: 'blur(3px)' }"
    >
      <AuthPanel
        :authenticated="authStatus.authenticated"
        :auth-loading="authLoading"
        :auth-submitting="authSubmitting"
        :auth-user="authStatus.user || null"
        @close="authDrawerOpen = false"
        @login="handleLogin"
        @register="handleRegister"
        @logout="handleLogout"
      />
    </a-drawer>
  </main>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";
import { useRouter } from "vue-router";
import { message } from "ant-design-vue";
import {
  CopyOutlined,
  DownloadOutlined,
  LinkOutlined
} from "@ant-design/icons-vue";
import ChatWorkspace from "../components/ChatWorkspace.vue";
import DocumentSidebar from "../components/DocumentSidebar.vue";
import DocumentDetail from "../components/DocumentDetail.vue";
import AuthPanel from "../components/AuthPanel.vue";
import { useDocumentLibrary } from "../composables/useDocumentLibrary";
import { useRagConversation } from "../composables/useRagConversation";
import { useServiceHealth } from "../composables/useServiceHealth";
import { useAuthSession } from "../composables/useAuthSession";
import { useViewportWidth } from "../composables/useViewportWidth";

const router = useRouter();
const documentDrawerOpen = ref(false);
const authDrawerOpen = ref(false);
const { width } = useViewportWidth();

const documentDrawerWidth = computed(() => {
  if (width.value >= 1200) return "32vw";
  if (width.value >= 992) return "38vw";
  if (width.value >= 768) return "46vw";
  return "100vw";
});

const authDrawerWidth = computed(() => {
  if (width.value >= 768) return "420px";
  return "100vw";
});

// Auth session
const {
  authStatus,
  authLoading,
  authSubmitting,
  refreshSession,
  handleLogin,
  handleRegister,
  handleLogout,
  handleUnauthorized
} = useAuthSession(message);

// Document library
const {
  documents,
  documentsLoading,
  uploading,
  fileUploads,
  deletingId,
  refreshDocuments,
  handleUpload,
  cancelUpload,
  handleDeleteDocument,
  handleViewDocument,
  handleShowDownloadLink,
  handleCloseDownloadLink,
  downloadLinkInfo,
  viewingDocument,
  viewingLoading,
  handleCloseDocumentDetail
} = useDocumentLibrary(message, authStatus.value.authenticated, async () => {
  await refreshSession(false);
});

// RAG conversation
const {
  messages,
  prompt,
  setPrompt,
  maxResults,
  setMaxResults,
  streaming,
  handleSend,
  handleSendWithImage,
  handleCancel,
  handleClearConversation
} = useRagConversation(message);

// Service health
const {
  ragHealth,
  documentHealth,
  refreshingHealth,
  refreshHealth
} = useServiceHealth();

// Handler wrappers
function handleRefreshDocuments() {
  void refreshDocuments();
}

function handleRefreshHealth() {
  void refreshHealth();
}

function handleOpenAdmin() {
  void router.push("/admin");
}

function handleDocumentDownload(documentId: string) {
  const doc = documents.value.find((d) => d.documentId === documentId);
  void handleShowDownloadLink(documentId, doc?.filename || "");
}

function handleCopyDownloadLink() {
  if (downloadLinkInfo.value) {
    navigator.clipboard.writeText(downloadLinkInfo.value.downloadUrl);
    message.success("链接已复制到剪贴板");
  }
}

function handleDownloadFile() {
  if (downloadLinkInfo.value) {
    const link = document.createElement("a");
    link.href = downloadLinkInfo.value.downloadUrl;
    link.download = downloadLinkInfo.value.filename;
    link.style.display = "none";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }
}
</script>
