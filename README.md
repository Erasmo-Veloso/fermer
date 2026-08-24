# Fermer

Git-native encrypted secrets manager. No server, no SaaS — secrets live in your repo, encrypted end-to-end.

## The Problem

Developers share `.env` files via Slack, email, or even commit them to Git. This is insecure, unauditable, and breaks when secrets change. Existing solutions (Vault, Doppler, Infisical) require deploying and maintaining infrastructure.

## The Solution

Fermer stores secrets **encrypted inside your Git repository**. Each developer has a cryptographic identity. Secrets are encrypted with a project key, and that project key is individually wrapped for each authorized developer using ECDH key agreement.

- No server to deploy or maintain
- No external service dependency
- Works offline by default
- Secrets are versioned with your code
- Zero-config for most workflows

## Quick Start

```bash
# Install (the package is fermer-cli; the command it installs is fermer)
npm install -g fermer-cli

# Create your identity (once per machine)
fermer identity

# Initialize Fermer in your project
fermer init

# Add a secret
fermer set DATABASE_URL=postgres://localhost/mydb

# Run your app with secrets injected
fermer run npm start

# Add a team member (see "Working with a Team" below)
fermer trust alice.pub

# List who has access
fermer members
```

Committing `.fermer/` is the point — it holds only ciphertext. Your private
key lives in `~/.fermer/identity.json` and never leaves your machine.

## How It Works

1. `fermer init` creates a `.fermer/` directory in your repo with an encrypted vault
2. A random AES-256 project key encrypts all secrets
3. That project key is wrapped (encrypted) for each developer using ECDH (P-256)
4. Each developer's private key stays on their machine (`~/.fermer/identity.json`)
5. `fermer run <cmd>` decrypts secrets and injects them into the process environment
6. When a member is removed, the project key is rotated and re-wrapped for remaining members

## Security Model

- **AES-256-GCM** for secret encryption (authenticated encryption)
- **ECDH on P-256** for key agreement (project key wrapping)
- **ECDSA P-256** for identity signing and verification
- Private keys never leave the developer's machine
- No plaintext secrets stored in Git, ever
- Key rotation on member revocation

## Commands

| Command | Description |
|---------|-------------|
| `fermer identity [label]` | Create or display your cryptographic identity |
| `fermer identity --export <path>` | Write your public key to a file to share |
| `fermer init` | Initialize Fermer in the current repository |
| `fermer set KEY=VALUE` | Add or update a secret |
| `fermer unset KEY` | Remove a secret |
| `fermer list` | List secret keys (values hidden) |
| `fermer run <cmd>` | Run a command with secrets injected |
| `fermer export` | Output decrypted secrets as KEY=VALUE |
| `fermer trust <key.pub>` | Authorize a developer |
| `fermer revoke <fingerprint>` | Revoke a developer and rotate keys |
| `fermer members` | List authorized developers |

Secret names must look like environment variables: letters, digits, and
underscores, not starting with a digit.

### Flags

| Flag | Description |
|------|-------------|
| `-e`, `--env <name>` | Target environment (default: `development`) |
| `--new-env` | With `set`, also add the environment to the project |
| `--json` | Machine-readable output for `list`, `members`, and `export` |

For `run`, put `-e` before the command being run, otherwise it is passed
through to that command: `fermer run -e production npm start`.

## Environments

A new project starts with `development`, `staging`, and `production`:

```bash
fermer set DATABASE_URL=postgres://prod-host/db -e production
fermer run -e production npm start
fermer list -e staging
```

An unknown environment is refused rather than created, so a typo in `-e`
cannot silently write a secret somewhere nothing will read it. Add a new
environment explicitly:

```bash
fermer set PREVIEW_URL=https://preview.example -e preview --new-env
```

## Working with a Team

### Giving someone access

Access is granted by trusting someone's **public** key. That key comes from
them — you cannot create it on their behalf, because the matching private key
must never leave their machine.

**1. They export their public key.** On their own machine, Alice runs:

```bash
fermer identity --export alice.pub
```

If she has no identity yet, this creates one and exports it in the same step.

**2. She sends you the file.** Slack, email, a chat message, an attachment —
any channel is fine. `alice.pub` is a public key: on its own it decrypts
nothing. The file that must never be shared is her `~/.fermer/identity.json`,
which holds the private key.

**3. Verify the fingerprint before trusting it.** Ask Alice to run
`fermer identity` and read you her fingerprint over a channel you trust — a
call, or in person. Then compare it with what `fermer trust` reports back.
Whoever's public key ends up in `members.json` can read every secret in the
project, so this step is what stops someone swapping the file in transit for a
key of their own.

**4. You trust the key and push.**

```bash
fermer trust ./alice.pub
git add .fermer/members.json
git commit -m "Grant Alice access"
git push
```

**5. She pulls, and she is in.**

```bash
git pull
fermer run npm start
```

The member's label comes from the file name, so `alice.pub` shows up as
`alice` in `fermer members`. Rename the file before trusting it if you want a
different label.

Because access lives in `.fermer/members.json`, a change to that file in a
pull request is a permissions change. Review it as carefully as you would
review one.

### Taking access away

```bash
fermer revoke <fingerprint>
git add .fermer/
git commit -m "Revoke Alice"
git push
```

Revoking generates a new project key, re-encrypts every secret in every
environment with it, and re-wraps it for everyone who remains. The revoked
member's wrapped key now opens a project key that no current secret uses.

**Rotate the secret values too.** Cryptographic revocation stops future
access, but it cannot un-see what someone already read: they may still have
the old database password written down, and older commits in Git history are
still encrypted with the key they held. For anything sensitive, change the
actual credential at its source — a new database password, a reissued API key
— and then `fermer set` the new value.

## Requirements

- Node.js >= 20
- Git

## License

MIT
