# Implementation Plan

This document describes every implementation task for the Fermer CLI, grouped into phases. Each phase builds on the previous — implement them in order. Each task is a single commit.

Read `docs/architecture.md` and `docs/security.md` before starting.

---

## Phase 1: Crypto Foundation

The crypto primitives already exist in `src/crypto/index.ts` and `src/crypto/device.ts`. This phase adds HKDF key derivation and the key wrapping module.

### T01 — Add HKDF-SHA256 key derivation to `src/crypto/index.ts`

Add a function `deriveKey(sharedSecret: Buffer, info: string, length?: number): Buffer` that uses `node:crypto` `hkdfSync` to derive a key from a shared secret.

- Algorithm: HKDF-SHA256
- Salt: empty buffer (32 zero bytes)
- Info: the provided string (e.g. `"fermer-wrap-v1"`)
- Default output length: 32 bytes (256 bits)

Add a test in `tests/crypto.test.ts` that verifies deterministic output (same inputs produce same key).

### T02 — Create `src/crypto/wrap.ts` — project key wrapping/unwrapping

This module wraps a project key for a specific member using ECDH + HKDF + AES-256-GCM.

**Functions:**

```typescript
interface WrappedKey {
  ephemeralPublicKey: string;  // PEM
  iv: string;                 // base64
  ciphertext: string;         // base64
  tag: string;                // base64
}

function wrapProjectKey(projectKey: Buffer, memberPublicKeyPem: string): WrappedKey
function unwrapProjectKey(wrapped: WrappedKey, memberPrivateKeyPem: string): Buffer
```

**`wrapProjectKey` logic:**
1. Generate an ephemeral EC P-256 keypair
2. Derive shared secret: `deriveSharedSecret(ephemeralPrivateKey, memberPublicKey)`
3. Derive wrapping key: `deriveKey(sharedSecret, "fermer-wrap-v1")`
4. Encrypt the project key: `encryptAesGcm(projectKey, wrappingKey)`
5. Return the ephemeral public key + encrypted data

**`unwrapProjectKey` logic:**
1. Derive shared secret: `deriveSharedSecret(memberPrivateKey, ephemeralPublicKey)`
2. Derive wrapping key: `deriveKey(sharedSecret, "fermer-wrap-v1")`
3. Decrypt and return the project key

Write tests in `tests/wrap.test.ts`:
- Roundtrip: wrap then unwrap returns original key
- Wrong private key fails to unwrap
- Tampered ciphertext fails to unwrap

### T03 — Update `tests/crypto.test.ts` import paths

Fix the existing crypto test to import from `../src/crypto/index` instead of `../src/index`. Verify all tests pass with `npm test`.

---

## Phase 2: Types and File Formats

### T04 — Create `src/types.ts` with all shared types

Define TypeScript interfaces for all data structures:

```typescript
interface Identity {
  version: 1;
  fingerprint: string;
  publicKey: string;
  privateKey: string;
  createdAt: string;
  label: string;
}

interface WrappedKey {
  ephemeralPublicKey: string;
  iv: string;
  ciphertext: string;
  tag: string;
}

interface MemberEntry {
  publicKey: string;
  label: string;
  wrappedKey: WrappedKey;
  addedAt: string;
}

interface MembersFile {
  version: 1;
  members: Record<string, MemberEntry>;  // keyed by fingerprint
}

interface EncryptedValue {
  iv: string;
  ciphertext: string;
  tag: string;
  updatedAt: string;
}

interface VaultFile {
  version: 1;
  environments: Record<string, {
    secrets: Record<string, EncryptedValue>;
  }>;
}

interface ConfigFile {
  version: 1;
  environments: string[];
  defaultEnvironment: string;
}
```

Export all types.

### T05 — Create `src/vault/format.ts` — file I/O for `.fermer/` files

Functions for reading and writing the three JSON files in `.fermer/`:

