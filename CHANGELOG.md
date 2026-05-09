# Changelog

All notable changes to this project will be documented in this file.

The format is based on Keep a Changelog and this project follows Semantic Versioning.

## [Unreleased]

### Added

- Backend run groups now persist grouped Run executions, instantiate selected templates per target, launch child runs concurrently, expose `/run-groups` create/read/cancel endpoints, and isolate per-target failures.
- Results now has a run-backed `/results-view/query` API and `/results-view/runs/:runId` detail API for the merged Dashboard/History experience, including filter metadata, scorecards, chart series, recent runs, dense history rows, and drawer data.
- Evaluation detail is now available at `GET /evaluations/:evaluationId` so leaderboard rows can open a detail drawer for the representative evaluation.

### Changed

- CI, release, and local Node version guidance now target Node.js 25 while declaring the supported runtime range as `>=22.19 <26`, matching Undici 8 requirements without claiming Node 26 support before native SQLite dependencies allow it.
- `better-sqlite3` is now pinned to the latest verified 12.9 release line for the current Node runtime window.
- Frontend styling now loads the new design-system foundation tokens, vendored IBM Plex fonts, and shared component primitives for cards, buttons, inputs, health pills, metrics, and architecture-tree surfaces.
- The frontend shell now uses React Router with a 220px always-expanded five-item sidebar, URL-backed Catalog/Results sub-tabs, legacy route redirects, and sidebar health/count status instead of the former global metric-card header.
- Catalog now replaces the legacy Inference Servers and Models bodies with a merged Servers/Models funnel, URL-backed server/model filters, server health view, slide-over add/edit drawer, card grids, and a full-width model inspector layout.
- Run now uses a unified 1-8 model workflow with query-backed model chips, shared template/options controls, single-target detail rendering, multi-target comparison columns, and summary aggregation.
- Results now uses a single merged Dashboard/Leaderboard/History page with a shared 240px filter rail, URL-owned tab/filter/sort/pagination/detail state, export/share/reset actions, run detail drawers for Dashboard and History, and evaluation detail drawers for Leaderboard.
- Leaderboard remains backed by `evaluations` while accepting server, model, score range, sort, and group query parameters, including grouping by server and `inference_config.quantization_level`.
- Inference server authentication can now use stored raw bearer/custom-header tokens for backend probes and runs while preserving the existing `token_env` fallback.

### Fixed

- Backend proxy support now sends plain HTTP outbound requests to the configured proxy in absolute-form while retaining CONNECT tunneling for HTTPS targets, routes backend outbound fetches through the configured Undici dispatcher directly, and no longer lets process-level `NO_PROXY` bypass backend proxy routing unless `AITESTBENCH_INFERENCE_NO_PROXY` is set.
- Inference server API responses now mask stored raw auth tokens and expose only token presence metadata.

## [0.3.2] - 2026-05-05

### Added

- Backend inference-server calls can now be routed through an optional Undici proxy configured with `AITESTBENCH_INFERENCE_PROXY` and `AITESTBENCH_INFERENCE_NO_PROXY`, without exposing proxy settings to the frontend.

### Changed

- CI and release workflows now run on Node.js 22 to match current backend dependency requirements.

### Fixed

- Results dashboard performance graphs now link repeated runs from the same template/model into one series even when generated active test IDs differ.
- Results dashboard merged metric graphs now keep different models as separate lines instead of collapsing same-test metrics together.
- Results dashboard default date ranges now include the newest result even when its timestamp has seconds or milliseconds, preventing single-run dashboards from appearing empty.
- Settings **Empty database** now clears all application SQLite tables, including evaluation prompts and evaluations that feed the leaderboard.
- Leaderboard view now clears stale displayed rows immediately after the database is emptied from settings.
- Architecture inspection errors now show visible, non-empty diagnostics in the model detail page instead of leaving only a red button state.
- MLX architecture inspection now uses config-backed estimation directly, avoiding PyTorch-dependent `AutoModel` construction and allowing models such as `/inferencerlabs/Qwen3-Coder-30B-A3B-Instruct-MLX-6.5bit` to inspect successfully from `config.json`.
- Architecture inspector subprocess failures now include captured output or an explicit timeout diagnostic when the Python process exits or is killed without a structured error.
- Models page filters now infer provider, quantized provider, format, quantization bit-depth, and use-case metadata from discovered model IDs, and collapse provider-prefixed aliases so the model filter shows clean base model names only.

## [0.3.1] - 2026-05-02

### Changed

