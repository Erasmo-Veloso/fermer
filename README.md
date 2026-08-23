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
# Install
npm install -g fermer

# Create your identity (once per machine)
fermer identity

# Initialize Fermer in your project
fermer init

# Add a secret
fermer set DATABASE_URL=postgres://localhost/mydb

# Run your app with secrets injected
fermer run npm start

# Add a team member
fermer trust alice-key.pub

# List who has access
fermer members
```

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
| `fermer identity` | Create or display your cryptographic identity |
| `fermer init` | Initialize Fermer in the current repository |
| `fermer set KEY=VALUE` | Add or update a secret |
| `fermer unset KEY` | Remove a secret |
| `fermer list` | List secret keys (values hidden) |
| `fermer run <cmd>` | Run a command with secrets injected |
| `fermer export` | Output decrypted secrets as KEY=VALUE |
| `fermer trust <key.pub>` | Authorize a developer |
| `fermer revoke <fingerprint>` | Revoke a developer and rotate keys |
| `fermer members` | List authorized developers |

## Environments

Fermer supports multiple environments (development, staging, production):

```bash
fermer set DATABASE_URL=postgres://prod-host/db -e production
fermer run -e production npm start
fermer list -e staging
```

The default environment is `development`.

## Requirements

- Node.js >= 20
- Git

## License

MIT