```typescript
function findRepoRoot(): string          // walk up from cwd until .git/ found, throw if not in a repo
function fermerDir(): string             // findRepoRoot() + '/.fermer'

function readConfig(): ConfigFile
function writeConfig(config: ConfigFile): void

function readVault(): VaultFile
function writeVault(vault: VaultFile): void

function readMembers(): MembersFile
function writeMembers(members: MembersFile): void
```

All read functions throw a clear error if the file doesn't exist or is malformed JSON. All write functions use `JSON.stringify(data, null, 2)` and write atomically (write to temp file, then rename).

---

## Phase 3: Identity Management

### T06 — Create `src/identity/index.ts`

```typescript
function identityDir(): string           // ~/.fermer/
function identityPath(): string          // ~/.fermer/identity.json
function identityExists(): boolean
function loadIdentity(): Identity        // throws if not found
function createIdentity(label: string): Identity  // generates keypair, writes to disk
function exportPublicKey(outputPath: string): void // writes just the public key PEM to a file
```

**`createIdentity`:**
1. Call `generateDeviceKeypair()` to get private key, public key, fingerprint
2. Build the `Identity` object with `version: 1`, ISO timestamp, provided label
3. Create `~/.fermer/` if needed
4. Write `identity.json` with permissions 0600 (use `fs.writeFileSync` with `mode: 0o600` — on Windows this is a no-op but harmless)
5. Return the identity

**`exportPublicKey`:**
1. Load identity
2. Write just the public key PEM to the given output path

Test in `tests/identity.test.ts`:
- Create identity, verify file exists and contains valid JSON
- Load identity returns the same data
- Use a temp directory for `~/.fermer/` in tests (inject the path or use env var `FERMER_HOME`)

---

## Phase 4: Vault Operations

### T07 — Create `src/vault/index.ts`

High-level vault operations that combine crypto + file I/O:

```typescript
function initVault(identity: Identity): void
function setSecret(key: string, value: string, env: string, identity: Identity): void
function unsetSecret(key: string, env: string, identity: Identity): void
function listSecrets(env: string, identity: Identity): string[]
function getSecrets(env: string, identity: Identity): Record<string, string>
```

**`initVault`:**
1. Check `.fermer/` doesn't already exist (throw if it does)
2. Generate a random 32-byte project key
3. Create `.fermer/config.json` with default environments `["development", "staging", "production"]`
4. Create empty `.fermer/vault.json`
5. Wrap the project key for the current identity and create `.fermer/members.json`

**`setSecret`:**
1. Load identity, members, vault
2. Unwrap project key using identity
3. Encrypt the value with the project key
4. Store/update in vault under the given environment
5. Write vault to disk

**`unsetSecret`:**
1. Same as set but removes the key. Throw if key not found.

**`listSecrets`:**
1. Load vault, return array of key names for the environment (no decryption needed — keys are plaintext, values are encrypted)

**`getSecrets`:**
1. Load identity, members, vault
2. Unwrap project key
3. Decrypt all secrets for the environment
4. Return as `Record<string, string>`

Test in `tests/vault.test.ts`:
- Init creates all three files
- Set and get roundtrip
- Set overwrites existing key
- Unset removes key
- List returns only key names
- Operations fail without identity in members

---

## Phase 5: Trust and Revocation

### T08 — Add trust operations to `src/vault/index.ts`

```typescript
function trustMember(publicKeyPath: string, identity: Identity): { fingerprint: string; label: string }
function revokeMember(fingerprint: string, identity: Identity): void
function listMembers(identity: Identity): Array<{ fingerprint: string; label: string; addedAt: string }>
```

**`trustMember`:**
1. Read the public key PEM from the given file path
2. Compute its fingerprint
3. Check the member isn't already in `members.json`
4. Load the project key (unwrap using current identity)
5. Wrap the project key for the new member
6. Add to `members.json` with label derived from the key file name or a default
7. Write `members.json`

**`revokeMember`:**
1. Check the fingerprint exists in `members.json`
2. Refuse the revocation only when it would leave the project with zero
   members. Revoking yourself is allowed while other members remain, since
   that is how someone leaves a project; the CLI should confirm before doing
   it because the caller loses their own access.
