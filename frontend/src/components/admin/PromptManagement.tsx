import { useState, useEffect, useCallback } from "react";
import {
  App as AntdApp,
  Button,
  Input,
  Modal,
  Popconfirm,
  Space,
  Spin,
  Table,
  Typography,
} from "antd";
import {
  EditOutlined,
  ReloadOutlined,
  SaveOutlined,
} from "@ant-design/icons";
import type { ColumnsType } from "antd/es/table";
import {
  listPrompts,
  updatePrompt,
  resetPrompt,
  type PromptInfo,
} from "../../lib/api";

const { Text } = Typography;
const { TextArea } = Input;

export function PromptManagement() {
  const { message } = AntdApp.useApp();
  const [prompts, setPrompts] = useState<PromptInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [editingPrompt, setEditingPrompt] = useState<{
    key: string;
    content: string;
    description: string;
  } | null>(null);
  const [saving, setSaving] = useState(false);

  const fetchPrompts = useCallback(async () => {
    setLoading(true);
    try {
      const result = await listPrompts();
      setPrompts(result);
    } catch (err) {
      message.error(err instanceof Error ? err.message : "加载提示词失败");
    } finally {
      setLoading(false);
    }
  }, [message]);

  useEffect(() => {
    fetchPrompts();
  }, [fetchPrompts]);

  const handleSave = useCallback(async () => {
    if (!editingPrompt) return;
    setSaving(true);
    try {
      await updatePrompt(editingPrompt.key, editingPrompt.content, editingPrompt.description);
      message.success("提示词已更新");
      setEditingPrompt(null);
      await fetchPrompts();
    } catch (err) {
      message.error(err instanceof Error ? err.message : "保存失败");
    } finally {
      setSaving(false);
    }
  }, [editingPrompt, message, fetchPrompts]);

  const handleReset = useCallback(
    async (key: string) => {
      try {
        await resetPrompt(key);
        message.success("已恢复默认提示词");
        await fetchPrompts();
      } catch (err) {
        message.error(err instanceof Error ? err.message : "重置失败");
      }
    },
    [message, fetchPrompts],
  );

  const columns: ColumnsType<PromptInfo> = [
    {
      title: "描述",
      dataIndex: "description",
      key: "description",
      width: 240,
      render: (desc: string, record: PromptInfo) => (
        <Text strong className="text-ink-950">
          {desc || record.promptKey}
        </Text>
      ),
    },
    {
      title: "Key",
      dataIndex: "promptKey",
      key: "promptKey",
      width: 200,
      render: (key: string) => (
        <Text className="font-mono text-xs text-ink-500">{key}</Text>
      ),
    },
    {
      title: "更新时间",
      dataIndex: "updatedAt",
      key: "updatedAt",
      width: 180,
      render: (val: string | null) => (
        <Text type="secondary" className="text-sm">
          {val ? new Date(val).toLocaleString("zh-CN") : "—"}
        </Text>
      ),
    },
    {
      title: "更新者",
      dataIndex: "updatedBy",
      key: "updatedBy",
      width: 120,
      render: (val: string | null) => (
        <Text type="secondary" className="text-sm">{val || "—"}</Text>
      ),
    },
    {
      title: "操作",
      key: "actions",
      width: 180,
      render: (_: unknown, record: PromptInfo) => (
        <Space size={4}>
          <Button
            size="small"
            icon={<EditOutlined />}
            onClick={() =>
              setEditingPrompt({
                key: record.promptKey,
                content: record.promptContent,
                description: record.description || "",
              })
            }
          >
            编辑
          </Button>
          <Popconfirm
            title="确认恢复默认值？"
            description="此操作将覆盖当前自定义内容"
            onConfirm={() => handleReset(record.promptKey)}
            okText="恢复"
            cancelText="取消"
          >
            <Button size="small" icon={<ReloadOutlined />}>
              重置
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div className="flex h-full flex-col">
      <div className="mb-5 flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-ink-950">提示词管理</h2>
          <p className="mt-1 text-sm text-ink-500">
            查看、编辑和重置系统提示词配置。重置将恢复为默认值。
          </p>
        </div>
        <Button icon={<ReloadOutlined />} onClick={fetchPrompts} loading={loading}>
          刷新
        </Button>
      </div>

      <Spin spinning={loading}>
        <Table<PromptInfo>
          rowKey="id"
          columns={columns}
          dataSource={prompts}
          pagination={{ pageSize: 10, showSizeChanger: true, showTotal: (t) => `共 ${t} 条` }}
          scroll={{ x: 920 }}
          size="middle"
          className="[&_.ant-table-thead>tr>th]:!bg-ink-50 [&_.ant-table-thead>tr>th]:!text-ink-700 [&_.ant-table-thead>tr>th]:!font-semibold"
        />
      </Spin>

      <Modal
        open={!!editingPrompt}
        title={`编辑提示词 - ${editingPrompt?.description || editingPrompt?.key}`}
        onCancel={() => setEditingPrompt(null)}
        width={720}
        footer={[
          <Button key="cancel" onClick={() => setEditingPrompt(null)}>
            取消
          </Button>,
          <Button
            key="save"
            type="primary"
            icon={<SaveOutlined />}
            loading={saving}
            onClick={handleSave}
          >
            保存
          </Button>,
        ]}
      >
        {editingPrompt && (
          <TextArea
            rows={16}
            value={editingPrompt.content}
            onChange={(e) =>
              setEditingPrompt((prev) =>
                prev ? { ...prev, content: e.target.value } : null,
              )
            }
            className="mt-4 font-mono text-sm"
          />
        )}
      </Modal>
    </div>
  );
}