# Feature Specification: LLM Server Test Harness & Benchmark Dashboard

**Feature Branch**: `[001-llm-server-test-harness]`  
**Created**: 2026-01-06  
**Status**: Draft  

**Input**: User description:  
> "We have spent quite sometime performing tests to assess the API compliancy and performance of the LLM server. Instead of doing do that manually, it could be more efficient to have an application that allow me to pass these tests automatically. The application should be able to test compliancy against OpenAI compatible API or Ollama (or others), asses performances (prefill, token generation, etc.) and also others aspects like perplexity measure as a lot of people like me mainly use small hardware configuration and hence are forced to run quantized models. This application should have pluggable tests. It means it should be able to add test through JSON or python files for example. These files will contain the specification and potentially the code of those tests. The application should have two modes : running a specific test once or several times, or doing all the tests sequantially. And finally an application dashboard will display all the results and memorize it. Can you think about that need and write out a detail specification? please follow this attached template. As this application will be developed by an AI, be really precise to avoid any misunderstanding."

---

## Clarifications

### Session 2026-01-06
- Q: Should the local HTTP API be required or optional? → A: Required (first-class interface).
- Q: What sandbox mechanism is acceptable on macOS for Python test runners? → A: Python venv + OS resource limits + filesystem allowlist (best-effort).
- Q: Preferred proxy perplexity task when logprobs are absent? → A: Cloze multiple-choice accuracy.
- Q: Are token timing hooks available for non-streaming decode timing? → A: No; approximate prefill, decode = not_measurable.
- Q: What retention policy should be used for stored runs? → A: Keep runs for X days.
- Q: What authentication is required for the local HTTP API? → A: Localhost only + API token.
- Q: What uniqueness rules apply to Targets and TestDefinitions? → A: Target unique by name+base_url; TestDefinition unique by id+version.
- Q: What observability level is required? → A: Structured logs + basic metrics.

## User Scenarios & Testing (mandatory)

### User Story 1 — Run a single test against a target (Priority: P1)

As a user, I want to select a target endpoint (OpenAI-compatible or Ollama), run one specific test once (or N times), and get a clear pass/fail plus metrics (TTFB, prefill, tokens/sec), so I can quickly validate whether a server/model setup behaves correctly.

**Why this priority**: This is the smallest valuable slice: instant validation and repeatable diagnostics without manual Burp/curl work.

**Independent Test**: Can be fully tested by registering one target, executing one built-in compliance test, and verifying a persisted result with metrics.

**Acceptance Scenarios**:
1. Given a configured OpenAI-compatible target, When I run the “Chat completion basic” test once, Then I see a result containing status (PASS/FAIL), raw request/response artefacts, TTFB, total latency, and tokens/sec.
2. Given a configured Ollama target, When I run the “Streaming SSE termination” test once, Then I see the stream events captured, including `[DONE]` handling, and the test verdict.
3. Given I set repetitions = 10, When I run the test, Then the result includes per-run metrics and aggregated stats (min/median/p95/stddev).

---

### User Story 2 — Run a full suite sequentially and compare runs over time (Priority: P2)

As a user, I want to run all tests in a suite sequentially against a target and store the results, so I can compare regressions across model versions, quantisation changes, or server updates.

**Why this priority**: This replaces long manual test sessions and produces a time-series view (crucial for performance tuning and regressions).

**Independent Test**: Can be fully tested by executing a default suite (10–20 tests), generating a run report, and verifying it appears in the dashboard history.

**Acceptance Scenarios**:
1. Given a target and a suite, When I run the suite, Then every test runs in a deterministic order, failures are recorded without stopping the entire run (unless configured), and a final run summary is produced.
2. Given two stored runs for the same target, When I open the dashboard comparison view, Then I can compare key metrics (TTFB, prefill latency, tokens/sec, error rate) test-by-test.
3. Given a suite with failures, When I retry in recovery mode, Then only failed
   tests are re-run and a retry summary is recorded.

---

### User Story 3 — Add pluggable tests (JSON spec + optional Python runner) (Priority: P3)

As a user, I want to add new tests without editing the core application, by dropping a JSON spec file (and optionally a Python file) into a test directory, so the harness discovers and executes them.

