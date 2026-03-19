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

It is designed for local evaluation workflows where you want to register and
manage inference servers, discover available models, define reusable test
templates, execute runs from a browser-based dashboard, and inspect results in
one place. The application supports both declarative JSON tests and
Python-backed tests, keeps run history and metrics locally, and provides a
results dashboard for filtering, comparing, and reviewing performance and
response data over time.

## Components

- `backend/`: Fastify API + SQLite persistence
- `frontend/`: React dashboard (Vite)

## Prerequisites

- Node.js 20 LTS (Node 25 also works in this repo)
- npm 9+
- Python 3.10+ (for Python test runners)
- SQLite (bundled with macOS/Linux)

## Setup

Use this section to prepare the repository locally before running the app.
It installs dependencies and creates the local environment file.

```bash
npm install
```

Create a local `.env` file from the example:

```bash
cp .env.example .env
```

## Desktop deployment

Use this section to run the released application on a desktop or workstation.
This is the intended local release flow: install from lockfile, build the frontend, then start the backend and frontend.

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

Copy/paste starter `.env`:

```bash
AITESTBENCH_API_TOKEN=change-me
PORT=8080
AITESTBENCH_DB_PATH=./data/aitestbench.sqlite
AITESTBENCH_TEST_TEMPLATES_DIR=./backend/data/templates
RETENTION_DAYS=30
AITESTBENCH_PYTHON_BIN=python3
VITE_AITESTBENCH_API_BASE_URL=http://localhost:8080
VITE_AITESTBENCH_FRONTEND_BASE_URL=http://localhost:5173
VITE_AITESTBENCH_API_TOKEN=change-me
```

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

Use `Type = JSON` for declarative tests where the template itself contains the
HTTP request definition and the assertions to run against the response.

Storage layout for JSON templates:

- The JSON template itself is stored in the templates directory.
- By default that directory is `backend/data/templates/`.
- A simple JSON template is a single file, usually written as `<template-id>.json`.
- All of the test logic for that template lives in that JSON file.

For simple tests, the minimal practical shape is:

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

How to build a JSON template from that shape:

- `id`, `name`, and `version` identify the template.
- `description` explains what the test is validating.
- `protocols` declares the expected protocol family. For chat-completion style
  requests, use `openai_chat_completions`.
- `request.method` and `request.path` define the HTTP call to make.
- `request.body_template` is the request payload template. The selected model is
  injected at run time, so keep a normal chat/completions body here.
- `assertions` defines what must be true for the test to pass.
- `metrics` is currently required by validation, but for the simple JSON form it
  does not actively control runtime metric collection yet. Use `{}`.

Supported assertion types for the simple JSON form:

- `status_code_in`
  Example:
  ```json
  { "type": "status_code_in", "expected": [200] }
  ```
- `json_path_exists`
  Example:
  ```json
  { "type": "json_path_exists", "expected": "$.choices[0].message.content" }
  ```
- `contains`
  Example:
  ```json
  { "type": "contains", "expected": "pong" }
  ```

For the simple JSON form, these are the only assertion types currently handled
by the backend runner.

Metrics currently computed automatically by the simple JSON runner:

- `ttfb_ms`: time in milliseconds from request start to the first token or
  first response chunk. If the runner cannot observe a first-token timestamp,
  it falls back to total duration.
- `total_ms`: time in milliseconds from request start to request completion.
- `prefill_ms`: time in milliseconds from request start to the first token. If
  token-phase timing is unavailable, it falls back to full request duration.
- `decode_ms`: time in milliseconds from the first token to the final token.
  This is only measurable when first-token timing exists.
- `tokens_per_sec`: output token throughput. Computed from
  `completion_tokens / decode_ms` when both values are available.
- `prompt_tokens`: input token count reported by the inference server, when the
  server exposes it.
- `completion_tokens`: output token count reported by the inference server,
  when the server exposes it.
- `not_measurable`: object listing metrics the runner could not compute and the
  reason why.

These are computed by the runner from request timing and token usage when
available. The `metrics` field in the template does not configure them yet.

Use this root-level JSON form when the test is a single request with a single
set of assertions. If you need more advanced scenario behaviour, the backend
also supports multi-step JSON templates with `defaults`, `vars`, `steps`,
`extract`, `assert`, and `final_assert`, but the single-request form is the
best starting point for new templates.

