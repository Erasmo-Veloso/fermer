# Implementation Plan: Secure Environment Variable Distribution and Runtime Injection

**Branch**: `001-secure-env-injection` | **Date**: 2026-05-23 | **Spec**: [specs/001-secure-env-injection/spec.md](specs/001-secure-env-injection/spec.md)

## Summary

Implement a lightweight, CLI-first system (Fermer) for secure environment variable distribution and runtime injection. The CLI (TypeScript/Node.js) will authenticate users/devices, retrieve encrypted secrets from an API server (Node/Express), decrypt locally using native Node.js crypto, and inject secrets into spawned processes without generating plaintext `.env` files by default.

## Technical Context

**Language/Version**: Node.js 18+ (TypeScript 5.x recommended)

**Primary Dependencies**: TypeScript, Express, Drizzle ORM, Zod, node:crypto (native), cross-spawn or child_process, pg

**Storage**: PostgreSQL for server; encrypted local cache (encrypted JSON or SQLite) on device

**Testing**: Vitest / Jest for unit tests, Playwright or Cypress for end-to-end CLI flows, integration tests for CLI↔API

**Target Platform**: Cross-platform (macOS, Linux, Windows)

**Project Type**: Monorepo (apps/cli, apps/server, packages/\*)

**Performance Goals**: CLI simple commands <100ms startup; secret retrieval latency minimized via batching & local secure cache

**Constraints**: Secrets must not be logged; no plaintext storage by default; device authorization required; avoid external crypto packages where possible

**Scale/Scope**: v1 targets small teams; design allows scaling to multi-team orgs later

## Constitution Check

GATE: Must pass before Phase 0 research. Reviewed against the Fermer Constitution (v1.0.0).

- CLI First: satisfied — primary UX is CLI; all flows available via CLI.
- Explicit Security Boundaries: satisfied — plan documents threat model and non-goals; secrets will be encrypted in transit and at rest.
- Modular Architecture: satisfied — monorepo modules defined.
- Readability / Strong Typing: satisfied — TypeScript strict mode and Zod validators.
- Testing Requirements: satisfied — unit, integration, and end-to-end test layers planned.

Result: PASS — no constitution violations identified. If future design introduces OS-level secrets or kernel modules, re-evaluate gates.

## Project Structure

```
fermer/
├── apps/
│   ├── cli/                # TypeScript CLI app
│   └── server/             # Express API server
├── packages/
│   ├── crypto/             # crypto helpers & key management
│   ├── sdk/                # typed API client used by CLI
│   ├── shared/             # types, schemas, constants
│   └── config/
├── specs/
│   └── 001-secure-env-injection/
└── scripts/
```

**Structure Decision**: Monorepo enables shared types and validation (Zod) across CLI and server while keeping concerns separate.

## Phase 0: Outline & Research

Open research tasks (resolve NEEDS CLARIFICATION if found):

- Research secure local cache formats (encrypted JSON vs encrypted SQLite) for cross-platform compatibility.
- Research device authorization patterns (public/private keypairs vs device tokens) and UX tradeoffs.
- Investigate Node.js child process environment injection patterns cross-platform (Windows env block size, quoting nuances).
- Define minimal crypto primitives to implement with `node:crypto` (AES-GCM for symmetric payloads, RSA/ECDSA for device auth if needed).

Deliverable: `research.md` capturing decisions and alternatives.

## Phase 1: Design & Contracts

Prerequisites: `research.md` complete.

1. data-model.md: define DB schema for users, devices, projects, environments, secrets, project_members, audit_logs.
2. contracts/: JSON/TS interface contracts for API endpoints (auth, secrets retrieval, device registration, audit queries).
3. quickstart.md: onboarding steps for developers (login, link, run).
4. Update agent context: `.github/copilot-instructions.md` updated to point to this plan (done).

Outputs: `data-model.md`, `/contracts/*`, `quickstart.md`.

Re-evaluate Constitution Check after Phase 1 design changes.

## Phase 2: Implementation Plan (High-level tasks)

Phase 1 must complete before Phase 2 begins.

Phase 2 - Server

- Implement Express server skeleton and endpoints (auth, projects, secrets, devices, audit).
- Add Drizzle ORM schema and migrations for PostgreSQL.
- Implement encryption orchestration: server holds encrypted payloads; server does not store plaintext.
- Add audit logging for secret access and permission changes.
- Add integration tests for API endpoints using an isolated test DB.

Phase 2 - CLI

- Implement CLI command scaffolding (fermer login, link, run, secrets pull)
- Implement authentication/session store on device (secure storage): encrypted cache and token handling.
- Implement `fermer run` that retrieves secrets, decrypts locally, injects env into spawned process, and streams stdout/stderr.
- Add unit tests for injection logic and integration tests for CLI↔API flows.

Cross-cutting

- Implement Zod validation schemas in `packages/shared` and use them server & client side.
- CI: run unit, integration, end-to-end tests; ensure tests run deterministically via seeded fixtures and local test DBs.

## Complexity Tracking

No constitution violations identified. Any future choices that add native modules or OS-level keyrings will require explicit justification.

## Risks & Mitigations

- Risk: Local plaintext leakage via misconfigured logging — Mitigation: default mask sensitive values and add lint/CI checks.
- Risk: Cross-platform process env limits (Windows) — Mitigation: research and implement chunked injection or temp file option behind explicit flag.
- Risk: Key management complexity — Mitigation: start with symmetric-encrypted secret envelopes per project and evaluate public-key device registration if needed.

## Next Steps

1. Run Phase 0 research tasks and produce `research.md`.
2. Produce `data-model.md`, API contracts, and `quickstart.md` (Phase 1 outputs).
3. Implement server & CLI skeletons and add unit tests (Phase 2 start).

---

Plan created by speckit.plan
