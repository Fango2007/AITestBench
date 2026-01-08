---

description: "Task list template for feature implementation"
---

# Tasks: LLM Server Test Harness & Benchmark Dashboard

**Input**: Design documents from `/specs/001-llm-server-test-harness/`
**Prerequisites**: plan.md (required), spec.md (required for user stories), research.md, data-model.md, contracts/

**Tests**: The examples below include test tasks. Tests are REQUIRED unless explicitly exempted in spec.md with documented rationale.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions

- **Single project**: `src/`, `tests/` at repository root
- **Web app**: `backend/src/`, `frontend/src/`
- **Mobile**: `api/src/`, `ios/src/` or `android/src/`
- Paths shown below assume single project - adjust based on plan.md structure

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project initialization and basic structure

- [X] T001 Create project directories per plan in `backend/`, `frontend/`, `cli/`
- [X] T002 Initialize root workspace config in `package.json`
- [X] T003 [P] Add shared TypeScript config in `tsconfig.base.json`
- [X] T004 [P] Add lint/format configs in `.eslintrc.cjs`, `.prettierrc`, `.editorconfig`
- [X] T005 [P] Initialize backend package in `backend/package.json`
- [X] T006 [P] Initialize frontend package in `frontend/package.json`
- [X] T007 [P] Initialize CLI package in `cli/package.json`
- [X] T008 [P] Add backend tsconfig in `backend/tsconfig.json`
- [X] T009 [P] Add frontend tsconfig in `frontend/tsconfig.json`
- [X] T010 [P] Add CLI tsconfig in `cli/tsconfig.json`
- [X] T011 [P] Add Tailwind config in `frontend/tailwind.config.ts`
- [X] T012 [P] Add Vite config in `frontend/vite.config.ts`
- [X] T013 [P] Add Fastify server entry in `backend/src/index.ts`
- [X] T014 [P] Add CLI entrypoint in `cli/src/index.ts`
- [X] T015 [P] Add env sample in `.env.example`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core infrastructure that MUST be complete before ANY user story can be implemented

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [X] T016 Define SQLite schema in `backend/src/models/schema.sql` (ref: /Users/Fango/DEV/Projects/codebase/AITestBench/specs/001-llm-server-test-harness/data-model.md)
- [X] T017 Implement DB access layer in `backend/src/models/db.ts` (ref: /Users/Fango/DEV/Projects/codebase/AITestBench/specs/001-llm-server-test-harness/data-model.md)
- [X] T018 Implement data repositories in `backend/src/models/repositories.ts` (ref: /Users/Fango/DEV/Projects/codebase/AITestBench/specs/001-llm-server-test-harness/data-model.md)
- [X] T019 Extend schema for Model and Profile tables in `backend/src/models/schema.sql` (ref: /Users/Fango/DEV/Projects/codebase/AITestBench/specs/001-llm-server-test-harness/data-model.md)
- [X] T020 Implement Model repository mapping in `backend/src/models/model.ts` (ref: /Users/Fango/DEV/Projects/codebase/AITestBench/specs/001-llm-server-test-harness/data-model.md)
- [X] T021 Implement Profile repository mapping in `backend/src/models/profile.ts` (ref: /Users/Fango/DEV/Projects/codebase/AITestBench/specs/001-llm-server-test-harness/data-model.md)
- [X] T022 Implement Model metadata service in `backend/src/services/model-metadata.ts` (ref: /Users/Fango/DEV/Projects/codebase/AITestBench/specs/001-llm-server-test-harness/data-model.md)
- [X] T023 Implement Profile service in `backend/src/services/profile-service.ts` (ref: /Users/Fango/DEV/Projects/codebase/AITestBench/specs/001-llm-server-test-harness/data-model.md)
- [X] T024 Implement auth token middleware in `backend/src/api/middleware/auth.ts`
- [X] T025 Implement structured logger + metrics in `backend/src/services/observability.ts` (ref: /Users/Fango/DEV/Projects/codebase/AITestBench/specs/001-llm-server-test-harness/data-model.md)
- [X] T026 Implement OpenAI adapter in `backend/src/adapters/openai.ts`
- [X] T027 Implement Ollama adapter in `backend/src/adapters/ollama.ts`
- [X] T028 Implement test discovery loader in `backend/src/plugins/loader.ts`
- [X] T029 Implement JSON test validator in `backend/src/plugins/json-validator.ts`
- [X] T030 Implement Python runner sandbox in `backend/src/plugins/python-runner.ts`
- [X] T031 Implement metrics computation utilities in `backend/src/services/metrics.ts` (ref: /Users/Fango/DEV/Projects/codebase/AITestBench/specs/001-llm-server-test-harness/data-model.md)
- [X] T032 Implement run orchestration service in `backend/src/services/run-executor.ts` (ref: /Users/Fango/DEV/Projects/codebase/AITestBench/specs/001-llm-server-test-harness/data-model.md)
- [X] T033 Implement redaction utilities in `backend/src/services/redaction.ts` (ref: /Users/Fango/DEV/Projects/codebase/AITestBench/specs/001-llm-server-test-harness/data-model.md)
- [X] T034 Define traceability mapping in `specs/001-llm-server-test-harness/tasks.md`
- [X] T035 Implement retention config loader in `backend/src/services/retention.ts`
- [X] T036 Implement retention cleanup job in `backend/src/services/retention-job.ts`

