---

description: "Task list template for feature implementation"
---

# Tasks: Test Templates

**Input**: Design documents from `/specs/001-test-templates/`
**Prerequisites**: plan.md (required), spec.md (required for user stories), research.md, data-model.md, contracts/

**Tests**: Include test tasks as required by the constitution. For UI features,
add Playwright coverage for menus, workflows, and key actions.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions

- **Web app**: `backend/src/`, `frontend/src/`

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project initialization and basic structure

- [X] T001 Add template storage env var to `.env.example`
- [X] T002 Add local template storage directory to `.gitignore`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core infrastructure that MUST be complete before ANY user story can be implemented

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [X] T003 Add database schema/migrations for test templates and versions in `backend/src/models/schema.sql`
- [X] T004 [P] Add test template repository model in `backend/src/models/test-template.ts`
- [X] T005 [P] Add template file storage service in `backend/src/services/template-storage.ts`
- [X] T006 Add repository/service logic in `backend/src/services/test-templates-repository.ts`
- [X] T007 Add uniqueness validation for active template names in `backend/src/services/test-templates-repository.ts`
- [X] T008 Add API schemas for templates in `backend/src/api/test-templates-schemas.ts`
- [X] T009 Register template routes in `backend/src/api/server.ts`
- [X] T010 Add template routes in `backend/src/api/routes/test-templates.ts`
- [X] T011 Wire template service to test instantiation flow in `backend/src/services/test-service.ts`

**Checkpoint**: Foundation ready - user story implementation can now begin in parallel

---

## Phase 3: User Story 1 - Create a Test Template (Priority: P1) 🎯 MVP

**Goal**: Users can create JSON/Python templates and see them in the dashboard with version v1.

**Independent Test**: Create a template via the dashboard and verify it appears with version v1 and a
file exists in `AITESTBENCH_TEST_TEMPLATE_DIR`.

### Tests for User Story 1

- [X] T012 [P] [US1] API contract test for create/list templates in `backend/tests/contract/test-templates-create.spec.ts`
- [X] T013 [P] [US1] Playwright test for create template flow in `frontend/tests/e2e/test-templates-create.spec.ts`

### Implementation for User Story 1

- [X] T014 [P] [US1] Add templates API client in `frontend/src/services/test-templates-api.ts`
- [X] T015 [P] [US1] Add templates list page in `frontend/src/pages/TestTemplates.tsx`
- [X] T016 [US1] Add templates route/nav entry in `frontend/src/App.tsx`
- [X] T017 [US1] Add create template form in `frontend/src/components/TestTemplateCreateForm.tsx`
- [X] T018 [US1] Add templates list component in `frontend/src/components/TestTemplateList.tsx`
- [X] T019 [US1] Add backend create/list handlers in `backend/src/api/routes/test-templates.ts`

**Checkpoint**: At this point, User Story 1 should be fully functional and testable independently

---

## Phase 4: User Story 2 - Update a Template With Versioning (Priority: P1)

**Goal**: Users can create new template versions and instantiate tests with a chosen version.

**Independent Test**: Update a template and verify a new version appears; instantiate a test and
verify template name/version is recorded.

### Tests for User Story 2

- [X] T020 [P] [US2] API contract test for update/version history in `backend/tests/contract/test-templates-update.spec.ts`
- [X] T021 [P] [US2] Playwright test for version update flow in `frontend/tests/e2e/test-templates-update.spec.ts`

### Implementation for User Story 2

- [X] T022 [P] [US2] Add version history UI in `frontend/src/components/TestTemplateVersions.tsx`
- [X] T023 [US2] Add update template form in `frontend/src/components/TestTemplateEditForm.tsx`
- [X] T024 [US2] Add version detail drawer/panel in `frontend/src/components/TestTemplateDetails.tsx`
- [X] T025 [US2] Add backend update/version handlers in `backend/src/api/routes/test-templates.ts`
- [X] T026 [US2] Extend test instantiation payload handling in `backend/src/services/test-service.ts`

**Checkpoint**: At this point, User Stories 1 AND 2 should both work independently

---