**Why this priority**: This enables community-driven coverage (new clients/protocol quirks) and personal test batteries for niche setups.

**Independent Test**: Can be fully tested by creating one JSON-defined test and verifying it is auto-discovered, runnable, and results are persisted.

**Acceptance Scenarios**:
1. Given a new JSON test spec in the tests folder, When the app starts (or I click “Reload tests”), Then the test appears in the UI/CLI list with metadata (name, category, tags).
2. Given a JSON test referencing a Python runner, When I run it, Then the Python runner is executed in a sandboxed environment, its output is captured, and verdict/metrics are stored.

---

## Edge Cases

- What happens when the target returns 200 OK but never sends a first byte within the timeout?
- What happens when SSE streaming is malformed (missing `data:` prefix, missing blank line separators, trailing bytes after `[DONE]`)?
- How does the system handle non-JSON error bodies (HTML proxy errors, plain text)?
- What happens when a server returns tool intent as text markup instead of structured `tool_calls`?
- How does the system handle rate limits (429), transient network failures, or DNS issues?
- What happens when the model output is huge (max tokens) and the response exceeds capture limits?
- What happens when the endpoint is OpenAI-compatible but deviates on fields (`max_completion_tokens` vs `max_tokens`, etc.)?
- How does the system behave when multiple runs execute concurrently (resource contention)?
- What is the system behavior when a suite partially fails and is retried?
- Expected handling for the above edge cases MUST follow FR-011a..FR-011h.

---

## Requirements (mandatory)

### Functional Requirements

#### Target & Protocol Support
- FR-001: System MUST support configuring targets of type OpenAI-compatible Chat Completions at `/v1/chat/completions`.
- FR-002: System MUST support configuring targets of type Ollama (local or remote) using the Ollama HTTP API.
- FR-003: System MUST allow per-target configuration of: base URL, auth header (Bearer token), default model, default temperature/top_p, request timeout(s), and concurrency limits.
- FR-003a: All timeout values MUST be specified in milliseconds and clearly
  scoped (per-request, per-test, per-suite).
- FR-003b: Concurrency limits MUST be specified as a maximum number of parallel
  requests per target.
- FR-003c: Default timeout values MUST be: per-request 30,000 ms, per-test
  120,000 ms, per-suite 900,000 ms, unless explicitly overridden.
- FR-003d: Default concurrency limit MUST be 4 parallel requests per target,
  unless explicitly overridden.
- FR-004: System MUST support both `stream=false` and `stream=true` requests where the protocol allows it.
- FR-005: System MUST capture and store request/response artefacts (headers + body), with secrets redacted at rest (Bearer tokens, API keys).
- FR-069: Targets MUST be unique by name + base_url.

#### Model Metadata & Introspection
- FR-029: System MUST support retrieving model metadata from a target endpoint when the protocol allows it (e.g. Ollama /api/show, OpenAI-compatible models endpoints, or vendor-specific extensions).
- FR-030: System MUST associate model metadata with:
  - each configured Target, and
	- each Run (snapshot at execution time).
- FR-031: System MUST store model metadata as a structured object and persist it alongside test results.
- FR-032: The system MUST attempt to collect and store the following categories of information:
  **Identity**
  - Model name / identifier
	- Model version or revision (if exposed)
	- Provider / backend (e.g. Ollama, custom OpenAI-compatible server)

  **Architecture (if available)**
	- Model family (e.g. LLaMA-derived, Qwen-derived, etc.)
	- Parameter count (raw and/or effective)
	- Context window size (tokens)

  **Quantisation & Runtime Characteristics**
  - Quantisation type (e.g. Q4, Q6, Q8, FP16, etc.)
  - Quantisation method (if available)
  - Runtime precision (CPU/GPU, Metal/CUDA, etc.)
  - Device placement (CPU / GPU / mixed, if exposed)

  **Capabilities & Feature Flags**
  - Tool calling support (declared or detected)
  - Streaming support
  - Logprobs support
  - Function/tool schema adherence level (native / partial / text-only)
  - Max supported tokens (prompt / completion)

  **Server-Reported Metadata**
  - Any additional key-value metadata returned by the server that characterises the model
  
