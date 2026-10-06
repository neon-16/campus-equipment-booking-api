# AI Usage Log

## Assistance used

- Inspected the empty workspace structure and identified that no starter package, routes, migrations, or tests were present.
- Designed a minimal Hono + Node SQLite architecture with a reusable `createApp(database)` function for isolated tests.
- Implemented CRUD handlers, JSON errors, parameterized SQL, ISO date validation, and shared overlap checking.
- Generated focused Vitest cases and documentation examples.

## Verification performed by the developer

- Reviewed the handler logic against the required interval rule: `new_start < existing_end AND new_end > existing_start`.
- Confirmed PATCH excludes the current booking ID from the conflict query.
- Ran `npm test`: 4 tests passed.
- Ran `npm run build`: TypeScript completed with no errors.
- Live curl checks are included in `API_CONTRACT.md` and were run separately against the local server.

Generated code was not accepted without review; SQL binding, status codes, date normalization, and update behavior were checked against the exam contract.