**Checkpoint**: Foundation ready - user story implementation can now begin in parallel

---

## Phase 3: User Story 1 - Run a single test against a target (Priority: P1) 🎯 MVP

**Goal**: Configure targets, run a single test once or N times, and view results.

**Independent Test**: Add a target, run a built-in test, and verify stored results with metrics.

### Tests for User Story 1 (REQUIRED unless exempted in spec.md) ⚠️

- [X] T037 [P] [US1] Unit test SSE parsing in `backend/tests/unit/sse-parser.test.ts`
- [X] T038 [P] [US1] Unit test metrics computation in `backend/tests/unit/metrics.test.ts`
- [X] T039 [P] [US1] Integration test target CRUD in `backend/tests/integration/targets.test.ts`
- [X] T040 [P] [US1] Integration test single run API in `backend/tests/integration/runs-single.test.ts`
- [X] T041 [P] [US1] CLI smoke test for single run in `cli/tests/integration/run-single.test.ts`
- [X] T042 [P] [US1] Unit test compliance test assertions in `backend/tests/unit/compliance.test.ts`

### Implementation for User Story 1

- [X] T043 [P] [US1] Implement Target model mapping in `backend/src/models/target.ts` (ref: /Users/Fango/DEV/Projects/codebase/AITestBench/specs/001-llm-server-test-harness/data-model.md)
- [X] T044 [P] [US1] Implement TestDefinition model mapping in `backend/src/models/test-definition.ts` (ref: /Users/Fango/DEV/Projects/codebase/AITestBench/specs/001-llm-server-test-harness/data-model.md)
- [X] T045 [US1] Implement Target service in `backend/src/services/target-service.ts` (ref: /Users/Fango/DEV/Projects/codebase/AITestBench/specs/001-llm-server-test-harness/data-model.md)
- [X] T046 [US1] Implement Tests service in `backend/src/services/test-service.ts` (ref: /Users/Fango/DEV/Projects/codebase/AITestBench/specs/001-llm-server-test-harness/data-model.md)
- [X] T047 [US1] Implement Runs service (single run) in `backend/src/services/run-service.ts` (ref: /Users/Fango/DEV/Projects/codebase/AITestBench/specs/001-llm-server-test-harness/data-model.md)
- [X] T048 [US1] Implement test-level override resolution in `backend/src/services/run-service.ts` (ref: /Users/Fango/DEV/Projects/codebase/AITestBench/specs/001-llm-server-test-harness/data-model.md)
- [X] T049 [US1] Persist effective parameter set in `backend/src/models/repositories.ts` (ref: /Users/Fango/DEV/Projects/codebase/AITestBench/specs/001-llm-server-test-harness/data-model.md)
- [X] T050 [US1] Implement context sizing strategies in `backend/src/services/context-strategy.ts` (ref: /Users/Fango/DEV/Projects/codebase/AITestBench/specs/001-llm-server-test-harness/data-model.md)
- [X] T051 [US1] Record prompt token counts in `backend/src/services/metrics.ts` (ref: /Users/Fango/DEV/Projects/codebase/AITestBench/specs/001-llm-server-test-harness/data-model.md)
- [X] T052 [US1] Extend Runs service to capture model metadata per run in `backend/src/services/run-service.ts` (ref: /Users/Fango/DEV/Projects/codebase/AITestBench/specs/001-llm-server-test-harness/data-model.md)
- [X] T053 [US1] Implement parameter sweep execution in `backend/src/services/sweep-runner.ts` (ref: /Users/Fango/DEV/Projects/codebase/AITestBench/specs/001-llm-server-test-harness/data-model.md)
- [X] T054 [US1] Persist sweep groupings in `backend/src/models/repositories.ts` (ref: /Users/Fango/DEV/Projects/codebase/AITestBench/specs/001-llm-server-test-harness/data-model.md)
- [X] T055 [US1] Add built-in compliance tests in `backend/src/plugins/builtins/openai-compliance.json`
- [X] T056 [US1] Add built-in compliance tests in `backend/src/plugins/builtins/ollama-compliance.json`
- [X] T057 [US1] Implement compliance mismatch detection in `backend/src/services/compliance.ts`
- [X] T058 [US1] Implement edge-case failure handling in `backend/src/services/failure-handling.ts`
- [X] T059 [US1] Add recovery retry mode in `backend/src/services/run-executor.ts`
- [X] T060 [US1] Wire built-in compliance tests into loader in `backend/src/plugins/loader.ts`
- [X] T061 [US1] Implement Targets API in `backend/src/api/routes/targets.ts` (ref: /Users/Fango/DEV/Projects/codebase/AITestBench/specs/001-llm-server-test-harness/contracts/openapi.yaml) (endpoints: /targets, /targets/{targetId})
- [X] T062 [US1] Implement Tests API in `backend/src/api/routes/tests.ts` (ref: /Users/Fango/DEV/Projects/codebase/AITestBench/specs/001-llm-server-test-harness/contracts/openapi.yaml) (endpoints: /tests, /tests/reload)
- [X] T063 [US1] Implement Runs API (single) in `backend/src/api/routes/runs.ts` (ref: /Users/Fango/DEV/Projects/codebase/AITestBench/specs/001-llm-server-test-harness/contracts/openapi.yaml) (endpoints: /runs, /runs/{runId}, /runs/{runId}/results)
- [X] T064 [US1] Implement Results API in `backend/src/api/routes/results.ts` (ref: /Users/Fango/DEV/Projects/codebase/AITestBench/specs/001-llm-server-test-harness/contracts/openapi.yaml) (endpoints: /results/{resultId})
- [X] T065 [US1] Implement CLI target commands in `cli/src/commands/target.ts` (ref: /Users/Fango/DEV/Projects/codebase/AITestBench/specs/001-llm-server-test-harness/contracts/openapi.yaml) (endpoints: /targets)
- [X] T066 [US1] Implement CLI test run command in `cli/src/commands/test.ts` (ref: /Users/Fango/DEV/Projects/codebase/AITestBench/specs/001-llm-server-test-harness/contracts/openapi.yaml) (endpoints: /runs)
- [X] T067 [US1] Implement CLI API client in `cli/src/lib/api-client.ts` (ref: /Users/Fango/DEV/Projects/codebase/AITestBench/specs/001-llm-server-test-harness/contracts/openapi.yaml) (endpoints: /targets, /tests, /tests/reload, /suites, /profiles, /runs, /runs/{runId}, /runs/{runId}/results, /results/{resultId}, /export)
- [X] T068 [US1] Implement CLI list targets command in `cli/src/commands/targets-list.ts` (ref: /Users/Fango/DEV/Projects/codebase/AITestBench/specs/001-llm-server-test-harness/contracts/openapi.yaml) (endpoints: /targets)
- [X] T069 [US1] Implement CLI list tests command in `cli/src/commands/tests-list.ts` (ref: /Users/Fango/DEV/Projects/codebase/AITestBench/specs/001-llm-server-test-harness/contracts/openapi.yaml) (endpoints: /tests)
- [X] T070 [US1] Implement CLI list suites command in `cli/src/commands/suites-list.ts` (ref: /Users/Fango/DEV/Projects/codebase/AITestBench/specs/001-llm-server-test-harness/contracts/openapi.yaml) (endpoints: /suites)
- [X] T071 [US1] Implement CLI export results command in `cli/src/commands/export.ts` (ref: /Users/Fango/DEV/Projects/codebase/AITestBench/specs/001-llm-server-test-harness/contracts/openapi.yaml) (endpoints: /export)
- [X] T072 [US1] Implement dashboard target setup page in `frontend/src/pages/Targets.tsx` (ref: /Users/Fango/DEV/Projects/codebase/AITestBench/specs/001-llm-server-test-harness/contracts/openapi.yaml) (endpoints: /targets)
- [X] T073 [US1] Implement dashboard single run page in `frontend/src/pages/RunSingle.tsx` (ref: /Users/Fango/DEV/Projects/codebase/AITestBench/specs/001-llm-server-test-harness/contracts/openapi.yaml) (endpoints: /runs)
- [X] T074 [US1] Implement dashboard results view in `frontend/src/pages/Results.tsx` (ref: /Users/Fango/DEV/Projects/codebase/AITestBench/specs/001-llm-server-test-harness/contracts/openapi.yaml) (endpoints: /runs/{runId}/results, /results/{resultId})
- [X] T075 [US1] Display edge-case failure reasons in `frontend/src/pages/Results.tsx`
- [X] T076 [US1] Implement frontend API client in `frontend/src/services/api.ts` (ref: /Users/Fango/DEV/Projects/codebase/AITestBench/specs/001-llm-server-test-harness/contracts/openapi.yaml) (endpoints: /targets, /tests, /tests/reload, /suites, /profiles, /runs, /runs/{runId}, /runs/{runId}/results, /results/{resultId}, /export)
- [X] T077 [US1] Add profile selection support in CLI run commands in `cli/src/commands/test.ts` (ref: /Users/Fango/DEV/Projects/codebase/AITestBench/specs/001-llm-server-test-harness/contracts/openapi.yaml) (endpoints: /runs)
- [X] T078 [US1] Add profile selection support in CLI suite commands in `cli/src/commands/suite.ts` (ref: /Users/Fango/DEV/Projects/codebase/AITestBench/specs/001-llm-server-test-harness/contracts/openapi.yaml) (endpoints: /runs)

