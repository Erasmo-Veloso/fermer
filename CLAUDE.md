# Fermer — Development Guide

## What This Is

Fermer is a Git-native encrypted secrets manager. It stores secrets encrypted inside the Git repository — no server, no external service. Each developer has a cryptographic identity (EC P-256 keypair). Secrets are encrypted with a per-project AES-256 key that is individually wrapped for each authorized developer via ECDH.

Read these before writing any code:
- `docs/architecture.md` — file formats, directory structure, crypto layers
- `docs/security.md` — threat model, key lifecycle, operational considerations
- `docs/plan.md` — implementation tasks in order (T01–T27)

## Tech Stack

- **Language**: TypeScript (strict mode)
- **Runtime**: Node.js >= 20
- **Build**: `tsc` (vanilla TypeScript compiler)
- **Tests**: Vitest
- **Dependencies**: ZERO runtime dependencies. Everything uses `node:` built-in modules.

## Project Structure

```
src/
  cli.ts           # Entry point
  types.ts         # All shared interfaces
  crypto/          # Cryptographic primitives (AES-GCM, ECDH, HKDF, key wrapping)
  vault/           # Vault read/write, secret CRUD, file I/O
  identity/        # Developer identity management
  commands/        # One file per CLI command
tests/             # Mirrors src/ structure
docs/              # Architecture, security, plan
```

## Commands

```bash
npm run dev -- <command>    # Run CLI in dev mode via tsx
npm run build               # Compile TypeScript
npm test                    # Run all tests
npm run lint                # Type-check without emitting
```

## Rules

1. **Zero runtime dependencies.** Do not add any package to `dependencies`. Everything must use `node:` built-in modules only. Dev dependencies (TypeScript, Vitest, tsx) are fine.

2. **Security first.** Never write plaintext secrets to disk outside of process memory. Never log secret values. Use `node:crypto` for all cryptographic operations — no custom crypto implementations.

3. **Atomic file writes.** When writing `.fermer/vault.json` or `.fermer/members.json`, write to a temporary file first then rename. Never leave a half-written file on disk.

4. **Errors to stderr.** All error messages go to `process.stderr.write()`. Normal output goes to `process.stdout.write()`. Use exit code 1 for errors, 0 for success.

5. **No comments unless the why is non-obvious.** The code should be self-documenting via clear names.

6. **Test with temp directories.** Tests must not write to the real `~/.fermer/` or modify the real filesystem. Use `os.tmpdir()` and clean up after.

7. **One commit per task.** Follow the task numbering in `docs/plan.md`. Use conventional commit messages.

8. **Follow the plan order.** Tasks depend on prior tasks. Do not skip ahead. Phase 1 before Phase 2, etc.

## Crypto Quick Reference

- **AES-256-GCM**: secret encryption. Inputs: plaintext + 256-bit key. Outputs: iv (12 bytes), ciphertext, auth tag (16 bytes).
- **ECDH (P-256)**: key agreement. Inputs: private key A + public key B. Output: shared secret.
- **HKDF-SHA256**: key derivation. Input: shared secret. Output: deterministic 256-bit key. Info string: `"fermer-wrap-v1"`.
- **EC P-256**: identity keys. Used for ECDH (wrapping) and ECDSA (signing/fingerprint).

The existing code in `src/crypto/index.ts` already has `encryptAesGcm`, `decryptAesGcm`, `generateKeyPair`, `deriveSharedSecret`, and `randomKey`. The `src/crypto/device.ts` has `generateDeviceKeypair`, `computeFingerprint`, `signPayload`, `verifySignature`.

## File Formats

All `.fermer/` files are JSON with `"version": 1`. See `docs/architecture.md` for full schemas.

- `.fermer/config.json` — environments list, default environment
- `.fermer/vault.json` — encrypted secrets per environment
- `.fermer/members.json` — member public keys + wrapped project keys

Identity at `~/.fermer/identity.json` — private key, public key, fingerprint, label.

## Testing Strategy

- Unit tests for crypto: roundtrip encryption, key wrapping, edge cases
- Unit tests for vault: CRUD operations on secrets with real crypto (no mocks)
- Unit tests for identity: creation, loading, export
- E2E test: full multi-developer flow (init, set, trust, decrypt, revoke)
- All tests use temp directories and clean up after themselves
