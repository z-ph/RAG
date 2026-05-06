import { useNavigate, useOutletContext } from "react-router-dom";
import { DocumentSidebar } from "../components/DocumentSidebar";
import type { DocumentsOutletContext } from "./documentsShared";

export function DocumentsIndexPage() {
  const navigate = useNavigate();
  const { authSession, canManageDocuments, documentLibrary, headerActions } =
    useOutletContext<DocumentsOutletContext>();

  return (
    <main className="h-screen min-h-dvh bg-[#fffaf4]">
      <div className="flex h-full w-full flex-col">
        <DocumentSidebar
          documents={documentLibrary.documents}
          documentsLoading={documentLibrary.documentsLoading}
          uploading={documentLibrary.uploading}
          deletingId={documentLibrary.deletingId}
          reindexingId={documentLibrary.reindexingId}
          fileUploads={documentLibrary.fileUploads}
          authenticated={authSession.authStatus.authenticated}
          canManageDocuments={canManageDocuments}
          onBack={() => navigate("/")}
          onRefreshDocuments={documentLibrary.refreshDocuments}
          onUpload={documentLibrary.handleUpload}
          onDeleteDocument={documentLibrary.handleDeleteDocument}
          onReindexDocument={documentLibrary.handleReindexDocument}
          onCancelUpload={documentLibrary.cancelUpload}
          onViewDocument={(documentId) => navigate(`/documents/${documentId}`)}
          onShowDownloadLink={documentLibrary.handleShowDownloadLink}
          headerActions={headerActions}
        />
      </div>
    </main>
  );
}
