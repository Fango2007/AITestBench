This document specifies how to implement the Inference Server entity, storage, validation, discovery caching, and capability reporting based on the provided schema.  ￼

## 1. Goal

Implement a first-class Inference Server resource in the application so users can:
	•	Register and manage inference servers (OpenAI-compatible, Ollama, or custom).
	•	Persist server identity, runtime/platform metadata, endpoints/auth, capabilities, discovery cache, and raw vendor payloads.
	•	Refresh and cache model discovery results with TTL.
	•	Use this server record as a dependency for profiles and tests (read-only reference for now is fine).

## 2. Non-goals
	•	Do not implement full profile/test execution in this task unless already planned elsewhere.
	•	Do not attempt to infer model-level capabilities beyond what is provided in discovery.model_list.normalised.
	•	Do not enforce “truth” of server claims; store what is observed/declared and timestamp it.

## 3. Canonical Data Model

### 3.1 Inference Server Object (canonical shape)

The persisted object MUST support the exact fields below (additions allowed only if backwards compatible). Field semantics are defined in sections 4–9.

```json
{
  "inference_server": {
    "server_id": "string",
    "display_name": "string",
    "active": true,
    "archived": false,
    "created_at": "RFC3339 timestamp",
    "updated_at": "RFC3339 timestamp",
    "archived_at": "RFC3339 timestamp"
  },

  "runtime": {
    "retrieved_at": "RFC3339 timestamp",
    "source": "server|client|mixed",
    "server_software": { "name": "string", "version": "string|null", "build": "string|null" },
    "api": { "schema_family": ["openai-compatible", "ollama", "custom"], "api_version": "string|null" },
    "platform": {
      "os": { "name": "macos|linux|windows|unknown", "version": "string|null", "arch": "arm64|x86_64|unknown" },
      "container": { "type": "docker|podman|none|unknown", "image": "string|null" }
    },
    "hardware": {
      "cpu": { "model": "string|null", "cores": "number|null" },
      "gpu": [{ "vendor": "nvidia|amd|apple|intel|unknown", "model": "string|null", "vram_mb": "number|null" }],
      "ram_mb": "number|null"
    }
  },

  "endpoints": {
    "base_url": "string",
    "health_url": "string|null",
    "https": false
  },

  "auth": {
    "type": "none|bearer|basic|oauth|custom",
    "header_name": "Authorization",
    "token_env": "ENV_VAR_NAME|null"
  },

  "capabilities": {
    "server": { "streaming": true, "models_endpoint": true },
    "generation": { "text": true, "json_schema_output": false, "tools": true, "embeddings": false },
    "multimodal": {
      "vision": { "input_images": false, "output_images": false },
      "audio": { "input_audio": false, "output_audio": false }
    },
    "reasoning": { "exposed": false, "token_budget_configurable": false },
    "concurrency": { "parallel_requests": true, "parallel_tool_calls": false, "max_concurrent_requests": null },
    "enforcement": "server"
  },

  "discovery": {
    "retrieved_at": "RFC3339 timestamp",
    "ttl_seconds": 300,
    "model_list": {
      "raw": {},
      "normalised": [
        { "model_id": "string", "display_name": "string|null", "context_window_tokens": "number|null", "quantisation": "string|null" }
      ]
    }
  },

  "raw": { "any_vendor_specific_payload": {} }
}
```

## 4. Validation Rules

