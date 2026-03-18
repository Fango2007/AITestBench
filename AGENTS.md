# AITestBench Development Guidelines

Auto-generated from all feature plans. Last updated: 2026-01-06

## Active Technologies
- SQLite (local file, WAL mode) (001-manage-targets)
- TypeScript 5.x (Node.js 20 LTS) + React 18 + Fastify 5.x, better-sqlite3, Ajv, Vite 7.x, TailwindCSS 3.x (001-test-templates)
- SQLite (WAL) for active tests and metadata; filesystem templates directory for JSON/Python templates (001-test-templates)
- TypeScript 5.x (Node.js 20 LTS) for backend and frontend + Fastify 5.x, better-sqlite3, Ajv, React 18, Vite 7.x, TailwindCSS 3.x, Playwrigh (001-results-dashboard)
- SQLite (WAL mode) with `runs`, `test_results`, `test_result_documents`, `metric_samples`, `inference_servers`, and `models` (001-results-dashboard)

- TypeScript 5.x (Node.js 20 LTS) + Fastify (API), React 18 + Vite (dashboard), TailwindCSS 3.x, SQLite (better-sqlite3), Ajv (JSON schema), eventsource-parser (SSE) (001-llm-server-test-harness)

## Project Structure

```text
src/
tests/
```

## Commands

npm test && npm run lint

## Code Style

TypeScript 5.x (Node.js 20 LTS): Follow standard conventions

## Recent Changes
- 001-results-dashboard: Added TypeScript 5.x (Node.js 20 LTS) for backend and frontend + Fastify 5.x, better-sqlite3, Ajv, React 18, Vite 7.x, TailwindCSS 3.x, Playwrigh
- 001-test-templates: Added TypeScript 5.x (Node.js 20 LTS) + React 18 + Fastify 5.x, better-sqlite3, Ajv, Vite 7.x, TailwindCSS 3.x
- 001-manage-targets: Added TypeScript 5.x (Node.js 20 LTS) + Fastify (API), React 18 + Vite (dashboard), TailwindCSS 3.x, SQLite (better-sqlite3), Ajv (JSON schema), eventsource-parser (SSE)


<!-- MANUAL ADDITIONS START -->
<!-- MANUAL ADDITIONS END -->