3. Generate a NEW random project key
4. Decrypt ALL secrets in ALL environments with the old project key
5. Re-encrypt ALL secrets with the new project key
6. Re-wrap the new project key for each REMAINING member
7. Remove the revoked member
8. Write both `vault.json` and `members.json` through
   `writeVaultAndMembers` in `src/vault/format.ts`, which stages both files
   to temp paths and then renames both. Never write them with two separate
   calls: between the writes the vault is already re-encrypted under the new
   project key while `members.json` still holds the old wrapped keys, which
   locks out every member.

**`listMembers`:**
1. Read `members.json`, return array of member info

Test in `tests/trust.test.ts`:
- Trust adds a member
- Trusted member can decrypt secrets
- Revoke removes member
- Revoked member cannot decrypt secrets (old wrapped key fails)
- Cannot revoke the last remaining member
- After revocation, remaining members can still decrypt
- A file containing a private key is refused and nothing is written
- A public key rewritten to CRLF in transit still resolves to the right member
- A key on the wrong curve, or a file that is not a key, is refused
- Secret `updatedAt` values survive rotation unchanged
- No `.tmp` files are left in `.fermer/` after rotation

---

## Phase 6: CLI Entry Point and Commands

### T09 — Create `src/cli.ts` — entry point and command dispatcher

Parse `process.argv` and dispatch to command modules. No external dependencies.

```
Usage: fermer <command> [options]

Commands:
  identity              Create or show your cryptographic identity
  init                  Initialize Fermer in the current repository
  set KEY=VALUE         Add or update a secret
  unset KEY             Remove a secret
  list                  List secret keys
  run <command...>      Run a command with secrets injected
  export                Output secrets as KEY=VALUE lines
  trust <key.pub>       Authorize a developer
  revoke <fingerprint>  Revoke a developer and rotate keys
  members               List authorized developers

Options:
  -e, --env <name>      Target environment (default: development)
  -h, --help            Show this help
  --version             Show version
```

Each command is a module in `src/commands/` that exports `async function execute(args: string[], opts: { env: string }): Promise<void>`.

The dispatcher:
1. Extracts the command name from `argv[2]`
2. Extracts `-e`/`--env` from remaining args (default `"development"`)
3. Dynamically imports the corresponding command module
4. Calls `execute` with remaining args and options
5. On error, prints to stderr and exits with code 1

### T10 — Create `src/commands/identity.ts`

- If identity exists: print fingerprint, label, public key path, creation date
- If identity doesn't exist: prompt label from args or use `os.userInfo().username + "@" + os.hostname()`, create identity, print fingerprint
- With `--export <path>`: export public key to file

### T11 — Create `src/commands/init.ts`

- Call `initVault(identity)`
- Print success message with instructions

### T12 — Create `src/commands/set.ts`

- Parse `KEY=VALUE` from args (first `=` is the separator — value can contain `=`)
- Call `setSecret(key, value, env, identity)`
- Print confirmation

### T13 — Create `src/commands/unset.ts`

- Parse key name from args
- Call `unsetSecret(key, env, identity)`
- Print confirmation

### T14 — Create `src/commands/list.ts`

- Call `listSecrets(env, identity)`
- Print each key name, one per line
- If empty, print a message saying no secrets in this environment

### T15 — Create `src/commands/run.ts`

- Parse the command and arguments from remaining args
- Call `getSecrets(env, identity)` to get decrypted secrets
- Spawn child process with `child_process.spawn(command, args, { stdio: 'inherit', env: { ...process.env, ...secrets } })`
- Exit with child's exit code

### T16 — Create `src/commands/export.ts`

- Call `getSecrets(env, identity)`
- Print each as `KEY=VALUE` to stdout, one per line
- Suitable for piping: `fermer export > .env`

### T17 — Create `src/commands/trust.ts`

- Parse public key file path from args
- Call `trustMember(path, identity)`
- Print the new member's fingerprint and confirmation

### T18 — Create `src/commands/revoke.ts`

