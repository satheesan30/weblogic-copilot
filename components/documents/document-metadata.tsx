"use client";

import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { StoredDocument } from "@/types/backend";

export function DocumentMetadataPreview() {
  const [documents, setDocuments] = useState<StoredDocument[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      try {
        const response = await fetch("/api/documents", { signal: controller.signal });
        if (!response.ok) return;
        const payload = await response.json();
        setDocuments((payload.documents || []).slice(0, 3));
      } catch {
        // Ignore transient failures.
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }

    load();
    const interval = setInterval(load, 5_000);
    return () => {
      controller.abort();
      clearInterval(interval);
    };
  }, []);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Document metadata preview</CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <p className="text-sm text-ink-soft">Loading documents...</p>
        ) : documents.length ? (
          <div className="grid gap-3">
            {documents.map((document) => (
              <div className="grid gap-2 border border-line bg-paper-2/50 p-3 sm:grid-cols-[1fr_auto] sm:items-center" key={document.id}>
                <div>
                  <p className="font-semibold text-ink">{document.filename}</p>
                  <p className="mt-1 text-sm text-ink-soft">
                    {document.type} · {document.size} · {document.uploadDate}
                  </p>
                </div>
                <Badge variant={document.status === "Indexed" ? "success" : document.status === "Failed" ? "danger" : "warning"}>{document.status}</Badge>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-ink-soft">No documents uploaded yet. Uploaded files appear here once indexed.</p>
        )}
      </CardContent>
    </Card>
  );
}
