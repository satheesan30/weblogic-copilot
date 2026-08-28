"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Activity, AlertTriangle, Radio, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

interface LiveStream {
  id: string;
  env: string;
  server: string;
  source: "http" | "file";
  filePath?: string;
  status: string;
  filename: string;
  lineCount: number;
  chunkCount: number;
  bytesIngested: number;
  lastSeenAt: string;
  tailRunning?: boolean;
  error?: string;
}

interface LiveAlert {
  id: string;
  streamId: string;
  env: string;
  server: string;
  severity: "info" | "warn" | "critical";
  title: string;
  detail: string;
  matched: string;
  createdAt: string;
}

export function LiveLogsPanel() {
  const [streams, setStreams] = useState<LiveStream[]>([]);
  const [alerts, setAlerts] = useState<LiveAlert[]>([]);
  const [env, setEnv] = useState("dev");
  const [server, setServer] = useState("AdminServer");
  const [source, setSource] = useState<"http" | "file">("http");
  const [filePath, setFilePath] = useState("");
  const [selectedStreamId, setSelectedStreamId] = useState("");
  const [pasteText, setPasteText] = useState(
    `<Error> <BEA-001129> <Connection pool for datasource "FinanceXADataSource" is at maximum capacity>\n<Warning> StuckThread detected on ExecuteThread: '12'`,
  );
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(false);
  const [pendingRemove, setPendingRemove] = useState<LiveStream | null>(null);

  const selectedStream = useMemo(
    () => streams.find((stream) => stream.id === selectedStreamId) || streams[0],
    [streams, selectedStreamId],
  );

  const refresh = useCallback(async () => {
    const response = await fetch("/api/live-logs/streams", { cache: "no-store" });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error || "Could not load live streams.");
    setStreams(payload.streams || []);
    setAlerts(payload.alerts || []);
    setSelectedStreamId((current) => current || payload.streams?.[0]?.id || "");
  }, []);

  useEffect(() => {
    const load = async () => {
      try {
        await refresh();
      } catch (error) {
        setStatus(error instanceof Error ? error.message : "Refresh failed.");
      }
    };
    void load();
    const timer = setInterval(() => {
      refresh().catch(() => undefined);
    }, 5000);
    return () => clearInterval(timer);
  }, [refresh]);

  async function createStream() {
    setLoading(true);
    setStatus("Creating stream...");
    try {
      const response = await fetch("/api/live-logs/streams", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ env, server, source, filePath: source === "file" ? filePath : undefined }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Create failed.");
      setSelectedStreamId(payload.stream.id);
      await refresh();
      setStatus(`Created stream ${payload.stream.filename}`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Create failed.");
    } finally {
      setLoading(false);
    }
  }


  async function injectPaste() {
    if (!selectedStream) {
      setStatus("Create or select a stream first.");
      return;
    }
    setLoading(true);
    setStatus("Injecting log lines...");
    try {
      const response = await fetch("/api/live-logs/ingest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ streamId: selectedStream.id, text: pasteText, flush: true }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Ingest failed.");
      await refresh();
      setStatus(
        `Accepted ${payload.acceptedLines} line(s), flushed ${payload.flushedChunks} chunk(s), alerts ${payload.alerts?.length || 0}.`,
      );
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Ingest failed.");
    } finally {
      setLoading(false);
    }
  }

  async function toggleTail(stream: LiveStream, action: "start" | "stop") {
    setLoading(true);
    try {
      const response = await fetch(`/api/live-logs/streams/${stream.id}/tail`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Tail control failed.");
      await refresh();
      setStatus(action === "start" ? "Local tail started." : "Local tail stopped.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Tail control failed.");
    } finally {
      setLoading(false);
    }
  }

  async function removeStream(stream: LiveStream) {
    setLoading(true);
    try {
      const response = await fetch(`/api/live-logs/streams/${stream.id}`, { method: "DELETE" });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Delete failed.");
      if (selectedStreamId === stream.id) setSelectedStreamId("");
      await refresh();
      setStatus("Stream removed.");
      toast.success("Stream removed", { description: `${stream.env}/${stream.server} and its indexed chunks were removed.` });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Delete failed.";
      setStatus(message);
      toast.error("Delete failed", { description: message });
    } finally {
      setLoading(false);
      setPendingRemove(null);
    }
  }

  const curlSnippet = selectedStream
    ? `curl -sS -X POST http://127.0.0.1:3000/api/live-logs/ingest \\\n  -H "Authorization: Bearer $LIVE_LOG_INGEST_TOKEN" \\\n  -H "Content-Type: application/json" \\\n  -d '{"streamId":"${selectedStream.id}","text":"<Error> <BEA-000337> sample","flush":true}'`
    : "Create a stream to generate an ingest curl snippet.";

  return (
    <div className="grid gap-5">
      <Card>
        <CardHeader>
          <CardTitle>Create live stream</CardTitle>
          <CardDescription>
            HTTP push works from any WebLogic host. File source tails a path on this Agentci machine.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-2">
          <label className="grid gap-1 text-sm">
            <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-ink-soft">Environment</span>
            <input
              className="border border-line bg-paper px-3 py-2 text-sm text-ink"
              onChange={(event) => setEnv(event.target.value)}
              value={env}
            />
          </label>
          <label className="grid gap-1 text-sm">
            <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-ink-soft">Server</span>
            <input
              className="border border-line bg-paper px-3 py-2 text-sm text-ink"
              onChange={(event) => setServer(event.target.value)}
              value={server}
            />
          </label>
          <label className="grid gap-1 text-sm">
            <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-ink-soft">Source</span>
            <select
              className="border border-line bg-paper px-3 py-2 text-sm text-ink"
              onChange={(event) => setSource(event.target.value as "http" | "file")}
              value={source}
            >
              <option value="http">HTTP push</option>
              <option value="file">Local file tail</option>
            </select>
          </label>
          <label className="grid gap-1 text-sm">
            <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-ink-soft">File path</span>
            <input
              className="border border-line bg-paper px-3 py-2 text-sm text-ink disabled:opacity-50"
              disabled={source !== "file"}
              onChange={(event) => setFilePath(event.target.value)}
              placeholder="/path/to/AdminServer.log"
              value={filePath}
            />
          </label>
          <div className="md:col-span-2">
            <Button disabled={loading} onClick={createStream} type="button">
              <Radio className="h-4 w-4" aria-hidden="true" />
              Create stream
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Manual inject / remote curl</CardTitle>
          <CardDescription>Paste log lines for a quick test, or push from a remote host with the ingest token.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3">
          <label className="grid gap-1 text-sm">
            <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-ink-soft">Target stream</span>
            <select
              className="border border-line bg-paper px-3 py-2 text-sm text-ink"
              onChange={(event) => setSelectedStreamId(event.target.value)}
              value={selectedStream?.id || ""}
            >
              {!streams.length ? <option value="">No streams yet</option> : null}
              {streams.map((stream) => (
                <option key={stream.id} value={stream.id}>
                  {stream.env}/{stream.server} ({stream.source})
                </option>
              ))}
            </select>
          </label>
          <textarea
            className="min-h-32 border border-line bg-paper px-3 py-2 font-mono text-xs leading-5 text-ink"
            onChange={(event) => setPasteText(event.target.value)}
            value={pasteText}
          />
          <div className="flex flex-wrap gap-2">
            <Button disabled={loading || !selectedStream} onClick={injectPaste} type="button">
              Inject and flush
            </Button>
          </div>
          <pre className="overflow-x-auto border border-line bg-paper-2 p-3 font-mono text-[11px] leading-5 text-ink-soft">
            {curlSnippet}
          </pre>
          <p className="text-sm text-ink-soft">
            Remote hosts: use <code className="font-mono text-xs">scripts/inject-weblogic-log.sh</code> with{" "}
            the one-time stream token returned when the stream is created or regenerated.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Active streams</CardTitle>
          <CardDescription>Indexed live chunks appear in Library as synthetic log documents.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3">
          {!streams.length ? <p className="text-sm text-ink-soft">No live streams yet.</p> : null}
          {streams.map((stream) => (
            <div className="border border-line bg-paper px-4 py-3" key={stream.id}>
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="success">
                  <Activity className="mr-1 h-3.5 w-3.5" aria-hidden="true" />
                  {stream.env}/{stream.server}
                </Badge>
                <Badge variant="outline">{stream.source}</Badge>
                <Badge variant="outline">{stream.status}</Badge>
                {stream.tailRunning ? <Badge>tailing</Badge> : null}
                <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-ink-soft">
                  {stream.lineCount} lines · {stream.chunkCount} chunks
                </span>
              </div>
              <p className="mt-2 text-sm text-ink-soft">
                {stream.filename}
                {stream.filePath ? ` · ${stream.filePath}` : ""}
                {stream.error ? ` · error: ${stream.error}` : ""}
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                {stream.source === "file" ? (
                  stream.tailRunning ? (
                    <Button disabled={loading} onClick={() => toggleTail(stream, "stop")} size="sm" type="button" variant="outline">
                      Stop tail
                    </Button>
                  ) : (
                    <Button disabled={loading} onClick={() => toggleTail(stream, "start")} size="sm" type="button" variant="secondary">
                      Start tail
                    </Button>
                  )
                ) : null}
                <Button disabled={loading} onClick={() => setPendingRemove(stream)} size="sm" type="button" variant="ghost">
                  <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                  Remove
                </Button>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Live alerts</CardTitle>
          <CardDescription>Heuristic BEA / JDBC / ERROR triage from flushed batches.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-2">
          {!alerts.length ? <p className="text-sm text-ink-soft">No alerts yet.</p> : null}
          {alerts.map((alert) => (
            <div className="border border-line bg-paper px-4 py-3" key={alert.id}>
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant={alert.severity === "critical" ? "danger" : alert.severity === "warn" ? "warning" : "outline"}>
                  <AlertTriangle className="mr-1 h-3.5 w-3.5" aria-hidden="true" />
                  {alert.severity}
                </Badge>
                <span className="text-sm font-semibold text-ink">{alert.title}</span>
                <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-ink-soft">
                  {alert.env}/{alert.server}
                </span>
              </div>
              <p className="mt-1 text-sm text-ink-soft">{alert.detail}</p>
            </div>
          ))}
        </CardContent>
      </Card>

      {status ? <p className="font-mono text-xs text-ink-soft">{status}</p> : null}

      <Dialog onOpenChange={(open) => !open && setPendingRemove(null)} open={Boolean(pendingRemove)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Remove live-log stream</DialogTitle>
            <DialogDescription>
              This stops <span className="font-semibold text-ink">{pendingRemove?.env}/{pendingRemove?.server}</span>,
              flushes remaining buffered lines, and removes its indexed vectors. This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button onClick={() => setPendingRemove(null)} type="button" variant="outline">
              Cancel
            </Button>
            <Button disabled={loading} onClick={() => pendingRemove && removeStream(pendingRemove)} type="button">
              {loading ? "Removing..." : "Remove"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
