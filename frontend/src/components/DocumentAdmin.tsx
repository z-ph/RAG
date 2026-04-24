import { useEffect, useState, useCallback } from "react";
import {
  App as AntdApp,
  Button,
  Input,
  List,
  Modal,
  Popconfirm,
  Space,
  Spin,
  Typography,
} from "antd";
import {
  CloseOutlined,
  EditOutlined,
  ReloadOutlined,
  SaveOutlined,
} from "@ant-design/icons";
import {
  listPrompts,
  updatePrompt,
  resetPrompt,
  type PromptInfo,
} from "../lib/api";

const { Text } = Typography;
const { TextArea } = Input;

interface DocumentAdminProps {
  onClose?: () => void;
}

export function DocumentAdmin({ onClose }: DocumentAdminProps) {
  const { message } = AntdApp.useApp();
  const [prompts, setPrompts] = useState<PromptInfo[]>([]);
  const [promptsLoading, setPromptsLoading] = useState(false);
  const [editingPrompt, setEditingPrompt] = useState<{
    key: string;
    content: string;
    description: string;
  } | null>(null);
  const [promptSaving, setPromptSaving] = useState(false);

  const fetchPrompts = useCallback(async () => {
    setPromptsLoading(true);
    try {
      const result = await listPrompts();
      setPrompts(result);
    } catch (err) {
      message.error(err instanceof Error ? err.message : "加载提示词失败");
    } finally {
      setPromptsLoading(false);
    }
  }, [message]);

  useEffect(() => {
    fetchPrompts();
  }, [fetchPrompts]);

  const handlePromptSave = useCallback(async () => {
    if (!editingPrompt) return;
    setPromptSaving(true);
    try {
      await updatePrompt(editingPrompt.key, editingPrompt.content, editingPrompt.description);
      message.success("提示词已更新");
      setEditingPrompt(null);
      await fetchPrompts();
    } catch (err) {
      message.error(err instanceof Error ? err.message : "保存失败");
    } finally {
      setPromptSaving(false);
    }
  }, [editingPrompt, message, fetchPrompts]);

  const handlePromptReset = useCallback(
    async (key: string) => {
      try {
        await resetPrompt(key);
        message.success("已恢复默认提示词");
        await fetchPrompts();
      } catch (err) {
        message.error(err instanceof Error ? err.message : "重置失败");
      }
    },
    [message, fetchPrompts]
  );

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-ink-100 px-5 py-3">
        <Text strong className="text-base">
          提示词管理
        </Text>
        <Space>
          <Button size="small" onClick={fetchPrompts} loading={promptsLoading}>
            刷新
          </Button>
          {onClose && (
            <Button size="small" icon={<CloseOutlined />} onClick={onClose} />
          )}
        </Space>
      </div>

      <div className="flex-1 overflow-y-auto px-5 py-3">
        <Spin spinning={promptsLoading}>
          <List
            dataSource={prompts}
            renderItem={(prompt: PromptInfo) => (
              <List.Item
                actions={[
                  <Button
                    key="edit"
                    size="small"
                    icon={<EditOutlined />}
                    onClick={() =>
                      setEditingPrompt({
                        key: prompt.promptKey,
                        content: prompt.promptContent,
                        description: prompt.description || "",
                      })
                    }
                  >
                    编辑
                  </Button>,
                  <Popconfirm
                    key="reset"
                    title="确认恢复默认值?"
                    onConfirm={() => handlePromptReset(prompt.promptKey)}
                  >
                    <Button size="small" icon={<ReloadOutlined />}>
                      重置
                    </Button>
                  </Popconfirm>,
                ]}
              >
                <List.Item.Meta
                  title={<Text strong>{prompt.description || prompt.promptKey}</Text>}
                  description={
                    <Text type="secondary" className="text-xs">
                      {prompt.promptKey}
                      {prompt.updatedAt && ` · 更新于 ${new Date(prompt.updatedAt).toLocaleString()}`}
                    </Text>
                  }
                />
              </List.Item>
            )}
          />
        </Spin>
      </div>

      <Modal
        open={!!editingPrompt}
        title={`编辑提示词 - ${editingPrompt?.description || editingPrompt?.key}`}
        onCancel={() => setEditingPrompt(null)}
        footer={[
          <Button key="cancel" onClick={() => setEditingPrompt(null)}>
            取消
          </Button>,
          <Button
            key="save"
            type="primary"
            icon={<SaveOutlined />}
            loading={promptSaving}
            onClick={handlePromptSave}
          >
            保存
          </Button>,
        ]}
        width={720}
      >
        {editingPrompt && (
          <TextArea
            rows={16}
            value={editingPrompt.content}
            onChange={(e) =>
              setEditingPrompt((prev) =>
                prev ? { ...prev, content: e.target.value } : null
              )
            }
          />
        )}
      </Modal>
    </div>
  );
}
