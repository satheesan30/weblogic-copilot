import { DocumentMetadataPreview } from "@/components/documents/document-metadata";
import { UploadStatusCards } from "@/components/documents/upload-status-cards";
import { UploadZone } from "@/components/documents/upload-zone";
import { AppShell } from "@/components/layout/app-shell";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { FileUp, Layers3 } from "lucide-react";

export default function UploadPage() {
  return (
    <AppShell>
      <PageHeader
        actions={
          <>
            <Badge>
              <FileUp className="mr-1 h-3.5 w-3.5" aria-hidden="true" />
              Logs and docs
            </Badge>
            <Badge variant="success">
              <Layers3 className="mr-1 h-3.5 w-3.5" aria-hidden="true" />
              Chunk and index
            </Badge>
          </>
        }
        description="Upload WebLogic logs up to 1 GB. Large files are transferred in 8 MB parts, then streamed into embedding chunks for RAG."
        eyebrow="Documents"
        title="Upload documents"
      />
      <div className="grid gap-5">
        <UploadZone />
        <UploadStatusCards />
        <DocumentMetadataPreview />
      </div>
    </AppShell>
  );
}