**Checkpoint**: User Story 1 should be fully functional and testable independently

---

## Phase 4: User Story 2 - Run a full suite sequentially and compare runs over time (Priority: P2)

**Goal**: Execute suites sequentially, persist results, and compare runs in the dashboard.

**Independent Test**: Run a suite against a target and view a comparison of two runs.

### Tests for User Story 2 (REQUIRED unless exempted in spec.md) ⚠️

- [X] T079 [P] [US2] Integration test suite run API in `backend/tests/integration/runs-suite.test.ts`
- [X] T080 [P] [US2] Integration test run history API in `backend/tests/integration/runs-history.test.ts`
- [X] T081 [P] [US2] UI e2e test comparison view in `frontend/tests/e2e/compare.spec.ts`
- [X] T082 [P] [US2] Integration test profiles API in `backend/tests/integration/profiles.test.ts`
- [X] T083 [P] [US2] Integration test model metadata API in `backend/tests/integration/models.test.ts`
- [X] T084 [P] [US2] UI e2e test model details view in `frontend/tests/e2e/models.spec.ts`

### Implementation for User Story 2

- [X] T085 [US2] Implement Suite model mapping in `backend/src/models/suite.ts` (ref: /Users/Fango/DEV/Projects/codebase/AITestBench/specs/001-llm-server-test-harness/data-model.md)
- [X] T086 [US2] Implement Suite service in `backend/src/services/suite-service.ts` (ref: /Users/Fango/DEV/Projects/codebase/AITestBench/specs/001-llm-server-test-harness/data-model.md)
- [X] T087 [US2] Extend Runs service for suites in `backend/src/services/run-service.ts` (ref: /Users/Fango/DEV/Projects/codebase/AITestBench/specs/001-llm-server-test-harness/data-model.md)
- [X] T088 [US2] Implement Suites API in `backend/src/api/routes/suites.ts` (ref: /Users/Fango/DEV/Projects/codebase/AITestBench/specs/001-llm-server-test-harness/contracts/openapi.yaml) (endpoints: /suites, /suites/{suiteId})
- [X] T089 [US2] Implement run history API in `backend/src/api/routes/runs.ts` (ref: /Users/Fango/DEV/Projects/codebase/AITestBench/specs/001-llm-server-test-harness/contracts/openapi.yaml) (endpoints: /runs, /runs/{runId}, /runs/{runId}/results)
- [X] T090 [US2] Implement Profiles API in `backend/src/api/routes/profiles.ts` (ref: /Users/Fango/DEV/Projects/codebase/AITestBench/specs/001-llm-server-test-harness/contracts/openapi.yaml) (endpoints: /profiles, /profiles/{profileId})
- [X] T091 [US2] Implement Models API in `backend/src/api/routes/models.ts` (ref: /Users/Fango/DEV/Projects/codebase/AITestBench/specs/001-llm-server-test-harness/contracts/openapi.yaml) (endpoints: /models, /models/{modelId})
- [X] T092 [US2] Extend OpenAPI with /models endpoints in `specs/001-llm-server-test-harness/contracts/openapi.yaml`
- [X] T093 [US2] Implement dashboard run history page in `frontend/src/pages/RunHistory.tsx` (ref: /Users/Fango/DEV/Projects/codebase/AITestBench/specs/001-llm-server-test-harness/contracts/openapi.yaml) (endpoints: /runs)
- [X] T094 [US2] Implement dashboard comparison page in `frontend/src/pages/CompareRuns.tsx` (ref: /Users/Fango/DEV/Projects/codebase/AITestBench/specs/001-llm-server-test-harness/contracts/openapi.yaml) (endpoints: /runs, /runs/{runId}/results)
- [X] T095 [US2] Implement charts components in `frontend/src/components/RunCharts.tsx` (ref: /Users/Fango/DEV/Projects/codebase/AITestBench/specs/001-llm-server-test-harness/contracts/openapi.yaml) (endpoints: /runs/{runId}/results)
- [X] T096 [US2] Display effective parameters in results view in `frontend/src/pages/Results.tsx` (ref: /Users/Fango/DEV/Projects/codebase/AITestBench/specs/001-llm-server-test-harness/contracts/openapi.yaml) (endpoints: /runs/{runId}/results, /results/{resultId})
- [X] T097 [US2] Add context utilization chart in `frontend/src/components/ContextUtilChart.tsx` (ref: /Users/Fango/DEV/Projects/codebase/AITestBench/specs/001-llm-server-test-harness/contracts/openapi.yaml) (endpoints: /runs/{runId}/results)
- [X] T098 [US2] Add parameter filter controls in comparison page in `frontend/src/pages/CompareRuns.tsx` (ref: /Users/Fango/DEV/Projects/codebase/AITestBench/specs/001-llm-server-test-harness/contracts/openapi.yaml) (endpoints: /runs, /runs/{runId}/results)
- [X] T099 [US2] Add sweep comparison panel in `frontend/src/pages/CompareRuns.tsx` (ref: /Users/Fango/DEV/Projects/codebase/AITestBench/specs/001-llm-server-test-harness/contracts/openapi.yaml) (endpoints: /runs)
- [X] T100 [US2] Implement profiles management page in `frontend/src/pages/Profiles.tsx` (ref: /Users/Fango/DEV/Projects/codebase/AITestBench/specs/001-llm-server-test-harness/contracts/openapi.yaml) (endpoints: /profiles)
- [X] T101 [US2] Implement models list page in `frontend/src/pages/Models.tsx` (ref: /Users/Fango/DEV/Projects/codebase/AITestBench/specs/001-llm-server-test-harness/contracts/openapi.yaml) (endpoints: /models)
- [X] T102 [US2] Implement model details page in `frontend/src/pages/ModelDetails.tsx` (ref: /Users/Fango/DEV/Projects/codebase/AITestBench/specs/001-llm-server-test-harness/contracts/openapi.yaml) (endpoints: /models, /models/{modelId})
- [X] T103 [US2] Add profile selector to single run page in `frontend/src/pages/RunSingle.tsx` (ref: /Users/Fango/DEV/Projects/codebase/AITestBench/specs/001-llm-server-test-harness/contracts/openapi.yaml) (endpoints: /profiles)
- [X] T104 [US2] Implement CLI profile commands in `cli/src/commands/profile.ts` (ref: /Users/Fango/DEV/Projects/codebase/AITestBench/specs/001-llm-server-test-harness/contracts/openapi.yaml) (endpoints: /profiles)

