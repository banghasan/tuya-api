# Repository Guidelines

## Project Structure & Module Organization
- `src/server.ts` is the entry point.
- `src/routes/` contains route wiring; `src/controllers/` holds request handlers.
- `src/services/` contains Tuya device integration logic.
- `src/views/` holds HTML/CSS/JS templates for the dashboard (note: HTML templates include placeholders like `{{DASHBOARD_CSS}}`).
- `tests/` contains Deno tests (e.g., `tests/server_test.ts`).
- `image/` stores static assets used in the README/UI.

## Build, Test, and Development Commands
- `deno task dev`: run the API server with watch mode.
- `deno task start`: run the API server once.
- `deno task test`: execute the Deno test suite.
- `deno task lint`: run `deno lint` for code quality checks.
- `deno task format`: run `deno fmt` for formatting.

## Coding Style & Naming Conventions
- Formatting follows `deno fmt` defaults (2-space indentation, single quotes avoided in JS unless needed).
- Linting uses `deno lint` (avoid browser-only globals like `window`; prefer `globalThis`).
- Use `camelCase` for variables/functions and `PascalCase` for types/classes.
- Keep route names and file names descriptive and lowercase (e.g., `smartplug.ts`).
- For template files with placeholders, keep existing `deno-fmt-ignore` directives.

## Testing Guidelines
- Framework: Deno built-in test runner.
- Place tests in `tests/` and name files `*_test.ts` (example: `server_test.ts`).
- Run tests with `deno task test` before opening a PR.

## Commit & Pull Request Guidelines
- Commit messages follow Conventional Commits (e.g., `feat: add smartplug endpoint`, `chore: update deps`, `refactor: simplify controller`).
- PRs should include:
  - A short summary and rationale.
  - Testing results (command + output summary).
  - Screenshots for dashboard/UI changes.
  - Linked issues when applicable.

## Security & Configuration Tips
- Copy `.env.example` to `.env` and configure device credentials.
- If `TUYA_API_KEY` is set, all `/api/*` endpoints require header `x-api-key`.
- Dashboard access can use `?key=YOUR_KEY` once to seed the session key.