- FR-033: If a target does not expose some or all metadata fields, the system MUST:
  - store missing fields as unknown,
  - record the reason (e.g. “endpoint does not expose metadata”).

#### Target-Level Defaults
- FR-036: The system MUST allow defining default generation parameters per Target, including:
  - max_context_tokens (or equivalent, if supported by the backend)
  - max_completion_tokens / max_tokens
  - temperature
  - top_p
  - top_k (if supported)
  - repetition_penalty / frequency_penalty / presence_penalty (when applicable)
  - stream (true/false)
  - seed (if supported by the model/server)
  - FR-037: These defaults MUST be applied automatically to all tests unless overridden.

#### Test-Level Overrides
- FR-038: A TestDefinition MUST be able to override any generation or context parameter for that test only.
- FR-039: Overrides MUST be explicit and declarative (JSON or Python), not inferred.
- FR-040: The system MUST record the effective parameter set actually used for each test execution.

Example (JSON test override)
```
{
  "generation_overrides": {
    "max_completion_tokens": 2048,
    "temperature": 0.0,
    "stream": true
  }
}
```

#### Context Window Configuration & Stress Testing
- FR-041: The system MUST allow tests to specify prompt size strategies, including:
  - fixed token count
  - percentage of declared context window (e.g. 25%, 50%, 90%)
  - incremental ramp (e.g. 512 → 1024 → 2048 → …)
- FR-042: The system MUST support context stress tests, where the same request is replayed with increasing prompt sizes until:
  - failure,
  - timeout,
  - truncation,
  - or degraded performance is observed.
- FR-043: The system MUST record:
  - actual prompt token count,
  - whether truncation occurred,
  - server-reported limits (if any).

#### Parameter Sweeps & Comparative Runs
- FR-044: The system SHOULD support parameter sweep execution, where a single test is executed across a matrix of parameter values (e.g. temperature × max_tokens).
- FR-045: Sweep results MUST be grouped and comparable in the dashboard.
- FR-046: The dashboard MUST allow filtering and comparison by:
  - context size
  - max tokens
  - temperature
  - streaming mode
  - quantisation level (via model metadata)
- FR-046a: Sweep definitions MUST include explicit parameter ranges/sets and
  step sizes (or enumerated values) for each parameter in the matrix.
- FR-046b: Sweep grouping MUST specify a stable sweep_id and parameter keys used
  for grouping and comparison.
- FR-046c: Sweep definitions MUST declare the parameter value format
  (range with step, explicit list, or categorical set) per parameter.

#### Persistence & Reproducibility
- FR-047: Every TestResult MUST persist:
  - declared parameters,
  - resolved/effective parameters,
  - server-reported overrides or clamps (if detected).
- FR-048: A user MUST be able to re-run a test with identical parameters from a previous run (bit-for-bit request reproduction, except timestamps).

#### Test Execution
- FR-006: System MUST provide two execution modes:
  - Single test mode: run one test once or N times
  - Suite mode: run all tests sequentially (optionally filtered by tags/category)
- FR-007: System MUST support per-test timeouts and per-suite timeouts.
- FR-008: System MUST support “continue on failure” (default) and “stop on first failure” (configurable).
- FR-009: System MUST compute performance metrics per run:
  - TTFB (time to first byte / first SSE chunk)
  - Total latency
  - Prefill time (see FR-017)
  - Decode time / token generation speed (tokens/sec)
  - Prompt tokens / completion tokens when available
- FR-010: System MUST compute aggregated metrics over repetitions: min/median/p95/max/stddev and failure rate.
- FR-011: System MUST record a deterministic test verdict: PASS/FAIL/SKIP plus failure reason and reproducible evidence.

#### Failure Handling & Recovery
- FR-011a: Malformed streaming (SSE) responses MUST be marked FAIL with a
  failure reason and preserved raw events.
- FR-011b: Rate-limit (429) and transient network failures MUST be classified
  as RETRYABLE or NON-RETRYABLE with a recorded reason.
- FR-011c: Suite runs MUST support a retry mode that re-runs only failed tests
  with identical parameters and records a retry summary.
- FR-011d: Request timeouts and no-first-byte conditions MUST be recorded as
  FAIL with a clear timeout reason and associated timing metrics.
- FR-011e: Non-JSON error bodies MUST be preserved as raw artefacts with a
  content-type label.
