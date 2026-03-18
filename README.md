# Inference server Test Bench

Version: `0.1.0`

Local-first harness for running automated LLM tests against OpenAI-compatible
or Ollama inference servers. It provides:

- A local HTTP API for triggering runs and fetching results
- A lightweight dashboard for browsing runs, profiles, and comparisons

## Purpose

This tool standardizes how you measure latency, correctness, and compliance
across model servers. It stores results locally (SQLite) and supports running
single tests, suites, and parameter sweeps with reusable profiles.

## Components

- `backend/`: Fastify API + SQLite persistence
- `frontend/`: React dashboard (Vite)

## Dashboard: Inference Server Management

The dashboard includes an Inference Servers area to create, update, archive,
and refresh runtime/discovery metadata. Model discovery is cached with TTL and
can be refreshed on demand. Archived servers are listed separately and are
hidden from run selection by default.

The Settings menu (bottom-left) lets you clear all DB tables and edit the
repo-root `.env` file. Env changes apply after restarting the backend.

## Frontend workflow: from server definition to a test run

### 1) Define an inference server

1. Start the app with `npm run dev`.
2. Open the dashboard and go to **Inference servers**.
3. In **Create inference server**, fill:
   - `Display name`
   - `Base URL` (example: `http://localhost:11434`)
   - `Schema families` (`OpenAI-compatible`, `Ollama`, and/or `Custom`)
   - `Auth type`, `Auth header name`, and optional `Auth token env var`
4. Click **Create**.
5. Select the created server and use:
   - **Refresh runtime** to fetch runtime metadata
   - **Refresh discovery** to fetch available models

### 2) Define a test template (JSON or Python)

1. Go to **Templates**.
2. Click **New template**.
3. Fill `Template ID`, `Name`, `Type`, and `Version`.
4. Paste template content in **Content** and click **Save**.

#### JSON template

Use `Type = JSON` and provide declarative test content (request + assertions).
Minimum practical shape:

```json
{
  "id": "template-id",
  "version": "1.0.0",
  "name": "Template name",
  "description": "Describe the test",
  "protocols": ["openai_chat_completions"],
  "request": {
    "method": "POST",
    "path": "/v1/chat/completions",
    "body_template": {
      "model": "gpt-4o-mini",
      "messages": [{ "role": "user", "content": "ping" }]
    }
  },
  "assertions": [],
  "metrics": {}
}
```

#### Python template

Use `Type = Python` and provide a python template descriptor that points to a
python module/entrypoint:

```json
{
  "kind": "python_test",
  "schema_version": "v1",
  "id": "template-id",
  "name": "Python Template",
  "version": "1.0.0",
  "lifecycle": { "status": "active" },
  "python": {
    "module": "tests.python.sample_test",
    "entrypoint": "entrypoint",
    "requirements": { "pip": [] }
  },
  "contracts": { "requires": [], "provides": [] },
  "defaults": { "timeout_ms": 60000, "retries": { "max": 0, "backoff_ms": 0 } },
  "outputs": {
    "result_schema": "scenario_result.v1",
    "normalised_response": "response_normalisation.v1"
  }
}
```

### 3) Run a test from the frontend

1. Go to **Run Single Test**.
2. Select the inference server.
3. Select the model (from discovered models, or type manually if needed).
4. Select one or more templates in **Templates**.
5. Click **Generate Active Tests**.
6. Optionally fill profile/timeouts/parameter overrides.
7. Click **Run**.
8. Click **Results** to fetch run outputs and metrics.

## Prerequisites

- Node.js 20 LTS (Node 25 also works in this repo)
- npm 9+
- Python 3.10+ (for Python test runners)
- SQLite (bundled with macOS/Linux)

## Setup

```bash
npm install
```

Create a local `.env` file from the example:

```bash
cp .env.example .env
```

## Desktop deployment

This release is intended to be deployed locally from source on a desktop or workstation.
The frontend is built with Vite and the backend runs directly from source.

```bash
npm ci
npm run build
npm start
```

## Environment variables
Create a local `.env` file at the repo root:

- `AITESTBENCH_API_TOKEN` (required): shared token for API auth.
  Used by backend auth (and by the frontend when `VITE_AITESTBENCH_API_TOKEN` is set).
