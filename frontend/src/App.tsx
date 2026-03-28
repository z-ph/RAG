import { App as AntdApp } from "antd";
import { ChatWorkspace } from "./components/ChatWorkspace";
import { DocumentSidebar } from "./components/DocumentSidebar";
import { useDocumentLibrary } from "./hooks/useDocumentLibrary";
import { useRagConversation } from "./hooks/useRagConversation";
import { useServiceHealth } from "./hooks/useServiceHealth";

function App() {
  const { message } = AntdApp.useApp();
  const documentLibrary = useDocumentLibrary(message);
  const serviceHealth = useServiceHealth();
  const conversation = useRagConversation(message);

  return (
    <main className="app-shell">
      <section className="orb orb-left" />
      <section className="orb orb-right" />

      <div className="app-grid">
        <DocumentSidebar
          documents={documentLibrary.documents}
          documentsLoading={documentLibrary.documentsLoading}
          uploading={documentLibrary.uploading}
          deletingId={documentLibrary.deletingId}
          ragHealth={serviceHealth.ragHealth}
          documentHealth={serviceHealth.documentHealth}
          refreshingHealth={serviceHealth.refreshingHealth}
          onRefreshDocuments={documentLibrary.refreshDocuments}
          onRefreshHealth={serviceHealth.refreshHealth}
          onUpload={documentLibrary.handleUpload}
          onDeleteDocument={documentLibrary.handleDeleteDocument}
        />

        <ChatWorkspace
          messages={conversation.messages}
          prompt={conversation.prompt}
          conversationId={conversation.conversationId}
          maxResults={conversation.maxResults}
          streaming={conversation.streaming}
          onPromptChange={conversation.setPrompt}
          onMaxResultsChange={conversation.setMaxResults}
          onSend={conversation.handleSend}
          onCancel={conversation.handleCancel}
          onClearConversation={conversation.handleClearConversation}
        />
      </div>
    </main>
  );
}

export default App;