- FR-011f: If tool calling responses are returned as plain text, the system
  MUST record a compatibility mismatch finding with evidence.
- FR-011g: If response size exceeds capture limits, the system MUST truncate
  artefacts, mark them as truncated, and preserve the first/last bytes.
- FR-011h: When a run would exceed concurrency limits, it MUST be queued or
  rejected with a recorded reason.

#### Compliance Tests (minimum built-ins)
- FR-012: System MUST include built-in compliance tests for:
  - Basic chat completion response shape (non-streaming)
  - SSE streaming format and termination handling
  - Tool calling: structured `tool_calls` emission (OpenAI-style) when tools are provided
  - Error handling: 4xx/5xx bodies parseability and schema adherence
- FR-013: System MUST detect common OpenAI-compatibility mismatches and report them as actionable findings (e.g., missing required fields, wrong types, unsupported parameters).
- FR-013a: “OpenAI-compatible” MUST mean passing the built-in compliance tests
  in FR-012 without critical mismatches.

#### Perplexity & Quality Probes (quantised-model-focused)
- FR-014: System MUST support running perplexity evaluation on a provided text dataset (local file) against a target that can expose token logprobs or a compatible scoring endpoint.
- FR-015: If the target does not support logprobs/scoring, System MUST mark perplexity tests as SKIP with a clear reason.
- FR-016: System SHOULD support “proxy perplexity” alternatives when logprobs are absent, using cloze multiple-choice accuracy as the default proxy task.

#### Prefill/Decode Measurement (practical definition)
- FR-017: System MUST define prefill time operationally as:
  - For streaming: time from request sent → first streamed token/chunk
  - For non-streaming: time from request sent → response received, with prefill approximated as total latency when token timestamps are unavailable.
- FR-018: System MUST compute decode speed as `completion_tokens / decode_duration` where decode_duration is:
  - For streaming: time from first token → final token (or `[DONE]`)
  - For non-streaming: if no token timestamps are available, decode speed MUST be reported as “not_measurable” (not guessed)

#### Pluggable Tests
- FR-019: System MUST auto-discover tests from a configured directory.
- FR-020: System MUST support JSON-defined tests (declarative) containing: name, description, protocol target type(s), request template, assertions, and metric extraction rules.
- FR-021: System MUST support Python-defined tests (imperative) with a stable runner interface (see “Test Plugin API” section).
- FR-022: System MUST sandbox Python tests using Python venv + OS resource limits + filesystem allowlist (best-effort) and enforce resource limits (CPU time, memory ceiling, filesystem allowlist).
- FR-023: System MUST version test specs and persist which version produced each result.
- FR-070: TestDefinitions MUST be unique by id + version.

#### Dashboard & Persistence
- FR-024: System MUST provide a dashboard that displays:
  - Latest run summary per target
  - Test-by-test results
  - Trend charts over time for key metrics
  - Run-to-run comparison view
- FR-025: System MUST persist all results locally (SQLite preferred) and support export to JSON/CSV.
- FR-026: System MUST support time-based result retention with a configurable
  `RETENTION_DAYS` setting (default: 30 days).
- FR-026a: When retention cleanup runs, the system MUST record a summary entry
  (timestamp, runs deleted, reason) for audit purposes.
- FR-034: System MUST provide a Model Details view in the dashboard showing:
  - full stored metadata for a model,
  - the list of runs/tests executed against that model,
  - aggregated performance metrics per model.
- FR-035: System MUST allow comparison of runs across different models or model revisions using metadata as grouping keys (e.g. quantisation level, parameter count).
- FR-049: The dashboard MUST display context and generation parameters alongside performance metrics.
- FR-050: The dashboard MUST allow comparing runs where only one parameter differs (e.g. same model, same prompt, different context size).
- FR-051: Context window utilisation (used tokens vs declared max) SHOULD be visualised when data is available.
- FR-066: The dashboard MUST display the Profile associated with each Run.
- FR-067: The dashboard MUST allow comparison of Runs that differ only by Profile.
- FR-068: Profiles SHOULD be usable as grouping keys in comparison and trend views.

