# Phase 0 Research: Secure Environment Variable Distribution

Date: 2026-05-23

Purpose: capture design decisions, trade-offs, and concrete recommendations for Phase 1 implementation.

1) Local encrypted cache format

- Options considered:
  - Encrypted JSON file: portable, no native deps, simple to implement cross-platform.
  - Encrypted SQLite: structured queries, ACID, better for large datasets but introduces an additional dependency and more complex distribution.

- Decision: start with an encrypted JSON file for v1. Rationale: minimal dependencies, simplest cross-platform UX, easier to audit and inspect. If later needs arise (performance, large secret sets), migrate to encrypted SQLite as a second-phase improvement.

2) Device authorization model

- Options considered:
  - Device tokens issued by server (bearer tokens scoped to device).
  - Public/private keypairs per device with server-side registration and public key storage.

- Decision: implement device public/private keypairs for v1 device authorization. Rationale: stronger cryptographic binding to the device, allows the server to wrap (encrypt) per-device secrets without storing device private keys. Use ECDSA/ECDH (P-256) via Node's `crypto` APIs to avoid external crypto libraries. Provide a token-based fallback for UX (short-lived tokens) where keypairs are not feasible.

3) Secret envelope / key management

- Approach: hybrid (symmetric envelope + asymmetric wrapping)
  - Each project has a symmetric "project key" (AES-256-GCM) used to encrypt secret payloads.
  - When a device is authorized, the server uses the device's public key to encrypt (wrap) the project key for that device. Devices store their wrapped project keys in the local cache.
  - Retrieving secrets: CLI fetches encrypted secret payload(s) + wrapped project key for the device, unwraps the project key locally using the device private key, then decrypts secret payloads locally.

- Rationale: This minimizes server cryptographic responsibilities (server never holds device private keys) and enables per-device access control and revocation by removing wrapped keys for revoked devices.

4) Transport and storage encryption

- All network traffic MUST use TLS.
- Secrets stored in the database are stored as ciphertext (bytea) along with metadata (version, created_by, environment).
- Local caches are AES-256-GCM encrypted and protected by a device-local key derived from the device private key or a passphrase (see UX trade-offs below).

5) Local key protection UX

- Options:
  - Protect device private keys with OS keyrings (platform-specific, increases complexity).
  - Protect keys with a user passphrase-derived key (PBKDF2/HKDF) and store encrypted private key on disk.

- Decision: v1 will store device private keys encrypted on disk using a passphrase-derived key (PBKDF2/HMAC-SHA256 with a reasonable iteration count). Offer optional OS keyring integration as an opt-in enhancement later.

6) Runtime injection approach

- Use direct process env injection via spawn/child_process (or `cross-spawn` for cross-platform behavior).
- Merge secrets into a copy of `process.env` and pass via the `env` option to `spawn`. Do NOT write plaintext `.env` files by default.

- Windows considerations: Windows has environment block size limits and quoting rules. Implement detection and fallback:
  - If env size approaches platform limits, provide an explicit flag to write a temporary encrypted `.env` file and instruct the user on secure cleanup, or chunk secrets (advanced).

7) Caching, batching, and secret retrieval performance

- Batch secret requests per environment to reduce round-trips.
- Cache decrypted secrets in memory for the duration of the `fermer run` process; cache encrypted payloads on disk for offline fallbacks (policy-controlled).

8) Threat model and non-goals

- Non-goals (explicit): protect against fully compromised machines, kernel/OS-level keyloggers, or malicious privileged actors.
- Threats mitigated: accidental plaintext sharing, insecure secret propagation via ad-hoc channels, compromised repository secrets in common developer workflows.

9) Cryptographic primitives (v1)

- Symmetric: AES-256-GCM for payload encryption (authenticated encryption).
- Asymmetric: ECDH/ECDSA (P-256) for device keypairs and wrapping project keys.
- KDF: HKDF for key derivation; PBKDF2 for passphrase-derived keys initially (tune iterations per platform).
- Storage encoding for v1: encrypted payloads and wrapped keys are stored as base64 text to simplify schema compatibility across drivers.

10) Audit and logging

- Store audit records for: login, device registration, secret retrieval, secret update, permission change.
- Audit records include: actor (user id), device id, action, resource (secret id/project id), environment, timestamp, and source IP (if available).

11) Open questions / follow-ups

- What is the expected max size/count of secret sets per project? (affects cache format decisions)
- Decide iteration/parameters for PBKDF2 or whether to rely on OS keyrings in target deployments.
- Define retention policy for wrapped project keys and audit logs.
- Development database: use the provided Neon PostgreSQL instance as the default dev database URL for the current workspace.

12) Recommended immediate tasks

- Implement Node.js AES-GCM helpers in `packages/crypto` and unit tests.
- Implement device keypair generation and wrapped-key flow proof-of-concept.
- Implement `fermer run` injection prototype that pulls a small secret set and spawns a child process with env injection.