Example: simple chat smoke test

```json
{
  "id": "chat-smoke",
  "version": "1.0.0",
  "name": "Chat Smoke Test",
  "description": "Checks that the server returns a valid chat completion payload.",
  "protocols": ["openai_chat_completions"],
  "request": {
    "method": "POST",
    "path": "/v1/chat/completions",
    "body_template": {
      "model": "gpt-4o-mini",
      "messages": [{ "role": "user", "content": "Reply with the single word pong." }]
    }
  },
  "assertions": [
    { "type": "status_code_in", "expected": [200] },
    { "type": "json_path_exists", "expected": "$.choices[0].message.content" },
    { "type": "contains", "expected": "pong" }
  ],
  "metrics": {}
}
```

Example: response metadata check

```json
{
  "id": "metadata-check",
  "version": "1.0.0",
  "name": "Metadata Check",
  "description": "Verifies model metadata fields are present in the response.",
  "protocols": ["openai_chat_completions"],
  "request": {
    "method": "POST",
    "path": "/v1/chat/completions",
    "body_template": {
      "model": "gpt-4o-mini",
      "messages": [{ "role": "user", "content": "Say hello." }],
      "temperature": 0
    }
  },
  "assertions": [
    { "type": "status_code_in", "expected": [200] },
    { "type": "json_path_exists", "expected": "$.id" },
    { "type": "json_path_exists", "expected": "$.model" },
    { "type": "json_path_exists", "expected": "$.usage" },
    { "type": "json_path_exists", "expected": "$.choices[0].message.content" }
  ],
  "metrics": {}
}
```

How to think about a multi-step JSON template:

- Use it when one request depends on data returned by an earlier request.
- `defaults` defines shared headers, timeout, and retry settings applied to all
  steps unless overridden.
- `vars` defines initial variables available to the scenario.
- `steps` is the ordered list of HTTP calls to execute.
- Each `step.request` defines one HTTP call.
- Each `step.extract` copies values from the current response into scenario
  variables for later reuse.
- Each `step.assert` validates the result of that single step.
- `final_assert` runs after all steps and is useful for checking end-state
  conditions across the whole scenario.

Example: multi-step JSON scenario

```json
{
  "id": "two-step-conversation",
  "version": "1.0.0",
  "description": "Creates a value in step one and checks it again in step two.",
  "vars": {
    "user_prompt": "Reply with the exact word cobalt."
  },
  "defaults": {
    "headers": {
      "content-type": "application/json"
    },
    "timeout_ms": 30000,
    "retries": {
      "max": 0,
      "backoff_ms": 0
    }
  },
  "steps": [
    {
      "id": "generate-answer",
      "request": {
        "method": "POST",
        "url": "{{profile.server.base_url}}/v1/chat/completions",
        "body_template": {
          "model": "{{profile.selection.model}}",
          "messages": [{ "role": "user", "content": "{{vars.user_prompt}}" }]
        }
      },
      "extract": [
        {
          "var": "assistant_reply",
          "from": "body",
          "selector": "choices.0.message.content",
          "transform": "string"
        }
      ],
      "assert": [
        {
          "type": "step-status",
          "target": "status",
          "op": "==",
          "expected": 200
        },
        {
          "type": "reply-exists",
          "target": "body",
          "selector": "choices.0.message.content",
          "op": "exists"
        }
      ]
    },
    {
      "id": "validate-extracted-value",
      "request": {
        "method": "POST",
        "url": "{{profile.server.base_url}}/v1/chat/completions",
        "body_template": {
          "model": "{{profile.selection.model}}",
          "messages": [
            {
              "role": "user",
              "content": "Return this text unchanged: {{vars.assistant_reply}}"
            }
          ]
        }
      },
      "assert": [
        {
          "type": "step-status",
          "target": "status",
          "op": "==",
          "expected": 200
        }
      ]
    }
  ],
  "final_assert": [
    {
      "type": "captured-value-present",
      "target": "vars",
      "selector": "assistant_reply",
      "op": "exists"
    }
  ]
}
```

Authoring guidance for multi-step JSON templates:

