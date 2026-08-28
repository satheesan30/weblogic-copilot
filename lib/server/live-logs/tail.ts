import { open, stat } from "node:fs/promises";
import { watch, type FSWatcher } from "node:fs";
import { injectLogBatch } from "@/lib/server/live-logs/agent";
import { getLiveStream, upsertLiveStream } from "@/lib/server/live-logs/store";

interface TailerState {
  watcher: FSWatcher;
  offset: number;
  stopped: boolean;
  pending: Promise<void>;
}

const tailers = new Map<string, TailerState>();

export function isLiveTailRunning(streamId: string) {
  return tailers.has(streamId);
}

export async function startLiveTail(streamId: string) {
  const stream = await getLiveStream(streamId);
  if (!stream) {
    throw new Error(`Live log stream '${streamId}' was not found.`);
  }
  if (stream.source !== "file" || !stream.filePath) {
    throw new Error("Local tail requires a file-source stream with filePath.");
  }
  if (tailers.has(streamId)) {
    return stream;
  }

  const filePath = stream.filePath;
  const info = await stat(filePath);
  if (!info.isFile()) {
    throw new Error(`Path is not a file: ${filePath}`);
  }

  const state: TailerState = {
    watcher: watch(filePath, () => {
      scheduleRead(streamId, filePath);
    }),
    offset: info.size,
    stopped: false,
    pending: Promise.resolve(),
  };
  tailers.set(streamId, state);

  stream.status = "active";
  stream.error = undefined;
  await upsertLiveStream(stream);

  // Seed with last ~8KB so the stream isn't empty on start.
  const seedStart = Math.max(0, info.size - 8192);
  if (info.size > 0) {
    state.offset = seedStart;
    await readNewBytes(streamId, filePath);
  }

  return stream;
}

export async function stopLiveTail(streamId: string) {
  const state = tailers.get(streamId);
  if (!state) return;
  state.stopped = true;
  state.watcher.close();
  tailers.delete(streamId);
  await state.pending;

  const stream = await getLiveStream(streamId);
  if (stream) {
    stream.status = "stopped";
    await upsertLiveStream(stream);
  }
}

function scheduleRead(streamId: string, filePath: string) {
  const state = tailers.get(streamId);
  if (!state || state.stopped) return;
  state.pending = state.pending
    .then(() => readNewBytes(streamId, filePath))
    .catch(async (error) => {
      const stream = await getLiveStream(streamId);
      if (stream) {
        stream.status = "error";
        stream.error = error instanceof Error ? error.message : "Live tail failed.";
        await upsertLiveStream(stream);
      }
      await stopLiveTail(streamId);
    });
}

async function readNewBytes(streamId: string, filePath: string) {
  const state = tailers.get(streamId);
  if (!state || state.stopped) return;

  const info = await stat(filePath);
  if (info.size < state.offset) {
    state.offset = 0;
  }
  if (info.size === state.offset) return;

  const handle = await open(filePath, "r");
  try {
    const length = info.size - state.offset;
    const buffer = Buffer.alloc(length);
    const { bytesRead } = await handle.read(buffer, 0, length, state.offset);
    state.offset += bytesRead;
    const text = buffer.subarray(0, bytesRead).toString("utf8");
    if (!text.trim()) return;
    await injectLogBatch({ streamId, text, forceFlush: text.includes("\n") });
  } finally {
    await handle.close();
  }
}
