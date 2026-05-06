import type { ReactNode } from "react";
import type { AuthSessionState } from "../hooks/useAuthSession";
import type { DocumentLibraryState } from "../hooks/useDocumentLibrary";

export interface DocumentsOutletContext {
  authSession: AuthSessionState;
  documentLibrary: DocumentLibraryState;
  canManageDocuments: boolean;
  headerActions: ReactNode;
}