#### Profiles (Parameter & Test Grouping)
- FR-052: The system MUST support user-defined **Profiles**.
- FR-053: A Profile MUST represent a reusable configuration that groups:
  - generation parameters,
  - context window configuration,
  - test and/or suite selection,
  - execution behaviour.
- FR-054: Profiles MUST be independent of Targets and Models and reusable across them.
- FR-055: A Profile MAY define default generation parameters, including:
  - max_context_tokens
  - max_completion_tokens / max_tokens
  - temperature
  - top_p
  - top_k (if supported)
  - repetition_penalty / frequency_penalty / presence_penalty
  - stream (true/false)
  - seed (if supported)
  - FR-056**: A Profile MAY define context window strategies, including:
  - fixed token count,
  - percentage of declared model context window,
  - incremental ramp strategies (e.g. 512 → 1024 → 2048),
  - truncation policy (fail / warn / allow).
- FR-057**: A Profile MAY define test selection rules, including:
  - explicit TestDefinition IDs,
  - Suite references,
  - tag-based inclusion or exclusion,
  - category-based filters.
  - FR-058**: A Profile MAY define execution behaviour, including:
  - number of repetitions per test,
  - per-test and per-suite timeouts,
  - continue-on-failure vs stop-on-failure policy,
  - warm-up run count.
- FR-059: Parameter resolution order MUST be:
  - Test-level overrides,
  - Profile-level settings,
  - Target-level defaults.
- FR-060: The system MUST record the fully resolved effective configuration used for each test execution.
- FR-061: The system MUST allow users to create, edit, duplicate, and delete Profiles.
- FR-062: Profiles MUST be versioned.
- FR-063: Each Run MUST persist:
  - profile identifier,
  - profile version,
  - resolved configuration snapshot.
- FR-064: The system MUST allow executing:
  - a single test with a selected Profile,
  - a Suite with a selected Profile,
  - all tests matching Profile-defined filters.
- FR-065: CLI and API interfaces MUST support Profile selection when triggering runs.
- FR-065a: If a selected Profile is missing or incompatible, the system MUST
  fail fast with a clear, actionable error.

#### CLI + API (for automation)
- FR-027: System MUST provide a CLI to:
  - list targets/tests/suites
  - run a test
  - run a suite
  - export results
- FR-028: System MUST provide a local HTTP API for triggering runs and fetching results.
- FR-029: The local HTTP API MUST bind to localhost and require an API token.

#### Non-Goals (Explicitly Out of Scope)
- NG-001: The system does NOT attempt to automatically infer optimal parameters.
- NG-002: The system does NOT silently adjust user-defined parameters to “make tests pass”.
- NG-003: The system does NOT assume parameter compatibility across different backends; unsupported parameters MUST be ignored with a recorded warning.

---

## Key Entities (include if feature involves data)

- **Target**  
  Represents an endpoint configuration (type: openai/ollama/other)  
  Attributes: id, name, base_url, auth_config, default_model, default_params, timeouts, created_at

- **TestDefinition**  
  Represents a discovered test (JSON or Python)  
  Attributes: id, name, version, category, tags, protocol_support, spec_path, runner_type

- **Suite**  
  Represents an ordered collection of tests (built-in or user-defined)  
  Attributes: id, name, ordered_test_ids, filters, stop_on_fail

- **Run**  
  Represents one execution of a test or suite against a target  
  Attributes: id, target_id, suite_id/test_id, started_at, ended_at, status, environment_snapshot

- **TestResult**  
  Represents one test’s outcome within a run (and repetition-level samples)  
  Attributes: verdict, failure_reason, metrics, artefacts (redacted), raw_events (optional), repetition_stats

- **MetricSample**  
  Represents numeric measurements for one repetition  
  Attributes: ttfb_ms, total_ms, prefill_ms, decode_ms, tokens_per_sec, prompt_tokens, completion_tokens

- **Model**
  Represents a concrete, testable model instance as exposed by a target
  Attributes:
  - id
  - name
  - provider
  - version / revision
  - architecture metadata
  - quantisation metadata
  - capabilities
  - raw_metadata (opaque JSON blob)
  - first_seen_at
  - last_seen_at  

