# Implementation Plan: LLM Server Test Harness & Benchmark Dashboard

**Branch**: `001-llm-server-test-harness` | **Date**: 2026-01-06 | **Spec**: `/Users/Fango/DEV/Projects/codebase/AITestBench/specs/001-llm-server-test-harness/spec.md`
**Input**: Feature specification from `/specs/001-llm-server-test-harness/spec.md`

## Summary

Build a local LLM test harness with a TypeScript-based CLI, local HTTP API, and
web dashboard. The system discovers pluggable tests (JSON + Python), runs single
or suite executions, captures compliance/performance metrics, and stores results
in SQLite for comparison over time.

## Technical Context

**Language/Version**: TypeScript 5.x (Node.js 20 LTS)  
**Primary Dependencies**: Fastify (API), React 18 + Vite (dashboard), TailwindCSS 3.x, SQLite (better-sqlite3), Ajv (JSON schema), eventsource-parser (SSE)  
**Storage**: SQLite (local file, WAL mode)  
**Testing**: Vitest (unit/integration), Supertest (API), Playwright (UI e2e)  
**Target Platform**: macOS + Linux (local workstation)  
**Project Type**: Web app (frontend + backend + CLI)  
**Performance Goals**: API p95 < 200ms local; dashboard renders 1,000 runs < 3s  
**Constraints**: Local-only API (localhost + token), offline-capable, redaction at rest, Python runners sandboxed with best-effort limits  
**Defaults**: request timeout 30s, per-test timeout 120s, per-suite timeout 900s, concurrency limit 4  
**Scale/Scope**: Single user; ~100 targets, ~200 tests, ~1,000 runs, ~50,000 results

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- Code quality gates defined (lint/format/style, complexity justification) — PASS
- Testing strategy defined (levels + required tests) — PASS
- UX consistency review planned — PASS
- Distraction-free UI checks defined — PASS
- OWASP Top Ten review planned — PASS
- Performance budgets defined and measurable — PASS
- Explicit error handling strategy defined — PASS

## Project Structure

### Documentation (this feature)

```text
specs/001-llm-server-test-harness/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
└── tasks.md
```

### Source Code (repository root)

```text
backend/
├── src/
│   ├── api/
│   ├── services/
│   ├── models/
│   ├── adapters/
│   └── plugins/
└── tests/

frontend/
├── src/
│   ├── components/
│   ├── pages/
│   └── services/
└── tests/

cli/
├── src/
└── tests/
```

**Structure Decision**: Web app split into `backend/` and `frontend/` with a
separate `cli/` package for automation. This matches the local API + dashboard +
CLI requirements.

## Phase 0: Research

Output: `/Users/Fango/DEV/Projects/codebase/AITestBench/specs/001-llm-server-test-harness/research.md`

## Phase 1: Design & Contracts

- Data model: `/Users/Fango/DEV/Projects/codebase/AITestBench/specs/001-llm-server-test-harness/data-model.md`
- API contracts: `/Users/Fango/DEV/Projects/codebase/AITestBench/specs/001-llm-server-test-harness/contracts/openapi.yaml`
- Quickstart: `/Users/Fango/DEV/Projects/codebase/AITestBench/specs/001-llm-server-test-harness/quickstart.md`

## Constitution Check (Post-Design)

- Code quality gates defined — PASS
- Testing strategy defined — PASS
- UX consistency review planned — PASS
- Distraction-free UI checks defined — PASS
- OWASP Top Ten review planned — PASS
- Performance budgets defined and measurable — PASS
- Explicit error handling strategy defined — PASS

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
