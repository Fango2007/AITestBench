# Quickstart

## Prerequisites

- Node.js 20 LTS
- npm 9+
- Python 3.10+
- SQLite (bundled with macOS/Linux)

## Setup

```bash
npm install
```

## Configure

Set the API token used by the local HTTP API and CLI:

```bash
export LLM_HARNESS_API_TOKEN="local-dev-token"
```

## Run (dev)

```bash
npm run dev
```

This starts the backend API on `http://localhost:8080` and the dashboard on
`http://localhost:5173`.

## Run Tests

```bash
npm -w backend run test
```

## Add a Target

```bash
npm run cli -- target add \
  --name "local-ollama" \
  --base-url "http://localhost:11434" \
  --type "ollama"
```

## Run a Single Test

```bash
npm run cli -- test run --id "chat-basic" --target "local-ollama" --reps 3
```

## Run a Suite

```bash
npm run cli -- suite run --id "default" --target "local-ollama"
```

## Add a Pluggable Test

Drop a JSON test file into `tests/definitions/` and reload:

```bash
npm run cli -- tests reload
```

## Export Results

```bash
npm run cli -- export --format json --run-id <run-id>
```
