import { DocumentLibrary } from "@/components/documents/document-library";
import { AppShell } from "@/components/layout/app-shell";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Database, SearchCheck } from "lucide-react";

export default function LibraryPage() {
  return (
    <AppShell>
      <PageHeader
        actions={
          <>
            <Badge>
              <Database className="mr-1 h-3.5 w-3.5" aria-hidden="true" />
              Knowledge base
            </Badge>
            <Badge variant="success">
              <SearchCheck className="mr-1 h-3.5 w-3.5" aria-hidden="true" />
              Retrieval ready
            </Badge>
          </>
        }
        description="Browse uploaded knowledge files, inspect indexing status, and prepare documents for retrieval."
        eyebrow="Knowledge base"
        title="Document library"
      />
      <DocumentLibrary />
    </AppShell>
  );
}