- `PORT` (optional): backend port. Default is `8080`.
- `AITESTBENCH_DB_PATH` (optional): override DB file path.
- `AITESTBENCH_TEST_TEMPLATES_DIR` (optional): filesystem path for template storage (default: `./backend/data/templates`).
- `RETENTION_DAYS` (optional): days to keep results (default: 30).
- `AITESTBENCH_PYTHON_BIN` (optional): Python executable used for Python-backed tests (default: `python3`).
- `AITESTBENCH_PROXY_PERPLEXITY_DATASET` (optional): JSON dataset path for proxy perplexity runs.
- `AITESTBENCH_CONTEXT_PROBE_TIMEOUT_MS` (optional): context window probe timeout in ms (default: 600000).
- `VITE_AITESTBENCH_API_BASE_URL` (optional): backend API base URL. (`http://localhost:8080` by default)
- `VITE_AITESTBENCH_FRONTEND_BASE_URL` (optional): frontend base URL (`http://localhost:5173` by default)
- `AITESTBENCH_DRY_RUN` (optional): set to `1` to skip live HTTP calls (useful for tests).
- `VITE_AITESTBENCH_API_TOKEN` (optional): alternate dashboard token env name.


## Run (dev)

```bash
npm run dev
```
or 

```bash
npm -w backend run dev
```

```bash
npm -w frontend run dev
```

To change tcp port for backend:

```bash
PORT=9090 npm run dev  # don't forget to update the VITE_AITESTBENCH_API_BASE_URL 
```

## API endpoints (local-only)

Base URL: `http://localhost:8080`

Core:
- `GET /health`: health check
- `GET /inference-servers`: list inference servers
- `POST /inference-servers`: create inference server
- `GET /inference-servers/{serverId}`: get inference server
- `PATCH /inference-servers/{serverId}`: update inference server
- `DELETE /inference-servers/{serverId}`: delete inference server (fails if runs exist)
- `POST /inference-servers/{serverId}/archive`: archive inference server
- `POST /inference-servers/{serverId}/unarchive`: unarchive inference server
- `POST /inference-servers/{serverId}/refresh-runtime`: refresh runtime metadata
- `POST /inference-servers/{serverId}/refresh-discovery`: refresh model discovery

Tests:
- `GET /tests`: list tests (built-in + discovered)
- `POST /tests/reload`: rescan `tests/definitions`

Runs:
- `POST /runs`: create run (test or suite)
- `GET /runs`: run history
- `GET /runs/{runId}`: run details
- `GET /runs/{runId}/results`: results for run
- `GET /results/{resultId}`: single result

Suites/Profiles/Models:
- `GET /suites`, `POST /suites`
- `GET /profiles`, `POST /profiles`
- `GET /models`

System:
- `POST /system/clear-db`: delete all rows in all tables
- `GET /system/env`: list `.env` entries
- `POST /system/env`: upsert/remove `.env` entries

## API payload samples

### Create inference server

Request:
```json
{
  "inference_server": {
    "display_name": "local-ollama"
  },
  "endpoints": {
    "base_url": "http://localhost:11434"
  },
  "runtime": {
    "api": {
      "schema_family": ["ollama"],
      "api_version": null
    }
  },
  "auth": {
    "type": "none",
    "header_name": "Authorization",
    "token_env": "OLLAMA_API_TOKEN"
  }
}
```

`auth.token_env` points to an environment variable name that stores the token
used for the inference server (e.g., `export OLLAMA_API_TOKEN="..."`).

Response (201):
```json
{
  "inference_server": {
    "server_id": "b5a6b1a9f59f4e0e9b7e",
    "display_name": "local-ollama",
    "active": true,
    "archived": false,
    "created_at": "2026-01-06T21:30:00.000Z",
    "updated_at": "2026-01-06T21:30:00.000Z",
    "archived_at": null
  },
  "endpoints": {
    "base_url": "http://localhost:11434",
    "health_url": null,
    "https": false
  },
  "auth": {
    "type": "none",
    "header_name": "Authorization",
    "token_env": "OLLAMA_API_TOKEN"
  }
}
```

### Create run (single test)

Request:
```json
{
  "inference_server_id": "b5a6b1a9f59f4e0e9b7e",
  "test_id": "chat-basic",
  "profile_id": "perf-default",
  "profile_version": "1.0.0"
}
```

