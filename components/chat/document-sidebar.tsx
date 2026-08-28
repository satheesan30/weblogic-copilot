"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, FileCode2, FileText, Server } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { StoredDocument } from "@/types/backend";

export function DocumentSidebar() {
  const [documents, setDocuments] = useState<StoredDocument[]>([]);

  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      try {
        const response = await fetch("/api/documents", { signal: controller.signal });
        if (!response.ok) return;
        const payload = await response.json();
        setDocuments((payload.documents || []).slice(0, 3));
      } catch {
        // Ignore transient failures; the rail stays empty.
      }
    }

    load();
    const interval = setInterval(load, 10_000);
    return () => {
      controller.abort();
      clearInterval(interval);
    };
  }, []);

  return (
    <aside className="desk-panel p-4">
      <div className="mb-4 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Server className="h-4 w-4 text-forest" aria-hidden="true" />
          <h2 className="font-display font-semibold text-ink">Evidence rail</h2>
        </div>
        <Badge variant={documents.length ? "success" : "outline"}>{documents.length ? "Healthy" : "Empty"}</Badge>
      </div>
      {documents.length ? (
        <div className="grid gap-3">
          {documents.map((document) => (
            <div className="border border-line bg-paper-2/50 p-3" key={document.id}>
              <div className="flex items-start gap-3">
                {document.type === "XML" ? (
                  <FileCode2 className="mt-0.5 h-4 w-4 text-forest" />
                ) : (
                  <FileText className="mt-0.5 h-4 w-4 text-forest" />
                )}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-ink">{document.filename}</p>
                  <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.12em] text-ink-soft">{document.size}</p>
                </div>
              </div>
              <Badge className="mt-3" variant={document.status === "Indexed" ? "success" : document.status === "Failed" ? "danger" : "warning"}>
                {document.status}
              </Badge>
            </div>
          ))}
        </div>
      ) : (
        <p className="border border-dashed border-line bg-paper-2/40 p-3 text-sm leading-6 text-ink-soft">
          No evidence indexed yet. Upload a log or runbook to ground chat answers.
        </p>
      )}
      <div className="mt-4 border border-forest/25 bg-forest/10 p-3 text-sm text-forest-deep">
        <div className="flex items-center gap-2 font-semibold">
          <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
          Sources up to date
        </div>
        <p className="mt-1 text-xs leading-5 text-forest">Indexed chunks are ready for retrieval and citation checks.</p>
      </div>
    </aside>
  );
}
