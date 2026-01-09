# Implementation Plan: Target Management Dashboard

**Branch**: `001-manage-targets` | **Date**: 2026-01-08 | **Spec**: `/Users/Fango/DEV/Projects/codebase/AITestBench/specs/001-manage-targets/spec.md`
**Input**: Feature specification from `/specs/001-manage-targets/spec.md`

## Summary

Expand the dashboard to manage targets end-to-end: create, update, delete, and
archive targets with run history. On create or update, run an asynchronous
connectivity check that stores status and available models, with clear error
handling and retry support.

## Technical Context

**Language/Version**: TypeScript 5.x (Node.js 20 LTS)
**Primary Dependencies**: Fastify (API), React 18 + Vite (dashboard), TailwindCSS 3.x, SQLite (better-sqlite3), Ajv (JSON schema), eventsource-parser (SSE)
**Storage**: SQLite (local file, WAL mode)
**Testing**: Vitest (unit/integration), Supertest (API), Playwright (UI e2e)
**Target Platform**: macOS + Linux (local workstation)
**Project Type**: Web app (frontend + backend + CLI)
**Performance Goals**: Target list renders < 1s for 500 targets; connectivity
check completes < 30s for 95% of reachable targets
**Constraints**: Local-only API (localhost + token), offline-capable, redaction
at rest, deterministic tests, explicit error handling
**Scale/Scope**: Single user; ~100 targets, ~200 tests, ~1,000 runs, ~50,000
results

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- Code Quality & Maintainability — PASS
- Testing Standards (NON-NEGOTIABLE) — PASS
- UX Consistency — PASS
- Distraction-Free UI — PASS
- OWASP Top Ten Security — PASS
- Performance Budgets — PASS
- Explicit, Non-Crashing Error Handling — PASS

## Project Structure

### Documentation (this feature)

```text
specs/001-manage-targets/
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
separate `cli/` package, aligning with existing repository layout.

## Phase 0: Research

Output: `/Users/Fango/DEV/Projects/codebase/AITestBench/specs/001-manage-targets/research.md`

## Phase 1: Design & Contracts

- Data model: `/Users/Fango/DEV/Projects/codebase/AITestBench/specs/001-manage-targets/data-model.md`
- API contracts: `/Users/Fango/DEV/Projects/codebase/AITestBench/specs/001-manage-targets/contracts/openapi.yaml`
- Quickstart: `/Users/Fango/DEV/Projects/codebase/AITestBench/specs/001-manage-targets/quickstart.md`

## Phase N: Verification Artifacts

- Perf verification notes: `/Users/Fango/DEV/Projects/codebase/AITestBench/frontend/tests/perf/targets-perf.md`
- OWASP review checklist: `/Users/Fango/DEV/Projects/codebase/AITestBench/specs/001-manage-targets/checklists/owasp-review.md`

## Constitution Check (Post-Design)

- Code Quality & Maintainability — PASS
- Testing Standards (NON-NEGOTIABLE) — PASS
- UX Consistency — PASS
- Distraction-Free UI — PASS
- OWASP Top Ten Security — PASS
- Performance Budgets — PASS
- Explicit, Non-Crashing Error Handling — PASS

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
