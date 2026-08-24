# Testing — Q0-Application-Service

_Last verified: 2026-08-07 (kb-builder)_ · Back to [AGENTS.md](../AGENTS.md) · See also [architecture.md](architecture.md) · [conventions-and-workflows.md](conventions-and-workflows.md)

## Framework & version

Jest `^30.4.2` + `ts-jest ^29.4.12`. Config: `jest.config.js` (repo root):

```js
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testMatch: ['**/?(*.)+(spec|test).ts'],
  testPathIgnorePatterns: ['/node_modules/', '/build/', '/dist/'],
  setupFilesAfterEnv: ['<rootDir>/unit_testing/jest.setup.ts'],
  collectCoverage: true,
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov'],
  coveragePathIgnorePatterns: ['/node_modules/', '/build/', '/unit_testing/'],
  transform: {
    '^.+\\.ts$': ['ts-jest', { tsconfig: 'tsconfig.json', diagnostics: false, isolatedModules: true }],
  },
  moduleFileExtensions: ['ts', 'js', 'json'],
  testTimeout: 15000,
  forceExit: true,
};
```
Note `diagnostics: false` and `isolatedModules: true` — type errors inside a test file do **not** fail the test run; only actual runtime failures do.

## Where tests live

Flat in `unit_testing/` at the repo root (not colocated with `src/`), one file per subject, named `<subject>.test.ts` — e.g. `auditLogController.test.ts`, `baseService.test.ts`, `guardrailsService.test.ts`, `authMiddleware.test.ts`, `utils.jwt.test.ts`, `utils.ssrfValidator.test.ts`. 31 test files exist, covering a mix of controllers, services, and standalone utils — not exhaustive across all ~90 controllers/services (most feature services/controllers have no test file at all; treat test coverage as partial, concentrated on the areas listed above).

## Mocking strategy

`unit_testing/jest.setup.ts` (loaded via `setupFilesAfterEnv` for **every** test file, no opt-out) globally mocks both database entry points so no test can accidentally open a real Postgres connection:

```ts
jest.mock('../src/database/database', () => ({
    __esModule: true,
    default: {
        getInstance: jest.fn().mockReturnValue({
            connectToDB: jest.fn().mockResolvedValue(undefined),
            executeExternalQuery: jest.fn().mockResolvedValue([]),
        }),
    },
}));

jest.mock('../src/database/data-source', () => ({
    getPostgresConnection: jest.fn().mockReturnValue({
        initialize: jest.fn().mockResolvedValue(undefined),
        manager: { query: jest.fn().mockResolvedValue([]) },
    }),
}));

import 'reflect-metadata'; // required for TypeORM decorators to parse at all
```
Individual test files then mock the specific entity (`jest.mock('../src/entities/xEntity')`) or service dependency they need, per-file — there is no shared factory/fixture library; each test file builds its own mock data inline. `reflect-metadata` is imported once here because TypeORM's decorators (`@Entity`, `@Column`, etc.) require it at parse time even under mocks.

## Running tests

```bash
npm test              # jest --forceExit — full suite, coverage collected
npm run test:watch    # jest --watchAll
npm run test:coverage # jest --coverage --forceExit
```
`forceExit: true` is set in both the config and the `test`/`test:coverage` scripts — a sign that something in the boot path (likely an open Kafka/DB handle from an incompletely-mocked import chain) doesn't close cleanly on its own; don't be alarmed if a test file leaves something open, that's already expected and handled.

**Not run in CI** — `.github/workflows/App-svc-Dev-Pipeline.yml` never invokes `npm test`; running it is on the developer before pushing (see [conventions-and-workflows.md](conventions-and-workflows.md#9-ci-pipeline)).

## Adding a new test in house style

1. Create `unit_testing/<subject>.test.ts` (matches `testMatch`; `.spec.ts` also works but every existing file uses `.test.ts` — follow that).
2. Don't add your own DB mock — `jest.setup.ts` already neutralizes `database.ts`/`data-source.ts` globally. Mock only the specific entity/service your subject under test depends on, inline in the test file (this is the pattern every existing test follows — no shared mock factory to reuse).
3. If testing a controller, mock its injected `service` and assert on `res.status`/`res.send` calls (or the `GenericResponse` shape) rather than hitting real business logic — check `baseController.test.ts` for the shape to follow.
4. If testing a service extending `BaseServices`, mock `this.entity`'s static methods (`find`, `findOneBy`, `createQueryBuilder`, etc.) — check `baseService.test.ts` for the closest existing example.
5. Run `npm test -- <subject>` (Jest's file-name filter) while iterating, full `npm test` before opening a PR.
