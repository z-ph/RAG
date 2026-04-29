import { useEffect, useState, useCallback } from "react";
import {
  App as AntdApp,
  Button,
  Input,
  Modal,
  Popconfirm,
  Select,
  Space,
  Spin,
  Table,
  Tag,
  Tooltip,
} from "antd";
import { PlusOutlined, ReloadOutlined } from "@ant-design/icons";
import type { ColumnsType } from "antd/es/table";
import {
  listRoles,
  createRole,
  updateRole,
  deleteRole,
  listPermissions,
} from "../../lib/adminApi";
import type { Role, Permission, CreateRoleRequest, UpdateRoleRequest } from "../../types/admin";

const BUILTIN_ROLES = new Set(["SUPER_ADMIN", "ADMIN", "USER"]);

export function RoleManagement() {
  const { message } = AntdApp.useApp();

  const [roles, setRoles] = useState<Role[]>([]);
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [loading, setLoading] = useState(false);

  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [createLoading, setCreateLoading] = useState(false);
  const [createForm, setCreateForm] = useState<CreateRoleRequest>({
    code: "",
    name: "",
    description: "",
    permissionIds: [],
  });

  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editLoading, setEditLoading] = useState(false);
  const [editingRole, setEditingRole] = useState<{
    id: number;
    name: string;
    description: string;
    permissionIds: number[];
  } | null>(null);

  const fetchRoles = useCallback(async () => {
    setLoading(true);
    try {
      const result = await listRoles();
      setRoles(result);
    } catch (err) {
      message.error(err instanceof Error ? err.message : "加载角色列表失败");
    } finally {
      setLoading(false);
    }
  }, [message]);

  const fetchPermissions = useCallback(async () => {
    try {
      const result = await listPermissions();
      setPermissions(result);
    } catch {
      // Permissions are supplementary; don't block the UI on failure
    }
  }, []);

  useEffect(() => {
    fetchRoles();
    fetchPermissions();
  }, [fetchRoles, fetchPermissions]);

  const handleCreate = useCallback(async () => {
    if (!createForm.code.trim() || !createForm.name.trim()) {
      message.warning("请填写角色编码和名称");
      return;
    }
    setCreateLoading(true);
    try {
      await createRole(createForm);
      message.success("角色创建成功");
      setCreateModalOpen(false);
      setCreateForm({ code: "", name: "", description: "", permissionIds: [] });
      await fetchRoles();
    } catch (err) {
      message.error(err instanceof Error ? err.message : "创建角色失败");
    } finally {
      setCreateLoading(false);
    }
  }, [createForm, message, fetchRoles]);

  const handleEdit = useCallback(async () => {
    if (!editingRole) return;
    setEditLoading(true);
    try {
      const req: UpdateRoleRequest = {
        name: editingRole.name,
        description: editingRole.description,
        permissionIds: editingRole.permissionIds,
      };
      await updateRole(editingRole.id, req);
      message.success("角色更新成功");
      setEditModalOpen(false);
      setEditingRole(null);
      await fetchRoles();
    } catch (err) {
      message.error(err instanceof Error ? err.message : "更新角色失败");
    } finally {
      setEditLoading(false);
    }
  }, [editingRole, message, fetchRoles]);

  const handleDelete = useCallback(
    async (id: number) => {
      try {
        await deleteRole(id);
        message.success("角色已删除");
        await fetchRoles();
      } catch (err) {
        message.error(err instanceof Error ? err.message : "删除角色失败");
      }
    },
    [message, fetchRoles],
  );

  const columns: ColumnsType<Role> = [
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
      render: (code: string) => (
        <Tag color={BUILTIN_ROLES.has(code) ? "red" : "default"}>{code}</Tag>
      ),
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
      title: "权限",
      dataIndex: "permissions",
      key: "permissions",
      width: 280,
      render: (perms: Permission[]) =>
        perms.length > 0 ? (
          <span className="flex flex-wrap gap-1">
            {perms.map((p) => (
              <Tag key={p.id} color="blue">{p.name}</Tag>
            ))}
          </span>
        ) : (
          <Tag>无权限</Tag>
        ),
    },
    {
      title: "操作",
      key: "actions",
      width: 160,
      render: (_: unknown, record: Role) => (
        <Space size="small">
          <Button
            size="small"
            onClick={() => {
              setEditingRole({
                id: record.id,
                name: record.name,
                description: record.description,
                permissionIds: record.permissions.map((p) => p.id),
              });
              setEditModalOpen(true);
            }}
          >
            编辑
          </Button>
          {BUILTIN_ROLES.has(record.code) ? (
            <Tooltip title="内置角色不可删除">
              <Button size="small" danger disabled>
                删除
              </Button>
            </Tooltip>
          ) : (
            <Popconfirm
              title="确认删除该角色？"
              description="此操作不可撤销"
              onConfirm={() => handleDelete(record.id)}
            >
              <Button size="small" danger>删除</Button>
            </Popconfirm>
          )}
        </Space>
      ),
    },
  ];

  return (
    <div className="flex h-full flex-col">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-ink-950">角色管理</h2>
        <Space>
          <Button icon={<ReloadOutlined />} onClick={fetchRoles} loading={loading}>
            刷新
          </Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreateModalOpen(true)}>
            创建角色
          </Button>
        </Space>
      </div>

      <Spin spinning={loading}>
        <Table<Role>
          rowKey="id"
          columns={columns}
          dataSource={roles}
          pagination={{ pageSize: 10, showSizeChanger: true, showTotal: (t) => `共 ${t} 条` }}
          locale={{ emptyText: "暂无角色数据" }}
        />
      </Spin>

      {/* Create Role Modal */}
      <Modal
        open={createModalOpen}
        title="创建角色"
        onCancel={() => {
          setCreateModalOpen(false);
          setCreateForm({ code: "", name: "", description: "", permissionIds: [] });
        }}
        onOk={handleCreate}
        confirmLoading={createLoading}
        okText="创建"
        cancelText="取消"
      >
        <div className="flex flex-col gap-4 py-2">
          <div>
            <label className="mb-1 block text-sm font-medium text-ink-700">角色编码</label>
            <Input
              placeholder="如: EDITOR"
              value={createForm.code}
              onChange={(e) => setCreateForm((prev) => ({ ...prev, code: e.target.value }))}
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-ink-700">角色名称</label>
            <Input
              placeholder="如: 编辑员"
              value={createForm.name}
              onChange={(e) => setCreateForm((prev) => ({ ...prev, name: e.target.value }))}
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-ink-700">描述</label>
            <Input
              placeholder="角色描述（可选）"
              value={createForm.description}
              onChange={(e) => setCreateForm((prev) => ({ ...prev, description: e.target.value }))}
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-ink-700">权限</label>
            <Select
              mode="multiple"
              className="w-full"
              placeholder="选择权限"
              value={createForm.permissionIds}
              onChange={(val) => setCreateForm((prev) => ({ ...prev, permissionIds: val }))}
              options={permissions.map((p) => ({ label: `${p.name} (${p.code})`, value: p.id }))}
            />
          </div>
        </div>
      </Modal>

      {/* Edit Role Modal */}
      <Modal
        open={editModalOpen}
        title="编辑角色"
        onCancel={() => {
          setEditModalOpen(false);
          setEditingRole(null);
        }}
        onOk={handleEdit}
        confirmLoading={editLoading}
        okText="保存"
        cancelText="取消"
      >
        {editingRole && (
          <div className="flex flex-col gap-4 py-2">
            <div>
              <label className="mb-1 block text-sm font-medium text-ink-700">角色名称</label>
              <Input
                value={editingRole.name}
                onChange={(e) => setEditingRole((prev) => prev ? { ...prev, name: e.target.value } : null)}
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-ink-700">描述</label>
              <Input
                value={editingRole.description}
                onChange={(e) => setEditingRole((prev) => prev ? { ...prev, description: e.target.value } : null)}
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-ink-700">权限</label>
              <Select
                mode="multiple"
                className="w-full"
                placeholder="选择权限"
                value={editingRole.permissionIds}
                onChange={(val) => setEditingRole((prev) => prev ? { ...prev, permissionIds: val } : null)}
                options={permissions.map((p) => ({ label: `${p.name} (${p.code})`, value: p.id }))}
              />
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}