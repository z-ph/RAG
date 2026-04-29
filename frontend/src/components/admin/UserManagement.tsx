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
  Switch,
  Table,
  Tag,
} from "antd";
import { PlusOutlined, ReloadOutlined } from "@ant-design/icons";
import type { ColumnsType } from "antd/es/table";
import {
  listUsers,
  createUser,
  updateUser,
  deleteUser,
  resetUserPassword,
  listRoles,
} from "../../lib/adminApi";
import type { User, CreateUserRequest, UpdateUserRequest } from "../../types/admin";

export function UserManagement() {
  const { message } = AntdApp.useApp();

  const [users, setUsers] = useState<User[]>([]);
  const [roles, setRoles] = useState<{ id: number; code: string; name: string }[]>([]);
  const [loading, setLoading] = useState(false);

  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [createLoading, setCreateLoading] = useState(false);
  const [createForm, setCreateForm] = useState<CreateUserRequest>({
    username: "",
    password: "",
    roleId: 0,
  });

  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editLoading, setEditLoading] = useState(false);
  const [editingUser, setEditingUser] = useState<{
    id: number;
    roleId: number;
    enabled: boolean;
  } | null>(null);

  const [resetModalOpen, setResetModalOpen] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);
  const [resettingUserId, setResettingUserId] = useState<number | null>(null);
  const [newPassword, setNewPassword] = useState("");

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const result = await listUsers();
      setUsers(result);
    } catch (err) {
      message.error(err instanceof Error ? err.message : "加载用户列表失败");
    } finally {
      setLoading(false);
    }
  }, [message]);

  const fetchRoles = useCallback(async () => {
    try {
      const result = await listRoles();
      setRoles(result.map((r) => ({ id: r.id, code: r.code, name: r.name })));
    } catch {
      // Roles are supplementary; don't block the UI on failure
    }
  }, []);

  useEffect(() => {
    fetchUsers();
    fetchRoles();
  }, [fetchUsers, fetchRoles]);

  const handleCreate = useCallback(async () => {
    if (!createForm.username.trim() || !createForm.password.trim() || !createForm.roleId) {
      message.warning("请填写完整信息");
      return;
    }
    setCreateLoading(true);
    try {
      await createUser(createForm);
      message.success("用户创建成功");
      setCreateModalOpen(false);
      setCreateForm({ username: "", password: "", roleId: 0 });
      await fetchUsers();
    } catch (err) {
      message.error(err instanceof Error ? err.message : "创建用户失败");
    } finally {
      setCreateLoading(false);
    }
  }, [createForm, message, fetchUsers]);

  const handleEdit = useCallback(async () => {
    if (!editingUser) return;
    setEditLoading(true);
    try {
      const req: UpdateUserRequest = {
        roleId: editingUser.roleId,
        enabled: editingUser.enabled,
      };
      await updateUser(editingUser.id, req);
      message.success("用户更新成功");
      setEditModalOpen(false);
      setEditingUser(null);
      await fetchUsers();
    } catch (err) {
      message.error(err instanceof Error ? err.message : "更新用户失败");
    } finally {
      setEditLoading(false);
    }
  }, [editingUser, message, fetchUsers]);

  const handleDelete = useCallback(
    async (id: number) => {
      try {
        await deleteUser(id);
        message.success("用户已删除");
        await fetchUsers();
      } catch (err) {
        message.error(err instanceof Error ? err.message : "删除用户失败");
      }
    },
    [message, fetchUsers],
  );

  const handleResetPassword = useCallback(async () => {
    if (!resettingUserId || !newPassword.trim()) {
      message.warning("请输入新密码");
      return;
    }
    setResetLoading(true);
    try {
      await resetUserPassword(resettingUserId, { newPassword });
      message.success("密码重置成功");
      setResetModalOpen(false);
      setResettingUserId(null);
      setNewPassword("");
    } catch (err) {
      message.error(err instanceof Error ? err.message : "重置密码失败");
    } finally {
      setResetLoading(false);
    }
  }, [resettingUserId, newPassword, message]);

  const columns: ColumnsType<User> = [
    {
      title: "ID",
      dataIndex: "id",
      key: "id",
      width: 64,
    },
    {
      title: "用户名",
      dataIndex: "username",
      key: "username",
    },
    {
      title: "角色",
      dataIndex: "roleName",
      key: "roleName",
      render: (name: string, record: User) => (
        <Tag color={record.role === "SUPER_ADMIN" ? "red" : record.role === "ADMIN" ? "orange" : "blue"}>
          {name}
        </Tag>
      ),
    },
    {
      title: "状态",
      dataIndex: "enabled",
      key: "enabled",
      width: 80,
      render: (enabled: boolean) => (
        <Tag color={enabled ? "green" : "default"}>{enabled ? "启用" : "禁用"}</Tag>
      ),
    },
    {
      title: "创建时间",
      dataIndex: "createdAt",
      key: "createdAt",
      width: 180,
      render: (val: string) => new Date(val).toLocaleString(),
    },
    {
      title: "操作",
      key: "actions",
      width: 240,
      render: (_: unknown, record: User) => (
        <Space size="small">
          <Button
            size="small"
            onClick={() => {
              setEditingUser({
                id: record.id,
                roleId: roles.find((r) => r.code === record.role)?.id ?? record.id,
                enabled: record.enabled,
              });
              setEditModalOpen(true);
            }}
          >
            编辑
          </Button>
          <Button size="small" onClick={() => {
            setResettingUserId(record.id);
            setNewPassword("");
            setResetModalOpen(true);
          }}>
            重置密码
          </Button>
          <Popconfirm
            title="确认删除该用户？"
            description="此操作不可撤销"
            onConfirm={() => handleDelete(record.id)}
          >
            <Button size="small" danger>删除</Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div className="flex h-full flex-col">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-ink-950">用户管理</h2>
        <Space>
          <Button icon={<ReloadOutlined />} onClick={fetchUsers} loading={loading}>
            刷新
          </Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreateModalOpen(true)}>
            创建用户
          </Button>
        </Space>
      </div>

      <Spin spinning={loading}>
        <Table<User>
          rowKey="id"
          columns={columns}
          dataSource={users}
          pagination={{ pageSize: 10, showSizeChanger: true, showTotal: (t) => `共 ${t} 条` }}
          locale={{ emptyText: "暂无用户数据" }}
        />
      </Spin>

      {/* Create User Modal */}
      <Modal
        open={createModalOpen}
        title="创建用户"
        onCancel={() => {
          setCreateModalOpen(false);
          setCreateForm({ username: "", password: "", roleId: 0 });
        }}
        onOk={handleCreate}
        confirmLoading={createLoading}
        okText="创建"
        cancelText="取消"
      >
        <div className="flex flex-col gap-4 py-2">
          <div>
            <label className="mb-1 block text-sm font-medium text-ink-700">用户名</label>
            <Input
              placeholder="请输入用户名"
              value={createForm.username}
              onChange={(e) => setCreateForm((prev) => ({ ...prev, username: e.target.value }))}
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-ink-700">密码</label>
            <Input.Password
              placeholder="请输入密码"
              value={createForm.password}
              onChange={(e) => setCreateForm((prev) => ({ ...prev, password: e.target.value }))}
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-ink-700">角色</label>
            <Select
              className="w-full"
              placeholder="请选择角色"
              value={createForm.roleId || undefined}
              onChange={(val) => setCreateForm((prev) => ({ ...prev, roleId: val }))}
              options={roles.map((r) => ({ label: r.name, value: r.id }))}
            />
          </div>
        </div>
      </Modal>

      {/* Edit User Modal */}
      <Modal
        open={editModalOpen}
        title="编辑用户"
        onCancel={() => {
          setEditModalOpen(false);
          setEditingUser(null);
        }}
        onOk={handleEdit}
        confirmLoading={editLoading}
        okText="保存"
        cancelText="取消"
      >
        {editingUser && (
          <div className="flex flex-col gap-4 py-2">
            <div>
              <label className="mb-1 block text-sm font-medium text-ink-700">角色</label>
              <Select
                className="w-full"
                value={editingUser.roleId}
                onChange={(val) => setEditingUser((prev) => prev ? { ...prev, roleId: val } : null)}
                options={roles.map((r) => ({ label: r.name, value: r.id }))}
              />
            </div>
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium text-ink-700">启用状态</label>
              <Switch
                checked={editingUser.enabled}
                onChange={(checked) => setEditingUser((prev) => prev ? { ...prev, enabled: checked } : null)}
              />
            </div>
          </div>
        )}
      </Modal>

      {/* Reset Password Modal */}
      <Modal
        open={resetModalOpen}
        title="重置密码"
        onCancel={() => {
          setResetModalOpen(false);
          setResettingUserId(null);
          setNewPassword("");
        }}
        onOk={handleResetPassword}
        confirmLoading={resetLoading}
        okText="重置"
        cancelText="取消"
      >
        <div className="py-2">
          <label className="mb-1 block text-sm font-medium text-ink-700">新密码</label>
          <Input.Password
            placeholder="请输入新密码"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
          />
        </div>
      </Modal>
    </div>
  );
}