- Model format handling now accepts `GCUF` as a compatibility alias for canonical `GGUF`.
- Architecture inspection now supports local GGUF files, MLX models with local `config.json` directories, and local-server MLX IDs that point back to HF-style repos, including leading-slash IDs such as `/lmstudio-community/...-MLX-6bit`.
- Architecture inspection now uses a layered pipeline: exact Transformers construction first, then format-aware config/header fallback with explicit provenance and accuracy metadata.
- Config fallback now normalizes nested decoder configs, estimates dense decoder, multimodal projector, and MoE structures, respects tied embeddings, and returns a clear unsupported error when required dimensions are missing.
- GPTQ, AWQ, SafeTensors, MLX, and GGUF inspection targets now route through the appropriate exact, config-backed, or header-only strategy without downloading weight tensors.
- Architecture cache entries now include inspector metadata and invalidate stale zero-parameter root-only results.

## [0.3.0] - 2026-05-01

### Added

- **Model Architecture Inspector** — model detail pages can inspect supported open-weight models and render an expandable layer tree with parameter counts, shapes, layer-type badges, and summary breakdowns.
- Backend architecture inspection APIs for cache-backed `POST`, cache-only `GET`, cache deletion, and per-model `trust_remote_code` settings.
- Python-based architecture extraction for Hugging Face Transformers configs and local GGUF files without loading model weights.
- Architecture cache storage under `backend/data/model/`, with corrupt-cache recovery, partial-file cleanup, path traversal protection, and a two-inspection concurrency limit.
- Frontend architecture tree controls for expand/collapse, expand all/collapse all, virtualized rendering for large trees, and hover highlighting by layer type.
- Optional Hugging Face token support through `HF_TOKEN` or `HUGGINGFACE_HUB_TOKEN` for gated model inspection.

### Changed

- Models now support navigation to model detail pages from the Models view.
- Release and desktop deployment docs now include Python architecture-inspection dependencies.

### Fixed

- Tightened TypeScript typings around schema validation, redaction, run execution, and chart rendering so release checks compile cleanly with current dependencies.

## [0.2.0] - 2026-04-29

### Security

- Upgraded Vite from 7.3.1 to 8.0.10, resolving three high-severity vulnerabilities (path traversal in optimised deps `.map` handling, `server.fs.deny` bypass via query strings, arbitrary file read via dev-server WebSocket — GHSA-4w7w-66w2-5vf9, GHSA-v2wj-q39q-566r, GHSA-p9ff-h696-f583).
- Co-upgraded `@vitejs/plugin-react` to 6.0.1 and `vitest` to 4.1.5, both of which require Vite 8.

### Added

- **Evaluate page** — submit a prompt to any registered inference server and model, receive the answer with six auto-computed quantitative metrics (input tokens, output tokens, total tokens, latency, word count, estimated cost), rate the answer on five qualitative dimensions (accuracy, relevance, coherence, completeness, helpfulness) using 1–5 sliders, and save an immutable evaluation record.
- **Leaderboard page** — ranked view of all evaluated models by composite qualitative score (arithmetic mean of the five dimensions), showing per-dimension averages, aggregate token/latency/cost statistics, and evaluation count per model.
- **Leaderboard filters** — date-range (from/to) and tag-based (OR logic) filtering; active filters with no matches show a distinct filter-specific empty state; clearing filters restores the full unfiltered ranking.
- **Compare Mode** — run the same prompt against two to four models simultaneously in a side-by-side layout; each model is scored and saved as an independent evaluation record.
- `eval_prompts` and `evaluations` SQLite tables with append-only semantics and indexes for efficient leaderboard aggregation.
- `POST /eval-inference`, `POST /evaluations`, `GET /evaluations`, and `GET /leaderboard` API endpoints, all protected by the existing `x-api-token` middleware.

## [0.1.0] - 2026-03-20

### Added

- Inference server management from the dashboard, including create, edit, archive, and runtime/discovery refresh flows.
- Test template management for JSON and Python-backed templates.
- Run execution, result browsing, and the results dashboard with filters, graphs, and tables.
- Local SQLite persistence, profile support, and API endpoints for runs, results, models, suites, profiles, templates, and system settings.
- CI and GitHub release workflow definitions for validating and publishing tagged releases.

### Changed

- Standardized the default backend port on `8080` so the backend, frontend, Playwright config, and documentation align out of the box.
- Added production-oriented `build` and `start` scripts for the backend and frontend workspaces.
- Excluded the CLI from the `0.1.0` public release surface.
