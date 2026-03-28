import { useState } from "react";
import { App as AntdApp, Drawer, Grid } from "antd";
import { ChatWorkspace } from "./components/ChatWorkspace";
import { DocumentSidebar } from "./components/DocumentSidebar";
import { useDocumentLibrary } from "./hooks/useDocumentLibrary";
import { useRagConversation } from "./hooks/useRagConversation";
import { useServiceHealth } from "./hooks/useServiceHealth";

function App() {
  const { message } = AntdApp.useApp();
  const screens = Grid.useBreakpoint();
  const [documentDrawerOpen, setDocumentDrawerOpen] = useState(false);
  const documentLibrary = useDocumentLibrary(message);
  const serviceHealth = useServiceHealth();
  const conversation = useRagConversation(message);
  const documentDrawerWidth = screens.xl
    ? "32vw"
    : screens.lg
      ? "38vw"
      : screens.md
        ? "46vw"
        : "100vw";

  return (
    <main
      className="relative isolate h-screen min-h-dvh overflow-hidden p-7 max-[1120px]:p-5 max-[720px]:p-3.5 [--message-shell-max:clamp(760px,84%,1220px)] max-[1120px]:[--message-shell-max:min(100%,920px)] max-[720px]:[--message-shell-max:100%]"
    >
      <section className="pointer-events-none absolute -left-[60px] -top-[80px] z-0 h-[260px] w-[260px] rounded-full bg-[rgb(255_143_71_/32%)] opacity-[0.55] blur-[28px]" />
      <section className="pointer-events-none absolute -bottom-[40px] -right-[40px] z-0 h-[320px] w-[320px] rounded-full bg-[rgb(70_118_255_/20%)] opacity-[0.55] blur-[28px]" />

      <div
        className="relative z-10 mx-auto flex h-full min-h-0 w-full max-w-[1600px]"
      >
        <ChatWorkspace
          messages={conversation.messages}
          prompt={conversation.prompt}
          maxResults={conversation.maxResults}
          streaming={conversation.streaming}
          onOpenDocuments={() => setDocumentDrawerOpen(true)}
          onPromptChange={conversation.setPrompt}
          onMaxResultsChange={conversation.setMaxResults}
          onSend={conversation.handleSend}
          onCancel={conversation.handleCancel}
          onClearConversation={conversation.handleClearConversation}
        />
      </div>

      <Drawer
        open={documentDrawerOpen}
        onClose={() => setDocumentDrawerOpen(false)}
        placement="left"
        width={documentDrawerWidth}
        closable={false}
        title={null}
        classNames={{
          mask: "!backdrop-blur-[3px]",
          wrapper: "!shadow-[0_28px_76px_rgba(24,46,79,0.18)]",
          section:
            "!bg-[linear-gradient(180deg,rgba(255,250,244,0.88),rgba(247,251,255,0.88))] !backdrop-blur-[22px]",
          body: "!h-full !p-6 max-[720px]:!p-[18px]"
        }}
      >
        <DocumentSidebar
          documents={documentLibrary.documents}
          documentsLoading={documentLibrary.documentsLoading}
          uploading={documentLibrary.uploading}
          deletingId={documentLibrary.deletingId}
          ragHealth={serviceHealth.ragHealth}
          documentHealth={serviceHealth.documentHealth}
          refreshingHealth={serviceHealth.refreshingHealth}
          onClose={() => setDocumentDrawerOpen(false)}
          onRefreshDocuments={documentLibrary.refreshDocuments}
          onRefreshHealth={serviceHealth.refreshHealth}
          onUpload={documentLibrary.handleUpload}
          onDeleteDocument={documentLibrary.handleDeleteDocument}
        />
      </Drawer>
    </main>
  );
}

export default App;
