# Fermer Installation

This guide covers local setup for the Fermer workspace.

## Prerequisites

- Node.js 18 or newer
- npm 9+ (or another package manager compatible with the workspace)
- PostgreSQL available locally or via a hosted connection string

## Install Dependencies

From the repository root:

```bash
npm install
```

## Configure Environment

Copy the sample environment file and fill in the required values:

```bash
cp .env.example .env
```

At minimum, make sure these values are set:

- `DATABASE_URL`
- `JWT_ACCESS_SECRET`
- `JWT_REFRESH_SECRET`
- `FERMER_API_URL` for the CLI when the API is not running on the default URL

## Run the Server

```bash
npm run start --workspace=@fermer/server
```

If you are using the repository scripts directly, the server entrypoint is `apps/server/src/index.ts`.

## Run the CLI

```bash
npm run start --workspace=@fermer/cli -- --help
```

Typical first steps are:

```bash
fermer login <email> <password> <apiUrl>
fermer init
fermer link <projectId>
fermer secrets pull <environmentId>
fermer run <environmentId> -- <command> [args...]
```

## Verify the Setup

```bash
npm run test:run
```

If the suite passes, the workspace is ready for the next implementation phase.
