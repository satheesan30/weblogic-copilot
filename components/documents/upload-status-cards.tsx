"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, Loader2, XCircle } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import type { StoredDocument } from "@/types/backend";

export function UploadStatusCards() {
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
        // Ignore transient failures; the card grid stays empty.
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

  if (loading) return null;
  if (!documents.length) return null;

  return (
    <div className="grid gap-4 md:grid-cols-3">
      {documents.map((document) => {
        const Icon = document.status === "Indexed" ? CheckCircle2 : document.status === "Failed" ? XCircle : Loader2;
        return (
          <Card key={document.id}>
            <CardContent className="p-5">
              <div className="flex items-start gap-3">
                <Icon className="mt-0.5 h-5 w-5 text-forest" aria-hidden="true" />
                <div className="min-w-0">
                  <p className="truncate font-semibold text-ink">{document.filename}</p>
                  <p className="mt-1 font-mono text-[11px] uppercase tracking-[0.12em] text-copper">{document.status}</p>
                  <p className="mt-2 text-sm leading-6 text-ink-soft">
                    {document.lineCount} lines · {document.chunkCount} chunks · {document.size}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
