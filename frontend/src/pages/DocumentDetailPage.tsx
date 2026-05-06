import { Button } from "antd";
import { useEffect } from "react";
import { useNavigate, useOutletContext, useParams } from "react-router-dom";
import { DocumentDetail } from "../components/DocumentDetail";
import type { DocumentsOutletContext } from "./documentsShared";

export function DocumentDetailPage() {
  const navigate = useNavigate();
  const { documentId } = useParams<{ documentId: string }>();
  const { documentLibrary, headerActions } = useOutletContext<DocumentsOutletContext>();
  const { handleShowDownloadLink, viewingDocument, viewingLoading } = documentLibrary;

  useEffect(() => {
    if (!documentId) {
      return;
    }

    void documentLibrary.handleViewDocument(documentId);
  }, [documentId]);

  return (
    <main className="h-screen min-h-dvh bg-[#fffaf4]">
      <div className="flex h-full w-full flex-col">
        <DocumentDetail
          detail={viewingDocument}
          loading={viewingLoading}
          onBack={() => navigate("/documents")}
          onDownload={handleShowDownloadLink}
          headerActions={headerActions}
          emptyState={documentId ? undefined : (
            <div className="space-y-4">
              <p className="text-sm text-ink-500">缺少文档 ID，无法加载详情。</p>
              <Button onClick={() => navigate("/documents")}>
                返回文档控制台
              </Button>
            </div>
          )}
        />
      </div>
    </main>
  );
}
