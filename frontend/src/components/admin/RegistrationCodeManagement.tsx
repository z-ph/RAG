import { useState, useEffect, useCallback } from "react";
import {
  App as AntdApp,
  Button,
  DatePicker,
  Form,
  Input,
  Modal,
  Popconfirm,
  Space,
  Spin,
  Table,
  Tag,
} from "antd";
import {
  DeleteOutlined,
  KeyOutlined,
  PlusOutlined,
  ReloadOutlined,
  StopOutlined,
} from "@ant-design/icons";
import type { ColumnsType } from "antd/es/table";
import {
  listRegistrationCodes,
  createRegistrationCode,
  disableRegistrationCode,
  deleteRegistrationCode,
} from "../../lib/api";
import type { RegistrationCode } from "../../types";

const dateFormatter = new Intl.DateTimeFormat("zh-CN", {
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
});

function formatDate(value?: string | null): string {
  if (!value) return "—";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return dateFormatter.format(parsed);
}

function statusLabel(status: string): string {
  switch (status) {
    case "USED":
      return "已使用";
    case "DISABLED":
      return "已禁用";
    case "EXPIRED":
      return "已过期";
    default:
      return "可用";
  }
}

function statusColor(status: string): string {
  switch (status) {
    case "USED":
      return "blue";
    case "DISABLED":
      return "red";
    case "EXPIRED":
      return "orange";
    default:
      return "green";
  }
}

interface CreateCodeFormValues {
  note?: string;
  expiresAt?: string;
}

