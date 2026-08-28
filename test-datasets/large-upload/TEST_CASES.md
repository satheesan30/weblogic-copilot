# Large Upload Test Cases

Generate the boundary fixture with `node scripts/create-large-upload-fixture.mjs`. It is a sparse 1 GiB file, so it reports a 1 GiB logical size but does not consume 1 GiB of physical disk. Generate the rejection fixture with `node scripts/create-large-upload-fixture.mjs --over-limit`.

| ID | Scenario | Input / action | Expected result |
|---|---|---|---|
| UP-01 | Exact upload limit | Upload `exactly-1g.txt` through the chunked upload flow. | Init succeeds; `totalParts` is 128 at 8 MiB each; no part is rejected for size. |
| UP-02 | Size above limit | Upload `over-limit-1g-plus-1.txt`. | Init is rejected with the 1 GB maximum-size message; no session or file parts are created. |
| UP-03 | Unsupported extension | Use a 1 GiB `.exe` or renamed unsupported extension. | Init is rejected before any data is accepted. |
| UP-04 | Part count integrity | Start an exact-limit session with 127 or 129 parts. | Init rejects the request because 128 parts are required. |
| UP-05 | Part size integrity | Upload a part smaller or larger than 8 MiB, except the valid final part. | The part endpoint rejects it and does not mark it received. |
| UP-06 | Missing part | Upload 127 valid parts, then complete. | Completion reports missing parts and does not index a document. |
| UP-07 | Duplicate part retry | Send the same valid part index twice. | Session still reports one received part for that index; no duplicate content is assembled. |
| UP-08 | Cross-user session | Create a session as User A; upload a part or complete it as User B. | API responds as if the upload session does not exist; no data leaks. |
| UP-09 | Expired session | Create a session, advance/seed expiry beyond 24 hours, then upload or complete. | Session is cleaned up/rejected and its temporary directory is removed. |
| UP-10 | Structure-aware Markdown | Upload a large Markdown runbook with headings exceeding 900 characters per section. | Chunks begin at headings; split chunks repeat the active heading; line metadata remains ordered. |
| UP-11 | Structure-aware FMW XML | Upload a large `config.xml` with `server`, `cluster`, `jdbc-system-resource`, and `jms-system-resource` nodes. | Chunks begin at component boundaries; vectors retain document ID, owner, type, and line metadata. |
| UP-12 | Long log stream | Upload a log with BEA entries across more than one 900-character chunk. | Lines are never cut mid-record; retrieval returns owner-scoped chunks with valid line ranges. |
| UP-13 | Cleanup after delete | Index a test document, query it, then delete it. | SQLite metadata and matching Chroma vectors are removed; later retrieval returns no chunks. |
| UP-14 | Retention cleanup | Set a document/vector record to expired and run retention. | Metadata, LangGraph/user state where applicable, and source vectors are removed. |

## Execution Notes

- Use the chunked API for files above the browser’s direct-upload threshold.
- Do not use the sparse 1 GiB fixture to validate semantic extraction or embedding quality: it intentionally contains almost no text.
- Use the existing `test-datasets/weblogic-rca` corpus for meaningful RAG, specialist-routing, and citation tests.
