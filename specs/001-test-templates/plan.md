# Implementation Plan: Test Templates Management

**Branch**: `001-test-templates` | **Date**: 2026-01-11 | **Spec**: `specs/001-test-templates/spec.md`
**Input**: Feature specification from `/specs/001-test-templates/spec.md`

## Summary

Add a fully integrated template library to the existing dashboard and API, enabling users to create, edit, delete, validate, and list JSON/Python test templates, instantiate active tests after selecting target/model, and run them via the current run pipeline. Templates live in the configured templates directory (root .env), built-in templates are migrated into the default directory, active tests are versioned and persisted in the database, and the UI supports explicit generate and run actions.

## Technical Context

**Language/Version**: TypeScript 5.x (Node.js 20 LTS) + React 18
**Primary Dependencies**: Fastify 5.x, better-sqlite3, Ajv, Vite 7.x, TailwindCSS 3.x
**Storage**: SQLite (WAL) for active tests and metadata; filesystem templates directory for JSON/Python templates
**Testing**: Vitest (backend/frontend), Playwright (frontend e2e)
**Target Platform**: Local Node.js server + browser dashboard
**Project Type**: Web application (backend + frontend)
**Performance Goals**: Template list refreshes within 5 seconds for 95% of attempts; UI feedback for save/instantiate within 2 seconds
**Constraints**: Must integrate into existing codebase and flows; no new services; root .env is the single configuration source
**Scale/Scope**: Dozens to hundreds of templates; single-operator usage per environment

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- Code Quality & Maintainability: Pass
- Testing Standards (NON-NEGOTIABLE): Pass (unit + e2e updates planned)
- UX Consistency: Pass (reuse existing UI patterns)
- Distraction-Free UI: Pass (no new interruptive UI)
- OWASP Top Ten Security: Pass (validation + auth already enforced)
- Performance Budgets: Pass (explicit budgets listed)
- Explicit, Non-Crashing Error Handling: Pass (validated errors with user messages)
- App-Root Environment Configuration: Pass (root .env only)

When UI is in scope, the plan MUST include Playwright coverage for menus, workflows, and key actions.

## Test Strategy

- Backend: contract tests for template CRUD and instantiation, unit tests for validation.
- Frontend: Playwright e2e for templates CRUD and Run Single instantiation.
- Determinism: isolate filesystem templates directory per test run.

## UX Consistency Review

- Reuse existing dashboard page layout, card, and form patterns.

## OWASP Review

- Validate inputs, enforce auth token, and prevent path traversal in template storage.
- Document threat model for template content ingestion.

## Performance Budget Verification

- Validate template list refresh <5s (95%) and UI feedback <2s.

## Error Handling Strategy

- Backend returns structured errors; UI displays actionable messages without stack traces.

## Project Structure

### Documentation (this feature)

```text
specs/001-test-templates/
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
│   ├── models/
│   ├── services/
│   └── plugins/
└── tests/

frontend/
├── src/
│   ├── components/
│   ├── pages/
│   └── services/
└── tests/
```

**Structure Decision**: Use the existing backend/ and frontend/ projects with new routes, services, and UI components wired into the current dashboard.

## Phase 0: Outline & Research

Research decisions are documented in `specs/001-test-templates/research.md` and resolve all open items from the spec.

## Phase 1: Design & Contracts

- Data model documented in `specs/001-test-templates/data-model.md`
- API contracts documented in `specs/001-test-templates/contracts/openapi.yaml`
- Developer quickstart documented in `specs/001-test-templates/quickstart.md`
- Agent context updated via `.specify/scripts/bash/update-agent-context.sh codex`

## Constitution Check (Post-Design)

- Code Quality & Maintainability: Pass
- Testing Standards (NON-NEGOTIABLE): Pass
- UX Consistency: Pass
- Distraction-Free UI: Pass
- OWASP Top Ten Security: Pass
- Performance Budgets: Pass
- Explicit, Non-Crashing Error Handling: Pass
- App-Root Environment Configuration: Pass

## Complexity Tracking

No violations requiring justification.