1. Start with a working single-step request.
2. Split it into multiple `steps` only when a later request truly depends on an
   earlier response.
3. Extract only the fields you need into `vars`.
4. Keep step-level assertions local to each step.
5. Use `final_assert` only for scenario-wide checks that make sense after the
   full sequence completes.

Example: a good authoring workflow for JSON templates

1. Start from the minimal shape.
2. Make the request succeed manually against your target inference server.
3. Add only a few high-signal assertions first, such as status code and one or
   two required response fields.
4. Keep `metrics` as `{}` for now, because simple JSON templates do not yet use
   that field to control runtime metric collection.
5. Save the template in the dashboard, generate the active test, and validate
   the output before making the assertions stricter.

#### Python template

Use `Type = Python` when the test logic should live in Python instead of being
fully expressed as declarative JSON.

Storage layout for Python templates:

- The template saved through the dashboard is a JSON descriptor stored in the
  templates directory, by default `backend/data/templates/`.
- Python template descriptors are currently written there as
  `<template-id>.pytest.json`.
- The executable Python implementation is a separate file stored under
  `backend/tests_python/`.
- So a Python test is split across two artifacts:
  the descriptor in `backend/data/templates/` and the implementation module in
  `backend/tests_python/`.

The important distinction is:

- The content saved in the dashboard is still JSON.
- That JSON is only a descriptor.
- The actual executable test lives in a Python module referenced by the
  descriptor.
- The Python module is executed through the backend's sandboxed Python runner,
  which applies path restrictions and resource limits during execution.

The minimal practical descriptor shape is:

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

How the Python descriptor works:

- `kind` must be `python_test`.
- `schema_version` is the descriptor schema version, currently `v1`.
- `id`, `name`, `description`, and `version` identify the template.
- `lifecycle.status` should normally be `active`.
- `python.module` points to the Python implementation file.
- `python.entrypoint` names the function inside that module that the runner will call.
- `python.requirements.pip` is where Python-specific runtime dependencies can be declared.
- `contracts.requires` and `contracts.provides` document what the test depends on
  and what it validates.
- `defaults` holds generic execution settings such as timeout and retries.
- `parameters` is optional and is the main place for test-specific inputs that
  your Python code will read.
- `outputs` declares the normalized result formats expected by the runner.

Canonical Python module contract:

- Prefer naming the callable `entrypoint`.
- Use the signature `entrypoint(ctx, params)`.
- Use `ctx.http.request(...)` for HTTP calls so the runner can capture request
  and response steps consistently.
- Use `ctx.render(...)` when request values need `{{profile.*}}`,
  `{{env.*}}`, or `{{vars.*}}` templating.
- Read all test-specific configuration from `params`, not from hardcoded module
  globals.
- Return a dict containing at least `metrics` and/or `artefacts`, and include
  `verdict` and `failure_reason` when the module wants to make pass/fail intent
  explicit in its own result payload.
- Prefer shared helpers from `backend/tests_python/common.py` for HTTP wrappers,
  statistics, logging, and redaction instead of re-implementing them in each
  test module.

How `python.module` is resolved:

- Python test implementations live under `backend/tests_python/`.
- A dotted module reference such as `avg_output_tokens` resolves to
  `backend/tests_python/avg_output_tokens.py`.
- A dotted module reference such as `tests_python.avg_output_tokens` also
  resolves to `backend/tests_python/avg_output_tokens.py`.
- A slash-based reference can also be used if it resolves under that same
  directory.

How the descriptor connects to the Python module:

1. You save the JSON descriptor as the template in the UI.
2. During execution, the backend loads that descriptor.
3. The runner resolves `python.module` to a file in `backend/tests_python/`.
4. The runner imports the module and calls the configured function as
   `entrypoint(ctx, params)`.
5. `params` comes from the descriptor’s optional `parameters` object.
6. The return value from that Python function becomes the Python test result
   attached to the run.

Example: Python latency probe descriptor

