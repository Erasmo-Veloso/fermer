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

# Add a team member: they export their public key, you trust it
fermer trust alice-key.pub

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

## Requirements

- Node.js >= 20
- Git

## License

MIT
