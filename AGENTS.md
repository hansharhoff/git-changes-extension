# AGENTS

Guidance for AI coding agents working in this repository.

## Scope

- This repository is a VS Code extension written in TypeScript.
- Core code: [src/extension.ts](src/extension.ts)
- Tests: [src/test/extension.test.ts](src/test/extension.test.ts)
- User-facing docs: [README.md](README.md), [CHANGELOG.md](CHANGELOG.md)

## Working Style

- Default to autopilot execution: implement the requested change end-to-end without unnecessary pauses.
- If a requirement is ambiguous, ask concise clarifying questions and provide concrete options.
- Keep changes focused and minimal; avoid unrelated refactors.
- Preserve existing behavior unless the task explicitly changes it.

## Quality Gates (Required)

After code changes, run these checks before finishing:

1. `npm run check-types`
2. `npm run lint`
3. `npm test`

If tests are slow during iteration, partial checks are allowed while developing, but all three commands must pass before handoff.

## Build And Packaging Commands

- Dev compile: `npm run compile`
- Watch mode: `npm run watch`
- Production package build: `npm run package`
- Generate installable VSIX: `npx @vscode/vsce package`

## Branching And Git Policy

- Never develop new features directly on `main`.
- Use feature branches (for example: `feature/<short-name>`, `fix/<short-name>`).
- Commit with clear, scoped messages.
- Push branches and open PRs for review before merge.

## Testing Expectations

- Add or update tests for behavioral changes.
- Prefer targeted unit tests for helper logic in [src/test/extension.test.ts](src/test/extension.test.ts).
- For git edge cases, cover fallback behavior and error handling.

## Linting Expectations

- Keep ESLint and TypeScript clean.
- Avoid suppressing lint/type errors unless unavoidable and justified inline.

## Documentation Expectations

- When changing behavior, update [README.md](README.md) and [CHANGELOG.md](CHANGELOG.md) as needed.
- Keep docs concise and accurate to shipped behavior.
