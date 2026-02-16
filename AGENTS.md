# Repository Guidelines

## Project Structure & Module Organization
- `src/server.ts` is the entry point for the API server.
- `src/routes/` wires HTTP routes; `src/controllers/` contains request handlers.
- `src/services/` holds Tuya device integration logic.
- `src/views/` contains dashboard HTML/CSS/JS templates (placeholders like `{{DASHBOARD_CSS}}` are expected).
- `tests/` includes Deno tests such as `tests/server_test.ts`.
- `image/` stores static assets used in the README or UI.

## Build, Test, and Development Commands
- `deno task dev`: run the API server in watch mode for local development.
- `deno task start`: run the API server once (no file watching).
- `deno task test`: execute the Deno test suite.
- `deno task lint`: run `deno lint` to check code quality.
- `deno task format`: run `deno fmt` to apply formatting.

## Coding Style & Naming Conventions
- Formatting uses `deno fmt` defaults (2-space indentation; avoid single quotes in JS unless needed).
- Linting uses `deno lint` (avoid browser-only globals like `window`; use `globalThis`).
- Use `camelCase` for variables/functions and `PascalCase` for types/classes.
- Keep filenames and routes lowercase and descriptive (example: `smartplug.ts`).
- In template files, preserve any existing `deno-fmt-ignore` directives.

## Testing Guidelines
- Framework: Deno built-in test runner.
- Place tests in `tests/` and name them `*_test.ts` (example: `server_test.ts`).
- Run `deno task test` before submitting changes.

## Commit & Pull Request Guidelines
- Commit messages follow Conventional Commits (examples: `feat: add smartplug endpoint`, `chore: update deps`).
- PRs should include a short summary, rationale, and testing results (command + output summary).
- Provide screenshots for dashboard/UI changes and link related issues when applicable.

## Security & Configuration Tips
- Copy `.env.example` to `.env` and set Tuya credentials.
- If `TUYA_API_KEY` is set, all `/api/*` endpoints require the `x-api-key` header.
- Dashboard access can be bootstrapped with `?key=YOUR_KEY` once to seed a session key.
