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
            @open-documents="documentDrawerOpen = true"
            @update:prompt="setPrompt"
            @update:max-results="setMaxResults"
            @send="handleSend"
            @cancel="handleCancel"
            @clear-conversation="handleClearConversation"
          />
        </div>

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
            :deleting-id="deletingId"
            :rag-health="ragHealth"
            :document-health="documentHealth"
            :refreshing-health="refreshingHealth"
            @close="documentDrawerOpen = false"
            @refresh-documents="handleRefreshDocuments"
            @refresh-health="handleRefreshHealth"
            @upload="handleUpload"
            @delete-document="handleDeleteDocument"
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
import { useDocumentLibrary } from "./composables/useDocumentLibrary";
import { useRagConversation } from "./composables/useRagConversation";
import { useServiceHealth } from "./composables/useServiceHealth";
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
const {
  documents,
  documentsLoading,
  uploading,
  deletingId,
  refreshDocuments,
  handleUpload: uploadDocument,
  handleDeleteDocument: deleteDocument
} = useDocumentLibrary(message);
const {
  messages,
  prompt,
  setPrompt,
  maxResults,
  setMaxResults,
  streaming,
  handleSend: sendQuestion,
  handleCancel: cancelQuestion,
  handleClearConversation: clearConversation
} = useRagConversation(message);
const {
  ragHealth,
  documentHealth,
  refreshingHealth,
  refreshHealth
} = useServiceHealth();
const { width } = useViewportWidth();

const documentDrawerWidth = computed(() => {
  if (width.value >= 1200) {
    return "32vw";
  }

  if (width.value >= 992) {
    return "38vw";
  }

  if (width.value >= 768) {
    return "46vw";
  }

  return "100vw";
});

function handleSend() {
  void sendQuestion();
}

function handleCancel() {
  void cancelQuestion();
}

function handleClearConversation() {
  void clearConversation();
}

function handleRefreshDocuments() {
  void refreshDocuments();
}

function handleRefreshHealth() {
  void refreshHealth();
}

function handleUpload(file: File) {
  void uploadDocument(file);
}

function handleDeleteDocument(documentId: string) {
  void deleteDocument(documentId);
}
</script>
