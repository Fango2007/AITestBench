# Data Model

## Entities

### Target
- **Fields**: id (uuid), name, base_url, auth_type, auth_token_ref, default_model,
  default_params (json), timeouts (json), concurrency_limit, created_at,
  updated_at
- **Constraints**: unique(name + base_url)
- **Relationships**: has many Runs

### TestDefinition
- **Fields**: id (string), version (semver), name, description, category, tags
  (array), protocols (array), spec_path, runner_type (json|python),
  request_template (json), assertions (json), metric_rules (json), created_at
- **Constraints**: unique(id + version)
- **Relationships**: can belong to many Suites

### Suite
- **Fields**: id (uuid), name, ordered_test_ids (array), filters (json),
  stop_on_fail (bool), created_at, updated_at
- **Relationships**: has many Runs

### Profile
- **Fields**: id (uuid), name, description, version (semver),
  generation_parameters (json), context_strategy (json), test_selection (json),
  execution_behaviour (json), created_at, updated_at
- **Relationships**: referenced by Runs

### Run
- **Fields**: id (uuid), target_id, suite_id (nullable), test_id (nullable),
  profile_id (nullable), profile_version (nullable), status, started_at,
  ended_at, environment_snapshot (json), retention_days
- **Relationships**: has many TestResults, belongs to Target, Suite or Test

### TestResult
- **Fields**: id (uuid), run_id, test_id, verdict (pass|fail|skip),
  failure_reason, metrics (json), artefacts (json), raw_events (json),
  repetition_stats (json), started_at, ended_at
- **Relationships**: has many MetricSamples, belongs to Run, TestDefinition

### MetricSample
- **Fields**: id (uuid), test_result_id, repetition_index, ttfb_ms, total_ms,
  prefill_ms, decode_ms, tokens_per_sec, prompt_tokens, completion_tokens,
  created_at
- **Relationships**: belongs to TestResult

### Model
- **Fields**: id (uuid), name, provider, version, architecture (json),
  quantisation (json), capabilities (json), raw_metadata (json), first_seen_at,
  last_seen_at
- **Relationships**: referenced by Targets and Runs (snapshot)

## Relationships Summary

- Target 1..N Run
- Run 1..N TestResult
- TestResult 1..N MetricSample
- Suite N..N TestDefinition (via ordered_test_ids)
- Profile 1..N Run

## State Transitions

### Run
- queued -> running -> completed
- queued -> running -> failed
- queued -> canceled

### TestResult
- pending -> running -> pass
- pending -> running -> fail
- pending -> skip

## Validation Rules

- Target name + base_url must be unique.
- TestDefinition id + version must be unique.
- Run must reference exactly one of suite_id or test_id.
- Metrics must omit values that are not measurable and set them to
  not_measurable with a reason in metrics metadata.
