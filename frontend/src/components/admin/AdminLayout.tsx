import { useState, useEffect } from "react";
import { Layout, Menu, Button, Avatar, Dropdown, theme, Grid } from "antd";
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
  CommentOutlined
} from "@ant-design/icons";
import { Outlet, useLocation, useNavigate, Link } from "react-router-dom";
import { useAuthSession } from "../../hooks/useAuthSession";
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
    <Layout className="min-h-screen">
      <Sider
        trigger={null}
        collapsible
        collapsed={collapsed}
        breakpoint="lg"
        collapsedWidth={screens.xs ? 0 : 80}
        onBreakpoint={(broken) => setCollapsed(broken)}
        className="!bg-[#132238]"
      >
        <div className="flex h-16 items-center justify-center gap-2 px-4">
          {!collapsed && (
            <span className="text-lg font-bold text-white">管理后台</span>
          )}
          {collapsed && <SettingOutlined className="text-xl text-white" />}
        </div>
        <Menu
          theme="dark"
          mode="inline"
          selectedKeys={[selectedKey]}
          items={menuItems}
          onClick={({ key }) => navigate(key)}
          className="!bg-[#132238] !border-r-0"
          style={{ background: "#132238" }}
        />
      </Sider>
      <Layout>
        <Header className="!bg-white flex items-center justify-between px-6 shadow-sm">
          <Button
            type="text"
            icon={collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
            onClick={() => setCollapsed(!collapsed)}
          />
          <div className="flex items-center gap-4">
            <Link to="/" className="flex items-center gap-1 text-sm text-ink-600 hover:text-accent-500">
              <CommentOutlined />
              返回对话
            </Link>
            <Dropdown menu={{ items: userMenuItems }} placement="bottomRight">
              <div className="flex cursor-pointer items-center gap-2">
                <Avatar size="small" className="!bg-accent-500">
                  {authStatus.user?.username?.charAt(0).toUpperCase()}
                </Avatar>
                <span className="text-sm font-medium text-ink-900">
                  {authStatus.user?.username}
                </span>
              </div>
            </Dropdown>
          </div>
        </Header>
        <Content className="m-6 bg-white rounded-xl p-6 shadow-sm">
          <Outlet />
        </Content>
      </Layout>
    </Layout>
  );
}
