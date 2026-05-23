---
description: "Task list for Secure Environment Variable Distribution and Runtime Injection"
---

# Tasks: Secure Environment Variable Distribution and Runtime Injection

**Input**: Design documents from `specs/001-secure-env-injection/`

## Phase 1: Setup (Repository Foundation)

- [ ] T001 Create project directory structure at apps/, packages/, docs/, specs/ (create directories)
- [ ] T002 Configure shared TypeScript base at tsconfig.base.json with `strict` mode and path aliases (tsconfig.base.json)
- [ ] T003 [P] Configure monorepo workspace tooling (pnpm-workspace.yaml or npm/yarn workspaces) (repo root)
- [ ] T004 [P] Configure ESLint and Prettier with shared rules (.eslintrc.cjs, .prettierrc)
- [ ] T005 Create shared environment loader and `.env.example` standards in packages/config (packages/config)

---

## Phase 2: Shared Packages

- [ ] T006 [P] [US5] Create shared types package in packages/shared (packages/shared/src)
- [ ] T007 [P] Create validation package with Zod schemas in packages/validation (packages/validation/src)
- [ ] T008 [P] Create crypto package with encryption/decryption/key utilities in packages/crypto (packages/crypto/src)
- [ ] T009 [P] Create SDK package for typed API client in packages/sdk (packages/sdk/src)

---

## Phase 3: Database Layer

- [x] T010 Configure local PostgreSQL development environment and migration workflow (devops/docker-compose.yml or docs/setup-db.md)
- [x] T011 Configure Drizzle ORM and project DB schema entrypoint (apps/server/src/db)
- [x] T012 [P] [US1] Create `users` schema and migration (apps/server/src/db/migrations)
- [x] T013 [P] [US1] Create `devices` schema and migration (apps/server/src/db/migrations)
- [x] T014 [P] Create `projects` schema and migration (apps/server/src/db/migrations)
- [x] T015 [P] [US5] Create `environments` schema and migration (apps/server/src/db/migrations)
- [x] T016 [P] [US4] Create `secrets` schema (encrypted payloads) and migration (apps/server/src/db/migrations)
- [x] T017 [P] Create `project_members` schema for roles and permissions (apps/server/src/db/migrations)
- [x] T018 [P] Create `audit_logs` schema for access/auth events and migration (apps/server/src/db/migrations)

---

## Phase 4: Backend API Foundation

- [ ] T019 Initialize Express server skeleton and modular routing (apps/server/src/index.ts)
- [ ] T020 Configure global structured error handling middleware (apps/server/src/middleware/error.ts)
- [ ] T021 Configure request validation middleware using Zod (apps/server/src/middleware/validation.ts)
- [ ] T022 [P] Implement authentication infrastructure (JWT, refresh tokens) (apps/server/src/auth)
- [ ] T023 [P] Implement authorization helpers and project permission enforcement (apps/server/src/auth/authorization.ts)

---

## Phase 5: Authentication Features (US1)

- [ ] T024 [US1] Implement user registration endpoint (apps/server/src/routes/auth/register.ts)
- [ ] T025 [US1] Implement user login endpoint (apps/server/src/routes/auth/login.ts)
- [ ] T026 [US1] Implement current-user endpoint (`/auth/me`) (apps/server/src/routes/auth/me.ts)
- [ ] T027 [US1] Implement logout/token invalidation endpoint (apps/server/src/routes/auth/logout.ts)

---

## Phase 6: Device Authorization

- [ ] T028 [US1] Implement device keypair generation utilities (packages/crypto/src/device.ts)
- [ ] T029 [US1] Implement device registration API and flow (apps/server/src/routes/devices/register.ts)
- [ ] T030 [US1] Implement device validation middleware to reject unauthorized devices (apps/server/src/middleware/deviceValidation.ts)

---

## Phase 7: Project Management (US3)

- [ ] T031 [US3] Implement create-project endpoint (apps/server/src/routes/projects/create.ts)
- [ ] T032 [US3] Implement local repository linking support in the CLI (apps/cli/src/commands/link.ts)
- [ ] T033 [US3] Implement invite project members endpoint (apps/server/src/routes/projects/invite.ts)
- [ ] T034 [US3] Implement remove project members / revoke access endpoint (apps/server/src/routes/projects/remove.ts)

---

## Phase 8: Secret Management (US4, US6)

- [ ] T035 [US4] Implement create-secret endpoint (apps/server/src/routes/secrets/create.ts)
- [ ] T036 [US6] Implement update-secret endpoint with version-safe updates and audit logging (apps/server/src/routes/secrets/update.ts)
- [ ] T037 [US6] Implement delete-secret endpoint with confirmation safeguards (apps/server/src/routes/secrets/delete.ts)
- [ ] T038 [US4] Implement list-secret-metadata endpoint returning names/environments only (apps/server/src/routes/secrets/list.ts)
- [ ] T039 [US4] Implement secret-retrieval endpoint delivering encrypted payloads with permission validation (apps/server/src/routes/secrets/retrieve.ts)

---

## Phase 9: CLI Foundation

