# Research

## Decision 1: Templates are user-managed only
- **Decision**: Remove the built-in concept and migrate existing templates into the templates directory.
- **Rationale**: Keeps a single source of truth and ensures all templates are editable via the dashboard.
- **Alternatives considered**: Keep read-only built-ins alongside user templates.

## Decision 2: Templates storage path and fallback
- **Decision**: Use the root .env setting for the templates directory and fall back to `./backend/data/templates` when unavailable.
- **Rationale**: Aligns with app-root configuration requirements and ensures a safe default.
- **Alternatives considered**: Fail hard when the path is missing.

## Decision 3: Template validation rules
- **Decision**: Validate JSON/Python templates for syntax before saving and block persistence on failures.
- **Rationale**: Prevents broken templates from entering the library and reduces run-time errors.
- **Alternatives considered**: Allow saving with warnings or validate only at instantiation.

## Decision 4: Duplicate identifiers and names
- **Decision**: Reject saves with duplicate identifiers or names.
- **Rationale**: Guarantees unique references for selection and traceability.
- **Alternatives considered**: Auto-rename or overwrite on conflict.

## Decision 5: Instantiation flow
- **Decision**: Require an explicit generate/instantiate action after target, model, and templates are selected.
- **Rationale**: Avoids unexpected creation and makes user intent clear.
- **Alternatives considered**: Auto-generate on selection or generate on run.

## Decision 6: Active test persistence and versioning
- **Decision**: Persist active tests in the database until explicitly deleted and require a version identifier.
- **Rationale**: Supports traceability and re-runs over time.
- **Alternatives considered**: Ephemeral active tests tied only to a run.

## Decision 7: Permissions model
- **Decision**: Any user can edit or delete templates.
- **Rationale**: Matches the current single-operator usage model and avoids blocking updates.
- **Alternatives considered**: Owner-only or admin-only changes.
