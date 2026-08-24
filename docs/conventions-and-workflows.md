# Conventions & Workflows — Q0-Application-Service

The rules your code must satisfy, paired with the commands that run/check it.

_Last verified: 2026-08-07 (kb-builder)_ · Back to [AGENTS.md](../AGENTS.md) · See also [architecture.md](architecture.md) · [testing.md](testing.md)

## Table of contents

- [Part A — Conventions](#part-a--conventions)
  1. [Enforced tooling rules](#1-enforced-tooling-rules)
  2. [Naming & directory conventions](#2-naming--directory-conventions)
  3. [Code patterns](#3-code-patterns)
  4. [Git conventions](#4-git-conventions)
- [Part B — Workflows](#part-b--workflows)
  5. [Environment setup](#5-environment-setup)
  6. [Canonical dev loop](#6-canonical-dev-loop)
  7. [All commands](#7-all-commands)
  8. [Environment variables](#8-environment-variables)
  9. [CI pipeline](#9-ci-pipeline)
  10. [Release process](#10-release-process)

---

## Part A — Conventions

### 1. Enforced tooling rules

**There is no ESLint, Prettier, Biome, or `.editorconfig` anywhere in this repo** — confirmed absent by direct search, not just missing from `package.json` scripts. `.dockerignore` lists `.eslintrc`/`.prettierrc`/`yarn.lock` as ignore patterns, but none of those files actually exist — leftover from a template, not evidence of prior tooling. There is nothing to run and nothing that gates a PR on style.

The one real compiler gate is **`tsconfig.json`** (enforced by `npm run build` / `tsc`):

```json
"target": "es2016",
"module": "commonjs",
"experimentalDecorators": true,
"strict": true,
"noImplicitAny": false,
"strictNullChecks": false,
"strictPropertyInitialization": false,
"skipLibCheck": true,
"resolveJsonModule": true,
"esModuleInterop": true,
"forceConsistentCasingInFileNames": true
```
`strict: true` is set but then individually weakened — `any` and `null`/`undefined` are **not** caught by the compiler despite `strict: true` appearing in the config. Don't rely on `tsc` to catch null-safety bugs; it won't. No `baseUrl`/`paths` aliases are configured — all imports are relative.

Since nothing else is enforced, **match the surrounding file's style by eye** (indentation, quote style, semicolons all vary file-to-file in this codebase — there is no single house style to point to beyond "look like the file you're editing").

### 2. Naming & directory conventions

Observed directly from the repo (README/FileStructure.md state an idealized version; this is what's actually there):

- **Controllers**: `src/controllers/<feature>/<feature>Controller.controller.ts`, class `FeatureController extends BaseController` (a handful of older files use `<feature>Controller.ts` without the `.controller` suffix, e.g. `loginController.ts`, `logoutController.ts`).
- **Services**: `src/services/<feature>/<feature>Service.service(s).ts` (both `.service.ts` and `.services.ts` occur — not standardized), class `FeatureService extends BaseServices`.
- **Entities**: `src/entities/<feature>Entity.ts`, class `FeatureEntity extends InferencingEntity` (a few omit the `Entity` suffix or the camel-case, e.g. `podDetails.ts`, `hardwareUtilization.ts` — inconsistent but rare).
- **Model/DTO pairs**: `src/database/repository/<feature>/<feature>.model.ts` (plain class, field defaults, the shape `BaseServices` persists) + `<feature>.dto.ts` (`class-validator`-decorated, the shape `validationFDMiddleware`/`validationMiddleware` validate against). These are two independently maintained classes per feature — keep them in sync by hand when adding a field.
- **Middleware**: `src/middlewares/<name>.middleware.ts` (or `<name>Middleware.ts` for `authMiddleware.ts`), default export, one file per cross-cutting concern.
- **Tests**: flat in `unit_testing/`, named `<subject>.test.ts` (see [testing.md](testing.md)) — not colocated with source.
- **One subdirectory per feature** under `controllers/`, `services/`, and `database/repository/` — even single-file features get their own folder, matching FileStructure.md's stated convention.

### 3. Code patterns

Grounded in what the service layer actually does (not aspirational — see [architecture.md](architecture.md) for the full `BaseController`/`BaseServices` template):

- **Extend the base classes, override only what differs.** A new feature's controller/service should be the smallest possible diff from `BaseController`/`BaseServices` — override `prepareQuery`/`prepareQueryParams` for filtering, `createPreProcess`/`createPostProcess` for side effects (audit logging, Kafka publish), not by writing parallel CRUD logic.
- **Soft delete, never hard delete.** Every delete path sets `is_delete = 1`. Any hand-written `WHERE` clause must add `is_delete = 0` itself.
- **Reject with a bare `ErrorCodes` string key from services**, not a thrown `ApiError`. `ApiError` (`src/core/ApiError.ts`) is for auth/middleware code and the global handler only. New service methods should `return Promise.reject('E10XXX')` (adding a new code to `src/core/ErrorCodes.ts` if none fits) and let `BaseController.handleError()` resolve it.
- **Signed URLs**: for any image/file field, use `this.generateSignedUrl(folder, id, filename)` (defined once on `BaseServices`) rather than re-implementing the "already-a-URL vs needs-signing" check — it's currently duplicated by hand across services, but new code shouldn't add another copy.
- **`hashId` convention**: list/detail responses commonly attach `hashId: CryptoJS.MD5(String(id)).toString()` as an obfuscated public identifier. Follow it if a feature is meant to avoid exposing raw sequential IDs; it is not centralized, so add it the same way existing services do (in `createPostProcess`/`getAll` transforms).
- **Kafka payloads get enriched automatically** — don't add `is_enterprise`/`is_reserved` fields by hand when publishing via `KafkaService.sendMessage()`; it does it for you.
- **File uploads ride the base CRUD pipeline** — declare a `MetaModel` (`fileKey`, `allowedSize`, `allowedExtensions`, `colName`, `require`) and pass it from `getMetaModel()`; `validationFDMiddleware`/`sanitizeFile` and `BaseServices.createRecord()`'s `uploadFiles` step handle the rest.
- **Anti-patterns present in the code, not to be copied into new work**: raw SQL built by string interpolation (`modelService.services.ts`, `pricingService.ts` — use parameterized `executeExternalQuery(sql, params)` or the query builder instead); hardcoded credentials checked into source in a few places (see [architecture.md](architecture.md#known-gotchas--dead-code)) — use env vars/secrets management instead.

### 4. Git conventions

From `git log` and `git branch -a` — **loose, not enforced by any hook or CI check**:

- **Commits**: a mix of GitHub's default merge-commit messages (`Merge pull request #NNN from Yotta-deeptech/<branch>`) and free-form direct commits. Some direct commits use a `type: description` shape (`fix: import PORT in app.ts for build compilation`, `feat: dynamic environment-based swagger server URLs`) resembling Conventional Commits, but plenty don't (`Small change`, `replica updated to 1`). No ticket-number prefix convention exists. If you want your commit to read well next to recent history, a short `feat:`/`fix:`/`docs:` prefix plus a plain description fits the more careful half of the log; a prefix-less imperative sentence also fits — either is consistent with something already in `git log`.
- **Branches**: `feature/<slug>` and `fixes/<slug>` are the closest thing to a convention (`feature/swagger`, `feature/monthly-billing`, `fixes/out-of-memory`), but casing/separator is inconsistent (`hotfix/` vs `hot_fix/`), and a large minority of branches have no prefix at all (`nim-fixes`, `kafka-fixes`) or are personal (`DEV-Jatin`). `develop` is the integration branch merged branches target; `Stage`/`UAT`/`main` are environment/release branches.
- **No CODEOWNERS, no PR template, no CONTRIBUTING.md** exist in this repo — there is nothing to conform to beyond matching nearby history.

---

## Part B — Workflows

### 5. Environment setup

From a clean checkout:

```bash
npm install
```
Create a `.env` (dev — `dotenv.config()` default path), or rely on `.env.uat`/`.env.stage` when running with `NODE_ENV=uat`/`stage` (see [config.ts](../src/config.ts) branching, and §8 below for variable names — **never copy real values into a committed file or into this KB**).

### 6. Canonical dev loop

```bash
npm run dev          # NODE_ENV=development nodemon, hot-reloads via ts-node src/server.ts (nodemon.json)
npm test             # jest --forceExit — DB is mocked (unit_testing/jest.setup.ts), safe to run with no DB configured
```
There is no lint/typecheck-only script to run in the loop beyond what `npm run build` does at the end. CI (§9) only builds and deploys — it does **not** run `npm test` or a typecheck step, so running `npm test` before pushing is on the developer, not enforced.

### 7. All commands

Copied verbatim from `package.json` — see [AGENTS.md](../AGENTS.md#commands) for the same table with one-line purposes.

```json
"build": "rimraf ./build && tsc",
"dev": "NODE_ENV=development nodemon",
"uat": "NODE_ENV=uat nodemon",
"stage": "NODE_ENV=stage nodemon",
"build:dev": "NODE_ENV=development npm run build",
"build:uat": "NODE_ENV=uat npm run build",
"build:stage": "NODE_ENV=stage npm run build",
"start:dev": "NODE_ENV=development node build/server.js",
"start:uat": "NODE_ENV=uat node build/server.js",
"start:stage": "NODE_ENV=stage node build/server.js",
"start:prod": "npm run build && NODE_ENV=production node build/server.js",
"test": "jest --forceExit",
"test:watch": "jest --watchAll",
"test:coverage": "jest --coverage --forceExit"
```
`nodemon.json` (used by `dev`/`uat`/`stage`): watches `src` for `.ts`/`.json` changes, runs `ts-node src/server.ts`, sends `SIGTERM` on restart, ignores `node_modules`/`build`.

Docker build (matches the three `Dockerfile_*` variants — differ only in the `build:<env>` step and pm2 instance count):
```bash
docker build -f Dockerfile_Dev_App_Service -t q0-app-service:dev .
```

### 8. Environment variables

Grouped by concern; names only (from `.env.stage`, `src/config.ts`, and a repo-wide `process.env.*` grep — **never real values**). Fake example values shown are illustrative, not defaults from the code unless noted.

| Variable | Purpose | Example |
|---|---|---|
| `NODE_ENV` | Selects `.env`/`.env.uat`/`.env.stage` and several config branches | `development` |
| `DB_HOST`, `DB_NAME`, `DB_USERNAME`, `DB_PASSWORD` | PostgreSQL connection (port is hardcoded `5432` in `data-source.ts`) | `db_host=localhost` |
| `AWS_ACCESS_KEY`, `AWS_SECRET_KEY`, `AWS_BUCKET_NAME`, `AWS_LOCATION`, `AWS_ENDPOINT`, `AWS_ENDPOINT_URL`, `AWS_SECRET_REGION`, `AWS_SIGNED_URL_EXPIRY`, `AWS_S3_FOLDER_NAME` | S3 storage + Secrets Manager | `AWS_BUCKET_NAME=q0-uploads-dev` |
| `BOOTSTRAP`, `USERNAME`, `PASSWORD`, `KAFKA_GROUP_ID`, `SECURITY_PROTOCOL`, `SASL_MECHANISMS` | Kafka broker connection (`node-rdkafka`) | `BOOTSTRAP=kafka.dev:9092` |
| `TOPIC_*` (30+ vars, e.g. `TOPIC_TRAINING_INIT`, `TOPIC_DEPLOYMENT_STATUS`, `TOPIC_RAG_INIT`) | Per-environment Kafka topic name overrides — each falls back to a `dev-*`/`uat-*`/`prod-*` default in `config.ts` if unset | `TOPIC_DEPLOYMENT_STATUS=dev-deployment-status` |
| `HUGGINGFACE_API_KEY`, `HUGGINGFACE_API_URL` | Hugging Face repo verification | — |
| `CLIENTID`, `CLIENTSECRET` | Google OAuth | — |
| `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET` | GitHub OAuth | — |
| `CCAVENUE_REDIRECT_URL`, `CCAVENUE_CANCEL_URL`, `CCAVENUE_UI_REDIRECT_URL` | Payment gateway callback URLs | — |
| `FRONTENDURL`, `FRONTENDDOMAIN`, `FRONTENDURL_ALPHA`, `FRONTENDDOMAIN_ALPHA`, `DEV_URL`, `DEV_URL_ALPHA` | Frontend origin(s), used in email links/CORS-adjacent logic | `FRONTENDURL=https://app-dev.q0.new` |
| `LOKI_URL`, `LOKI_URL_ALPHA` | Log query backend for `LokiLogController` | — |
| `MEMBERAPPROVALREQUESTURL`, `MEMBERAPPROVALREQUESTURL_ALPHA` | Link embedded in member-approval emails | — |
| `GRPC_UPLOAD_HOST` | Upload service gRPC host | — |
| `EMAIL_HOST`, `EMAIL_PORT`, `EMAIL_USERNAME`, `EMAIL_PASSWORD`, `EMAIL_FROM` | SMTP for transactional email (note: not all of these are currently wired up end-to-end — see [architecture.md](architecture.md#known-gotchas--dead-code)) | — |
| `TENANT_ID`, `IPSETID`, `IPSETBLOCKSCHEDULAR` | Multi-tenant/WAF config | — |
| `MODALQUANTIZATIONURL`, `MODELTRAININGURL`, `DATASETDOWNLOAD`, `DEPLOYMENTURL`, `COMPILATIONURL`, `CHUNK_MANAGEMENT_API_URL`, `INFERENCE_API_URL`, `UPLOAD_TRAINING_WEIGHTS_URL`, `TERMINATE_RESOURCES`, `COST_FORECAST_API_URL` | External ML-pipeline and cost-forecast service URLs this app calls out to | — |
| `COST_FORECAST_API_TIMEOUT_MS` | Timeout in milliseconds for cost-forecast requests | `10000` |
| `MYMODEL_LOGS`, `DEPLOYMENT_LOGS`, `TRAINING_LOGS`, `KNOWLEDGEBASE_LOG` | Loki log-stream names | — |
| `QDRANT_DB_URL` | Vector store for knowledge bases | — |
| `WEBSOCKET_PATH`, `WEBSOCKET_HEARTBEAT_INTERVAL_MS`, `WEBSOCKET_REDIS_URL`, `WEBSOCKET_REDIS_CHANNEL`, `REDIS_URL` | WebSocket server + Redis fan-out | `WEBSOCKET_REDIS_CHANNEL=ws-broadcast` |
| `APPLICATION_SENTRY_DSN` | Sentry (omit to disable) | — |
| `OTEL_EXPORTER_OTLP_ENDPOINT`, `OTEL_SERVICE_NAME` | OpenTelemetry export target/service name | — |
| `BASE_URL`, `SWAGGER_BASE_URL` | Swagger UI server URL construction | — |
| `CLOUDFRONTBASEURL`, `CDN_LINK` | CDN passthrough for S3-backed assets | — |

`UNVERIFIED — confirm with team`: no `JWT_SECRET`-style variable name appears anywhere — JWT signing isn't currently env-driven (see known debt in [architecture.md](architecture.md)).

### 9. CI pipeline

Only one workflow exists: `.github/workflows/App-svc-Dev-Pipeline.yml`, dev environment only, triggered on a **merged** PR into `develop` or manual `workflow_dispatch`. Jobs, in order:

1. **`auth`** — checks out `develop`, verifies the branch is actually `develop`, assumes an AWS role (`Dev_Pipeline_Role`) via OIDC.
2. **`build`** — logs into ECR, computes the next sequential tag matching `App_svc_Dev_<n>`, `docker build -f ./Dockerfile_Dev_App_Service .`, pushes to ECR.
3. **`deploy`** — `aws eks update-kubeconfig`, patches the new image tag into `dev-k8-files/values.yaml`, `helm template` → `kubectl apply`, waits on rollout status.
4. **`notify`** — always runs; emails a build/deploy status report via SES SMTP.

**No test or lint/typecheck step runs in CI** — `npm test`/`npm run build`'s type-checking happen only as a side effect of step 2's Docker build (`RUN npm run build:dev` inside the image); a broken `tsc` build fails the pipeline, a broken `npm test` does not (it's never invoked). There is no Stage/UAT/production CI pipeline in this repo — only `App-svc-Dev-Pipeline.yml` exists, despite `Dockerfile_Stage_App_Service`/`Dockerfile_UAT_App_Service` and `Stage-k8-files`/`UAT-k8-files` all being present; those environments are presumably deployed by a process outside this repo or manually. `UNVERIFIED — confirm with team`.

**Security note**: this workflow's email-notification step has SMTP credentials checked in as plaintext rather than pulled from `secrets.*` — flagged as a live finding for whoever owns CI/secrets hygiene, not reproduced here.

### 10. Release process

No `CHANGELOG.md`, no git tags observed, no `version` bump automation — `package.json`'s `version` field (`1.0.0`) does not appear to be bumped per release. The dev Docker image tag itself functions as the release identifier (`App_svc_Dev_<incrementing-number>`, computed by scanning ECR in the CI `build` job). Stage/UAT image tags follow the same `App_svc_Stage_<n>`/`App_svc_UAT_<n>` naming (per the Helm `values.yaml` files) but there is no visible automation building/pushing them from this repo — `UNVERIFIED` how Stage/UAT/production deploys are actually triggered.
