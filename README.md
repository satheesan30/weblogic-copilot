# Agentci AI

Agentci AI is a local **agentic RAG** assistant for Oracle WebLogic Server administrators. It plans retrieval, searches memory and the knowledge base, assesses evidence, optionally rewrites the query for a second hop, then answers with citations.

It helps analyze WebLogic logs, configuration snippets, runbooks, JDBC/JMS issues, startup failures, BEA errors, Node Manager issues, WLST tasks, clustering questions, and troubleshooting workflows.

The app runs locally using:

- Next.js App Router frontend and API routes
- Ollama for local LLM chat
- Ollama embeddings for local document embeddings
- ChromaDB for local vector search
- LiteLLM multi-model gateway
- Local JSON metadata storage under `.app-data/`

No cloud backend is required for the current implementation.

## Current Architecture

```text
Browser UI
  |
  | Upload documents / ask questions
  v
Next.js API routes
  |
  | /api/upload
  | - chunk, embed, index into ChromaDB
  |
  | /api/chat (agentic RAG)
  | - plan / classify
  | - search_memory
  | - search_knowledge
  | - assess_evidence
  | - deterministic evidence refinement + second retrieve when weak
  | - generate grounded answer with citations
  v
Ollama + LiteLLM + ChromaDB
```

Primary config file: `agentci.toml` (falls back to `weblogic-copilot.toml`).

## Technology Stack

- Next.js `16.2.6`
- React `19.2.6`
- TypeScript
- Tailwind CSS
- shadcn/ui-style local components
- lucide-react icons
- ChromaDB JavaScript client
- Ollama local models

## Project Location

```text
/Users/satheraj/Downloads/weblogic-copilot
```

## Important Files

```text
weblogic-copilot.toml       Main local model, retrieval, and vector DB config
app/api/chat/route.ts       Chat RAG API
app/api/upload/route.ts     Upload, chunk, embed, and index API
app/api/documents/route.ts  Document list/search API
app/api/health/route.ts     Ollama and ChromaDB health check
lib/server/                 Backend service logic
components/                 Frontend UI components
.app-data/                  Local document metadata, generated at runtime
chroma-data/                Local ChromaDB storage, generated at runtime
```

## Configuration

Configuration is stored in:

```text
/Users/satheraj/Downloads/weblogic-copilot/weblogic-copilot.toml
```

Current configuration:

```toml
[llm]
provider = "ollama"
endpoint = "http://localhost:11434/v1/chat/completions"
model = "qwen3:8b"
temperature = 0.2

[retrieval]
topK = 6
chunkSize = 900
citationMode = "Balanced"

[vectorStore]
provider = "ChromaDB"
endpoint = "http://localhost:8000"
collectionName = "weblogic-knowledge-base"
persistencePath = "./chroma-data"
embeddingModel = "nomic-embed-text"
embeddingEndpoint = "http://localhost:11434/api/embed"
```

## Prerequisites

Install these first:

- Node.js `22.13.0` or newer
- Yarn
- Ollama

Check:

```bash
node --version
yarn --version
ollama --version
```

## Install Dependencies

Run once:

```bash
cd /Users/satheraj/Downloads/weblogic-copilot
yarn install
```

## Pull Local Models

Run once:

```bash
ollama pull qwen3:8b
ollama pull nomic-embed-text
```

Purpose:

- `qwen3:8b`: local chat/reasoning model
- `nomic-embed-text`: local embedding model for RAG search

## Start The Application

Use three terminals.

### Terminal 1: Start ChromaDB

```bash
cd /Users/satheraj/Downloads/weblogic-copilot
yarn chroma:run
```

ChromaDB runs at:

```text
http://localhost:8000
```

Data is stored under:

```text
/Users/satheraj/Downloads/weblogic-copilot/chroma-data
```

### Terminal 2: Start Ollama

```bash
ollama serve
```

Ollama runs at:

```text
http://localhost:11434
```

### Terminal 3: Start WebLogic Copilot

```bash
cd /Users/satheraj/Downloads/weblogic-copilot
yarn dev
```

Open:

```text
http://localhost:3000
```

## Application Pages

### Landing Page

```text
http://localhost:3000
```

Shows the product overview, feature cards, and architecture summary.

### Upload Page

```text
http://localhost:3000/upload
```

Use this page to upload WebLogic knowledge files.

Supported practical file types:

- `.log`
- `.txt`
- `.md`
- `.html`
- `.xml`
- `.properties`
- text-like `.out` / `.trc` files

What happens during upload:

1. File text is read.
2. Content is split into chunks.
3. Each chunk is embedded using `nomic-embed-text`.
4. Vectors are stored in ChromaDB.
5. Document metadata is saved locally.

### Library Page

```text
http://localhost:3000/library
```

Use this page to:

- View indexed documents
- Search documents
- Filter by document type
- Delete local document metadata

Deleting a document removes both its SQLite record and the associated Chroma vectors immediately.

## Production persistence and retention

Operational state is stored in `.app-data/weblogic-copilot.sqlite`; existing JSON/JSONL state is imported once on first startup and the source files are left untouched. Documents, memory, live streams, alerts, upload sessions, and observability events are private to the authenticated user and expire after 30 days (upload sessions expire after 24 hours). Expired records are cleaned on health/request activity and daily while the service is running. No backup is created automatically.

Live-log HTTP ingestion uses a unique token for each stream. The token is shown only when a stream is created or regenerated, and only its hash is stored. Do not configure `LIVE_LOG_INGEST_TOKEN`. For local file tailing, set `LIVE_LOG_TAIL_ROOT` to the approved directory; symlinked files and paths outside that root are rejected.

## LangGraph orchestration

Set `LANGGRAPH_ENABLED=true` to enable the durable SQLite-backed LangGraph workflow. It uses deterministic specialist routing and falls back to the existing chat workflow if a graph run fails. Leave it unset or `false` for the default compatibility mode. Conversation checkpoints are private to the authenticated user and follow the 30-day retention policy.

### Chat Page

```text
http://localhost:3000/chat
```

Use this page to ask questions after uploading documents.

Example prompts:

```text
Why is my managed server stuck in STARTING?
```

```text
Analyze this WebLogic error log and identify the probable root cause.
```

```text
Explain JDBC connection pool failures from the uploaded logs.
```

```text
Create a WLST health-check checklist for this domain.
```

What happens during chat:

1. Your question is embedded using Ollama.
2. ChromaDB retrieves relevant document chunks.
3. The app builds a grounded prompt with retrieved context.
4. Ollama `qwen3:8b` generates the answer.
5. The UI shows the answer and citations.

### Settings Page

```text
http://localhost:3000/settings
```

Shows model, ChromaDB, embedding, and retrieval configuration loaded from `weblogic-copilot.toml`.

## API Routes

### Health Check

```text
GET /api/health
```

Checks whether Ollama and ChromaDB are reachable.

Example:

```bash
curl http://localhost:3000/api/health
```

Expected result:

```json
{
  "ollama": true,
  "chroma": true
}
```

### Upload Documents

```text
POST /api/upload
```

Accepts multipart form data with one or more files under the field name `files`.

Example:

```bash
curl -X POST http://localhost:3000/api/upload \
  -F "files=@/path/to/server.log"
```

### Chat

```text
POST /api/chat
```

Example:

```bash
curl -X POST http://localhost:3000/api/chat \
  -H "Content-Type: application/json" \
  -d '{"message":"Why is my managed server stuck in STARTING?"}'
```

### List Documents

```text
GET /api/documents
```

Examples:

```bash
curl http://localhost:3000/api/documents
curl "http://localhost:3000/api/documents?query=jdbc&type=log"
```

### Delete Document Metadata

```text
DELETE /api/documents/:id
```

Example:

```bash
curl -X DELETE http://localhost:3000/api/documents/DOCUMENT_ID
```

### Settings

```text
GET /api/settings
```

Example:

```bash
curl http://localhost:3000/api/settings
```

## Useful Commands

Run development server:

```bash
yarn dev
```

Run ChromaDB:

```bash
yarn chroma:run
```

Run lint:

```bash
yarn lint
```

Run production build:

```bash
yarn build
```

Start production server after build:

```bash
yarn start
```

## Daily Startup Checklist

1. Start ChromaDB:

```bash
cd /Users/satheraj/Downloads/weblogic-copilot
yarn chroma:run
```

2. Start Ollama:

```bash
ollama serve
```

3. Start the app:

```bash
cd /Users/satheraj/Downloads/weblogic-copilot
yarn dev
```

4. Check health:

```text
http://localhost:3000/api/health
```

5. Upload documents:

```text
http://localhost:3000/upload
```

6. Ask questions:

```text
http://localhost:3000/chat
```

