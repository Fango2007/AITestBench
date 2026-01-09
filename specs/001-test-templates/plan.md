# Implementation Plan: Test Templates

**Branch**: `001-test-templates` | **Date**: 2026-01-09 | **Spec**: `specs/001-test-templates/spec.md`
**Input**: Feature specification from `/specs/001-test-templates/spec.md`

**Note**: This template is filled in by the `/speckit.plan` command. See `.specify/templates/commands/plan.md` for the execution workflow.

## Summary

Add dashboard and API support for managing test templates (JSON or Python) with
versioning, archiving, and deletion rules that preserve traceability. Each test
instantiation records template name + version. Provide Playwright UI coverage
for menu/workflow/action flows and backend validation for template syntax and
version history.

## Technical Context

<!--
  ACTION REQUIRED: Replace the content in this section with the technical details
  for the project. The structure here is presented in advisory capacity to guide
  the iteration process.
-->

**Language/Version**: TypeScript 5.x (Node.js 20 LTS)  
**Primary Dependencies**: Fastify (API), React 18 + Vite (dashboard), TailwindCSS 3.x,
better-sqlite3, Ajv, eventsource-parser  
**Storage**: SQLite (local file, WAL mode)  
**Testing**: Vitest (backend/cli), Playwright (frontend e2e)  
**Target Platform**: Local web app (browser UI + Node.js API)  
**Project Type**: Web application (frontend + backend)  
**Performance Goals**: Template list and detail views load in under 1s for up to 500 templates.  
**Constraints**: Local SQLite storage, offline-capable, owner-only edits enforced.  
**Scale/Scope**: Single-user local instance; hundreds of templates, thousands of versions.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- Code Quality & Maintainability
- Testing Standards (NON-NEGOTIABLE)
- UX Consistency
- Distraction-Free UI
- OWASP Top Ten Security
- Performance Budgets
- Explicit, Non-Crashing Error Handling

When UI is in scope, the plan MUST include Playwright coverage for menus,
workflows, and key actions.

## Project Structure

### Documentation (this feature)

```text
specs/001-test-templates/
├── plan.md              # This file (/speckit.plan command output)
├── research.md          # Phase 0 output (/speckit.plan command)
├── data-model.md        # Phase 1 output (/speckit.plan command)
├── quickstart.md        # Phase 1 output (/speckit.plan command)
├── contracts/           # Phase 1 output (/speckit.plan command)
└── tasks.md             # Phase 2 output (/speckit.tasks command - NOT created by /speckit.plan)
```

### Source Code (repository root)
<!--
  ACTION REQUIRED: Replace the placeholder tree below with the concrete layout
  for this feature. Delete unused options and expand the chosen structure with
  real paths (e.g., apps/admin, packages/something). The delivered plan must
  not include Option labels.
-->

```text
backend/
├── src/
│   ├── models/
│   ├── services/
│   └── api/
└── tests/

frontend/
├── src/
│   ├── components/
│   ├── pages/
│   └── services/
└── tests/
```

**Structure Decision**: Web application with backend API and frontend dashboard,
using the repository’s existing backend/ and frontend/ layouts.

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| None | N/A | N/A |

## Phase 0: Research

- Confirm versioning scheme, archive rules, and validation timing align with
  traceability requirements.
- Document ownership and deletion constraints for templates.

## Phase 1: Design & Contracts

- Define data model for templates, versions, and instantiated tests.
- Draft API contracts for template CRUD, version history, and instantiation.
- Document dashboard flows and validation/error states.
- Update agent context via `.specify/scripts/bash/update-agent-context.sh codex`.

## Phase 2: Implementation Plan Outline

- Backend: data model + migrations, repository/service logic, API routes,
  validation, and authorization checks.
- Frontend: templates list, create/edit/version history, archive/unarchive,
  delete guardrails, and instantiation flow.
- Tests: backend unit/integration coverage; Playwright E2E coverage for menu,
  workflow, and action scenarios.
