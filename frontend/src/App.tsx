import { useState } from "react";
import { MenuUnfoldOutlined } from "@ant-design/icons";
import { App as AntdApp, Button } from "antd";
import { ChatWorkspace } from "./components/ChatWorkspace";
import { DocumentSidebar } from "./components/DocumentSidebar";
import { useDocumentLibrary } from "./hooks/useDocumentLibrary";
import { useRagConversation } from "./hooks/useRagConversation";
import { useServiceHealth } from "./hooks/useServiceHealth";

function App() {
  const { message } = AntdApp.useApp();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const documentLibrary = useDocumentLibrary(message);
  const serviceHealth = useServiceHealth();
  const conversation = useRagConversation(message);

  return (
    <main className={`app-shell ${sidebarCollapsed ? "sidebar-collapsed" : ""}`}>
      <section className="orb orb-left" />
      <section className="orb orb-right" />

      {sidebarCollapsed ? (
        <Button
          type="text"
          icon={<MenuUnfoldOutlined />}
          className="sidebar-expand-dock"
          onClick={() => setSidebarCollapsed(false)}
          title="展开文档侧边栏"
        />
      ) : null}

      <div className={`app-grid ${sidebarCollapsed ? "sidebar-collapsed" : ""}`}>
        {!sidebarCollapsed ? (
          <DocumentSidebar
            documents={documentLibrary.documents}
            documentsLoading={documentLibrary.documentsLoading}
            uploading={documentLibrary.uploading}
            deletingId={documentLibrary.deletingId}
            ragHealth={serviceHealth.ragHealth}
            documentHealth={serviceHealth.documentHealth}
            refreshingHealth={serviceHealth.refreshingHealth}
            onToggleCollapse={() => setSidebarCollapsed(true)}
            onRefreshDocuments={documentLibrary.refreshDocuments}
            onRefreshHealth={serviceHealth.refreshHealth}
            onUpload={documentLibrary.handleUpload}
            onDeleteDocument={documentLibrary.handleDeleteDocument}
          />
        ) : null}

        <ChatWorkspace
          messages={conversation.messages}
          prompt={conversation.prompt}
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