- Parse fingerprint from args
- Call `revokeMember(fingerprint, identity)`
- Print confirmation that key was rotated

### T19 — Create `src/commands/members.ts`

- Call `listMembers(identity)`
- Print a table: fingerprint (first 16 chars), label, added date
- Mark the current identity with `(you)`

---

## Phase 7: Polish and Edge Cases

### T20 — Add `.gitattributes` template to `fermer init`

When `fermer init` runs, also create a `.gitattributes` entry:
```
.fermer/vault.json merge=binary
.fermer/members.json merge=binary
```

This prevents Git from trying to merge encrypted content. Print a note about this.

### T21 — Validate vault integrity on load and harden writes

In `src/vault/format.ts`, add validation when reading files:
- Check `version` field matches expected version
- Check required fields exist
- Throw descriptive errors for malformed files

Two issues found during the Phase 1–2 review also belong here:

**Durability of atomic writes.** `writeJsonAtomic` writes to a temp file
then renames. That makes a torn write invisible to readers, but POSIX
does not guarantee the data reaches disk before the rename, so a power
loss can leave a renamed-but-empty file. Open the temp file with
`openSync`, `writeSync` the contents, `fsyncSync` the descriptor, then
`closeSync` and rename. The vault is also in Git history, so this is
hardening rather than a data-loss fix.

**Misleading not-found message.** `readJson` always suggests running
`fermer init`, but if `.fermer/` already exists and only one file is
missing, `init` refuses to run. Distinguish the two cases: if `.fermer/`
is absent, suggest `fermer init`; if it exists but a file is missing,
say the vault is incomplete and name the missing file.

**Partial init leaves an unusable directory.** `initVault` writes
config, vault, and members in sequence. If it fails after the first
write, `.fermer/` exists so `init` refuses to run again, while every
other command fails because `members.json` is missing. Stage all three
files and only then move them into place, or remove a partially written
`.fermer/` when init fails.

**Unknown environments are created silently.** `setSecret` accepts any
environment name, so `fermer set X=1 -e prodution` writes a secret into a
new misspelled environment instead of failing. `config.json` already
carries the allowed list; validate against it and require an explicit
flag to add a new environment.

### T22 — Add `--json` output flag

For `list`, `members`, and `export` commands, add a `--json` flag that outputs structured JSON instead of human-readable text. Useful for scripting.

### T23 — Handle concurrent vault writes

When writing vault or members files:
1. Read the file again right before writing
2. If the content hash changed since our read, abort with a clear error asking the user to retry
3. This prevents data loss when two developers modify secrets simultaneously

### T24 — E2E test: full onboarding flow

Write `tests/e2e/onboarding.test.ts` that simulates:
1. Developer A creates identity
2. Developer A runs `fermer init`
3. Developer A sets three secrets across two environments
4. Developer A exports public key
5. Developer B creates identity
6. Developer A trusts Developer B's public key
7. Developer B can decrypt all secrets
8. Developer A revokes Developer B
9. Developer B can no longer decrypt
10. Developer A can still decrypt

Use temp directories for everything.

---

## Phase 8: Build and Distribution

### T25 — Verify `npm run build` produces working CLI

- Run `tsc`, check `dist/` output
- Run `node dist/cli.js --help` and verify output
- Run `node dist/cli.js --version` and verify it prints the version from package.json

### T26 — Add `bin` smoke test

In `tests/smoke.test.ts`:
- Build the project
- Run the built CLI with `--help` via `child_process.execSync`
- Verify exit code 0 and output contains expected text

### T27 — Add GitHub Actions CI

Create `.github/workflows/ci.yml`:
- Run on push to main and pull requests
- Node.js 20 and 22
- Steps: install, lint, test, build, smoke test

---

## Commit Convention

Use conventional commits. One commit per task. Format:

```
feat(crypto): add HKDF-SHA256 key derivation
test(crypto): verify HKDF deterministic output
feat(vault): implement secret set/get with encryption
fix(cli): handle missing identity gracefully
test(e2e): full onboarding flow with trust and revocation
```

No merge commits. Rebase if needed.
