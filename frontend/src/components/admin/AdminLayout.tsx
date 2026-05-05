import { useState } from "react";
import { Layout, Menu, Button, Avatar, Dropdown, Grid } from "antd";
import {
  DashboardOutlined,
  UserOutlined,
  SafetyCertificateOutlined,
  KeyOutlined,
  FileTextOutlined,
  SettingOutlined,
  LogoutOutlined,
  LockOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  CommentOutlined,
  FileSearchOutlined
} from "@ant-design/icons";
import { Outlet, useLocation, useNavigate, Link } from "react-router-dom";
import type { AuthStatusResponse } from "../../types";

const { Header, Sider, Content } = Layout;

interface AdminLayoutProps {
  authStatus: AuthStatusResponse;
  onLogout: () => void;
}

export function AdminLayout({ authStatus, onLogout }: AdminLayoutProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const screens = Grid.useBreakpoint();
  const [collapsed, setCollapsed] = useState(false);

  const menuItems = [
    { key: "/admin", icon: <DashboardOutlined />, label: "概览" },
    { key: "/admin/users", icon: <UserOutlined />, label: "用户管理" },
    { key: "/admin/roles", icon: <SafetyCertificateOutlined />, label: "角色管理" },
    { key: "/admin/permissions", icon: <KeyOutlined />, label: "权限管理" },
    { key: "/admin/registration-codes", icon: <FileTextOutlined />, label: "注册码管理" },
    { key: "/admin/prompts", icon: <SettingOutlined />, label: "提示词管理" },
    { key: "/admin/logs", icon: <FileSearchOutlined />, label: "日志管理" },
  ];

  const selectedKey = menuItems.find(item => location.pathname === item.key)?.key
    || menuItems.find(item => location.pathname.startsWith(item.key))?.key
    || "/admin";

  const userMenuItems = [
    {
      key: "change-password",
      icon: <LockOutlined />,
      label: <Link to="/admin/change-password">修改密码</Link>
    },
    {
      key: "logout",
      icon: <LogoutOutlined />,
      label: "退出登录",
      onClick: onLogout
    }
  ];

  return (
    <Layout style={{ minHeight: "100vh" }}>
      <Sider
        trigger={null}
        collapsible
        collapsed={collapsed}
        breakpoint="lg"
        collapsedWidth={screens.xs ? 0 : 64}
        onBreakpoint={(broken) => setCollapsed(broken)}
        width={200}
        style={{ background: "var(--color-sidebar)" }}
      >
        <div className="flex h-12 items-center gap-3 px-5 border-b border-white/10">
          {!collapsed && (
            <>
              <div className="h-5 w-5 bg-accent-500" />
              <span className="text-sm font-bold tracking-wider text-white uppercase">Admin</span>
            </>
          )}
          {collapsed && <div className="mx-auto h-5 w-5 bg-accent-500" />}
        </div>
        <Menu
          theme="dark"
          mode="inline"
          selectedKeys={[selectedKey]}
          items={menuItems}
          onClick={({ key }) => navigate(key)}
          style={{ background: "transparent", borderInlineEnd: 0 }}
        />
      </Sider>
      <Layout>
        <Header className="flex items-center justify-between px-6" style={{ background: "#fff", borderBottom: "1px solid #e5e7eb", height: 48, lineHeight: "48px", padding: "0 24px" }}>
          <Button
            type="text"
            icon={collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
            onClick={() => setCollapsed(!collapsed)}
            className="text-ink-600"
          />
          <div className="flex items-center gap-6">
            <Link to="/" className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wider text-ink-500 transition-colors hover:text-ink-900">
              <CommentOutlined />
              返回对话
            </Link>
            <Dropdown menu={{ items: userMenuItems }} placement="bottomRight">
              <div className="flex cursor-pointer items-center gap-2 py-1 pr-3 transition-colors hover:bg-black/[0.04]">
                <Avatar size="small" className="!bg-ink-800 !text-white" style={{ borderRadius: 0 }}>
                  {authStatus.user?.username?.charAt(0).toUpperCase()}
                </Avatar>
                <span className="text-sm font-medium text-ink-900">
                  {authStatus.user?.username}
                </span>
              </div>
            </Dropdown>
          </div>
        </Header>
        <Content style={{ flex: "1 1 0", minHeight: 0, overflow: "auto", background: "#f9fafb", padding: 24 }}>
          <Outlet />
        </Content>
      </Layout>
    </Layout>
  );
}