- [ ] T040 Initialize CLI application scaffold with command parser and help (apps/cli/src/index.ts)
- [ ] T041 Configure CLI output utilities (apps/cli/src/utils/output.ts)
- [ ] T042 Configure local CLI storage for tokens and encrypted cache (apps/cli/src/storage/\*)

---

## Phase 10: CLI Authentication Commands (US1)

- [ ] T043 [US1] Implement `fermer login` CLI command (apps/cli/src/commands/login.ts)
- [ ] T044 [US1] Implement `fermer logout` CLI command (apps/cli/src/commands/logout.ts)
- [ ] T045 [US1] Implement `fermer whoami` CLI command (apps/cli/src/commands/whoami.ts)

---

## Phase 11: CLI Project Commands (US3)

- [ ] T046 [US3] Implement `fermer init` to initialize local project config (apps/cli/src/commands/init.ts)
- [ ] T047 [US3] Implement `fermer link` to persist project linkage locally (apps/cli/src/commands/link.ts)
- [ ] T048 [US3] Implement `fermer unlink` to remove project association (apps/cli/src/commands/unlink.ts)

---

## Phase 12: CLI Secret Commands (US4)

- [ ] T049 [US4] Implement `fermer secrets list` to show metadata only (apps/cli/src/commands/secrets/list.ts)
- [ ] T050 [US4] Implement `fermer secrets pull` to retrieve encrypted secrets and store in encrypted cache (apps/cli/src/commands/secrets/pull.ts)
- [ ] T051 [US4] Implement `fermer secrets sync` to synchronize updated secrets (apps/cli/src/commands/secrets/sync.ts)

---

## Phase 13: Runtime Injection (US2, US5)

- [ ] T052 [US2] Implement environment injection engine to merge runtime variables securely and avoid plaintext `.env` by default (apps/cli/src/injector.ts)
- [ ] T053 [US2] Implement process execution integration that preserves stdout/stderr and streams (apps/cli/src/run/process.ts)
- [ ] T054 [US2] Implement `fermer run` command that retrieves secrets, injects environment, and spawns the target command (apps/cli/src/commands/run.ts)

---

## Phase 14: Audit System (US7)

- [ ] T055 [US7] Implement audit logging for authentication events (apps/server/src/audit/auth.ts)
- [ ] T056 [US7] Implement audit logging for secret access events (apps/server/src/audit/secrets.ts)
- [ ] T057 [US7] Implement audit logging for permission changes (apps/server/src/audit/permissions.ts)

---

## Phase 15: Error Handling and UX

- [ ] T058 Improve error messaging with recovery suggestions (docs/errors.md, apps/cli/src/errors.ts)
- [ ] T059 Improve CLI help output and examples (docs/cli-usage.md, apps/cli/src/help.ts)
- [ ] T060 Add confirmation prompts for destructive actions (apps/cli/src/prompts/\*)

---

## Phase 16: Testing

- [ ] T061 Configure test runner and CI test matrix (vitest/jest config at repo root)
- [ ] T062 Create crypto unit tests (packages/crypto/tests)
- [ ] T063 Create authentication integration tests (apps/server/tests/auth)
- [ ] T064 Create permission/authorization tests (apps/server/tests/permissions)
- [ ] T065 Create runtime injection tests (apps/cli/tests/injection)
- [ ] T066 Create end-to-end onboarding and `fermer run` tests (tests/e2e)

---

## Phase 17: Documentation

- [ ] T067 Create installation guide (docs/installation.md)
- [ ] T068 Create CLI usage documentation with examples (docs/cli-usage.md)
- [ ] T069 Create security documentation covering threat model and limitations (docs/security.md)
- [ ] T070 Create contribution guide and coding conventions (docs/contributing.md)

---

## Phase 18: Future Enhancements (Roadmap)

- [ ] T071 Add secret rotation support (docs/roadmap.md)
- [ ] T072 Add temporary access tokens feature (docs/roadmap.md)
- [ ] T073 Add CI/CD integration patterns (docs/roadmap.md)
- [ ] T074 Add team management features (docs/roadmap.md)
- [ ] T075 Add self-hosted deployment guide (docs/roadmap.md)

---

## Final Phase: MVP Validation

- [ ] T076 Validate MVP completion criteria: authentication, device registration, project creation/linking, secret management, secret retrieval, and `fermer run` (validation checklist in quickstart.md)

---

## Dependencies & Parallel Opportunities

- Foundation tasks (Phase 1) must complete before many server/CLI tasks begin.
- Shared packages (T006-T009) can be developed in parallel by different contributors. [P]
- DB migrations (T012-T018) can be prepared in parallel but require integration testing.
- CLI commands (T043-T051) can be implemented in parallel once SDK and storage primitives exist. [P]

---

## Implementation Strategy

1. Phase 1: Setup
2. Phase 2: Shared packages
3. Phase 3: Database + Phase 4: API foundation
4. Phase 5-8: Auth, devices, project, and secret endpoints (P1 & P2 priorities)
5. Phase 9-13: CLI foundation + `fermer run` implementation
6. Phase 14-16: Audit, UX, and testing
7. Final: Documentation, validation, and release

---

Generated from template: .specify/templates/tasks-template.md