- **Profile**  
  Represents a reusable execution configuration that groups parameter settings, context configuration, test selection, and execution behaviour.  
  Attributes:
  - id
  - name
  - description
  - version
  - generation_parameters
  - context_strategy
  - test_selection
  - execution_behaviour
  - created_at
  - updated_at

---

## Success Criteria (mandatory)

### Measurable Outcomes
- SC-001: A user can configure a new target and run the “Basic chat completion” test in under 2 minutes end-to-end.
- SC-002: Single test runs produce a complete result record (verdict + artefacts + metrics) with 100% persistence reliability (no lost runs).
- SC-003: Suite runs correctly execute at least 20 tests sequentially with deterministic ordering and a final summary.
- SC-004: For repeated runs (N≥10), dashboard shows median and p95 for TTFB/total latency and failure rate per test.
- SC-005: Pluggable tests: a new JSON test dropped into the tests folder appears in the UI/CLI within 5 seconds (or after explicit reload).
- SC-006: Export: results can be exported to JSON/CSV and re-imported (or viewed externally) without loss of key metrics.
- SC-007: For any stored test run, a user can unambiguously determine which exact model configuration (including quantisation, runtime, and capabilities) produced the results.

---

## Test Plugin API (Implementation Contract)

### JSON Test Spec (Declarative) — Required Fields

A JSON test file MUST contain:
- id (string, unique)
- version (semver string)
- name (string)
- description (string)
- protocols (array: `["openai_chat_completions", "ollama", ...]`)
- request object:
  - method (default POST)
  - path (e.g. `/v1/chat/completions`)
  - headers (optional; secrets are referenced by key, not inline)
  - body_template (JSON object with templating variables)
- assertions array (ordered):
  - type: `json_schema | json_path_equals | contains | regex | sse_event_sequence | status_code_in`
  - target: where to apply (status/headers/body/events)
  - expected: value/pattern/schema
- metrics extraction rules:
  - ttfb: required method (client-measured)
  - token_counts: json paths (optional)
  - throughput: computed formula definition (optional)

### Python Test Runner (Imperative) — Required Interface

A Python test module MUST expose:
- `TEST_META = { id, version, name, description, protocols, tags }`
- `def run(ctx) -> Result:`
  - ctx provides: target config, HTTP client, helper timers, redaction utilities, artefact recorder
  - Result returns: verdict, failure_reason, metrics dict, artefacts dict, optional events list

---

## Non-Functional Requirements (Precision Controls)

- NFR-001: All timing MUST be measured client-side using monotonic clocks with millisecond precision.
- NFR-002: The harness MUST redact secrets in logs and stored artefacts.
- NFR-003: The dashboard MUST load and render 1,000 historical runs in under 3 seconds on a typical laptop.
- NFR-004: The system MUST be deterministic given the same inputs (except inherently stochastic model outputs; randomness must be controlled via fixed seeds where supported).
- NFR-005: The system MUST emit structured logs and basic metrics with run_id and test_id tags.
- NFR-006: All performance-related terms (e.g., "fast", "low latency") MUST be
  quantified with explicit thresholds.
- NFR-007: The spec MUST define a traceability scheme that links requirements
  (FR/NFR) to tasks and acceptance criteria.

---

## Traceability Scheme

- Requirements are identified as FR-### / NFR-### and map to tasks T###.
- Acceptance criteria map to SC-### and must cite the related FR/NFR IDs.

---

## Coding Rules (for AI implementation)

- CR-001: Limit changes to only what is required to satisfy acceptance scenarios.
- CR-002: Produce unit tests for all parsing/normalisation logic (SSE parsing, schema validation, metric computation).
- CR-003: Prefer robust, widely used libraries (HTTP client, SSE parser, SQLite ORM) and pin versions.
- CR-004: Never guess metrics. If a metric cannot be measured, label it as `not_measurable` with a reason.
- CR-005: All protocol differences (OpenAI vs Ollama) MUST be isolated behind adapters.

---

## VRT update (new items added)

- **test harness** = a framework to run automated tests (counter: 0)
- **pluggable** = designed so new parts can be added easily (counter: 0)
- **compliance** = adherence to a specification/standard (counter: 0)
- **throughput** = amount produced per unit time, e.g. tokens/sec (counter: 0)
- **regression** = performance/behaviour gets worse after a change (counter: 0)
