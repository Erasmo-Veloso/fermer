# Architecture

## Overview

Fermer is a single Node.js CLI application that manages encrypted secrets stored directly in a Git repository. There is no server component. All cryptographic operations happen locally.

## Directory Structure

```
fermer/
  src/
    cli.ts                 # Entry point, argument parsing, command dispatch
    types.ts               # Shared TypeScript types
    crypto/
      index.ts             # AES-256-GCM encrypt/decrypt, ECDH key derivation
      device.ts            # Identity keypair generation, fingerprint, signing
      wrap.ts              # Project key wrapping/unwrapping via ECDH
    vault/
      index.ts             # Vault CRUD: load, save, set, unset, list secrets
      format.ts            # Vault file format (read/write .fermer/vault.json)
    identity/
      index.ts             # Identity creation, loading, export
    commands/
      identity.ts          # `fermer identity`
      init.ts              # `fermer init`
      set.ts               # `fermer set KEY=VALUE`
      unset.ts             # `fermer unset KEY`
      list.ts              # `fermer list`
      run.ts               # `fermer run <cmd>`
      export.ts            # `fermer export`
      trust.ts             # `fermer trust <key.pub>`
      revoke.ts            # `fermer revoke <fingerprint>`
      members.ts           # `fermer members`
  tests/
    crypto.test.ts
    vault.test.ts
    identity.test.ts
    wrap.test.ts
    commands/
      init.test.ts
      set.test.ts
      run.test.ts
      trust.test.ts
      revoke.test.ts
```

## File Formats

### Identity File (`~/.fermer/identity.json`)

Stored on each developer's machine. Never committed to Git.

```json
{
  "version": 1,
  "fingerprint": "a1b2c3d4...",
  "publicKey": "-----BEGIN PUBLIC KEY-----\n...",
  "privateKey": "-----BEGIN PRIVATE KEY-----\n...",
  "createdAt": "2026-08-23T10:00:00Z",
  "label": "alice@workstation"
}
```

### Vault File (`.fermer/vault.json`)

Committed to Git. Contains encrypted secrets per environment.

```json
{
  "version": 1,
  "environments": {
    "development": {
      "secrets": {
        "DATABASE_URL": {
          "iv": "base64...",
          "ciphertext": "base64...",
          "tag": "base64...",
          "updatedAt": "2026-08-23T10:00:00Z"
        }
      }
    }
  }
}
```

### Members File (`.fermer/members.json`)

Committed to Git. Maps developer fingerprints to their public keys and wrapped project keys.

```json
{
  "version": 1,
  "members": {
    "a1b2c3d4...": {
      "publicKey": "-----BEGIN PUBLIC KEY-----\n...",
      "label": "alice@workstation",
      "wrappedKey": {
        "ephemeralPublicKey": "-----BEGIN PUBLIC KEY-----\n...",
        "iv": "base64...",
        "ciphertext": "base64...",
        "tag": "base64..."
      },
      "addedAt": "2026-08-23T10:00:00Z"
    }
  }
}
```

### Config File (`.fermer/config.json`)

Committed to Git. Project-level configuration.

```json
{
  "version": 1,
  "environments": ["development", "staging", "production"],
  "defaultEnvironment": "development"
}
```

## Cryptographic Design

### Layers

```
Layer 3: ECDH Key Agreement (P-256)
  Each developer has a P-256 keypair.
  Used to wrap/unwrap the project key for each member.

Layer 2: Project Key (AES-256)
  One random 256-bit symmetric key per project.
  Encrypts all secret values.
  Rotated when a member is revoked.

Layer 1: Secret Values
  Each value encrypted individually with AES-256-GCM.
  Stored as (iv, ciphertext, tag) tuple in the vault.
```

### Key Wrapping (ECDH)

When adding a member:
1. Generate an ephemeral EC P-256 keypair
2. Derive a shared secret via ECDH(ephemeral_private, member_public)
3. Use HKDF-SHA256 on the shared secret to derive a 256-bit wrapping key
4. Encrypt the project key with AES-256-GCM using the wrapping key
5. Store the ephemeral public key + encrypted project key in `members.json`

When a member decrypts:
1. Read their wrapped key entry from `members.json`
2. Derive shared secret via ECDH(member_private, ephemeral_public)
3. Use HKDF-SHA256 to derive the wrapping key
4. Decrypt the project key
5. Use the project key to decrypt secrets from the vault

### Key Rotation (on revocation)

1. Generate a new random project key
2. Decrypt all secrets with the old project key
3. Re-encrypt all secrets with the new project key
4. Re-wrap the new project key for each remaining member
5. Remove the revoked member's entry from `members.json`
6. Update `vault.json` with re-encrypted secrets

This is an atomic operation — if it fails partway, no files are written.

## CLI Design

### Argument Parsing

No external dependency. The CLI uses `process.argv` directly with a simple pattern-matching dispatcher. Each command is a standalone module that exports an `execute` function.

### Error Handling

All errors write to stderr and exit with code 1. Errors include:
- Missing identity (`fermer identity` not run yet)
- Not in a fermer-initialized repo
- Secret key not found
- Access denied (no wrapped key for this identity)
- Invalid vault file

### Process Injection (`fermer run`)

1. Load and decrypt all secrets for the target environment
2. Merge with `process.env` (secrets override existing vars)
3. Spawn the child command with `child_process.spawn` using the merged env
4. Forward stdin/stdout/stderr
5. Exit with the child's exit code

## Dependencies

Zero runtime dependencies. Everything uses Node.js built-in modules:
- `node:crypto` for all cryptographic operations
- `node:fs` for file I/O
- `node:path` for path resolution
- `node:child_process` for process spawning
- `node:os` for home directory resolution
