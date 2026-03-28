import {
  CloudUploadOutlined,
  DatabaseOutlined,
  DeleteOutlined,
  LoadingOutlined,
  MenuFoldOutlined,
  ReloadOutlined
} from "@ant-design/icons";
import {
  Button,
  Empty,
  List,
  Spin,
  Tag,
  Typography,
  Upload,
  type UploadProps
} from "antd";
import type { DocumentListItem, HealthState } from "../types";
import { HealthBadge } from "./HealthBadge";

interface DocumentSidebarProps {
  documents: DocumentListItem[];
  documentsLoading: boolean;
  uploading: boolean;
  deletingId: string | null;
  ragHealth: HealthState;
  documentHealth: HealthState;
  refreshingHealth: boolean;
  onToggleCollapse: () => void;
  onRefreshDocuments: () => Promise<void>;
  onRefreshHealth: () => Promise<void>;
  onUpload: (file: File) => Promise<void>;
  onDeleteDocument: (documentId: string) => Promise<void>;
}

export function DocumentSidebar(props: DocumentSidebarProps) {
  const uploadProps: UploadProps = {
    accept: ".pdf,.txt",
    multiple: false,
    showUploadList: false,
    beforeUpload(file) {
      void props.onUpload(file);
      return false;
    }
  };

  const refreshing = props.documentsLoading || props.refreshingHealth;

  function refreshAll() {
    void props.onRefreshDocuments();
    void props.onRefreshHealth();
  }

  return (
    <aside className="surface panel-side">
      <div className="panel-header">
        <div>
          <Tag color="orange" bordered={false}>
            Knowledge Base
          </Tag>
          <Typography.Title level={3} className="panel-title">
            文档控制台
          </Typography.Title>
          <Typography.Paragraph className="panel-copy">
            把 PDF 和 TXT 推进知识库，再用右侧对话流直接验证检索与生成效果。
          </Typography.Paragraph>
        </div>
        <div className="sidebar-header-actions">
          <Button icon={<ReloadOutlined />} onClick={refreshAll} loading={refreshing}>
            刷新
          </Button>
          <Button
            type="text"
            shape="circle"
            icon={<MenuFoldOutlined />}
            onClick={props.onToggleCollapse}
            title="收起文档侧边栏"
          />
        </div>
      </div>

      <div className="status-row">
        <HealthBadge label="RAG" state={props.ragHealth} />
        <HealthBadge label="文档" state={props.documentHealth} />
        <Tag icon={<DatabaseOutlined />} bordered={false} className="health-tag">
          {props.documents.length} 份文档
        </Tag>
      </div>

      <div className="upload-panel">
        <div className="upload-copy">
          <CloudUploadOutlined />
          <span>支持 PDF / TXT，上传后自动切分并向量化</span>
        </div>
        <Upload {...uploadProps}>
          <Button
            type="primary"
            icon={props.uploading ? <LoadingOutlined /> : <CloudUploadOutlined />}
            loading={props.uploading}
            block
          >
            上传知识文档
          </Button>
        </Upload>
      </div>

      <div className="documents-section">
        <div className="section-heading">
          <span>已入库文档</span>
          <Button
            type="text"
            size="small"
            icon={<ReloadOutlined />}
            onClick={() => void props.onRefreshDocuments()}
          >
            重载
          </Button>
        </div>

        {props.documentsLoading ? (
          <div className="empty-state">
            <Spin />
          </div>
        ) : props.documents.length === 0 ? (
          <div className="empty-state">
            <Empty
              description="还没有文档，先上传一份试试"
              image={Empty.PRESENTED_IMAGE_SIMPLE}
            />
          </div>
        ) : (
          <List
            dataSource={props.documents}
            className="documents-list"
            renderItem={(item) => (
              <List.Item
                key={item.documentId}
                actions={[
                  <Button
                    key="delete"
                    danger
                    type="text"
                    icon={<DeleteOutlined />}
                    loading={props.deletingId === item.documentId}
                    onClick={() => void props.onDeleteDocument(item.documentId)}
                  >
                    删除
                  </Button>
                ]}
              >
                <List.Item.Meta
                  title={item.filename}
                  description={`文档 ID: ${item.documentId}`}
                />
                <Tag bordered={false}>{item.segmentCount} 段</Tag>
              </List.Item>
            )}
          />
        )}
      </div>
    </aside>
  );
}