**Checkpoint**: User Stories 1 and 2 should both work independently

---

## Phase 5: User Story 3 - Add pluggable tests (JSON spec + optional Python runner) (Priority: P3)

**Goal**: Discover JSON/Python tests from disk and run them safely.

**Independent Test**: Drop a JSON test file, reload, and run it successfully.

### Tests for User Story 3 (REQUIRED unless exempted in spec.md) ⚠️

- [X] T105 [P] [US3] Unit test JSON schema validation in `backend/tests/unit/json-tests.test.ts`
- [X] T106 [P] [US3] Integration test test reload API in `backend/tests/integration/tests-reload.test.ts`
- [X] T107 [P] [US3] Unit test Python runner sandbox in `backend/tests/unit/python-runner.test.ts`
- [X] T108 [P] [US3] Unit test proxy perplexity scoring in `backend/tests/unit/perplexity.test.ts`

### Implementation for User Story 3

- [X] T109 [US3] Define JSON test schema in `backend/src/plugins/test-schema.json`
- [X] T110 [US3] Implement tests reload route in `backend/src/api/routes/tests.ts` (ref: /Users/Fango/DEV/Projects/codebase/AITestBench/specs/001-llm-server-test-harness/contracts/openapi.yaml) (endpoints: /tests, /tests/reload)
- [X] T111 [US3] Implement CLI reload command in `cli/src/commands/tests.ts` (ref: /Users/Fango/DEV/Projects/codebase/AITestBench/specs/001-llm-server-test-harness/contracts/openapi.yaml) (endpoints: /tests/reload)
- [X] T112 [US3] Implement dashboard reload button in `frontend/src/components/ReloadTestsButton.tsx` (ref: /Users/Fango/DEV/Projects/codebase/AITestBench/specs/001-llm-server-test-harness/contracts/openapi.yaml) (endpoints: /tests/reload)
- [X] T113 [US3] Implement tests directory config in `backend/src/plugins/config.ts`
- [X] T114 [US3] Implement perplexity dataset loader in `backend/src/services/perplexity.ts`
- [X] T115 [US3] Implement proxy perplexity runner in `backend/src/services/perplexity-runner.ts`
- [X] T116 [US3] Add proxy perplexity test definition in `backend/src/plugins/builtins/proxy-perplexity.json`
- [X] T117 [US3] Surface perplexity metrics in results view in `frontend/src/pages/Results.tsx` (ref: /Users/Fango/DEV/Projects/codebase/AITestBench/specs/001-llm-server-test-harness/contracts/openapi.yaml) (endpoints: /runs/{runId}/results)

