# Repository Guidelines

## Project Structure & Module Organization
- `src/server.ts` is the API server entry point.
- `src/routes/` defines HTTP routes and maps them to handlers.
- `src/controllers/` contains request handlers and response shaping.
- `src/services/` holds Tuya device integration logic.
- `src/views/` includes dashboard HTML/CSS/JS templates (placeholders such as `{{DASHBOARD_CSS}}` are expected).
- `tests/` contains Deno tests (example: `tests/server_test.ts`).
- `image/` stores static assets used by the README or UI.

## Build, Test, and Development Commands
- `deno task dev`: run the API server in watch mode for local development.
- `deno task start`: run the API server once (no watch mode).
- `deno task test`: execute the Deno test suite.
- `deno task lint`: run `deno lint` for code quality checks.
- `deno task format`: apply `deno fmt` formatting.

## Coding Style & Naming Conventions
- Formatting uses `deno fmt` defaults (2-space indentation; prefer double quotes in JS/TS).
- Linting uses `deno lint` (avoid browser-only globals like `window`; use `globalThis`).
- Use `camelCase` for variables/functions and `PascalCase` for types/classes.
- Keep filenames and routes lowercase and descriptive (example: `smartplug.ts`).
- In template files, preserve any existing `deno-fmt-ignore` directives.

## Testing Guidelines
- Framework: Deno built-in test runner.
- Place tests under `tests/` and name them `*_test.ts` (example: `server_test.ts`).
- Run `deno task test` before submitting changes.

## Commit & Pull Request Guidelines
- Commit messages follow Conventional Commits (examples: `feat: add smartplug endpoint`, `chore: update deps`).
- PRs should include a short summary of changes and rationale.
- PRs should include testing results (command + output summary).
- Provide screenshots for dashboard/UI changes.
- Link related issues when applicable.

## Security & Configuration Tips
- Copy `.env.example` to `.env` and set Tuya credentials before running locally.
- If `TUYA_API_KEY` is set, all `/api/*` endpoints require the `x-api-key` header.
- Dashboard access can be bootstrapped with `?key=YOUR_KEY` once to seed a session key.
