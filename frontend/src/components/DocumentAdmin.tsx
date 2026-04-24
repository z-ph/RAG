import { useEffect, useState, useCallback } from "react";
import {
  App as AntdApp,
  Button,
  Card,
  Collapse,
  Input,
  List,
  Modal,
  Popconfirm,
  Space,
  Spin,
  Tag,
  Typography,
} from "antd";
import {
  DeleteOutlined,
  EditOutlined,
  ReloadOutlined,
  SaveOutlined,
} from "@ant-design/icons";
import {
  adminListSegments,
  adminUpdateSegment,
  adminDeleteSegment,
  adminReindexDocument,
  listPublicDocuments,
  type AdminSegmentInfo,
} from "../lib/api";
import type { PublicDocumentListItem } from "../types";

const { Text, Paragraph } = Typography;
const { TextArea } = Input;

interface DocumentAdminProps {
  onClose?: () => void;
}

export function DocumentAdmin({ onClose }: DocumentAdminProps) {
  const { message } = AntdApp.useApp();
  const [documents, setDocuments] = useState<PublicDocumentListItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [segments, setSegments] = useState<Record<string, AdminSegmentInfo[]>>({});
  const [segmentsLoading, setSegmentsLoading] = useState<Record<string, boolean>>({});
  const [editingSegment, setEditingSegment] = useState<{
    documentId: string;
    pointId: string;
    text: string;
  } | null>(null);
  const [saving, setSaving] = useState(false);
  const [reindexing, setReindexing] = useState<string | null>(null);

  const fetchDocuments = useCallback(async () => {
    setLoading(true);
    try {
      const result = await listPublicDocuments();
      setDocuments(result.documents || []);
    } catch (err) {
      message.error(err instanceof Error ? err.message : "加载文档列表失败");
    } finally {
      setLoading(false);
    }
  }, [message]);

  useEffect(() => {
    fetchDocuments();
  }, [fetchDocuments]);

  const fetchSegments = useCallback(
    async (documentId: string) => {
      setSegmentsLoading((prev) => ({ ...prev, [documentId]: true }));
      try {
        const result = await adminListSegments(documentId);
        setSegments((prev) => ({ ...prev, [documentId]: result.segments }));
      } catch (err) {
        message.error(err instanceof Error ? err.message : "加载片段失败");
      } finally {
        setSegmentsLoading((prev) => ({ ...prev, [documentId]: false }));
      }
    },
    [message]
  );

  const handleSave = useCallback(async () => {
    if (!editingSegment) return;
    setSaving(true);
    try {
      await adminUpdateSegment(
        editingSegment.documentId,
        editingSegment.pointId,
        editingSegment.text
      );
      message.success("片段已更新");
      setSegments((prev) => {
        const docSegments = prev[editingSegment.documentId] || [];
        return {
          ...prev,
          [editingSegment.documentId]: docSegments.map((s) =>
            s.pointId === editingSegment.pointId
              ? { ...s, text: editingSegment.text }
              : s
          ),
        };
      });
      setEditingSegment(null);
    } catch (err) {
      message.error(err instanceof Error ? err.message : "保存失败");
    } finally {
      setSaving(false);
    }
  }, [editingSegment, message]);

  const handleDelete = useCallback(
    async (documentId: string, pointId: string) => {
      try {
        await adminDeleteSegment(documentId, pointId);
        message.success("片段已删除");
        setSegments((prev) => ({
          ...prev,
          [documentId]: (prev[documentId] || []).filter(
            (s) => s.pointId !== pointId
          ),
        }));
      } catch (err) {
        message.error(err instanceof Error ? err.message : "删除失败");
      }
    },
    [message]
  );

  const handleReindex = useCallback(
    async (documentId: string) => {
      setReindexing(documentId);
      try {
        const result = await adminReindexDocument(documentId);
        message.success(
          `重新索引完成: 删除 ${result.deletedSegments} 个旧片段, 创建 ${result.newSegments} 个新片段`
        );
        await fetchSegments(documentId);
      } catch (err) {
        message.error(err instanceof Error ? err.message : "重新索引失败");
      } finally {
        setReindexing(null);
      }
    },
    [message, fetchSegments]
  );

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-ink-100 px-5 py-3">
        <Text strong className="text-base">
          文档管理
        </Text>
        <Button size="small" onClick={fetchDocuments} loading={loading}>
          刷新
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto px-5 py-3">
        <Spin spinning={loading}>
          <Collapse
            accordion
            onChange={(key) => {
              if (typeof key === "string" && key) {
                fetchSegments(key);
              }
            }}
            items={documents.map((doc) => ({
              key: doc.documentId,
              label: (
                <div className="flex items-center gap-2">
                  <Text strong>{doc.title || doc.filename}</Text>
                  <Tag>{doc.segmentCount} 个片段</Tag>
                  {doc.category && <Tag color="blue">{doc.category}</Tag>}
                </div>
              ),
              extra: (
                <Popconfirm
                  title="确认重新索引?"
                  description="将删除所有片段并从原始文件重新解析"
                  onConfirm={(e) => {
                    e?.stopPropagation();
                    handleReindex(doc.documentId);
                  }}
                  onCancel={(e) => e?.stopPropagation()}
                >
                  <Button
                    size="small"
                    icon={<ReloadOutlined />}
                    loading={reindexing === doc.documentId}
                    onClick={(e) => e.stopPropagation()}
                  >
                    重新索引
                  </Button>
                </Popconfirm>
              ),
              children: segmentsLoading[doc.documentId] ? (
                <Spin />
              ) : (
                <List
                  dataSource={segments[doc.documentId] || []}
                  renderItem={(seg: AdminSegmentInfo) => (
                    <List.Item
                      actions={[
                        <Button
                          key="edit"
                          size="small"
                          icon={<EditOutlined />}
                          onClick={() =>
                            setEditingSegment({
                              documentId: doc.documentId,
                              pointId: seg.pointId,
                              text: seg.text,
                            })
                          }
                        >
                          编辑
                        </Button>,
                        <Popconfirm
                          key="del"
                          title="确认删除此片段?"
                          onConfirm={() =>
                            handleDelete(doc.documentId, seg.pointId)
                          }
                        >
                          <Button size="small" danger icon={<DeleteOutlined />}>
                            删除
                          </Button>
                        </Popconfirm>,
                      ]}
                    >
                      <List.Item.Meta
                        title={
                          <Space>
                            <Text type="secondary">#{seg.chunkIndex}</Text>
                            {seg.title && <Tag>{seg.title}</Tag>}
                            {seg.keywords && (
                              <Text type="secondary" className="text-xs">
                                {seg.keywords}
                              </Text>
                            )}
                          </Space>
                        }
                        description={
                          <Paragraph
                            ellipsis={{ rows: 2, expandable: true }}
                            className="!mb-0"
                          >
                            {seg.text}
                          </Paragraph>
                        }
                      />
                    </List.Item>
                  )}
                />
              ),
            }))}
          />
        </Spin>
      </div>

      <Modal
        open={!!editingSegment}
        title="编辑片段"
        onCancel={() => setEditingSegment(null)}
        footer={[
          <Button key="cancel" onClick={() => setEditingSegment(null)}>
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
        width={640}
      >
        {editingSegment && (
          <TextArea
            rows={10}
            value={editingSegment.text}
            onChange={(e) =>
              setEditingSegment((prev) =>
                prev ? { ...prev, text: e.target.value } : null
              )
            }
          />
        )}
      </Modal>
    </div>
  );
}
