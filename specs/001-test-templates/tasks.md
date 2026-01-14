# Tasks: Test Templates Management

**Feature**: Test Templates Management  
**Branch**: `001-test-templates`  
**Spec**: `specs/001-test-templates/spec.md`  
**Plan**: `specs/001-test-templates/plan.md`

## Phase 1: Setup

- [X] T001 Add AITESTBENCH_TEST_TEMPLATES_DIR to root .env.example and document in README.md
- [X] T002 [P] Create templates directory default under backend/data/templates with migration note in backend/README.md
- [X] T003 Add migration from backend/src/plugins/builtins to templates dir in backend/src/services/template-migration.ts
- [X] T004 [P] Add startup migration invocation in backend/src/index.ts

## Phase 2: Foundational

- [X] T005 Add template storage config loader in backend/src/services/template-storage.ts
- [X] T006 Add template file IO helpers (list/read/write/delete) in backend/src/services/template-storage.ts
- [X] T007 Add template validation helpers for JSON/Python syntax in backend/src/services/template-validation.ts
- [X] T008 Add template persistence models for active tests in backend/src/models/active-test.ts
- [X] T009 Add migrations for active test table and version fields in backend/src/models/db.ts
- [X] T010 Add template service for CRUD + instantiate in backend/src/services/template-service.ts
- [X] T011 Add API routes for templates and active tests in backend/src/api/routes/templates.ts
- [X] T012 Register new template routes in backend/src/api/server.ts
- [X] T041 Implement templates dir fallback + warning in backend/src/services/template-storage.ts

## Phase 3: User Story 1 (P1) – Manage Test Templates

**Story goal**: Users can create, edit, list, validate, and delete templates in the dashboard.

**Independent test criteria**: A user can create, update, and delete a template; validation errors prevent saving; template list updates within 5 seconds.

- [X] T013 [US1] Add templates API client in frontend/src/services/templates-api.ts
- [X] T014 [US1] Add Templates page and route in frontend/src/pages/Templates.tsx
- [X] T015 [P] [US1] Add Templates list component in frontend/src/components/TemplateList.tsx
- [X] T016 [P] [US1] Add Template editor form component in frontend/src/components/TemplateEditor.tsx
- [X] T017 [US1] Wire Templates page into navigation in frontend/src/App.tsx
- [X] T018 [US1] Enforce unique id/name on create/update in backend/src/services/template-service.ts
- [X] T019 [US1] Add backend tests for template CRUD in backend/tests/contract/templates.spec.ts
- [X] T020 [US1] Add contract test for uniqueness errors in backend/tests/contract/templates.spec.ts
- [X] T021 [US1] Add Playwright coverage for templates CRUD in frontend/tests/e2e/templates-crud.spec.ts

## Phase 4: User Story 2 (P2) – Instantiate Templates for a Run

**Story goal**: Users can generate active tests after selecting target/model/templates and then run them.

**Independent test criteria**: Selecting target/model/templates and clicking Generate creates active tests and enables Run.

- [X] T022 [US2] Add active tests API client in frontend/src/services/active-tests-api.ts
- [X] T023 [US2] Extend Run Single to load templates in frontend/src/pages/RunSingle.tsx
- [X] T024 [US2] Add Generate/Instantiate action UI in frontend/src/pages/RunSingle.tsx
- [X] T025 [US2] Persist active tests list in frontend/src/pages/RunSingle.tsx
- [X] T026 [US2] Add active test version fields in backend/src/models/active-test.ts and db migration
- [X] T027 [US2] Expose active test version in backend/src/api/routes/templates.ts
- [X] T028 [US2] Implement list/delete active tests in backend/src/api/routes/templates.ts
- [X] T029 [US2] Add active test delete UI in frontend/src/pages/RunSingle.tsx
- [X] T030 [US2] Add backend contract test for instantiate endpoint in backend/tests/contract/active-tests.spec.ts
- [X] T031 [US2] Add contract test for list/delete in backend/tests/contract/active-tests.spec.ts
- [X] T032 [US2] Add Playwright coverage for instantiate flow in frontend/tests/e2e/run-single-templates.spec.ts
- [X] T042 [US2] Enforce active test naming with model name in backend/src/services/template-service.ts
- [X] T043 [US2] Disable Run action until active tests exist in frontend/src/pages/RunSingle.tsx

## Phase 5: User Story 3 (P3) – Use Different Template Types

**Story goal**: JSON and Python templates produce correct run-ready behavior.

**Independent test criteria**: JSON templates create a runnable command preview; Python templates are marked ready for sandboxed execution.

- [X] T033 [US3] Add runnable command preview support in backend/src/services/template-service.ts
- [X] T034 [US3] Render runnable command preview in frontend/src/pages/RunSingle.tsx
- [X] T035 [US3] Add unit tests for JSON/Python validation in backend/tests/unit/template-validation.test.ts
- [X] T036 [US3] Add e2e coverage for JSON/Python template selection in frontend/tests/e2e/run-single-template-types.spec.ts
- [X] T044 [US3] Persist Python template readiness status in backend/src/services/template-service.ts

## Phase 6: Polish & Cross-Cutting Concerns

- [X] T037 Add error handling for template IO failures in backend/src/api/routes/templates.ts
- [X] T038 [P] Add error-state UX for template validation failures in frontend/src/components/TemplateEditor.tsx
- [X] T039 [P] Update frontend styles for templates UI in frontend/src/styles/index.css
- [X] T040 Update documentation in specs/001-test-templates/quickstart.md

## Dependencies

- User Story 1 blocks User Story 2 (templates must exist before instantiation).
- User Story 2 blocks User Story 3 (template type behaviors depend on instantiation flow).

## Parallel Execution Examples

- US1: T015 + T016 can run in parallel with T013 once API client contract is defined.
- US2: T023 + T024 can run in parallel with T022 once API client is defined.
- US3: T033 + T034 can run in parallel with T035.

## Implementation Strategy

1. Deliver template storage + API foundation.
2. Ship template CRUD UI (US1) with tests.
3. Add instantiation flow and active tests (US2) with tests.
4. Add JSON/Python-specific behaviors (US3) and finalize e2e coverage.
5. Polish error handling and UX.
