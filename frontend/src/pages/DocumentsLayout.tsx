import { useState } from "react";
import { App as AntdApp, Button, Drawer, Grid, Space } from "antd";
import { SettingOutlined, UserOutlined } from "@ant-design/icons";
import { Outlet, useNavigate } from "react-router-dom";
import { AuthPanel } from "../components/AuthPanel";
import { DocumentDownloadModal } from "../components/DocumentDownloadModal";
import { useAuthSession } from "../hooks/useAuthSession";
import { useDocumentLibrary } from "../hooks/useDocumentLibrary";

export function DocumentsLayout() {
  const { message } = AntdApp.useApp();
  const navigate = useNavigate();
  const screens = Grid.useBreakpoint();
  const [authDrawerOpen, setAuthDrawerOpen] = useState(false);
  const authSession = useAuthSession(message);
  const documentLibrary = useDocumentLibrary(
    message,
    authSession.authStatus.authenticated,
    authSession.handleUnauthorized
  );
  const drawerWidth = screens.xl
    ? "32vw"
    : screens.lg
      ? "38vw"
      : screens.md
        ? "46vw"
        : "100vw";
  const canManageDocuments = authSession.authStatus.authenticated
    && (
      authSession.authStatus.user?.roleCode === "ADMIN"
      || authSession.authStatus.user?.roleCode === "SUPER_ADMIN"
    );

  const headerActions = (
    <Space size="small">
      {canManageDocuments && (
        <Button
          className="!border-ink-950/10 !bg-amber-50/90 !px-4 !text-ink-900 !shadow-none hover:!border-accent-500/25 hover:!text-accent-500"
          icon={<SettingOutlined />}
          onClick={() => navigate("/admin")}
        >
          管理
        </Button>
      )}
      <Button
        className={`!px-4 !shadow-none ${
          authSession.authStatus.authenticated
            ? "!border-accent-200 !bg-accent-100 !text-accent-500 hover:!border-accent-300 hover:!text-accent-400"
            : "!border-ink-950/10 !bg-white/80 !text-ink-700 hover:!border-accent-500/25 hover:!text-accent-500"
        }`}
        icon={<UserOutlined />}
        onClick={() => setAuthDrawerOpen(true)}
      >
        <span className="truncate">
          {authSession.authStatus.authenticated && authSession.authStatus.user
            ? `${authSession.authStatus.user.username} · ${canManageDocuments ? "管理" : "成员"}`
            : "用户登录"}
        </span>
      </Button>
    </Space>
  );

  return (
    <>
      <Outlet
        context={{
          authSession,
          documentLibrary,
          canManageDocuments,
          headerActions
        }}
      />

      <DocumentDownloadModal
        info={documentLibrary.downloadLinkInfo}
        onClose={documentLibrary.handleCloseDownloadLink}
      />

      <Drawer
        open={authDrawerOpen}
        onClose={() => setAuthDrawerOpen(false)}
        placement="right"
        closable={false}
        title={null}
        styles={{
          section: {
            width: drawerWidth
          }
        }}
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
          onLogout={async () => {
            await authSession.handleLogout();
            setAuthDrawerOpen(false);
          }}
        />
      </Drawer>
    </>
  );
}