export function RegistrationCodeManagement() {
  const { message } = AntdApp.useApp();
  const [codes, setCodes] = useState<RegistrationCode[]>([]);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [mutatingId, setMutatingId] = useState<number | null>(null);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [createForm] = Form.useForm<CreateCodeFormValues>();

  const fetchCodes = useCallback(async () => {
    setLoading(true);
    try {
      const result = await listRegistrationCodes();
      setCodes(result.codes);
    } catch (err) {
      message.error(err instanceof Error ? err.message : "加载注册码失败");
    } finally {
      setLoading(false);
    }
  }, [message]);

  useEffect(() => {
    fetchCodes();
  }, [fetchCodes]);

  const handleCreate = useCallback(
    async (values: CreateCodeFormValues) => {
      setCreating(true);
      try {
        const result = await createRegistrationCode({
          note: values.note?.trim() || null,
          expiresAt: values.expiresAt || null,
        });
        message.success(`注册码已创建：${result.code}`);
        setCreateModalOpen(false);
        createForm.resetFields();
        await fetchCodes();
      } catch (err) {
        message.error(err instanceof Error ? err.message : "创建注册码失败");
      } finally {
        setCreating(false);
      }
    },
    [message, fetchCodes, createForm],
  );

  const handleDisable = useCallback(
    async (id: number) => {
      setMutatingId(id);
      try {
        await disableRegistrationCode(id);
        message.success("注册码已禁用");
        await fetchCodes();
      } catch (err) {
        message.error(err instanceof Error ? err.message : "禁用注册码失败");
      } finally {
        setMutatingId(null);
      }
    },
    [message, fetchCodes],
  );

  const handleDelete = useCallback(
    async (id: number) => {
      setMutatingId(id);
      try {
        const result = await deleteRegistrationCode(id);
        message.success(result.message);
        await fetchCodes();
      } catch (err) {
        message.error(err instanceof Error ? err.message : "删除注册码失败");
      } finally {
        setMutatingId(null);
      }
    },
    [message, fetchCodes],
  );

  const columns: ColumnsType<RegistrationCode> = [
    {
      title: "注册码",
      dataIndex: "code",
      key: "code",
      width: 200,
      render: (code: string) => (
        <span className="inline-flex items-center gap-1.5 bg-ink-950/6 px-3 py-0.5 text-xs font-semibold tracking-[0.14em] text-ink-900">
          <KeyOutlined className="text-[10px]" />
          {code}
        </span>
      ),
    },
    {
      title: "备注",
      dataIndex: "note",
      key: "note",
      width: 180,
      render: (note?: string | null) => (
        <span className="text-sm text-ink-700">{note || "—"}</span>
      ),
    },
    {
      title: "创建者",
      dataIndex: "createdBy",
      key: "createdBy",
      width: 100,
    },
    {
      title: "创建时间",
      dataIndex: "createdAt",
      key: "createdAt",
      width: 160,
      render: (val: string) => (
        <span className="text-sm text-ink-500">{formatDate(val)}</span>
      ),
    },
    {
      title: "过期时间",
      dataIndex: "expiresAt",
      key: "expiresAt",
      width: 160,
      render: (val?: string | null) => (
        <span className="text-sm text-ink-500">
          {val ? formatDate(val) : "长期有效"}
        </span>
      ),
    },
    {
      title: "状态",
      dataIndex: "status",
      key: "status",
      width: 100,
      render: (status: string) => (
        <Tag color={statusColor(status)} bordered={false}>
          {statusLabel(status)}
        </Tag>
      ),
    },
    {
      title: "使用者",
      dataIndex: "usedBy",
      key: "usedBy",
      width: 100,
      render: (usedBy?: string | null) => (
        <span className="text-sm text-ink-500">{usedBy || "—"}</span>
      ),
    },
    {
      title: "操作",
      key: "actions",
      width: 180,
      render: (_: unknown, record: RegistrationCode) => (
        <Space size={4}>
          <Button
            size="small"
            icon={<StopOutlined />}
            disabled={record.status !== "AVAILABLE"}
            loading={mutatingId === record.id}
            onClick={() => handleDisable(record.id)}
          >
            禁用
          </Button>
          <Popconfirm
            title="确认删除此注册码？"
            description="删除后无法恢复"
            onConfirm={() => handleDelete(record.id)}
            okText="删除"
            cancelText="取消"
          >
            <Button
              size="small"
              danger
              type="text"
              icon={<DeleteOutlined />}
              loading={mutatingId === record.id}
            >
              删除
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div className="flex h-full flex-col">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold uppercase tracking-wider text-ink-950">注册码管理</h2>
          <p className="mt-1 text-xs text-ink-500 uppercase tracking-wider">
            生成一次性注册码，支持禁用和删除
          </p>
        </div>
        <Space>
          <Button icon={<ReloadOutlined />} onClick={fetchCodes} loading={loading}>
            刷新
          </Button>
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => setCreateModalOpen(true)}
          >
            创建注册码
          </Button>
        </Space>
      </div>

      <Spin spinning={loading}>
        <div className="border border-ink-300">
          <Table<RegistrationCode>
            rowKey="id"
            columns={columns}
            dataSource={codes}
            pagination={{ pageSize: 10, showSizeChanger: true, showTotal: (t) => `共 ${t} 条` }}
            scroll={{ x: 1200 }}
            size="middle"
          />
        </div>
      </Spin>

      <Modal
        open={createModalOpen}
        title="创建注册码"
        onCancel={() => {
          setCreateModalOpen(false);
          createForm.resetFields();
        }}
        footer={null}
        width={480}
      >
        <Form<CreateCodeFormValues>
          form={createForm}
          layout="vertical"
          onFinish={handleCreate}
          className="mt-4"
        >
          <Form.Item label="备注" name="note">
            <Input placeholder="例如：运维同事 / 试用账号" />
          </Form.Item>
          <Form.Item
            label="有效期截止时间"
            name="expiresAt"
            extra="留空表示不限制有效期"
          >
            <DatePicker
              showTime
              className="w-full"
              format="YYYY-MM-DD HH:mm"
              placeholder="选择过期时间"
            />
          </Form.Item>
          <Form.Item className="mb-0">
            <Space>
              <Button type="primary" htmlType="submit" loading={creating}>
                创建
              </Button>
              <Button
                onClick={() => {
                  setCreateModalOpen(false);
                  createForm.resetFields();
                }}
              >
                取消
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}