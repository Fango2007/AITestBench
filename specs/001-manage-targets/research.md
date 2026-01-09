# Research: Target Management Dashboard

## Decision 1: Asynchronous connectivity checks

**Decision**: Run connectivity checks asynchronously after save with status
updates and retry support.
**Rationale**: Preserves UI responsiveness while providing immediate feedback
and a clear recovery path for transient failures.
**Alternatives considered**: Blocking save until check completes; manual
user-triggered checks only.

## Decision 2: Archive on delete when runs exist

**Decision**: Block deletion when runs exist and offer archive action instead.
**Rationale**: Preserves historical run integrity while allowing cleanup.
**Alternatives considered**: Hard delete with cascade; allow delete with warning.

## Decision 3: Unique target names

**Decision**: Enforce unique target names with a clear error on duplicates.
**Rationale**: Prevents confusion in selection and history review.
**Alternatives considered**: Allow duplicates with warning; auto-suffix names.

## Decision 4: Archived targets presentation

**Decision**: Separate active and archived views/sections; exclude archived from
run selection by default with a user-controlled toggle to view.
**Rationale**: Keeps primary workflows focused while retaining access to
historical targets.
**Alternatives considered**: Single list with status badges; hide archived
completely.
