import { useEffect, useState } from "react";
import { Card, Row, Col, Statistic, Spin } from "antd";
import {
  UserOutlined,
  SafetyCertificateOutlined,
  KeyOutlined,
  FileTextOutlined
} from "@ant-design/icons";
import { listUsers } from "../../lib/adminApi";
import { listRoles } from "../../lib/adminApi";
import { listPermissions } from "../../lib/adminApi";
import { listRegistrationCodes } from "../../lib/api";
import type { User } from "../../types/admin";
import type { Role } from "../../types/admin";
import type { Permission } from "../../types/admin";
import type { RegistrationCode } from "../../types";

export function AdminDashboard() {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    users: 0,
    roles: 0,
    permissions: 0,
    codes: 0
  });

  useEffect(() => {
    async function loadStats() {
      try {
        const [users, roles, permissions, codes] = await Promise.all([
          listUsers(),
          listRoles(),
          listPermissions(),
          listRegistrationCodes().then(r => r.codes)
        ]);
        setStats({
          users: users.length,
          roles: roles.length,
          permissions: permissions.length,
          codes: codes.length
        });
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
      <h1 className="mb-6 text-xl font-bold text-ink-900">管理后台概览</h1>
      <Spin spinning={loading}>
        <Row gutter={[16, 16]}>
          <Col xs={24} sm={12} lg={6}>
            <Card>
              <Statistic
                title="用户总数"
                value={stats.users}
                prefix={<UserOutlined className="text-accent-500" />}
              />
            </Card>
          </Col>
          <Col xs={24} sm={12} lg={6}>
            <Card>
              <Statistic
                title="角色总数"
                value={stats.roles}
                prefix={<SafetyCertificateOutlined className="text-accent-500" />}
              />
            </Card>
          </Col>
          <Col xs={24} sm={12} lg={6}>
            <Card>
              <Statistic
                title="权限总数"
                value={stats.permissions}
                prefix={<KeyOutlined className="text-accent-500" />}
              />
            </Card>
          </Col>
          <Col xs={24} sm={12} lg={6}>
            <Card>
              <Statistic
                title="注册码总数"
                value={stats.codes}
                prefix={<FileTextOutlined className="text-accent-500" />}
              />
            </Card>
          </Col>
        </Row>
      </Spin>
    </div>
  );
}