## Phase 5: User Story 3 - Archive and Unarchive Templates (Priority: P2)

**Goal**: Users can archive/unarchive templates and keep the UI clean while preserving history.

**Independent Test**: Archive a template and ensure it disappears from active list; unarchive restores it.

### Tests for User Story 3

- [ ] T027 [P] [US3] API contract test for archive/unarchive in `backend/tests/contract/test-templates-archive.spec.ts`
- [ ] T028 [P] [US3] Playwright test for archive/unarchive flow in `frontend/tests/e2e/test-templates-archive.spec.ts`

### Implementation for User Story 3

- [ ] T029 [US3] Add archive/unarchive actions in `frontend/src/components/TestTemplateList.tsx`
- [ ] T030 [US3] Add backend archive/unarchive handlers in `backend/src/api/routes/test-templates.ts`

**Checkpoint**: User Story 3 is independently testable

---

## Phase 6: User Story 4 - Delete Templates (Priority: P2)

**Goal**: Users can delete unused templates while preserving traceability.

**Independent Test**: Delete an unused template; deletion is blocked if referenced by any test.

### Tests for User Story 4

- [ ] T031 [P] [US4] API contract test for delete guardrails in `backend/tests/contract/test-templates-delete.spec.ts`
- [ ] T032 [P] [US4] Playwright test for delete flow in `frontend/tests/e2e/test-templates-delete.spec.ts`

### Implementation for User Story 4

- [ ] T033 [US4] Add delete action + confirmation in `frontend/src/components/TestTemplateList.tsx`
- [ ] T034 [US4] Add backend delete handler with guardrails in `backend/src/api/routes/test-templates.ts`

**Checkpoint**: All user stories should now be independently functional

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Improvements that affect multiple user stories

- [ ] T035 [P] Add backend unit tests for template validation in `backend/tests/unit/test-templates-validation.test.ts`
- [ ] T036 Update docs for template storage env var in `README.md`
- [ ] T037 [P] Add Playwright coverage for menu/workflow/actions summary in `frontend/tests/e2e/test-templates-smoke.spec.ts`

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

- **User Story 1 (P1)**: Depends on Foundational phase completion
- **User Story 2 (P1)**: Depends on User Story 1 (versioning/instantiation builds on base CRUD)
- **User Story 3 (P2)**: Depends on User Story 1
- **User Story 4 (P2)**: Depends on User Story 1

### Within Each User Story

- Tests MUST be written and FAIL before implementation
- Models before services
- Services before endpoints
- Core implementation before integration
- Story complete before moving to next priority

### Parallel Opportunities

- All Setup tasks marked [P] can run in parallel
- Foundational tasks marked [P] can run in parallel (within Phase 2)
- Once Foundational phase completes, user stories can start in parallel if capacity allows
- All tests for a user story marked [P] can run in parallel
- Different user stories can be worked on in parallel by different team members after dependencies

---

## Parallel Example: User Story 1

```bash
# Launch all tests for User Story 1 together:
Task: "API contract test for create/list templates in backend/tests/contract/test-templates-create.spec.ts"
Task: "Playwright test for create template flow in frontend/tests/e2e/test-templates-create.spec.ts"

# Launch UI tasks for User Story 1 together:
Task: "Add templates API client in frontend/src/services/test-templates-api.ts"
Task: "Add templates list page in frontend/src/pages/TestTemplates.tsx"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational (CRITICAL - blocks all stories)
3. Complete Phase 3: User Story 1
4. **STOP and VALIDATE**: Test User Story 1 independently
5. Demo MVP

### Incremental Delivery

1. Complete Setup + Foundational → Foundation ready
2. Add User Story 1 → Test independently → Demo
3. Add User Story 2 → Test independently → Demo
4. Add User Story 3 → Test independently → Demo
5. Add User Story 4 → Test independently → Demo
6. Each story adds value without breaking previous stories

### Parallel Team Strategy

With multiple developers:

1. Team completes Setup + Foundational together
2. Once Foundational is done:
   - Developer A: User Story 1
   - Developer B: User Story 3
   - Developer C: User Story 4
3. Integrate User Story 2 after User Story 1 completes