Response (201):
```json
{
  "id": "9b2e9f79a1c54290d91b",
  "inference_server_id": "b5a6b1a9f59f4e0e9b7e",
  "suite_id": null,
  "test_id": "chat-basic",
  "profile_id": "perf-default",
  "profile_version": "1.0.0",
  "status": "completed",
  "started_at": "2026-01-06T21:31:00.000Z",
  "ended_at": "2026-01-06T21:31:01.000Z",
  "environment_snapshot": {
    "effective_config": {
      "temperature": 0.2
    }
  },
  "retention_days": 30
}
```

### Create run (suite)

Request:
```json
{
  "inference_server_id": "b5a6b1a9f59f4e0e9b7e",
  "suite_id": "default",
  "profile_id": "perf-default",
  "profile_version": "1.0.0"
}
```

Response (201):
```json
{
  "id": "e74b7b0a3a5b4c1fa312",
  "inference_server_id": "b5a6b1a9f59f4e0e9b7e",
  "suite_id": "default",
  "test_id": null,
  "profile_id": "perf-default",
  "profile_version": "1.0.0",
  "status": "completed",
  "started_at": "2026-01-06T21:32:00.000Z",
  "ended_at": "2026-01-06T21:32:02.000Z",
  "environment_snapshot": {
    "effective_config": {
      "temperature": 0.2
    }
  },
  "retention_days": 30
}
```

### List runs

Response (200):
```json
[
  {
    "id": "9b2e9f79a1c54290d91b",
    "inference_server_id": "b5a6b1a9f59f4e0e9b7e",
    "suite_id": null,
    "test_id": "chat-basic",
    "profile_id": "perf-default",
    "profile_version": "1.0.0",
    "status": "completed",
    "started_at": "2026-01-06T21:31:00.000Z",
    "ended_at": "2026-01-06T21:31:01.000Z",
    "environment_snapshot": {
      "effective_config": {
        "temperature": 0.2
      }
    },
    "retention_days": 30
  }
]
```

### Run results

Response (200):
```json
[
  {
    "id": "result-1",
    "run_id": "9b2e9f79a1c54290d91b",
    "test_id": "chat-basic",
    "verdict": "pass",
    "failure_reason": null,
    "metrics": {
      "ttfb_ms": 120,
      "total_ms": 950,
      "tokens_per_sec": 85.2
    },
    "artefacts": {
      "response_preview": "Hello!"
    },
    "raw_events": [],
    "repetition_stats": {
      "repetitions": 1
    },
    "started_at": "2026-01-06T21:31:00.000Z",
    "ended_at": "2026-01-06T21:31:01.000Z"
  }
]
```

### Reload tests

Response (200):
```json
{
  "reloaded": 12,
  "errors": []
}
```

### Create profile

Request:
```json
{
  "id": "perf-default",
  "version": "1.0.0",
  "name": "Perf default",
  "description": "Balanced latency + quality checks",
  "generation_parameters": {
    "temperature": 0.2,
    "max_tokens": 512
  },
  "context_strategy": {
    "type": "percentage",
    "value": 50,
    "truncation_policy": "warn"
  },
  "test_selection": {
    "tags": ["smoke", "latency"]
  },
  "execution_behaviour": {
    "repetitions": 3,
    "per_test_timeout_sec": 120
  }
}
```

Response (201):
```json
{
  "id": "perf-default",
  "version": "1.0.0",
  "name": "Perf default",
  "description": "Balanced latency + quality checks",
  "generation_parameters": {
    "temperature": 0.2,
    "max_tokens": 512
  },
  "context_strategy": {
    "type": "percentage",
    "value": 50,
    "truncation_policy": "warn"
  },
  "test_selection": {
    "tags": ["smoke", "latency"]
  },
  "execution_behaviour": {
    "repetitions": 3,
    "per_test_timeout_sec": 120
  },
  "created_at": "2026-01-06T21:33:00.000Z",
  "updated_at": "2026-01-06T21:33:00.000Z"
}
```

### Create suite

Request:
```json
{
  "id": "default",
  "name": "Default suite",
  "ordered_test_ids": ["chat-basic", "openai-compliance"],
  "stop_on_fail": true
}
```

