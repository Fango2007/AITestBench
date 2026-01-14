# Data Model

## TestTemplate

- **id**: string (unique identifier)
- **name**: string (unique display name)
- **type**: string ("json" | "python")
- **content**: string (raw template content)
- **created_at**: timestamp
- **updated_at**: timestamp
- **version**: string (template version for traceability)

**Validation Rules**:
- id and name must be unique
- content must pass syntax validation for the selected type

## ActiveTest

- **id**: string (unique identifier)
- **template_id**: string (references TestTemplate)
- **template_version**: string (version at instantiation time)
- **target_id**: string
- **model_name**: string
- **status**: string (e.g., ready, running, completed, failed)
- **created_at**: timestamp
- **deleted_at**: timestamp (nullable)
- **version**: string (active test version for traceability)

**Validation Rules**:
- template_id must reference an existing template
- template_version must match the template version at instantiation

## Relationships

- TestTemplate 1 -> many ActiveTest
- ActiveTest links to Target by target_id and to Template by template_id

## State Transitions

- ActiveTest: ready -> running -> completed/failed
- ActiveTest: ready -> deleted (when user deletes)
