import { useState } from "react";
import { App as AntdApp, Drawer, Grid } from "antd";
import { ChatWorkspace } from "./components/ChatWorkspace";
import { DocumentSidebar } from "./components/DocumentSidebar";
import { AuthPanel } from "./components/AuthPanel";
import { useAuthSession } from "./hooks/useAuthSession";
import { useDocumentLibrary } from "./hooks/useDocumentLibrary";
import { useRagConversation } from "./hooks/useRagConversation";

function App() {
  const { message } = AntdApp.useApp();
  const screens = Grid.useBreakpoint();
  const [documentDrawerOpen, setDocumentDrawerOpen] = useState(false);
  const [authDrawerOpen, setAuthDrawerOpen] = useState(false);
  const authSession = useAuthSession(message);
  const documentLibrary = useDocumentLibrary(
    message,
    authSession.authStatus.authenticated,
    authSession.handleUnauthorized
  );
  const conversation = useRagConversation(message);
  const drawerWidth = screens.xl
    ? "32vw"
    : screens.lg
      ? "38vw"
      : screens.md
        ? "46vw"
        : "100vw";

  return (
    <main
      className="relative isolate h-screen min-h-dvh overflow-hidden p-7 max-[1120px]:p-5 max-[720px]:p-3.5 [--message-shell-max:clamp(760px,96%,1440px)] max-[1120px]:[--message-shell-max:min(100%,920px)] max-[720px]:[--message-shell-max:100%]"
    >
      <div
        className="relative z-10 mx-auto flex h-full min-h-0 w-full max-w-[1600px]"
      >
        <ChatWorkspace
          messages={conversation.messages}
          prompt={conversation.prompt}
          maxResults={conversation.maxResults}
          streaming={conversation.streaming}
          authenticated={authSession.authStatus.authenticated}
          authUser={authSession.authStatus.user || null}
          onOpenDocuments={() => setDocumentDrawerOpen(true)}
          onOpenAuth={() => setAuthDrawerOpen(true)}
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
        width={drawerWidth}
        closable={false}
        title={null}
        classNames={{
          mask: "!backdrop-blur-[3px]",
          wrapper: "!shadow-none",
          section: "!bg-[#fffaf4]",
          body: "!h-full !p-0"
        }}
      >
        <DocumentSidebar
          documents={documentLibrary.documents}
          documentsLoading={documentLibrary.documentsLoading}
          uploading={documentLibrary.uploading}
          deletingId={documentLibrary.deletingId}
          uploadProgress={documentLibrary.uploadProgress}
          authenticated={authSession.authStatus.authenticated}
          onClose={() => setDocumentDrawerOpen(false)}
          onRefreshDocuments={documentLibrary.refreshDocuments}
          onUpload={documentLibrary.handleUpload}
          onDeleteDocument={documentLibrary.handleDeleteDocument}
          onCancelUpload={documentLibrary.cancelUpload}
        />
      </Drawer>

      <Drawer
        open={authDrawerOpen}
        onClose={() => setAuthDrawerOpen(false)}
        placement="right"
        width={drawerWidth}
        closable={false}
        title={null}
        classNames={{
          mask: "!backdrop-blur-[3px]",
          wrapper: "!shadow-none",
          section: "!bg-[#fffaf4]",
          body: "!h-full !p-0"
        }}
      >
        <AuthPanel
          authenticated={authSession.authStatus.authenticated}
          authLoading={authSession.authLoading}
          authSubmitting={authSession.authSubmitting}
          authUser={authSession.authStatus.user || null}
          registrationCodes={authSession.registrationCodes}
          registrationCodesLoading={authSession.registrationCodesLoading}
          codeCreating={authSession.codeCreating}
          codeMutatingId={authSession.codeMutatingId}
          onClose={() => setAuthDrawerOpen(false)}
          onLogin={authSession.handleLogin}
          onRegister={authSession.handleRegister}
          onLogout={authSession.handleLogout}
          onRefreshRegistrationCodes={authSession.refreshRegistrationCodes}
          onCreateRegistrationCode={authSession.handleCreateRegistrationCode}
          onDisableRegistrationCode={authSession.handleDisableRegistrationCode}
          onDeleteRegistrationCode={authSession.handleDeleteRegistrationCode}
        />
      </Drawer>
    </main>
  );
}

export default App;
