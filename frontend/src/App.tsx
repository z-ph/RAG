import { lazy, Suspense, type ReactNode } from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { App as AntdApp } from "antd";
import { LazyPageFallback } from "./components/LazyPageFallback";
import { useAuthSession } from "./hooks/useAuthSession";
import { useRagConversation } from "./hooks/useRagConversation";

const ChatPage = lazy(async () => import("./pages/ChatPage").then((module) => ({ default: module.ChatPage })));
const DocumentsLayout = lazy(async () => import("./pages/DocumentsLayout").then((module) => ({ default: module.DocumentsLayout })));
const DocumentsIndexPage = lazy(async () => import("./pages/DocumentsIndexPage").then((module) => ({ default: module.DocumentsIndexPage })));
const DocumentDetailPage = lazy(async () => import("./pages/DocumentDetailPage").then((module) => ({ default: module.DocumentDetailPage })));
const AdminLayout = lazy(async () => import("./components/admin/AdminLayout").then((module) => ({ default: module.AdminLayout })));
const AdminDashboard = lazy(async () => import("./components/admin/AdminDashboard").then((module) => ({ default: module.AdminDashboard })));
const UserManagement = lazy(async () => import("./components/admin/UserManagement").then((module) => ({ default: module.UserManagement })));
const RoleManagement = lazy(async () => import("./components/admin/RoleManagement").then((module) => ({ default: module.RoleManagement })));
const PermissionManagement = lazy(async () => import("./components/admin/PermissionManagement").then((module) => ({ default: module.PermissionManagement })));
const RegistrationCodeManagement = lazy(async () => import("./components/admin/RegistrationCodeManagement").then((module) => ({ default: module.RegistrationCodeManagement })));
const PromptManagement = lazy(async () => import("./components/admin/PromptManagement").then((module) => ({ default: module.PromptManagement })));
const ChangePassword = lazy(async () => import("./components/ChangePassword").then((module) => ({ default: module.ChangePassword })));
const LogViewer = lazy(async () => import("./components/admin/LogViewer").then((module) => ({ default: module.LogViewer })));

function AppSuspense({ children }: { children: ReactNode }) {
  return (
    <Suspense fallback={<LazyPageFallback />}>
      {children}
    </Suspense>
  );
}

function AdminRoutes() {
  const { message } = AntdApp.useApp();
  const authSession = useAuthSession(message);

  if (authSession.authLoading) {
    return <LazyPageFallback />;
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
    <AppSuspense>
      <AdminLayout
        authStatus={authSession.authStatus}
        onLogout={authSession.handleLogout}
      />
    </AppSuspense>
  );
}

function App() {
  const { message } = AntdApp.useApp();
  const conversation = useRagConversation(message);

  return (
    <BrowserRouter basename="/rag">
      <Routes>
        <Route
          path="/"
          element={(
            <AppSuspense>
              <ChatPage conversation={conversation} />
            </AppSuspense>
          )}
        />
        <Route
          path="/documents"
          element={(
            <AppSuspense>
              <DocumentsLayout />
            </AppSuspense>
          )}
        >
          <Route index element={<DocumentsIndexPage />} />
          <Route path=":documentId" element={<DocumentDetailPage />} />
        </Route>
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
