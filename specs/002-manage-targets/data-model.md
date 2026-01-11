# Data Model: Target Management Dashboard

## Entities

### Target

- **id**: unique identifier
- **name**: unique, human-readable name
- **base_url**: target endpoint URL
- **auth_type**: auth mode (e.g., none, token)
- **auth_token_ref**: environment variable key reference
- **default_model**: optional default model name
- **default_params**: optional parameter map
- **timeouts**: request timeout settings
- **concurrency_limit**: integer
- **status**: `active` | `archived`
- **connectivity_status**: `pending` | `ok` | `failed`
- **last_check_at**: timestamp
- **last_error**: brief error summary (nullable)
- **created_at**: timestamp
- **updated_at**: timestamp

**Validation rules**:
- `name` must be unique.
- `base_url` must be present and valid.
- Deletion allowed only when no runs exist.

**State transitions**:
- `active` → `archived` when runs exist and user archives.
- `archived` → `active` only if unarchive is supported (out of scope unless
  explicitly added later).

### ConnectivityCheck

- **id**: unique identifier
- **target_id**: reference to Target
- **status**: `ok` | `failed`
- **checked_at**: timestamp
- **error_summary**: brief message (nullable)
- **response_time_ms**: integer (optional)

### Model

- **id**: unique identifier
- **target_id**: reference to Target
- **name**: model name
- **provider**: provider name (optional)
- **version**: version string (optional)
- **metadata**: key-value map (optional)
- **refreshed_at**: timestamp

## Relationships

- Target 1 → N ConnectivityCheck
- Target 1 → N Model

## Derived Data

- Latest connectivity status is the most recent ConnectivityCheck for a target.
- Available models list is the most recent set from the last successful check.
