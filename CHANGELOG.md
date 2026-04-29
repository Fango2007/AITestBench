# Changelog

All notable changes to this project will be documented in this file.

The format is based on Keep a Changelog and this project follows Semantic Versioning.

## [Unreleased]

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
