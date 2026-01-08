# Phase 0 Research

## Decision: TypeScript + Node.js backend, React + Tailwind dashboard

**Rationale**: A single TypeScript stack keeps the CLI, API, and UI consistent
and fast to iterate. React + Tailwind delivers the dashboard requirements with
minimal overhead, and Node.js is sufficient for local API + CLI workloads.

**Alternatives considered**:
- Tauri/Electron desktop app: better for packaged distribution, but adds
  complexity and is unnecessary for a local web dashboard.
- Python FastAPI backend: strong for APIs, but introduces a second language for
  CLI/UI, increasing maintenance.

## Decision: Fastify for local API

**Rationale**: Fastify provides high performance with a small footprint, strong
TypeScript support, and predictable plugin patterns.

**Alternatives considered**:
- Express: simple but less structured and slower out of the box.
- Koa: flexible but fewer batteries included.

## Decision: SQLite (better-sqlite3) for storage

**Rationale**: Local-first persistence with low operational overhead and good
performance for the expected run volumes.

**Alternatives considered**:
- Postgres: unnecessary operational cost for a local tool.
- IndexedDB: browser-only and more complex for shared CLI/API access.

## Decision: Testing stack (Vitest, Supertest, Playwright)

**Rationale**: Vitest is fast and TypeScript-friendly, Supertest covers API
integration, and Playwright validates dashboard workflows.

**Alternatives considered**:
- Jest: slower and heavier for modern TS projects.
- Cypress: strong UI tooling but less ideal for multi-app setups.

## Decision: Sandbox for Python test runners

**Rationale**: Use Python venv + OS resource limits + filesystem allowlist as a
best-effort sandbox on macOS without Docker dependency.

**Alternatives considered**:
- Docker: stronger isolation but requires a daemon and adds setup friction.
- sandbox-exec: deprecated and unreliable on modern macOS.
