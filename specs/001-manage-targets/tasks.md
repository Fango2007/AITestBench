---

description: "Task list template for feature implementation"
---

# Tasks: Target Management Dashboard

**Input**: Design documents from `/specs/001-manage-targets/`
**Prerequisites**: plan.md (required), spec.md (required for user stories), research.md, data-model.md, contracts/

**Tests**: Tests are REQUIRED by the constitution; include per-story API and UI
coverage.

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

- [x] T001 Review existing targets API and dashboard layout in backend/src/api/ and frontend/src/pages/
- [x] T002 [P] Add target management routes skeleton in backend/src/api/routes/targets.ts
- [x] T003 [P] Add dashboard targets page shell with active/archived sections in frontend/src/pages/Targets.tsx

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core infrastructure that MUST be complete before ANY user story can be implemented

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [x] T004 Add target, connectivity, and model persistence schema updates in backend/src/models/target.ts
- [x] T005 Add data access layer for targets and models in backend/src/services/targets-repository.ts
- [x] T006 Add connectivity check runner service in backend/src/services/connectivity-runner.ts
- [x] T007 Add request validation schemas for targets endpoints in backend/src/api/targets-schemas.ts
- [x] T008 Add shared frontend API client for targets in frontend/src/services/targets-api.ts

**Checkpoint**: Foundation ready - user story implementation can now begin in parallel

---

## Phase 3: User Story 1 - Add Target With Connectivity Check (Priority: P1) 🎯 MVP

**Goal**: Create targets from the dashboard and run async connectivity checks

**Independent Test**: Create a target, see pending status, then view available models or a failed status with retry

### Tests for User Story 1 ⚠️

- [x] T009 [P] [US1] Add API contract tests for target create/list in backend/tests/contract/targets.spec.ts
- [x] T010 [P] [US1] Add UI tests for target creation flow in frontend/tests/e2e/targets-create.spec.ts

### Implementation for User Story 1

- [x] T011 [P] [US1] Implement POST /targets handler with async check trigger in backend/src/api/routes/targets.ts
- [x] T012 [P] [US1] Implement GET /targets list with status and models in backend/src/api/routes/targets.ts
- [x] T013 [US1] Implement connectivity check execution and model refresh in backend/src/services/connectivity-runner.ts
- [x] T014 [US1] Enforce unique target name with conflict handling in backend/src/services/targets-repository.ts
- [x] T015 [US1] Return 409 on duplicate target name in backend/src/api/routes/targets.ts
- [x] T016 [US1] Implement POST /targets/{id}/connectivity-check in backend/src/api/routes/targets.ts
- [x] T017 [P] [US1] Implement target create form with validation in frontend/src/components/TargetCreateForm.tsx
- [x] T018 [P] [US1] Render target list with connectivity status in frontend/src/components/TargetList.tsx
- [x] T019 [US1] Wire create flow and async status refresh in frontend/src/pages/Targets.tsx
- [x] T020 [US1] Add retry connectivity action in frontend/src/components/TargetList.tsx

**Checkpoint**: At this point, User Story 1 should be fully functional and testable independently

---

## Phase 4: User Story 2 - Maintain Existing Targets (Priority: P2)

**Goal**: Update targets and archive when runs exist

**Independent Test**: Edit a target, see a refreshed connectivity check, and archive a target with runs

### Tests for User Story 2 ⚠️

- [x] T021 [P] [US2] Add API contract tests for target update/archive in backend/tests/contract/targets-update.spec.ts
- [x] T022 [P] [US2] Add UI tests for target edit/archive flow in frontend/tests/e2e/targets-edit.spec.ts

### Implementation for User Story 2

- [x] T023 [P] [US2] Implement PUT /targets/{id} with recheck trigger in backend/src/api/routes/targets.ts
- [x] T024 [P] [US2] Implement POST /targets/{id}/archive in backend/src/api/routes/targets.ts
- [x] T025 [US2] Enforce archive-only when runs exist in backend/src/services/targets-repository.ts
- [x] T026 [P] [US2] Add target edit form in frontend/src/components/TargetEditForm.tsx
- [x] T027 [US2] Add archive action in frontend/src/components/TargetList.tsx
- [x] T028 [US2] Wire edit and archive flows in frontend/src/pages/Targets.tsx
- [x] T029 [US2] Exclude archived targets by default in run selection UI with toggle in frontend/src/components/RunTargetSelect.tsx

**Checkpoint**: At this point, User Stories 1 AND 2 should both work independently

---

## Phase 5: User Story 3 - Delete Unused Targets (Priority: P3)

**Goal**: Delete targets with no runs

**Independent Test**: Delete a target with zero runs and confirm removal from both lists

### Tests for User Story 3 ⚠️

- [x] T030 [P] [US3] Add API contract tests for target delete in backend/tests/contract/targets-delete.spec.ts
- [x] T031 [P] [US3] Add UI tests for target delete flow in frontend/tests/e2e/targets-delete.spec.ts

### Implementation for User Story 3

- [x] T032 [P] [US3] Implement DELETE /targets/{id} with run check in backend/src/api/routes/targets.ts
- [x] T033 [US3] Enforce no-runs delete rule in backend/src/services/targets-repository.ts
- [x] T034 [US3] Add delete action with confirmation in frontend/src/components/TargetList.tsx
- [x] T035 [US3] Wire delete flow in frontend/src/pages/Targets.tsx

**Checkpoint**: All user stories should now be independently functional

---

## Phase N: Polish & Cross-Cutting Concerns

**Purpose**: Improvements that affect multiple user stories

- [x] T036 Update empty, loading, and error states in frontend/src/pages/Targets.tsx
- [x] T037 [P] Add user-facing error copy for validation and connectivity failures in frontend/src/components/TargetErrors.tsx
- [x] T038 [P] Add backend logging for connectivity outcomes in backend/src/services/connectivity-runner.ts
- [x] T039 Update quickstart validation notes in specs/001-manage-targets/quickstart.md
- [x] T040 Add performance verification for targets list and connectivity check in frontend/tests/perf/targets-perf.md
- [x] T041 Add OWASP review checklist and mitigations summary in specs/001-manage-targets/checklists/owasp-review.md

---

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
- **User Story 2 (P2)**: Can start after Foundational (Phase 2) - May integrate with US1 but should be independently testable
- **User Story 3 (P3)**: Can start after Foundational (Phase 2) - May integrate with US1/US2 but should be independently testable

### Within Each User Story

- Models before services
- Services before endpoints
- Core implementation before integration
- Story complete before moving to next priority

### Parallel Opportunities

- Setup tasks marked [P] can run in parallel
- Foundational tasks marked [P] can run in parallel (within Phase 2)
- Once Foundational phase completes, all user stories can start in parallel (if team capacity allows)
- Components and API handlers marked [P] can run in parallel

---

## Parallel Example: User Story 1

```bash
Task: "Implement POST /targets handler with async check trigger in backend/src/api/routes/targets.ts"
Task: "Implement GET /targets list with status and models in backend/src/api/routes/targets.ts"
Task: "Implement target create form with validation in frontend/src/components/TargetCreateForm.tsx"
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
- Stop at any checkpoint to validate story independently
- Avoid: vague tasks, same file conflicts, cross-story dependencies that break independence
