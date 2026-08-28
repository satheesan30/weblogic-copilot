import { mkdir, open, stat } from "node:fs/promises";
import path from "node:path";

const GIB = 1024 * 1024 * 1024;
const overLimit = process.argv.includes("--over-limit");
const target = path.join(process.cwd(), "test-datasets", "large-upload", overLimit ? "over-limit-1g-plus-1.txt" : "exactly-1g.txt");

await mkdir(path.dirname(target), { recursive: true });
const handle = await open(target, "w");
try {
  // Sparse fixture: exact logical upload size with negligible physical disk use.
  // It tests request/session/part-size boundaries, not full-content RAG quality.
  await handle.write(Buffer.from("Agentci large-upload boundary fixture\n"), 0, undefined, 0);
  await handle.write(Buffer.from("\n"), 0, undefined, GIB - 1);
  if (overLimit) await handle.write(Buffer.from("x"), 0, undefined, GIB);
} finally {
  await handle.close();
}

const info = await stat(target);
console.log(`${target}: ${info.size} bytes (${overLimit ? "over limit" : "exact limit"})`);
