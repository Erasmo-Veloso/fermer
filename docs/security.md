# Fermer Security

Fermer is designed to keep plaintext secrets out of source control and out of the default runtime path.

## Security Goals

- Secrets are stored on the server as encrypted payloads, not plaintext values.
- The CLI loads secrets locally only when a command explicitly asks for them.
- Secret injection happens in-process at runtime instead of generating `.env` files by default.
- Audit logs capture authentication, permission, and secret access events.

## Threat Model

The main risks we care about are:

- Accidental secret exposure through logs or debug output
- Unauthorized access to project secrets
- Stale or corrupted local caches being reused silently
- Destructive actions that remove local project state without user intent

## Defensive Measures

- The CLI prints recovery hints instead of raw stack traces for common user errors.
- `fermer unlink` asks for confirmation before removing local project state.
- Secrets are fetched through authenticated API calls and validated before use.
- The CLI runtime injection path uses explicit environment merging at process launch.
- Local secret payloads support AES-GCM decryption when a local key is provided.

## Current Limitations

- The local secret cache is not yet tied to an OS keyring.
- Device-wrapped key management is still a future enhancement.
- The current implementation assumes trusted local execution of the CLI.
- Audit logging is best-effort and does not block the request path if logging fails.

## Operational Guidance

- Do not commit `.fermer/` or any exported secret files.
- Use short-lived tokens where possible.
- Rotate secrets regularly and remove unused project members promptly.
- If a local secrets file is corrupted, delete it and fetch it again from the server.
