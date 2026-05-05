import { useState } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { App as AntdApp, Drawer, Grid, Modal, Input, Space, Button } from "antd";
import { ChatWorkspace } from "./components/ChatWorkspace";
import { DocumentSidebar } from "./components/DocumentSidebar";
import { DocumentDetail } from "./components/DocumentDetail";
import { AuthPanel } from "./components/AuthPanel";
import { AdminLayout } from "./components/admin/AdminLayout";
import { AdminDashboard } from "./components/admin/AdminDashboard";
import { UserManagement } from "./components/admin/UserManagement";
import { RoleManagement } from "./components/admin/RoleManagement";
import { PermissionManagement } from "./components/admin/PermissionManagement";
import { RegistrationCodeManagement } from "./components/admin/RegistrationCodeManagement";
import { PromptManagement } from "./components/admin/PromptManagement";
import { ChangePassword } from "./components/ChangePassword";
import { LogViewer } from "./components/admin/LogViewer";
import { CopyOutlined, DownloadOutlined, LinkOutlined } from "@ant-design/icons";
import { useAuthSession } from "./hooks/useAuthSession";
import { useDocumentLibrary } from "./hooks/useDocumentLibrary";
import { useRagConversation } from "./hooks/useRagConversation";

function ChatPage() {
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
      <div className="relative z-10 mx-auto flex h-full min-h-0 w-full max-w-[1600px]">
        <ChatWorkspace
          messages={conversation.messages}
          prompt={conversation.prompt}
          maxResults={conversation.maxResults}
          streaming={conversation.streaming}
          authenticated={authSession.authStatus.authenticated}
          authUser={authSession.authStatus.user || null}
          onOpenDocuments={() => setDocumentDrawerOpen(true)}
          onOpenAuth={() => setAuthDrawerOpen(true)}
          onOpenAdmin={authSession.authStatus.authenticated && (authSession.authStatus.user?.roleCode === "ADMIN" || authSession.authStatus.user?.roleCode === "SUPER_ADMIN") ? "/admin" : undefined}
          onPromptChange={conversation.setPrompt}
          onMaxResultsChange={conversation.setMaxResults}
          onSend={conversation.handleSend}
          onSendWithImage={conversation.handleSendWithImage}
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
          fileUploads={documentLibrary.fileUploads}
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
                  const link = document.createElement("a");
                  link.href = documentLibrary.downloadLinkInfo!.downloadUrl;
                  link.download = documentLibrary.downloadLinkInfo!.filename;
                  link.style.display = "none";
                  document.body.appendChild(link);
                  link.click();
                  document.body.removeChild(link);
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
          onClose={() => setAuthDrawerOpen(false)}
          onLogin={authSession.handleLogin}
          onRegister={authSession.handleRegister}
          onLogout={authSession.handleLogout}
        />
      </Drawer>
    </main>
  );
}

function AdminRoutes() {
  const { message } = AntdApp.useApp();
  const authSession = useAuthSession(message);

  if (authSession.authLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-center">
          <div className="mb-2 h-8 w-8 animate-spin border-2 border-accent-500 border-t-transparent mx-auto" />
          <p className="text-sm text-ink-500">加载中...</p>
        </div>
      </div>
    );
  }

  if (!authSession.authStatus.authenticated) {
    return <Navigate to="/" replace />;
  }

  const isAdmin = authSession.authStatus.user?.roleCode === "ADMIN"
    || authSession.authStatus.user?.roleCode === "SUPER_ADMIN";

  if (!isAdmin) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-center">
          <h1 className="mb-2 text-2xl font-bold text-ink-900">403</h1>
          <p className="text-ink-500">您没有权限访问管理后台</p>
        </div>
      </div>
    );
  }

  return (
    <AdminLayout
      authStatus={authSession.authStatus}
      onLogout={authSession.handleLogout}
    />
  );
}

function App() {
  return (
    <BrowserRouter basename="/rag">
      <Routes>
        <Route path="/" element={<ChatPage />} />
        <Route element={<AdminRoutes />}>
          <Route path="/admin" element={<AdminDashboard />} />
          <Route path="/admin/users" element={<UserManagement />} />
          <Route path="/admin/roles" element={<RoleManagement />} />
          <Route path="/admin/permissions" element={<PermissionManagement />} />
          <Route path="/admin/registration-codes" element={<RegistrationCodeManagement />} />
          <Route path="/admin/prompts" element={<PromptManagement />} />
          <Route path="/admin/logs" element={<LogViewer />} />
          <Route path="/admin/change-password" element={<ChangePassword />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
