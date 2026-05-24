# Contributing to Fermer

Fermer is a strict, CLI-first monorepo. Keep changes focused and prefer small, testable increments.

## Branch and Commit Style

- Work on a feature branch.
- Keep commit messages short and descriptive.
- Group related documentation and code changes together when possible.

## Code Conventions

- Use TypeScript for shared packages and server code.
- Use CommonJS shims where the runtime entrypoint requires them.
- Prefer small helper functions over large inline blocks.
- Keep error messages actionable and avoid exposing secrets.
- Preserve existing formatting and avoid unrelated reformatting.

## Testing Expectations

- Run `npx tsc -p tsconfig.base.json --noEmit` before committing code changes.
- Run `npm run test:run` after touching the CLI, server, or shared packages.
- Add focused tests for new commands, routes, and runtime behavior.

## Documentation Expectations

- Update `docs/` when the user-visible workflow changes.
- Keep installation and usage docs in sync with the actual commands.
- Document new security assumptions and current limitations clearly.

## Pull Request Checklist

- The code compiles cleanly.
- Tests pass locally.
- New behavior is documented.
- Any destructive action has a confirmation or a clear recovery path.
