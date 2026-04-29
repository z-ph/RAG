import { useEffect, useState } from "react";
import { Spin } from "antd";
import {
  UserOutlined,
  SafetyCertificateOutlined,
  KeyOutlined,
  FileTextOutlined
} from "@ant-design/icons";
import { listUsers, listRoles, listPermissions } from "../../lib/adminApi";
import { listRegistrationCodes } from "../../lib/api";

interface StatItem {
  label: string;
  value: number;
  icon: React.ReactNode;
}

export function AdminDashboard() {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<StatItem[]>([]);

  useEffect(() => {
    async function loadStats() {
      try {
        const [users, roles, permissions, codes] = await Promise.all([
          listUsers(),
          listRoles(),
          listPermissions(),
          listRegistrationCodes().then(r => r.codes)
        ]);
        setStats([
          { label: "用户总数", value: users.length, icon: <UserOutlined /> },
          { label: "角色总数", value: roles.length, icon: <SafetyCertificateOutlined /> },
          { label: "权限总数", value: permissions.length, icon: <KeyOutlined /> },
          { label: "注册码总数", value: codes.length, icon: <FileTextOutlined /> },
        ]);
      } catch {
        // ignore
      } finally {
        setLoading(false);
      }
    }
    void loadStats();
  }, []);

  return (
    <div>
      <h1 className="text-lg font-bold uppercase tracking-wider text-ink-900 mb-6">管理后台概览</h1>
      <Spin spinning={loading}>
        <div className="grid grid-cols-2 gap-px bg-ink-300 lg:grid-cols-4">
          {stats.map(item => (
            <div key={item.label} className="bg-white px-5 py-5">
              <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-ink-500 mb-2">
                {item.icon}
                {item.label}
              </div>
              <div className="text-3xl font-bold text-ink-950 tabular-nums">{item.value}</div>
            </div>
          ))}
        </div>
      </Spin>
    </div>
  );
}
