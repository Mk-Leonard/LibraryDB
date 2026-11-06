# Project Instructions

## Project Structure
- `server/` contains the TypeScript Express API and SQL Server integration.
- `server/src/server.ts` defines the API routes; `server/src/test.ts` is an interactive CLI client for exercising them.
- `client/` is currently empty. Do not assume a frontend framework or add one without a task requiring it.

## Development Commands
Run these from `server/`:
- `npm run dev` starts the API with `tsx` watch mode.
- `npm run build` compiles TypeScript into `server/dist/`.
- `npm start` runs the compiled API.
- `npm run test:cli` starts the interactive CLI client; the API and configured SQL Server must be available for end-to-end use.

## Conventions
- Keep API route behavior and SQL Server operations in the server's existing TypeScript stack unless a task calls for a structural change.
- Use parameterized SQL inputs for values; do not interpolate user-provided values into SQL statements.
- Keep credentials and other secrets out of source control. Read configuration from environment variables when changing database configuration.
- Preserve the existing `/api` route prefix and response JSON conventions when extending the API.
- No automated test suite is currently configured; run the TypeScript build after server changes and use the CLI for manual API checks when appropriate.