**Checkpoint**: All user stories should now be independently functional

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Improvements that affect multiple user stories

- [X] T118 UX consistency review against design system in `frontend/src/styles/index.css`
- [X] T119 Distraction-free UI review and cleanup in `frontend/src/pages/`
- [X] T120 OWASP Top Ten review and hardening in `backend/src/api/`
- [X] T121 Performance benchmarking against budgets in `backend/tests/perf/benchmarks.ts`
- [X] T122 [P] Documentation updates in `specs/001-llm-server-test-harness/quickstart.md`
- [X] T123 [P] Code cleanup and refactoring in `backend/src/` and `frontend/src/`

---

## Traceability Mapping

| Requirement | Coverage Tasks |
|-------------|----------------|
| FR-019, FR-020, FR-021 | T028, T029, T030 |
| FR-022 | T030 |
| FR-025 | T016, T017, T018 |
| FR-026, FR-026a | T035, T036 |
| FR-052 to FR-063 | T019, T021, T023, T077, T078 |
| FR-059, FR-060 | T048, T049 |
| FR-065 | T077, T078 |
| NFR-002 | T033 |
| NFR-005 | T025 |
| NFR-007 | T034 |

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion - BLOCKS all user stories
- **User Stories (Phase 3+)**: All depend on Foundational phase completion
  - User stories can then proceed in parallel (if staffed)
  - Or sequentially in priority order (P1 → P2 → P3)
