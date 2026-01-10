# Data Model: Test Templates

## Entities

### TestTemplate
- **Purpose**: Represents the canonical template record shown in the dashboard.
- **Fields**:
  - id (string, unique)
  - name (string, unique among active templates)
  - format (enum: json | python)
  - status (enum: active | archived)
  - owner_id (string)
  - current_version_id (string, references TestTemplateVersion)
  - storage_path (string, local file path)
  - created_at (timestamp)
  - updated_at (timestamp)

### TestTemplateVersion
- **Purpose**: Immutable snapshot of template content used for instantiation.
- **Fields**:
  - id (string, unique)
  - template_id (string, references TestTemplate)
  - version_number (integer, auto-increment per template)
  - content (string)
  - created_at (timestamp)
  - created_by (string, owner_id)

### InstantiatedTest
- **Purpose**: A test created from a specific template version.
- **Fields**:
  - id (string, unique)
  - template_id (string, references TestTemplate)
  - template_version_id (string, references TestTemplateVersion)
  - created_at (timestamp)

## Relationships
- TestTemplate 1 → N TestTemplateVersion
- TestTemplateVersion 1 → N InstantiatedTest
- TestTemplate 1 → N InstantiatedTest (via template_id)

## Validation Rules
- Template name must be unique among active templates.
- Template format must be json or python.
- Template content must validate on create/update and on instantiation.
- Archived templates cannot be used for new instantiations.
- Deletion is blocked if any InstantiatedTest references the template.
- Version numbers are auto-incremented per template and immutable once created.
- Template storage directory is set via `AITESTBENCH_TEST_TEMPLATE_DIR` and defaults to app root
  when unset.

## State Transitions
- TestTemplate.status: active → archived → active
- Deletion: allowed only from active or archived if no instantiated tests reference the template.
