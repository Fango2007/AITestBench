# Feature Specification: Test Templates Management

**Feature Branch**: `001-test-templates`  
**Created**: 2026-01-06  
**Status**: Draft  
**Input**: User description: "I want to add this feature: there are already built-in test templates availabe under ./ backend/src/plugins/builtins/. It must be possible to create/update/save and delete through the dashboard interface these test templates. An new .env variable named AITESTBENCH_TEST_TEMPLATES_DIR will be set to define the path where these templates are saved and located. A user can select one or more test templates in the Run Single menu (Tests zone). A test template must be instanciated to become an actionable test. The user first choose a target, a model and then an active test will be generated based on the template with the name of the seleted model. This active test will recorded in the DB and is now ready to be run against the model. When it is a JSON-defined test, the application will built a curl command with a content derived from the test. If this is a Python-defined test, the application should be ready to excute this python code in sandbox. When a test has been instanciated and become active, a button should become avaible to run the tests."

## User Scenarios & Testing *(mandatory)*

## Clarifications

### Session 2026-01-11

- Q: Are built-in templates editable or read-only? → A: Built-in templates are removed; all templates are user-managed and stored in the templates directory (default `./backend/data/templates`).
- Q: How should duplicate template identifiers be handled? → A: Template identifiers must be unique; saving fails on duplicates.
- Q: When should active tests be generated from templates? → A: Users must click a separate “Generate/Instantiate” action after selecting target, model, and templates.
- Q: How long should active tests persist? → A: Active tests persist in the database until a user deletes them.
- Q: Who can edit/delete templates? → A: Any user can edit or delete any template.
- Q: Should templates be validated before saving? → A: JSON/Python templates must be syntax-validated automatically before saving.
- Q: Should active tests carry versions? → A: Active tests must include a version for traceability.

### User Story 1 - Manage Test Templates (Priority: P1)

As an operator, I can create, edit, and delete test templates in the dashboard so I can maintain a reusable library of tests.

**Why this priority**: Without template management, the feature provides no value beyond the current built-ins.

**Independent Test**: Create a new template, verify it appears in the list, edit it, and delete it without using the run workflow.

**Acceptance Scenarios**:

1. **Given** I am viewing the template library, **When** I save a new template, **Then** it appears in the list with its details.
2. **Given** an existing template, **When** I edit and save it, **Then** the updated details are shown immediately.
3. **Given** an existing template, **When** I delete it, **Then** it is removed from the list and cannot be selected.

---

### User Story 2 - Instantiate Templates for a Run (Priority: P2)

As an operator, I can select one or more templates in Run Single, choose a target and model, and generate active tests so they are ready to run.

**Why this priority**: Instantiation turns templates into actionable tests and unlocks execution.

**Independent Test**: Select a target and model, choose templates, generate active tests, and confirm the run button becomes available.

**Acceptance Scenarios**:

1. **Given** at least one template exists, **When** I select a target and model and choose templates, **Then** active tests are created and recorded for each template.
2. **Given** active tests were created, **When** the dashboard updates, **Then** the run action is enabled for those tests.

---

### User Story 3 - Use Different Template Types (Priority: P3)

As an operator, I can use request-based and script-based templates so both types can be executed safely and predictably.

**Why this priority**: The system must support the two template formats in use today.

**Independent Test**: Instantiate one request-based template and one script-based template and verify both become active and ready to run.

**Acceptance Scenarios**:

1. **Given** a request-based template, **When** it is instantiated, **Then** the system generates a runnable command preview derived from the template.
2. **Given** a script-based template, **When** it is instantiated, **Then** the system marks it ready for sandboxed execution.

---

### Edge Cases

- If the template storage path is missing or unavailable, the system falls back to the default `./backend/data/templates`.
- If template content or schema validation fails, the system shows a clear warning and does not save the template until fixed.
- A template can be deleted even if it has already been used to instantiate an active test; existing active tests remain.
- Duplicate template identifiers are rejected; template names must be unique unless deleted.
- If initial templates cannot be migrated, the system logs the failure and continues with an empty template library.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST list all available templates managed by users.
- **FR-002**: The system MUST allow users to create, update, and delete templates from the dashboard.
- **FR-003**: The system MUST use the configured template storage directory for templates, and fall back to `./backend/data/templates` if unavailable.
- **FR-004**: Users MUST be able to select one or more templates in the Run Single view.
- **FR-005**: The system MUST generate active tests only after a target and model are selected and the user triggers a generate action.
- **FR-006**: Each active test MUST be recorded and traceable back to its source template and selected model.
- **FR-007**: Active tests MUST be named to include the selected model name for clear identification.
- **FR-008**: For request-based templates, the system MUST generate a runnable command preview derived from the template data, including method, URL, headers, and body.
- **FR-009**: For script-based templates, the system MUST mark the test as ready for sandboxed execution via an explicit readiness status or flag.
- **FR-010**: The run action MUST remain disabled until at least one active test has been created.
- **FR-011**: The system MUST reject template saves when the identifier or name is already in use.
- **FR-012**: The system MUST keep active tests stored until explicitly deleted by a user.
- **FR-013**: The system MUST allow any user to edit or delete any template.
- **FR-014**: The system MUST validate template syntax before saving JSON or script templates and reject invalid content.
- **FR-015**: Each active test MUST include a version identifier for traceability.

### Key Entities *(include if feature involves data)*

- **Test Template**: A reusable definition containing identifier, name, type (request or script), content, and updated timestamp.
- **Active Test**: A runnable test instance created from a template, linked to a target and model, with version, status, and created timestamp.
- **Template Library**: The collection of user-managed templates surfaced in the dashboard.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Users can create and save a new template in under 2 minutes without leaving the dashboard.
- **SC-002**: 95% of valid template instantiations result in active tests ready to run without manual retries.
- **SC-003**: Users can generate active tests for selected templates in three or fewer actions after choosing a target and model.
- **SC-004**: The template list reflects create/update/delete actions within 5 seconds for 95% of attempts.

## Assumptions

- The deployment configuration provides a template storage directory setting and it is writable.
- Existing built-in templates are migrated into the default templates directory before use.
- Deleting a template does not delete or alter previously created active tests.
- The template storage directory is configured via AITESTBENCH_TEST_TEMPLATES_DIR in the root .env file.