- **Polish (Final Phase)**: Depends on all desired user stories being complete

### User Story Dependencies

- **User Story 1 (P1)**: Can start after Foundational (Phase 2) - No dependencies on other stories
- **User Story 2 (P2)**: Can start after Foundational (Phase 2) - Integrates with US1 data
- **User Story 3 (P3)**: Can start after Foundational (Phase 2) - Depends on test loader foundations

### Within Each User Story

- Tests MUST be written and FAIL before implementation
- Models before services
- Services before endpoints
- Core implementation before integration
- Story complete before moving to next priority

### Parallel Opportunities

- All Setup tasks marked [P] can run in parallel
- All Foundational tasks marked [P] can run in parallel (within Phase 2)
- Once Foundational phase completes, all user stories can start in parallel (if team capacity allows)
- All tests for a user story marked [P] can run in parallel
- Models within a story marked [P] can run in parallel
- Different user stories can be worked on in parallel by different team members

---

## Parallel Example: User Story 1

```bash
# Launch unit tests for User Story 1 together:
Task: "Unit test SSE parsing in backend/tests/unit/sse-parser.test.ts"
Task: "Unit test metrics computation in backend/tests/unit/metrics.test.ts"

# Launch UI and API components in parallel:
Task: "Implement Targets API in backend/src/api/routes/targets.ts"
Task: "Implement dashboard target setup page in frontend/src/pages/Targets.tsx"
```