## Local Agent Memory

The app supports local ChromaDB-backed agent memory. This is separate from uploaded document RAG data.

```text
weblogic-knowledge-base -> uploaded logs, docs, runbooks
weblogic-agent-memory   -> user preferences, environment facts, incident notes
```

Memory settings are in `weblogic-copilot.toml`:

```toml
[memory]
enabled = true
provider = "ChromaDB"
collectionName = "weblogic-agent-memory"
topK = 4
```

Add memory:

```bash
curl -X POST http://localhost:3000/api/memory \
  -H "Content-Type: application/json" \
  -d '{"content":"The user prefers RCA answers with confirmed facts first, then probable cause and remediation.","category":"preference","source":"user"}'
```

List memory:

```bash
curl http://localhost:3000/api/memory
```

Delete memory:

```bash
curl -X DELETE http://localhost:3000/api/memory/MEMORY_ID
```

During chat, the backend retrieves relevant memory from ChromaDB and inserts it into the prompt before calling the local Ollama model.

Do not store passwords, API keys, tokens, or secrets in memory.

## LiteLLM Multi-Model Gateway

The app can route chat through LiteLLM so one endpoint can serve multiple local and enterprise models.

Current app LLM config:

```toml
[llm]
provider = "litellm"
endpoint = "http://localhost:4000/v1/chat/completions"
model = "weblogic-local"
modelOptions = "weblogic-local,weblogic-mistral,weblogic-fast,weblogic-enterprise"
apiKeyEnv = "LITELLM_MASTER_KEY"
temperature = 0.2
```

LiteLLM config file:

```text
litellm-config.yaml
```

Configured aliases:

```text
weblogic-local      -> Ollama qwen3:8b
weblogic-mistral    -> Ollama mistral
weblogic-fast       -> OpenAI gpt-4o-mini
weblogic-enterprise -> OCI Generative AI OpenAI-compatible endpoint
```

Install LiteLLM if needed:

```bash
pipx install litellm
```

or:

```bash
pip install litellm
```

Set secrets:

```bash
export LITELLM_MASTER_KEY="local-dev-key"
export OPENAI_API_KEY="optional-openai-key"
export OCI_GENAI_API_KEY="optional-oci-key"
```

For local development, the app and `yarn litellm:run` both use `local-dev-key` when `LITELLM_MASTER_KEY` is not explicitly set. Replace this with a real secret in any shared or production environment.

Start LiteLLM:

```bash
cd /Users/satheraj/Downloads/weblogic-copilot
yarn litellm:run
```

Start the app in another terminal:

```bash
yarn dev
```

The chat page model dropdown will show the aliases from `modelOptions`. The browser never receives provider API keys; the app sends only the selected alias to the backend, and LiteLLM routes it to the configured provider.

For local RAG, embeddings still use:

```text
nomic-embed-text through Ollama
```

So keep this model available when uploading documents or using memory:

```bash
ollama run nomic-embed-text
```

## Troubleshooting

### `ollama` is false in `/api/health`

Start Ollama:

```bash
ollama serve
```

Confirm models are available:

```bash
ollama list
```

If missing:

```bash
ollama pull qwen3:8b
ollama pull nomic-embed-text
```

### `chroma` is false in `/api/health`

Start ChromaDB:

```bash
cd /Users/satheraj/Downloads/weblogic-copilot
yarn chroma:run
```

### Upload fails

Check:

- ChromaDB is running
- Ollama is running
- `nomic-embed-text` has been pulled
- File is text-readable

### Chat fails

Check:

- Ollama is running
- `qwen3:8b` has been pulled
- ChromaDB is running
- At least one document has been uploaded and indexed

### Port already in use

If Next says another dev server is already running, open:

```text
http://localhost:3000
```

or stop the old process before starting a new one.

## Current Limitations

- PDF binary extraction is not implemented yet; upload only text-based formats that the current line reader can index.
- Upload works best for text-like files.
- Delete removes local document metadata only, not ChromaDB vectors.
- Chat is non-streaming.
- No authentication.
- No production deployment configuration.
- No UI-based settings save yet.

## Suggested Next Improvements

- Add PDF parsing.
- Delete vectors from ChromaDB when deleting documents.
- Add streaming chat responses.
- Add document re-index button.
- Add status indicators for Ollama and ChromaDB in the UI.
- Add backend tests for upload, retrieval, and chat routes.
