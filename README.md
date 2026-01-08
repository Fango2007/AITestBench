# LLM Server Test Harness & Benchmark Dashboard

Local-first harness for running automated LLM tests against OpenAI-compatible
or Ollama servers. It provides:

- A local HTTP API for triggering runs and fetching results
- A CLI for automation and scripting
- A lightweight dashboard for browsing runs, profiles, and comparisons

## Purpose

This tool standardizes how you measure latency, correctness, and compliance
across model servers. It stores results locally (SQLite) and supports running
single tests, suites, and parameter sweeps with reusable profiles.

## Components

- `backend/`: Fastify API + SQLite persistence
- `cli/`: TypeScript CLI for automation
- `frontend/`: React dashboard (Vite)

## Prerequisites

- Node.js 20 LTS (Node 25 also works in this repo)
- npm 9+
- Python 3.10+ (for Python test runners)
- SQLite (bundled with macOS/Linux)

## Setup

```bash
npm install
```

## Environment variables
Create a local `.env` file at the repo root:

- `AITESTBENCH_API_TOKEN` (required): shared token for API + CLI auth.
- `AITESTBENCH_DB_PATH` (optional): override DB file path.
- `RETENTION_DAYS` (optional): days to keep results (default: 30).
- `VITE_AITESTBENCH_API_BASE_URL` (optional): dashboard API base URL (default: http://localhost:8080).
- `AITESTBENCH_DRY_RUN` (optional): set to `1` to skip live HTTP calls (useful for tests).
- `VITE_AITESTBENCH_API_TOKEN` (optional): alternate dashboard token env name.


## Run (dev)

```bash
npm run dev
```

- API: `http://localhost:8080` **(by default)**
- Dashboard: `http://localhost:5173`

If you are not using a root dev script, run in two terminals:

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

## CLI usage (reference)

```bash
# target management
npm run cli -- target add \
  --name "local-ollama" \
  --base-url "http://localhost:11434" \
  --type "ollama"

# list targets
npm run cli -- target list

# delete target
npm run cli -- target delete --id "<target-id>"

# update target
npm run cli -- target update --id "<target-id>" --name "new-name" --base-url "http://localhost:11434"

# single test
npm run cli -- test run --id "chat-basic" --target "local-ollama"

# suite run
npm run cli -- suite run --id "default" --target "local-ollama"

# profile selection on runs
npm run cli -- test run --id "chat-basic" --target "local-ollama" \
  --profile-id "perf-default" --profile-version "1.0.0"

# create profile
npm run cli -- profiles create \
  --id "perf-default" \
  --version "1.0.0" \
  --name "Perf default"

# reload tests
npm run cli -- tests reload

# list profiles
npm run cli -- profiles list

# list models
npm run cli -- models list

# export results
npm run cli -- export --format json --run-id <run-id>
```

## API endpoints (local-only)

Base URL: `http://localhost:8080`

Core:
- `GET /health`: health check
- `GET /targets`: list targets
- `POST /targets`: create target
- `GET /targets/{targetId}`: get target
- `PUT /targets/{targetId}`: update target
- `DELETE /targets/{targetId}`: delete target

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

## API payload samples

### Create target

Request:
```json
{
  "name": "local-ollama",
  "base_url": "http://localhost:11434",
  "auth_type": "none",
  "auth_token_ref": "OLLAMA_API_TOKEN",
  "default_model": "llama3",
  "default_params": {
    "temperature": 0.2
  },
  "timeouts": {
    "request_timeout_sec": 30
  },
  "concurrency_limit": 2
}
```

`auth_token_ref` points to an environment variable name that stores the bearer
token used for the target (e.g., `export OLLAMA_API_TOKEN="..."`).

Response (201):
```json
{
  "id": "b5a6b1a9f59f4e0e9b7e",
  "name": "local-ollama",
  "base_url": "http://localhost:11434",
  "auth_type": "none",
  "auth_token_ref": "OLLAMA_API_TOKEN",
  "default_model": "llama3",
  "default_params": {
    "temperature": 0.2
  },
  "timeouts": {
    "request_timeout_sec": 30
  },
  "concurrency_limit": 2,
  "created_at": "2026-01-06T21:30:00.000Z",
  "updated_at": "2026-01-06T21:30:00.000Z"
}
```

### Create run (single test)

Request:
```json
{
  "target_id": "b5a6b1a9f59f4e0e9b7e",
  "test_id": "chat-basic",
  "profile_id": "perf-default",
  "profile_version": "1.0.0"
}
```

Response (201):
```json
{
  "id": "9b2e9f79a1c54290d91b",
  "target_id": "b5a6b1a9f59f4e0e9b7e",
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
  "target_id": "b5a6b1a9f59f4e0e9b7e",
  "suite_id": "default",
  "profile_id": "perf-default",
  "profile_version": "1.0.0"
}
```

Response (201):
```json
{
  "id": "e74b7b0a3a5b4c1fa312",
  "target_id": "b5a6b1a9f59f4e0e9b7e",
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
    "target_id": "b5a6b1a9f59f4e0e9b7e",
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
    # ctx provides target config, HTTP client, timers, redaction, artefact recorder
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

- Target: endpoint config + defaults
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
npm -w cli run test
```

## Data storage

Results are stored in a local SQLite file under `./data/` by default. Retention
is controlled by `RETENTION_DAYS` (default: 30 days).

## Notes

- API is intended for localhost use only and requires `AITESTBENCH_API_TOKEN`.
- Tests can be JSON-defined or Python-defined (loaded from `tests/definitions`).

## Troubleshooting

- `401 Unauthorized`: confirm `AITESTBENCH_API_TOKEN` matches in CLI + backend env.
- `409 Conflict` with `"Target has existing runs"` : Targets with existing runs cannot be deleted. Delete runs first or use a separate cleanup workflow.
- `no such table`: delete `./data/harness.sqlite` or ensure schema load on startup.
- `python3 not found`: install Python 3.10+ and ensure it is on PATH.
