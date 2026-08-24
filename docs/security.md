# Security Model

## Threat Model

### What Fermer Protects Against

1. **Plaintext secrets in Git history** — Secrets are always encrypted at rest. Even if the repository is leaked, attackers see only AES-256-GCM ciphertext.

2. **Unauthorized access to secrets** — Only developers whose public key is in `members.json` can decrypt the project key. Adding a member requires an explicit `fermer trust` action.

3. **Compromised member** — When a member is revoked via `fermer revoke`, the project key is rotated. All secrets are re-encrypted with a new key that the revoked member never possessed. (Forward secrecy from the point of revocation.)

4. **Tampering with encrypted secrets** — AES-256-GCM provides authenticated encryption. Any modification to iv, ciphertext, or tag causes decryption to fail.

5. **Replay of old wrapped keys** — Each member's wrapped key is specific to the current project key. After rotation, old wrapped keys decrypt to a stale project key that cannot decrypt current secrets.

### What Fermer Does NOT Protect Against

1. **Compromised machine** — If an attacker has access to a developer's machine (where `~/.fermer/identity.json` lives), they can decrypt all secrets that developer has access to. This is fundamental: if the endpoint is compromised, no client-side encryption helps.

2. **Secrets in process memory** — When running `fermer run`, decrypted secrets exist in the child process environment and memory. This is inherent to how environment variable injection works.

3. **Git history after rotation** — After key rotation, old commits still contain secrets encrypted with the old project key. If the old project key was wrapped for a now-revoked member, they can still decrypt secrets from those old commits. **Secret values themselves should be rotated** (new database passwords, API keys, etc.) when revoking access.

4. **Social engineering** — Fermer cannot prevent a developer from running `fermer export` and sending plaintext secrets via chat. It reduces the incentive to do so.

## Cryptographic Primitives

| Purpose | Algorithm | Rationale |
|---------|-----------|-----------|
| Secret encryption | AES-256-GCM | NIST-approved AEAD cipher, hardware-accelerated on modern CPUs |
| Key agreement | ECDH on P-256 | NIST-approved, widely supported, 128-bit security level |
| Key derivation | HKDF-SHA256 | RFC 5869, standard KDF for deriving keys from ECDH output |
| Identity keys | EC P-256 (ECDSA) | Same curve for signing and key agreement |
| Fingerprints | SHA-256 | Standard hash of the public key PEM |

All cryptographic operations use Node.js built-in `node:crypto`, which delegates to OpenSSL.

## Key Lifecycle

### Identity Key (per developer)

- Generated once per machine via `fermer identity`
- Stored at `~/.fermer/identity.json` (file permissions: 0600 on Unix)
- Never transmitted over any network
- No expiration — the developer manages their own key

### Project Key (per project)

- Generated at `fermer init` (random 256-bit key)
- Never stored in plaintext anywhere
- Wrapped individually for each member using ECDH
- Rotated on every `fermer revoke`
- Old project keys become useless after rotation (current vault uses new key)

### Ephemeral Keys (per wrapping operation)

- A fresh EC P-256 keypair is generated each time a project key is wrapped for a member
- The ephemeral private key is used once for ECDH and then discarded
- The ephemeral public key is stored in `members.json` alongside the wrapped key
- This ensures that even if two members have the same public key (they shouldn't), their wrapped keys differ

## File Permissions

On Unix systems:
- `~/.fermer/identity.json` is created with mode `0600` (owner read/write only)
- `~/.fermer/` is created with mode `0700`, so the private key does not sit in a
  world-listable directory on a shared machine
- `.fermer/` directory contents are committed to Git — they contain no plaintext secrets

On Windows:
- `~/.fermer/identity.json` is protected by the user profile ACL
- The mode arguments are inert; no additional permission hardening is applied

## Operational Security Recommendations

1. **Rotate secrets, not just keys.** When revoking a member, change the actual secret values (database passwords, API keys) in addition to running `fermer revoke`. The cryptographic key rotation prevents future access, but the revoked member may have cached or noted secret values.

2. **Use per-environment separation.** Keep production secrets in a `production` environment. Grant only the team members who need production access.

3. **Verify a fingerprint out of band before trusting it.** `fermer trust`
   grants the holder of that key access to every secret in the project. A public
   key travelling over email or chat can be swapped in transit for the
   attacker's own, and nothing in the file itself would reveal that. Have the
   person read their fingerprint from `fermer identity` over a channel you
   trust — a call, or in person — and compare it against what `fermer trust`
   reports.

4. **Review `members.json` in PRs.** Treat changes to `.fermer/members.json` as
   security-sensitive: it is the project's access list, so a change to it is a
   permissions change. A malicious PR could add an unauthorized public key, and
   it would look like a routine diff of base64.

5. **Back up your identity.** If you lose `~/.fermer/identity.json` and no one
   re-runs `fermer trust` for you, you lose access to all projects. There is no
   recovery path by design — no server holds a copy.

6. **Let `fermer init` manage the merge strategy.** It records
   `.fermer/vault.json merge=binary` and the same for `members.json` in
   `.gitattributes`. This makes Git report a conflict instead of attempting a
   line-based merge of two ciphertexts, which would produce a file that
   decrypts to nothing. Resolve such a conflict by picking one side and
   re-applying the other's change with `fermer set` — never by hand-editing the
   ciphertext.
