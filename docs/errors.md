# Fermer Error Handling

Fermer tries to keep CLI errors actionable. When a command fails, the CLI prints the error message plus a short recovery hint when it can infer one.

## Common Errors

- `Invalid API URL`: pass a full URL such as `http://localhost:3000`.
- `Not authenticated. Run fermer login.`: sign in again before retrying.
- `Invalid or expired access token`: run `fermer login` to refresh the local session.
- `No project linked. Run fermer link <projectId>.`: initialize the repo with `fermer init`, then link it.
- `No local secrets file found for environment ...`: run `fermer secrets pull <environmentId>` before `fermer run`.
- `Unsupported encryptedValue format`: ensure the cache was created by `fermer secrets pull` or set `FERMER_LOCAL_KEY` for AES-GCM payloads.

## Recovery Patterns

1. Re-run `fermer login` when authentication-related errors appear.
2. Re-run `fermer init` and `fermer link <projectId>` when the repository is not linked.
3. Re-run `fermer secrets pull <environmentId>` when the local secrets cache is missing or stale.
4. Remove corrupted local cache files under `.fermer/` and fetch them again.
