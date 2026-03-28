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
  const messageShellClass = sidebarCollapsed
    ? "[--message-shell-max:clamp(760px,84%,1220px)] max-[1120px]:[--message-shell-max:min(100%,920px)] max-[720px]:[--message-shell-max:100%]"
    : "[--message-shell-max:clamp(640px,74%,920px)] max-[720px]:[--message-shell-max:100%]";

  return (
    <main
      className={`relative isolate h-screen min-h-dvh overflow-hidden p-7 max-[1120px]:h-auto max-[1120px]:overflow-auto max-[1120px]:p-5 max-[720px]:p-3.5 ${messageShellClass}`}
    >
      <section className="pointer-events-none absolute -left-[60px] -top-[80px] z-0 h-[260px] w-[260px] rounded-full bg-[rgb(255_143_71_/32%)] opacity-[0.55] blur-[28px]" />
      <section className="pointer-events-none absolute -bottom-[40px] -right-[40px] z-0 h-[320px] w-[320px] rounded-full bg-[rgb(70_118_255_/20%)] opacity-[0.55] blur-[28px]" />

      {sidebarCollapsed ? (
        <Button
          type="text"
          icon={<MenuUnfoldOutlined />}
          className="!fixed !left-0 !z-20 !w-[46px] !rounded-l-none !rounded-r-[20px] !border !border-l-0 !border-ink-950/8 !bg-white/[0.92] !text-ink-700 !shadow-[0_18px_36px_rgba(24,46,79,0.14)] !backdrop-blur-md hover:!bg-white/[0.98] hover:!text-ink-950 focus-visible:!bg-white/[0.98] focus-visible:!text-ink-950 max-[1120px]:!top-5 max-[1120px]:!h-14 max-[1120px]:!w-[42px] min-[1121px]:!top-1/2 min-[1121px]:!-mt-9 min-[1121px]:!h-[72px]"
          onClick={() => setSidebarCollapsed(false)}
          title="展开文档侧边栏"
        />
      ) : null}

      <div
        className={`relative z-10 mx-auto grid h-full min-h-0 max-w-[1600px] grid-cols-1 gap-5 max-[1120px]:h-auto max-[1120px]:min-h-[calc(100vh-40px)] max-[1120px]:min-h-[calc(100dvh-40px)] ${sidebarCollapsed ? "" : "min-[1121px]:grid-cols-[minmax(320px,380px)_minmax(0,1fr)]"}`}
      >
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
