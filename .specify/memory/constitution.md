<!--
Sync Impact Report

Version change: unspecified -> 1.0.0
Modified principles:
- Template placeholders -> Fermer principles (CLI First; Explicit Security Boundaries; Modular Architecture; Readability & Strong Typing; Testing, UX, Performance, Documentation, Decision-making)
Added sections: Architecture Principles, Code Quality Principles, Testing Principles, UX & Documentation, Decision-Making
Removed sections: none
Templates requiring review: ✅ .specify/templates/constitution-template.md (aligned); ⚠ .specify/templates/plan-template.md (pending constitution gate wording) - c:\\Projectos\\fermer\\.specify\\templates\\plan-template.md
⚠ .specify/templates/spec-template.md - c:\\Projectos\\fermer\\.specify\\templates\\spec-template.md
⚠ .specify/templates/tasks-template.md - c:\\Projectos\\fermer\\.specify\\templates\\tasks-template.md
Follow-up TODOs: none
-->

# Fermer Constitution

## Core Principles

### 1. CLI First

Fermer is a terminal-first tool. The CLI is the primary product surface and MUST be fast, intuitive, scriptable, and cross-platform.

Requirements:

- Every important action MUST be possible from the CLI.
- Commands MUST be composable and automation-friendly.
- Outputs MUST support both human-readable and machine-readable formats (e.g., `--json`).

Example: `fermer secrets pull --json`

### 2. Explicit Security Boundaries

Security claims MUST be explicit. Fermer MUST clearly communicate what is protected, what is not, and threat limitations.

Requirements:

- Secrets MUST never be stored in plaintext by default.
- Sensitive data MUST be encrypted in transit.
- Local persistence SHOULD use encryption when feasible.
- Security-sensitive operations MUST be auditable.

Non-goals:

- Fermer does NOT guarantee protection against fully compromised devices, malicious OS access, privileged attackers, or memory inspection attacks.

### 3. Modular Architecture

Fermer MUST be organized into independent modules with explicit boundaries to ensure maintainability and testability.

Core areas:

- CLI, SDK, cryptography, API server, storage, authentication.

Requirements:

- Modules MUST have explicit boundaries and well-defined interfaces.
- Shared logic MUST live in reusable packages.
- Internal APIs exposed externally MUST be versioned.

### 4. Readability Over Cleverness

Code MUST prioritize clarity and maintainability over clever or compact solutions.

Rules:

- Prefer clear intent and simple functions that do one thing well.
- Avoid unexplained magic values, God classes, deep nesting, and implicit mutations.

### 5. Strong Typing

Type safety is mandatory across codebases using typed languages.

Requirements:

- TypeScript projects MUST enable `strict` mode.
- Avoid `any` unless documented and justified.
- Runtime validation is REQUIRED for all external inputs (approved: Zod, Valibot, or equivalent).

### 6. Consistent Project Structure

Repository structure MUST be predictable and consistent so contributors can find code and tests quickly.

Example layout:

packages/
crypto/
sdk/
shared/

apps/
cli/
server/

Rules:

- Similar concerns MUST live together; public APIs MUST have clear entry points.

## Additional Constraints & Security Requirements

- Secrets MUST not be logged by default; sensitive values MUST be masked.
- Destructive or unsafe operations MUST require explicit confirmation.
- Caching of secrets is allowed only when done securely and documented.

Performance & Scalability:

- CLI startup MUST be fast; simple commands should target <100ms locally.
- Batch operations and secure caching SHOULD be used to reduce repeated decryptions.
- APIs MUST support pagination; database access SHOULD be appropriately indexed.

## Development Workflow & Testing

Testing Principles:

- Reliability first: critical security and environment flows MUST be covered by tests (auth, encryption, permission validation, CLI execution, failure handling).
- Maintain unit, integration, and end-to-end test layers.
- Tests MUST be deterministic: avoid timing-dependent assertions and external network dependencies in tests.

Workflow:

- Tests intended to catch security regressions MUST run in CI before merges.
- Destructive actions require explicit confirmation; defaults MUST minimize friction for legitimate workflows.

## User Experience & Documentation

- Developer experience is a feature: commands MUST be discoverable and examples copy-paste ready.
- Error messages MUST include recovery steps or commands to resolve failures.
- Public commands MUST include examples and migration notes for breaking changes.

## Governance

The constitution is the authoritative guidance for project decisions. Amendments require documentation, rationale, and a migration plan.

Amendment procedure:

- Propose change via a PR that updates this document and adds a migration/compatibility plan.
- Changes that add or remove PRINCIPLES in a backward-incompatible way count as a MAJOR bump.
- Additions or material expansions count as MINOR.
- Editorial clarifications count as PATCH.
- Approvals: changes MUST be approved by the core maintainers team (explicit approvers listed in the repos' CODEOWNERS or PR reviewers).

Versioning policy:

- Use semantic versioning for the constitution: MAJOR.MINOR.PATCH.
- Record `RATIFICATION_DATE` when a version is adopted and update `LAST_AMENDED_DATE` on changes.

Compliance:

- All PRs that materially affect security, API, or testing MUST reference relevant constitution sections and demonstrate compliance in the PR description.

**Version**: 1.0.0 | **Ratified**: 2026-05-23 | **Last Amended**: 2026-05-23