### 4.1 General rules
	•	All timestamps MUST be RFC3339.
	•	server_id MUST be unique.
	•	display_name MUST be non-empty.
	•	active and archived MUST NOT both be true.
	•	endpoints.base_url MUST be a valid URL.
	•	endpoints.https MUST reflect the scheme of base_url (if scheme is https://, then https=true, else false). If mismatch, reject or auto-correct (choose one behaviour and document it).

### 4.2 Runtime & discovery timestamp rules
	•	runtime.retrieved_at MUST be updated whenever runtime metadata is refreshed.
	•	discovery.retrieved_at MUST be updated whenever discovery is refreshed.
	•	The application MUST treat cached discovery as valid only if:
	•	now < discovery.retrieved_at + discovery.ttl_seconds.

### 4.3 Enum constraints

Enforce the enumerations exactly as specified for:
	•	runtime.source
	•	runtime.api.schema_family
	•	runtime.platform.os.name
	•	runtime.platform.os.arch
	•	runtime.platform.container.type
	•	runtime.hardware.gpu[].vendor
	•	auth.type
	•	capabilities.enforcement

## 5. Storage & Persistence

Implement persistent storage for inference servers.

Minimum requirements:
	•	CRUD operations: create, list, get, update, archive/unarchive.
	•	Updating any field MUST update inference_server.updated_at.
	•	raw and discovery.model_list.raw MUST be stored as JSON blobs without modification.

Recommended:
	•	Use a database table/collection inference_servers.
	•	Use JSON columns for nested structures if using a relational DB.

## 6. API Endpoints (Application’s own API)

Expose these app-level endpoints (REST or equivalent):
	•	POST /inference-servers
Create a server entry. If server_id not provided, generate one.
	•	GET /inference-servers
List all servers (include filters: active, archived, schema_family).
	•	GET /inference-servers/{server_id}
Get full record.
	•	PATCH /inference-servers/{server_id}
Partial update. Validate enums/URLs.
	•	POST /inference-servers/{server_id}/archive
Set archived=true, active=false.
	•	POST /inference-servers/{server_id}/unarchive
Set archived=false (do not auto-set active; user chooses).
	•	POST /inference-servers/{server_id}/refresh-runtime
Refresh runtime info; updates runtime.* and updated_at.
	•	POST /inference-servers/{server_id}/refresh-discovery
Refresh model list; updates discovery.* and updated_at.

## 7. Runtime Metadata Collection

### 7.1 Behaviour

The app SHOULD attempt to populate runtime metadata using:
	•	Server-reported fields where available (preferred).
	•	Client-observed fields (fallback), especially if the server is local.

Set runtime.source as:
	•	server if all collected from server responses.
	•	client if collected only from local environment inspection.
	•	mixed if a combination.

### 7.2 Minimal acceptable implementation

If runtime probing is not feasible for a given server, allow runtime to be partially filled and keep nulls. Do not block server creation.

## 8. Discovery (Model List) Collection

### 8.1 Behaviour

Discovery refresh MUST:
	•	Call the appropriate model listing endpoint based on runtime.api.schema_family:
	•	openai-compatible: use GET /v1/models (or configured equivalent).
	•	ollama: use /api/tags (or configured equivalent).
	•	custom: allow user-configured discovery path (optional for v1; otherwise store only raw/manual).

Store:
	•	discovery.model_list.raw: exact server response payload (JSON).
	•	discovery.model_list.normalised: mapped array with:
	•	model_id (required)
	•	display_name (nullable)
	•	context_window_tokens (nullable)
	•	quantisation (nullable)

### 8.2 TTL & caching
	•	If cached discovery is still valid (TTL not expired), the UI MAY reuse it without re-fetching.
	•	The refresh endpoint MUST bypass TTL and force a fetch.

## 9. Capabilities

### 9.1 Semantics

capabilities describes server-level behavioural features, not per-model features.
	•	capabilities.server.streaming: server supports streaming responses.
	•	capabilities.server.models_endpoint: server supports listing models.
	•	capabilities.generation.tools: server supports native tool calling.
	•	capabilities.concurrency.*: server scheduling/execution support.
	•	capabilities.multimodal.*: server accepts/produces non-text modalities.
	•	capabilities.reasoning.*: whether server exposes explicit reasoning controls.

### 9.2 Defaults

When creating a server, initialise capabilities with safe defaults:
	•	Unknowns should default to false or null (for numeric limits).
	•	Avoid optimistic defaults. The user can enable them after verification.

## 10. UI Requirements (Minimal)

Implement a server details view showing:
	•	Identity: server_id, display_name, active/archived, created_at/updated_at
	•	Endpoints + auth summary (do not show secrets)
	•	Capabilities (grouped as in schema)
	•	Runtime metadata (timestamped)
	•	Discovery: model list normalised + retrieved_at + TTL + “Refresh” action
	•	Raw payloads view (collapsible JSON viewer) for:
	•	raw
	•	discovery.model_list.raw

## 11. Error Handling
	•	Network failures on refresh endpoints MUST return a structured error with:
	•	server_id
	•	attempted URL
	•	status code / exception
	•	timestamp
	•	Do not overwrite existing cached discovery/runtime on refresh failure.

## 12. Acceptance Tests

Implement automated tests (unit or integration) that verify:
	•	Creating a server persists required fields and timestamps.
	•	Enums are validated and reject invalid values.
	•	active & archived constraint enforced.
	•	Updating any field updates updated_at.
	•	Discovery TTL logic returns “valid cache” until expiry.
	•	Refresh discovery updates retrieved_at and stores raw + normalised payload.
	•	Refresh failure does not wipe prior data.

## 13. Implementation Notes
	•	Treat raw fields as “escape hatch” blobs: store them verbatim.
	•	Keep the design server-agnostic: selection of discovery endpoints is driven by runtime.api.schema_family.
	•	Timestamp everything that can change over time (“runtime” and “discovery”) to support reproducibility and debugging (“compare runs”, “regressions”, “drift”).
