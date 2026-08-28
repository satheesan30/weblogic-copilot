"use client";

import { useEffect, useState } from "react";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { StoredDocument } from "@/types/backend";

export function DocumentLibrary() {
  const [query, setQuery] = useState("");
  const [type, setType] = useState("all");
  const [documents, setDocuments] = useState<StoredDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [pendingDelete, setPendingDelete] = useState<StoredDocument | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    async function loadDocuments() {
      setLoading(true);
      setError("");
      try {
        const params = new URLSearchParams({ query, type });
        const response = await fetch(`/api/documents?${params.toString()}`, { signal: controller.signal });
        const payload = await response.json();
        if (!response.ok) throw new Error(payload.error || "Could not load documents.");
        setDocuments(payload.documents || []);
      } catch (caughtError) {
        if (!controller.signal.aborted) {
          setError(caughtError instanceof Error ? caughtError.message : "Could not load documents.");
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }

    loadDocuments();
    return () => controller.abort();
  }, [query, type]);

  async function confirmDelete() {
    if (!pendingDelete) return;
    setDeleting(true);
    try {
      const response = await fetch(`/api/documents/${pendingDelete.id}`, { method: "DELETE" });
      if (!response.ok) throw new Error("Could not delete document.");
      setDocuments((current) => current.filter((document) => document.id !== pendingDelete.id));
      toast.success("Document deleted", { description: `${pendingDelete.filename} and its indexed vectors were removed.` });
      setPendingDelete(null);
    } catch (caughtError) {
      toast.error("Delete failed", { description: caughtError instanceof Error ? caughtError.message : "Unknown error." });
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="overflow-hidden border border-line bg-paper">
      <div className="grid gap-3 border-b border-line bg-paper-2/70 p-4 md:grid-cols-[1fr_220px]">
        <Input onChange={(event) => setQuery(event.target.value)} placeholder="Search documents..." value={query} />
        <Select onChange={(event) => setType(event.target.value)} value={type}>
          <option value="all">All types</option>
          <option value="PDF">PDF</option>
          <option value="TXT">TXT</option>
          <option value="MD">MD</option>
          <option value="HTML">HTML</option>
          <option value="XML">XML</option>
          <option value="properties">properties</option>
          <option value="log">log</option>
        </Select>
      </div>

      {loading ? (
        <div className="p-10 text-center">
          <p className="font-display font-semibold text-ink">Loading documents...</p>
        </div>
      ) : error ? (
        <div className="p-10 text-center">
          <p className="font-semibold text-danger">{error}</p>
        </div>
      ) : documents.length ? (
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Filename</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Size</TableHead>
                <TableHead>Upload date</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {documents.map((document) => (
                <TableRow key={document.id}>
                  <TableCell className="font-semibold text-ink">{document.filename}</TableCell>
                  <TableCell>{document.type}</TableCell>
                  <TableCell>{document.size}</TableCell>
                  <TableCell>{document.uploadDate}</TableCell>
                  <TableCell>
                    <Badge variant={document.status === "Indexed" ? "success" : document.status === "Failed" ? "danger" : "warning"}>
                      {document.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button onClick={() => setPendingDelete(document)} size="sm" type="button" variant="ghost">
                      <Trash2 className="h-4 w-4" aria-hidden="true" />
                      Delete
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      ) : (
        <div className="p-10 text-center">
          <p className="font-display font-semibold text-ink">No documents found</p>
          <p className="mt-1 text-sm text-ink-soft">Try a different search term or document type.</p>
        </div>
      )}

      <Dialog onOpenChange={(open) => !open && setPendingDelete(null)} open={Boolean(pendingDelete)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete document</DialogTitle>
            <DialogDescription>
              This removes <span className="font-semibold text-ink">{pendingDelete?.filename}</span> and its indexed
              vectors from ChromaDB. This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button onClick={() => setPendingDelete(null)} type="button" variant="outline">
              Cancel
            </Button>
            <Button disabled={deleting} onClick={confirmDelete} type="button">
              {deleting ? "Deleting..." : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
