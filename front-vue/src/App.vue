<template>
  <a-config-provider :locale="zhCN" :theme="theme">
    <a-app>
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
            @update:prompt="setPrompt"
            @update:max-results="setMaxResults"
            @send="handleSend"
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
            :upload-progress="uploadProgress"
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
            @download-document="handleDownloadDocument"
          />
        </a-drawer>

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
            :auth-status="authStatus"
            :auth-submitting="authSubmitting"
            :registration-codes="registrationCodes"
            :registration-codes-loading="registrationCodesLoading"
            :code-creating="codeCreating"
            :code-mutating-id="codeMutatingId"
            @close="authDrawerOpen = false"
            @login="handleLogin"
            @register="handleRegister"
            @logout="handleLogout"
            @create-code="handleCreateRegistrationCode"
            @disable-code="handleDisableRegistrationCode"
            @delete-code="handleDeleteRegistrationCode"
          />
        </a-drawer>
      </main>
    </a-app>
  </a-config-provider>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";
import { message } from "ant-design-vue";
import zhCN from "ant-design-vue/es/locale/zh_CN";
import ChatWorkspace from "./components/ChatWorkspace.vue";
import DocumentSidebar from "./components/DocumentSidebar.vue";
import AuthPanel from "./components/AuthPanel.vue";
import { useDocumentLibrary } from "./composables/useDocumentLibrary";
import { useRagConversation } from "./composables/useRagConversation";
import { useServiceHealth } from "./composables/useServiceHealth";
import { useAuthSession } from "./composables/useAuthSession";
import { useViewportWidth } from "./composables/useViewportWidth";

const theme = {
  token: {
    colorPrimary: "#f25b2a",
    colorInfo: "#f25b2a",
    colorSuccess: "#1d8f6f",
    borderRadius: 22,
    fontFamily:
      '"Space Grotesk", "Noto Sans SC", "Segoe UI", "PingFang SC", sans-serif'
  }
};

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
  authSubmitting,
  registrationCodes,
  registrationCodesLoading,
  codeCreating,
  codeMutatingId,
  refreshSession,
  refreshRegistrationCodes,
  handleLogin,
  handleRegister,
  handleLogout,
  handleCreateRegistrationCode,
  handleDisableRegistrationCode,
  handleDeleteRegistrationCode
} = useAuthSession(message);

// Document library
const {
  documents,
  documentsLoading,
  uploading,
  uploadProgress,
  deletingId,
  refreshDocuments,
  handleUpload,
  cancelUpload,
  handleDeleteDocument,
  handleViewDocument,
  handleDownloadDocument
} = useDocumentLibrary(message, authStatus.authenticated, async () => {
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
</script>
