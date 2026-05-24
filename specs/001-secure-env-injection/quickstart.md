# Fermer Quickstart

This quickstart is the final MVP validation checklist for the secure environment distribution feature.

## Validate the MVP

Run the following steps from the repository root:

```bash
npm run test:run
node apps/cli/src/index.js login <email> <password> <apiUrl>
node apps/cli/src/index.js whoami
node apps/cli/src/index.js init
node apps/cli/src/index.js link <projectId>
node apps/cli/src/index.js secrets pull <environmentId>
node apps/cli/src/index.js run <environmentId> -- node -e "console.log(process.env.MY_SECRET)"
```

## MVP Checklist

- [x] Authentication works through the CLI.
- [x] Device registration and access control are implemented.
- [x] Project creation and local linking are available.
- [x] Secret metadata can be listed and encrypted payloads can be fetched.
- [x] Secrets can be injected at runtime without writing a plaintext `.env` file by default.
- [x] Audit logs capture auth, secret, and permission changes.
- [x] The CLI provides actionable help and recovery hints.
- [x] The test suite passes.

## Notes

- If you are running the server locally, ensure `DATABASE_URL`, `JWT_ACCESS_SECRET`, and `JWT_REFRESH_SECRET` are set.
- If `fermer run` fails to decrypt local secrets, provide `FERMER_LOCAL_KEY` for AES-GCM payloads.
- Do not commit `.fermer/` or exported secret files.
