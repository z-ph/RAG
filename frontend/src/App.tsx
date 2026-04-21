import { useState } from "react";
import { App as AntdApp, Drawer, Grid, Modal, Input, Space, Button } from "antd";
import { ChatWorkspace } from "./components/ChatWorkspace";
import { DocumentSidebar } from "./components/DocumentSidebar";
import { DocumentDetail } from "./components/DocumentDetail";
import { AuthPanel } from "./components/AuthPanel";
import { CopyOutlined, DownloadOutlined, LinkOutlined } from "@ant-design/icons";
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
          onViewDocument={documentLibrary.handleViewDocument}
          onShowDownloadLink={documentLibrary.handleShowDownloadLink}
        />
      </Drawer>

      <Drawer
        open={!!documentLibrary.viewingDocument}
        onClose={documentLibrary.handleCloseDocumentDetail}
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
        <DocumentDetail
          detail={documentLibrary.viewingDocument}
          loading={documentLibrary.viewingLoading}
          onClose={documentLibrary.handleCloseDocumentDetail}
          onDownload={documentLibrary.handleShowDownloadLink}
        />
      </Drawer>

      <Modal
        open={!!documentLibrary.downloadLinkInfo}
        onCancel={documentLibrary.handleCloseDownloadLink}
        footer={null}
        closable={false}
        width={420}
        title={null}
      >
        {documentLibrary.downloadLinkInfo && (
          <div className="py-2">
            <div className="mb-3 flex items-start gap-2">
              <LinkOutlined className="mt-1 text-accent-500" />
              <div className="min-w-0">
                <p className="text-sm font-medium text-ink-900">
                  下载链接
                </p>
                <p className="truncate text-xs text-ink-500">
                  {documentLibrary.downloadLinkInfo.filename}
                </p>
              </div>
            </div>
            <Space.Compact className="w-full">
              <Input
                readOnly
                value={documentLibrary.downloadLinkInfo!.downloadUrl}
                className="bg-ink-50"
              />
              <Button
                icon={<CopyOutlined />}
                onClick={() => {
                  navigator.clipboard.writeText(documentLibrary.downloadLinkInfo!.downloadUrl);
                  message.success("链接已复制到剪贴板");
                }}
              >
                复制
              </Button>
              <Button
                type="primary"
                icon={<DownloadOutlined />}
                onClick={() => {
                  window.location.href = documentLibrary.downloadLinkInfo!.downloadUrl;
                }}
              >
                下载
              </Button>
            </Space.Compact>
            <p className="mt-2 text-xs text-ink-500">
              点击"下载"按钮将触发文件下载（部分浏览器可能不支持）
            </p>
          </div>
        )}
      </Modal>

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
