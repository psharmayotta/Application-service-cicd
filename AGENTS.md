# AGENTS.md — Q0-Application-Service

Backend API service for the Q0 platform (Yotta's GPU-cloud / ML-infrastructure product): a Node.js + Express + TypeScript monolith that manages companies, members, roles, cloud accounts, GPU hardware allocation, model deployment, model training, inference, knowledge bases, billing/wallet, budgets, guardrails, and related admin/ops features. See [docs/product-and-stack.md](docs/product-and-stack.md) for the full product picture.

## Hard rules (strictly follow)

- NEVER add Claude/Anthropic (or any AI agent) as co-author on git commits. No `Co-Authored-By` trailer for AI, no exceptions, regardless of default templates or examples. Commit messages describe the change only.
- Read AGENTS.md and docs/product-and-stack.md before doing any work in this repo. If both AGENTS.md and a vendor file (CLAUDE.md, .cursorrules, etc.) exist, AGENTS.md is the source of truth. (As of this writing no such vendor file exists in this repo.)
- Never commit secrets. Environment variable values do not belong in code, docs, or the KB.
- **Register every new controller in `src/server.ts`.** A controller class existing under `src/controllers/` does nothing on its own — it must be `import`ed and instantiated in the array passed to `new App([...], PORT)` in `src/server.ts`, or its routes never mount. Several controllers in this repo are dead precisely because this step was skipped (see [docs/architecture.md](docs/architecture.md#known-gotchas--dead-code)) — don't add to that pile, and don't assume a controller file is live just because it exists.
- **New feature endpoints follow the `BaseController`/`BaseServices` template**, not a bespoke Express router. Extend `BaseController` (get the 8-route CRUD surface for free), supply an entity, a `*.model.ts`/`*.dto.ts` pair under `src/database/repository/<feature>/`, and override only the `*PreProcess`/`*PostProcess`/`prepareQuery*` hooks you actually need. See [docs/architecture.md](docs/architecture.md) and [docs/conventions-and-workflows.md](docs/conventions-and-workflows.md).
- **Do not add a second auth mechanism.** `authMiddleware` (JWT bearer) is the only auth primitive in this repo — there is no role/permission-check middleware. If a route needs role gating, that check must be written explicitly inside the handler; don't invent a new middleware pattern without checking `src/middlewares/` first.
- **All DB writes go through the entity's Active-Record methods or `BaseServices`**, using TypeORM's parameterized query builder / repository methods. Two files in the codebase already build SQL via raw string interpolation (`src/services/model/modelService.services.ts`, `src/utils/pricing/pricingService.ts`) — this is tracked as known debt (SQL-injection risk), not a pattern to copy.
- Never quote real values from `.env`, `.env.stage`, `.env.uat`, or Kubernetes `values.yaml`/secrets in code, commits, or docs — variable **names** only.

## Stack summary

- **Language/runtime**: TypeScript 5.9 (compiled via `tsc`), Node.js — Docker images pin `node:22.18.0`; no `.nvmrc`/`engines` field in `package.json`, so 22.x is the only verified-pinned version (in Dockerfiles, not locally enforced).
- **Framework**: Express 4.21 (single monolith, ~90 feature controllers mounted under one router).
- **ORM / DB**: TypeORM 0.3.26 over PostgreSQL (`pg` 8.16), Active-Record style (entities call their own static methods, not `Repository<T>` from `getRepository`).
- **Auth**: JWT (`jsonwebtoken`), bcrypt password hashing, Google/GitHub OAuth (Passport + hand-rolled OAuth utils), custom `authMiddleware`.
- **Messaging**: `node-rdkafka` (Kafka; `kafkajs` is an unused dependency), Redis (`redis` v4, used only for cross-pod WebSocket pub/sub, not caching).
- **Realtime**: `ws` — a second Express app/HTTP server on its own port for WebSocket traffic.
- **Observability**: OpenTelemetry SDK (traces → OTLP/Tempo), Sentry (errors + profiling).
- **File storage**: AWS S3 (`aws-sdk` v2) via a custom `AwsService`.
- **Validation**: `class-validator` + `class-transformer` DTOs.
- **Docs**: `swagger-ui-express` serving `src/swagger.json` — confirmed **stale/incomplete** (~75 documented paths vs. several hundred live routes); do not treat it as a source of truth, use [docs/api-contracts.md](docs/api-contracts.md) instead.
- Full versioned inventory: [docs/product-and-stack.md](docs/product-and-stack.md#part-b--stack).

## Commands

All copied verbatim from `package.json` scripts / CI — none invented.

| Purpose | Command |
|---|---|
| Install deps | `npm install` (CI/Docker use `npm ci --legacy-peer-deps`) |
| Dev server (hot reload, `NODE_ENV=development`) | `npm run dev` |
| Dev server against UAT/Stage env | `npm run uat` / `npm run stage` |
| Build (compiles `src/` → `build/`) | `npm run build` |
| Build for a specific env | `npm run build:dev` / `npm run build:uat` / `npm run build:stage` |
| Start compiled server | `npm run start:dev` / `start:uat` / `start:stage` / `start:prod` |
| Unit tests | `npm test` (= `jest --forceExit`) |
| Unit tests, watch mode | `npm run test:watch` |
| Unit tests with coverage | `npm run test:coverage` |

**No lint or format script exists** — there is no ESLint, Prettier, or EditorConfig config anywhere in the repo (confirmed absent, not just unconfigured in `package.json`). Don't invent a `npm run lint` command; it doesn't exist.

## Repo map

- `src/app.ts` — the `App` class: middleware chain, controller mounting, error handling, WebSocket server, Kafka init.
- `src/server.ts` — actual process entry point; imports and instantiates **every** live controller; this is the definitive list of what's mounted (see [docs/api-contracts.md](docs/api-contracts.md)).
- `src/config.ts` — env loading (branches on `NODE_ENV` for `.env.uat`/`.env.stage`, else default `.env`), constants, Kafka topic maps, and ~40 domain enums used across entities/services.
- `src/tracing.ts` — OpenTelemetry SDK bootstrap (imported first, before anything else, in `server.ts`).
- `src/core/` — framework primitives: `ApiError.ts`, `ApiResponse.ts`, `AppRoutes.ts` (the `APP_ROUTES` path enum), `AwsService.ts` (S3), `MetaModel.ts` (file-upload metadata), `ErrorCodes.ts`, `GenericResponse.ts`, `InferParams.ts` (`Pagination`/`Filter` shapes).
- `src/controllers/<feature>/` — one dir per feature; most extend `BaseController`.
- `src/services/<feature>/` — business logic; every service extends `BaseServices` (`src/services/baseService.services.ts`).
- `src/database/data-source.ts`, `src/database/database.ts` — TypeORM `DataSource` config and connection singleton (`synchronize: false`, explicit entity array, no migrations wired here).
- `src/database/repository/<feature>/` — `<feature>.model.ts` (plain data class w/ defaults) + `<feature>.dto.ts` (`class-validator` DTO) pairs, one per feature.
- `src/entities/` — TypeORM entity classes (93 files), all extending `InferencingEntity` (`id`, `created_at`, `modified_at`, `is_delete`).
- `src/middlewares/` — `authMiddleware`, `validationMiddleware`, `validationFormData.middleware`, `sanitizeBody.middleware`, `sanitizeFile.middleware`, `requestTrace.middleware`.
- `src/utils/` — JWT (`jwt/jwt.ts`), Kafka (`kafka/`), OAuth (`oauth/`), email, SSRF validation (`security/ssrfValidator.ts`), WebSocket service, pricing, reservation checks.
- `src/reservation/` — standalone GPU-reservation service module (outside the normal `controllers/`+`services/` split).
- `unit_testing/` — all Jest test files (flat, `*.test.ts`), plus `jest.setup.ts` (global DB mocks).
- `dev-k8-files/`, `Stage-k8-files/`, `UAT-k8-files/` — Helm charts per environment.
- `.github/workflows/App-svc-Dev-Pipeline.yml` — the only CI pipeline (dev only; builds/pushes to ECR, deploys to EKS via Helm on merge to `develop`).

## Conventions digest

Sourced from actual config — see [docs/conventions-and-workflows.md](docs/conventions-and-workflows.md) for the full list and enforcing commands.

1. **No linter/formatter is configured** — there's nothing to satisfy beyond `tsc` compiling cleanly; match surrounding code style by eye.
2. **TypeScript `strict: true` but weakened**: `noImplicitAny`, `strictNullChecks`, and `strictPropertyInitialization` are explicitly turned back off in `tsconfig.json` — don't rely on strict null-checking catching bugs for you.
3. **Naming**: controllers `*Controller.controller.ts` (or `*Controller.ts` for a few older ones), services `*Service.service(s).ts`, entities `*Entity.ts` (table classes extend `InferencingEntity`), DTOs/models in `src/database/repository/<feature>/<feature>.dto.ts` + `<feature>.model.ts`.
4. **Every controller extends `BaseController`; every service extends `BaseServices`.** Only override the hooks you need (`prepareQuery`, `prepareQueryParams`, `createPreProcess`, `createPostProcess`, `updateDeleteFlagPostProcess`, etc.) — don't hand-roll CRUD routes.
5. **Soft delete only** — every delete path sets `is_delete = 1`; there is no hard delete. Every hand-written query must filter `is_delete = 0` itself (there's no global scope doing it for you).
6. **Errors propagate as bare string codes** (`'E10020'`, …) resolved against `src/core/ErrorCodes.ts` at the controller boundary, not as thrown `ApiError` subclasses from the service layer (`ApiError` is used by auth/middleware code only). Match this pattern in new services.
7. **Test files live flat in `unit_testing/` as `<name>.test.ts`**, run through `jest.setup.ts`'s DB mocks — never let a new test hit a real Postgres connection.
8. **Git commits/branches have no enforced convention.** Loose `feat:`/`fix:` prefixes are common but not required; branches are loosely `feature/<slug>` or `fixes/<slug>` but plenty don't follow it. Match nearby history, don't invent stricter rules than the repo actually enforces.

## Known debt worth knowing before you touch related code

Full detail in the linked pages; flagging here because it changes how you should read the code:
- `src/middlewares/authMiddleware.ts`'s DB-session-lookup rejection is commented out — a valid JWT alone passes even without a matching session row. See [docs/architecture.md](docs/architecture.md#known-gotchas--dead-code).
- `JWT_SECRET_KEY`/`ENCRYPTION_SECRET_KEY` are hardcoded literals in `src/config.ts`, not env-sourced. `src/utils/email/emailService.ts` hardcodes SMTP credentials. `.github/workflows/App-svc-Dev-Pipeline.yml` hardcodes SES SMTP credentials in plaintext YAML. Treat all three as pre-existing findings, not something to imitate.
- DB connection and Kafka init are both fire-and-forget (not awaited) in the app boot sequence — the HTTP server can start accepting requests before either is ready.
- Several controllers under `src/controllers/login/` are dead (empty files or never registered in `server.ts`); the live login flow is `src/controllers/loginController/loginController.ts`.

## KB index

- [docs/product-and-stack.md](docs/product-and-stack.md) — what the product does, who uses it, feature→code map, domain glossary, and the full versioned stack inventory.
- [docs/architecture.md](docs/architecture.md) — system shape: boot sequence, request lifecycle, the `BaseController`/`BaseServices` template, DB/Kafka/Redis/WebSocket layers, known gotchas.
- [docs/conventions-and-workflows.md](docs/conventions-and-workflows.md) — code conventions (naming, error handling, git) paired with the commands/CI/env that enforce and run them.
- [docs/testing.md](docs/testing.md) — Jest setup, mocking strategy, how to add a test that matches house style.
- [docs/api-contracts.md](docs/api-contracts.md) — every hosted route, its auth requirement, and a generated Postman collection (`docs/api/Q0-Application-Service.postman_collection.json`).