Response (201):
```json
{
  "id": "default",
  "name": "Default suite",
  "ordered_test_ids": ["chat-basic", "openai-compliance"],
  "filters": null,
  "stop_on_fail": true,
  "created_at": "2026-01-06T21:34:00.000Z",
  "updated_at": "2026-01-06T21:34:00.000Z"
}
```

### List models

Response (200):
```json
[
  {
    "id": "model-1",
    "name": "llama3",
    "provider": "ollama",
    "version": "3.1",
    "architecture": { "params": "8B" },
    "quantisation": { "bits": 8 },
    "capabilities": { "chat": true },
    "raw_metadata": { "source": "ollama /api/show" }
  }
]
```

## Profiles (example)

Profiles define reusable parameter sets, context strategy, and test selection.

```json
{
  "id": "perf-default",
  "version": "1.0.0",
  "name": "Perf default",
  "description": "Balanced latency + quality checks",
  "generation_parameters": {
    "temperature": 0.2,
    "max_tokens": 512
  },
  "context_strategy": {
    "type": "percentage",
    "value": 50,
    "truncation_policy": "warn"
  },
  "test_selection": {
    "tags": ["smoke", "latency"]
  },
  "execution_behaviour": {
    "repetitions": 3,
    "per_test_timeout_sec": 120
  }
}
```

## Test plugins (examples)

### JSON test (declarative)

```json
{
  "id": "chat-basic",
  "version": "1.0.0",
  "name": "Basic chat completion",
  "description": "Sanity check for chat response shape.",
  "protocols": ["openai_chat_completions"],
  "request": {
    "method": "POST",
    "path": "/v1/chat/completions",
    "body_template": {
      "model": "gpt-4o-mini",
      "messages": [{ "role": "user", "content": "ping" }]
    }
  },
  "assertions": [
    { "type": "json_path_exists", "target": "body", "expected": "$.id" },
    { "type": "json_path_exists", "target": "body", "expected": "$.choices" }
  ],
  "metrics": { "ttfb": "client" }
}
```

### Python test (imperative skeleton)

```python
TEST_META = {
    "id": "python-example",
    "version": "1.0.0",
    "name": "Python example",
    "description": "Custom test runner example",
    "protocols": ["openai_chat_completions"],
    "tags": ["custom"]
}

def run(ctx):
    # ctx provides inference server config, HTTP client, timers, redaction, artefact recorder
    response = ctx.http.post("/v1/chat/completions", json={
        "model": "gpt-4o-mini",
        "messages": [{"role": "user", "content": "ping"}]
    })
    return {
        "verdict": "pass",
        "failure_reason": None,
        "metrics": {"ttfb_ms": 120},
        "artefacts": {"raw": response.text},
        "events": []
    }
```

## Data model (overview)

- InferenceServer: endpoint config + runtime/auth/capabilities/discovery
- TestDefinition: versioned test spec (JSON or Python)
- Suite: ordered test collection
- Profile: reusable parameters + context strategy + test selection
- Run: single test or suite execution
- TestResult: per-test outcome with metrics/artefacts
- MetricSample: repetition-level metrics
- Model: observed model metadata snapshot

## Metrics

- TTFB: request sent → first token (streaming)
- Prefill: request sent → first token (streaming) or total latency when no tokens
- Decode: first token → final token (streaming)
- Tokens/sec: completion_tokens / decode_duration
- Proxy perplexity: cloze accuracy when logprobs are unavailable

## Tests

```bash
npm -w backend run test
npm -w frontend run test
```

## Data storage

Results are stored in a local SQLite file under `./data/` by default. Retention
is controlled by `RETENTION_DAYS` (default: 30 days).

## Notes

- API is intended for localhost use only and requires `AITESTBENCH_API_TOKEN`.
- Tests can be JSON-defined or Python-defined (loaded from `tests/definitions`).

## Troubleshooting

- `401 Unauthorized`: confirm `AITESTBENCH_API_TOKEN` matches backend env, and frontend token config if used.
- `409 Conflict` with `"Inference server has existing runs"` : Servers with existing runs must be archived instead of deleted.
- `no such table`: delete `./data/harness.sqlite` or ensure schema load on startup.
- `python3 not found`: install Python 3.10+ and ensure it is on PATH.