---

## Parallel Example: User Story 2

```bash
# Launch suite API and UI work together:
Task: "Implement Suites API in backend/src/api/routes/suites.ts"
Task: "Implement dashboard run history page in frontend/src/pages/RunHistory.tsx"
```

---

## Parallel Example: User Story 3

```bash
# Launch plugin schema + UI reload in parallel:
Task: "Define JSON test schema in backend/src/plugins/test-schema.json"
Task: "Implement dashboard reload button in frontend/src/components/ReloadTestsButton.tsx"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational (CRITICAL - blocks all stories)
3. Complete Phase 3: User Story 1
4. **STOP and VALIDATE**: Test User Story 1 independently
5. Deploy/demo if ready

### Incremental Delivery

1. Complete Setup + Foundational → Foundation ready
2. Add User Story 1 → Test independently → Deploy/Demo (MVP!)
3. Add User Story 2 → Test independently → Deploy/Demo
4. Add User Story 3 → Test independently → Deploy/Demo
5. Each story adds value without breaking previous stories

### Parallel Team Strategy

With multiple developers:

1. Team completes Setup + Foundational together
2. Once Foundational is done:
   - Developer A: User Story 1
   - Developer B: User Story 2
   - Developer C: User Story 3
3. Stories complete and integrate independently

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- Each user story should be independently completable and testable
- Verify tests fail before implementing
- Commit after each task or logical group
- Stop at any checkpoint to validate story independently
- Avoid: vague tasks, same file conflicts, cross-story dependencies that break independence
