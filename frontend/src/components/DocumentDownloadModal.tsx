import { App as AntdApp, Button, Input, Modal, Space } from "antd";
import { CopyOutlined, DownloadOutlined, LinkOutlined } from "@ant-design/icons";

interface DownloadLinkInfo {
  documentId: string;
  filename: string;
  downloadUrl: string;
}

interface DocumentDownloadModalProps {
  info: DownloadLinkInfo | null;
  onClose: () => void;
}

export function DocumentDownloadModal(props: DocumentDownloadModalProps) {
  const { message } = AntdApp.useApp();

  return (
    <Modal
      open={!!props.info}
      onCancel={props.onClose}
      footer={null}
      closable={false}
      width={420}
      title={null}
    >
      {props.info && (
        <div className="py-2">
          <div className="mb-3 flex items-start gap-2">
            <LinkOutlined className="mt-1 text-accent-500" />
            <div className="min-w-0">
              <p className="text-sm font-medium text-ink-900">
                下载链接
              </p>
              <p className="truncate text-xs text-ink-500">
                {props.info.filename}
              </p>
            </div>
          </div>
          <Space.Compact className="w-full">
            <Input
              readOnly
              value={props.info.downloadUrl}
              className="bg-ink-50"
            />
            <Button
              icon={<CopyOutlined />}
              onClick={() => {
                navigator.clipboard.writeText(props.info!.downloadUrl);
                message.success("链接已复制到剪贴板");
              }}
            >
              复制
            </Button>
            <Button
              type="primary"
              icon={<DownloadOutlined />}
              onClick={() => {
                const link = document.createElement("a");
                link.href = props.info!.downloadUrl;
                link.download = props.info!.filename;
                link.style.display = "none";
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
              }}
            >
              下载
            </Button>
          </Space.Compact>
          <p className="mt-2 text-xs text-ink-500">
            点击"下载"按钮将触发文件下载（部分浏览器可能不支持）
          </p>
        </div>
      )}
    </Modal>
  );
}
