# Fermer CLI Usage

Fermer is a CLI-first workflow for linking a repository to a project, syncing encrypted secrets, and running commands with secrets injected into the process environment.

## Authentication

```bash
fermer login user@example.com password http://localhost:3000
fermer whoami
fermer logout
```

## Project Setup

```bash
fermer init
fermer link <projectId>
fermer unlink
```

`fermer unlink` asks for confirmation before removing `.fermer/config.json`.

## Secrets

```bash
fermer secrets list development
fermer secrets pull development
fermer secrets sync development
```

## Runtime Injection

```bash
fermer run development -- node app.js
```

The `run` command loads the local secrets cache for the environment, merges the injected variables, and streams stdout/stderr from the spawned process.