```json
{
  "kind": "python_test",
  "schema_version": "v1",
  "id": "latency-probe",
  "name": "Latency Probe",
  "version": "1.0.0",
  "lifecycle": { "status": "active" },
  "python": {
    "module": "tests_python.avg_output_tokens",
    "entrypoint": "entrypoint",
    "requirements": { "pip": [] }
  },
  "contracts": { "requires": [], "provides": ["metrics"] },
  "defaults": { "timeout_ms": 60000, "retries": { "max": 0, "backoff_ms": 0 } },
  "parameters": {
    "prompts": ["Summarize the Eiffel Tower in one sentence.", "Explain what a token is."],
    "temperature": 0.7,
    "top_p": 0.9,
    "max_tokens": 256
  },
  "outputs": {
    "result_schema": "scenario_result.v1",
    "normalised_response": "response_normalisation.v1"
  }
}
```

Example: Python custom validation descriptor

```json
{
  "kind": "python_test",
  "schema_version": "v1",
  "id": "response-policy-check",
  "name": "Response Policy Check",
  "version": "1.0.0",
  "lifecycle": { "status": "active" },
  "python": {
    "module": "tests.python.response_policy_check",
    "entrypoint": "entrypoint",
    "requirements": { "pip": ["jsonschema==4.23.0"] }
  },
  "contracts": { "requires": [], "provides": ["artefacts", "metrics"] },
  "defaults": { "timeout_ms": 120000, "retries": { "max": 1, "backoff_ms": 250 } },
  "parameters": {
    "expected_schema": "response-policy.v1",
    "forbidden_terms": ["internal-only", "do not disclose"]
  },
  "outputs": {
    "result_schema": "scenario_result.v1",
    "normalised_response": "response_normalisation.v1"
  }
}
```

Example: a good authoring workflow for Python templates

1. Create the Python implementation first in `backend/tests_python/<name>.py`.
2. Import shared helpers from `backend/tests_python/common.py` when you need
   HTTP wrappers, metrics extraction, statistics, or redaction.
3. Write the function referenced by `python.entrypoint`.
4. Decide which knobs should be configurable, then expose them through
   `parameters` in the JSON descriptor.
5. Save the descriptor in the dashboard with `Type = Python`.
6. Run the template once and inspect the returned artefacts and metrics before
   relying on it in larger evaluations.

### 3) Run a test from the frontend

1. Go to **Run Single Test**.
2. Select the inference server.
3. Select the model (from discovered models, or type manually if needed).
4. Select one or more templates in **Templates**.
5. Click **Generate Active Tests**.
6. Optionally fill profile/timeouts/parameter overrides.
7. Click **Run**.
8. Click **Results** to fetch run outputs and metrics.


### Python test module (implementation referenced by a Python template)

This is the Python file referenced by `python.module` in the template
descriptor. The runner imports the module and calls the configured function as
`entrypoint(ctx, params)`.

```python
def entrypoint(ctx, params):
    # ctx exposes helpers such as ctx.http, ctx.env, ctx.vars, ctx.logger, and ctx.render().
    # params comes from the "parameters" field of the JSON descriptor.
    prompt = params.get("prompt", "ping")
    request = ctx.render({
        "method": "POST",
        "url": "{{profile.server.base_url}}/v1/chat/completions",
        "headers": {"content-type": "application/json"},
        "body": {
            "model": "{{profile.selection.model}}",
            "messages": [{"role": "user", "content": prompt}]
        }
    })

    response = ctx.http.request(
        method=request["method"],
        url=request["url"],
        headers=request.get("headers"),
        json=request.get("body"),
        timeout_ms=request.get("timeout_ms"),
        stream=False,
    )

    return {
        "verdict": "pass",
        "failure_reason": None,
        "metrics": {
            "status_code": response.status
        },
        "artefacts": {
            "response_text": response.text
        }
    }
```


## Tests

```bash
npm -w backend run test
npm -w frontend run test
```

## Data storage

Results are stored in a local SQLite file under `./data/` by default. Retention
is controlled by `RETENTION_DAYS` (default: 30 days).


## Troubleshooting

- `401 Unauthorized`: confirm `AITESTBENCH_API_TOKEN` matches backend env, and frontend token config if used.
- `409 Conflict` with `"Inference server has existing runs"` : Servers with existing runs must be archived instead of deleted.
- `no such table`: delete `./data/harness.sqlite` or ensure schema load on startup.
- `python3 not found`: install Python 3.10+ and ensure it is on PATH.
