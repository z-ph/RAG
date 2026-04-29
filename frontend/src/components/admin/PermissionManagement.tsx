import { useEffect, useState, useCallback } from "react";
import { App as AntdApp, Button, Empty, Space, Spin, Table, Tag } from "antd";
import { ReloadOutlined } from "@ant-design/icons";
import type { ColumnsType } from "antd/es/table";
import { listPermissions } from "../../lib/adminApi";
import type { Permission } from "../../types/admin";

export function PermissionManagement() {
  const { message } = AntdApp.useApp();

  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchPermissions = useCallback(async () => {
    setLoading(true);
    try {
      const result = await listPermissions();
      setPermissions(result);
    } catch (err) {
      message.error(err instanceof Error ? err.message : "加载权限列表失败");
    } finally {
      setLoading(false);
    }
  }, [message]);

  useEffect(() => {
    fetchPermissions();
  }, [fetchPermissions]);

  const columns: ColumnsType<Permission> = [
    {
      title: "ID",
      dataIndex: "id",
      key: "id",
      width: 64,
    },
    {
      title: "编码",
      dataIndex: "code",
      key: "code",
      render: (code: string) => <Tag color="blue">{code}</Tag>,
    },
    {
      title: "名称",
      dataIndex: "name",
      key: "name",
    },
    {
      title: "描述",
      dataIndex: "description",
      key: "description",
      ellipsis: true,
    },
    {
      title: "模块",
      dataIndex: "module",
      key: "module",
      render: (module: string) => <Tag color="geekblue">{module}</Tag>,
    },
  ];

  return (
    <div className="flex h-full flex-col">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-ink-950">权限管理</h2>
        <Button icon={<ReloadOutlined />} onClick={fetchPermissions} loading={loading}>
          刷新
        </Button>
      </div>

      <Spin spinning={loading}>
        <Table<Permission>
          rowKey="id"
          columns={columns}
          dataSource={permissions}
          pagination={{ pageSize: 10, showSizeChanger: true, showTotal: (t) => `共 ${t} 条` }}
          locale={{ emptyText: <Empty description="暂无权限数据" /> }}
        />
      </Spin>
    </div>
  );
}