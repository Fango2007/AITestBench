# Research: Test Templates

## Decision: Template Versioning Scheme
- Decision: Auto-increment integer versions (v1, v2, v3) per template.
- Rationale: Simple mental model, easy to display, and unambiguous for traceability.
- Alternatives considered: Semantic versioning; timestamp-based versions; user-defined labels.

## Decision: Archived Template Usage
- Decision: Archived templates cannot be used to instantiate new tests.
- Rationale: Prevents accidental reuse while preserving historical versions for traceability.
- Alternatives considered: Allow explicit selection of archived templates; treat archived as active.

## Decision: Template Name Uniqueness
- Decision: Names must be unique among active templates; archived names can be reused.
- Rationale: Avoids ambiguity in active workflows while preserving flexibility after archival.
- Alternatives considered: No uniqueness requirement; global uniqueness across all templates.

## Decision: Validation Timing
- Decision: Validate template content on create/update and again on instantiation.
- Rationale: Prevents invalid templates from entering the system and protects against legacy
  templates when validation rules change.
- Alternatives considered: Validate only on create/update; validate only on instantiation.

## Decision: Edit Permissions
- Decision: Template edits (create/update/archive/delete) are owner-only.
- Rationale: Matches the trusted-user assumption and keeps scope minimal without a full RBAC model.
- Alternatives considered: Admin-only edits; shared team ownership.

## Decision: Deletion Constraints
- Decision: Deletion is allowed only when the template is not referenced by any instantiated test.
- Rationale: Preserves traceability for historical runs.
- Alternatives considered: Soft-delete with tombstone references; allow delete with orphaned history.

## Decision: Template Storage Location
- Decision: Templates are stored as local files on disk, with a configurable storage directory set
  via `AITESTBENCH_TEST_TEMPLATE_DIR` (defaults to app root).
- Rationale: Aligns with local-first deployment and keeps template content auditable on disk.
- Alternatives considered: Store template content only in the database; store templates in remote
  object storage.
