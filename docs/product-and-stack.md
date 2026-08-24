# Product & Stack — Q0-Application-Service

What Q0-Application-Service is for, and what it's built out of.

_Last verified: 2026-08-07 (kb-builder)_ · Back to [AGENTS.md](../AGENTS.md) · See also [architecture.md](architecture.md) · [conventions-and-workflows.md](conventions-and-workflows.md) · [api-contracts.md](api-contracts.md)

## Table of contents

- [Part A — Product](#part-a--product)
  1. [Product overview](#1-product-overview)
  2. [Target users / personas](#2-target-users--personas)
  3. [Core features / modules](#3-core-features--modules)
  4. [Domain glossary](#4-domain-glossary)
  5. [Key flows](#5-key-flows)
  6. [Product boundaries](#6-product-boundaries)
  7. [External integrations](#7-external-integrations)
- [Part B — Stack](#part-b--stack)
  8. [Languages & runtimes](#8-languages--runtimes)
  9. [Frameworks & key libraries](#9-frameworks--key-libraries)
  10. [Upgrade-sensitive notes](#10-upgrade-sensitive-notes)

---

## Part A — Product

### 1. Product overview

Q0-Application-Service is the API/control-plane backend for **Q0**, Yotta's GPU-cloud and ML-infrastructure platform ("Infer" — the API base path is literally `/Infer/api`). Companies sign up, invite members, connect cloud accounts and hardware, then use the platform to catalogue AI models, allocate GPU capacity, train and deploy models, run inference (interactive playground, chat, batch, and RAG-backed knowledge-base queries), and pay for it all via a wallet/budget/billing system. This repo owns identity, orchestration, and billing/metadata; it does **not** itself run training or inference workloads (see [Product boundaries](#6-product-boundaries)).

Evidence: `README.md` "Key Features" list, `src/core/AppRoutes.ts` (92 mounted resource groups), entity/enum survey below.

### 2. Target users / personas

Derived from the entity/role model and which endpoints exist — no explicit persona documentation exists in the repo, so this is inferred from `companyEntity.ts`, `membersEntity.ts`, `rolesEntity.ts`/`modulesEntity.ts`/`roleModulePermissionEntity.ts`, and the controller surface:

| Persona | Evidence | What they do |
|---|---|---|
| **Company admin** | `CompanyEntity.created_by`, `CompanyMemberRolesController` approve/reject/de-activate routes, `InviteController` | Creates the company, completes KYC (`CompanyEntity.is_kyc`), invites/approves/removes members, assigns roles, manages billing/wallet/budgets. |
| **Company member (developer/ML user)** | `MembersEntity.role_id`, the bulk of auth-gated controllers | Browses the model catalog, connects cloud accounts, allocates hardware, trains/deploys/benchmarks models, runs inference (playground/chat/batch), builds knowledge bases, views usage/audit logs. |
| **External integrator** | `RegisterationController` (`/pub/api/v1/generate-token`, `/sync-ext-customer`, `/get-ext-customer`), `ApiKeyTokenController`/`ValidateApiKeyController`, `InferenceController`'s `api-key` header path | Calls the platform's inference/customer-sync APIs from another Yotta system using an issued API key/token instead of a member JWT. |
| **Anonymous / public visitor** | `PublicModelController` (`/public/models`, no auth), `ContactUsController`, `DocsCmsPageRelationController` | Browses the public model marketplace and CMS/contact pages without logging in. |
| **Role/permission is data, not yet enforced in code** — `RolesEntity`/`ModulesEntity`/`RoleModulePermissionEntity` model a full RBAC schema (which module a role can access), but no middleware in `src/middlewares/` reads or enforces it; only `authMiddleware` (is-this-a-valid-JWT) gates routes today. Treat per-role capability differences as data-model intent, not as an enforced product boundary — see [architecture.md](architecture.md#known-gotchas--dead-code). | | |

### 3. Core features / modules

| Feature area | Code location |
|---|---|
| Identity & company management (signup, login, SSO/Google/GitHub, invites, roles, KYC flag) | `src/controllers/loginController/`, `company/`, `member/`, `roles/`, `modules/`, `roleModulePermission/`, `invite/`, `companyMemberRoles/`, `accessManagement/` |
| Cloud provider integration (accounts, regions, providers, secrets, hosted zones) | `src/controllers/cloudAccount/`, `cloudProvider/`, `cloudRegion/`, `cloudService/`, `cloudSecrets/`, `hostedZone/` |
| GPU/hardware capacity management | `src/controllers/hardwareMaster/`, `hardwareSpeces/`, `hardwareUtilization/`, `infraNodes/`, `nodeGroups/`, `clusters/`, `podDetails/`, `allocation/`, `reservation/` (+ standalone `src/reservation/reservationService.services.ts`) |
| Model catalog | `src/controllers/model/`, `modelClass/`, `modelCategory/`, `modelTask/`, `embeddingModel/`, `publicModel/` |
| Model training & deployment lifecycle | `src/controllers/modelTraining/`, `myModel/`, `deployments/` (deployment, deploymentModel, deploymentQuota, getScalingMetrics), `gpuCost/` |
| Inference | `src/controllers/inference/`, `playground/`, `batchInference/`, `chatSession/` |
| Knowledge base / RAG | `src/controllers/knowledgeBase/` (source, source-mapping, vector-store, job, deployment-integration, database-type) |
| Model benchmarking & evaluation | `src/controllers/benchmarking/` (benchmarking, benchmarkingDataset, evaluationTask, inferenceSetting) |
| Guardrails (prompt/content policy) | `src/controllers/guardrails/`, entity `GuardrailsEntity` (prompt injection, content moderation, topic/word/PII policy, image content toggles) |
| Billing, wallet, cost forecasting & budgets | `src/controllers/monthlyBilling/`, `src/controllers/wallet/`, entities `WalletEntity`/`WalletTransactionsEntity`/`WalletRechargesEntity`/`WalletRefundsEntity`/`PaymentTransactionsEntity`/`PricePlanEntity`, `src/controllers/budgetControl/`, `src/utils/pricing/pricingService.ts` |
| Webhooks & third-party integration toggles | `src/controllers/webhookConfig/`, `webhookPlatforms/`, `integration/` |
| Notifications | `src/controllers/notification/`, Kafka-driven (`TOPIC_NOTIFICATION_INIT`) |
| Audit logging | `src/controllers/auditLog/`, `AuditLogService` (static logging API called from most feature services) |
| External/partner integration (Yotta One) | `src/controllers/registration/registerationController.ts` (`/pub/api/v1/*`) |
| Ops/observability endpoints | `src/controllers/apiHealthCheck/`, `lokiLog/`, `dashboard/` (entity is an empty stub — unfinished) |
| Marketing/public content | `src/controllers/contactUs/`, `docs/docsCmsPageRelationController.controller.ts` |

### 4. Domain glossary

Terms exactly as spelled in the code (entities in `src/entities/`, enums in `src/config.ts`):

| Term | Meaning |
|---|---|
| `is_delete` | Soft-delete flag (0/1) on every entity via base `InferencingEntity` — there is no hard delete anywhere. |
| `Allocation` / `InfraAllocation` | A live binding of GPU capacity to a `module` (model, training job, knowledge base, or deployment) — `module_type` enum: `model \| training \| knowledge_base \| deployment`. |
| `Reservation` | A pre-booked block of GPU capacity for a company over a date range (`status`: `pending`/approved via `approved_by`), independent of an active `Allocation`. |
| `is_kyc` | Boolean on `CompanyEntity` marking whether the company has completed Know-Your-Customer verification. |
| `Wallet` | Per-user/company prepaid balance (`balance`, `currency`, `status`: `ACTIVE \| SUSPENDED`) debited/credited by usage. |
| `WalletTxnType` / `WalletTxnReferenceType` | `CREDIT \| DEBIT`; reference types: `PLAYGROUND, PAYMENT, REFUND, ORDER, ADJUSTMENT, DEPLOYMENT, SIGNUP_BONUS, BENCHMARKING, BATCH_INFERENCE, KNOWLEDGEBASE, DATASET` — i.e. every billable action in the product. |
| `BudgetControl` | A company- or user-level spend cap (`Daily \| Monthly`) with three tiered alert thresholds and an `auto_stop_resources` kill-switch. |
| `Guardrail` | A configurable content-safety policy (prompt injection, content moderation, topic/word/PII filtering, image content) attachable to a model category. |
| `MyModel` | A member's personal/fine-tuned model instance, distinct from the shared `Model` catalog entry. |
| `KnowledgeBase` | A RAG data source: has a `KnowledgeBaseSource`, gets chunked/embedded into a `KnowledgeBaseVectorStore` (Qdrant), tracked via `KnowledgeBaseJob`, and can be integrated into a `Deployment` (`DeploymentKbIntegration`). |
| `DeploymentQuota` | Per-model, per-company rate limits: `tpm_limit`/`rpm_limit` (tokens/requests per minute) with `extended_*`/`max_*` overrides. |
| `hashId` | An `MD5(id)` string attached to almost every list/detail API response as an obfuscated public identifier, generated ad hoc in each service (not centralized). |

### 5. Key flows

- **Company onboarding**: `POST /logins/signup` → email verification (`GET /logins/verify-email/:token`) → `POST /logins/login` → invite members (`InviteController`) → members join (`POST /join-company`) → KYC completion sets `CompanyEntity.is_kyc`.
- **Cloud + hardware setup**: connect a cloud account (`CloudAccountController`, backed by `CloudSecretsController`) → discover/allocate hardware (`AllocationController`, `ReservationController` for pre-booked capacity).
- **Model deployment**: pick a catalog `Model` → `DeploymentController` creates an allocation → downstream training/compile/deploy workers (outside this repo) report status back over Kafka (`TOPIC_DEPLOYMENT_STATUS`, consumed in `src/utils/kafka/consumers.ts`) → `DeploymentController`'s public `update-deployment-status` route and `WebSocketService` push live status to the frontend.
- **Inference**: authenticated `POST /inference` (JWT) or `POST /inference/api-key` (external API key + model-id headers) → `InferenceController` → downstream inference execution (external `INFERENCE_API_URL`) → wallet debited (`WalletTxnReferenceType.PLAYGROUND`/etc.) via Kafka-driven billing.
- **RAG / knowledge base**: upload a source (`KnowledgeBaseSourceController`) → `POST /knowledge-base/sync-now` triggers chunking/embedding (external `CHUNK_MANAGEMENT_API_URL`, Kafka `TOPIC_RAG_INIT`) → vector store entry (`KnowledgeBaseVectorStoreController`, Qdrant) → integrate into a deployment (`DeploymentKbIntegrationController`).
- **Billing**: usage events arrive via Kafka (`TOPIC_CREDIT_CALCULATE`, `TOPIC_FETCH_UPDATED_CREDIT`) → `WalletService`/`MonthlyBillingController`/`BudgetControlController` update balances and fire alerts (`BudgetAlertHistoryEntity`) when thresholds are crossed.

### 6. Product boundaries

This repo is the **API/control-plane + billing/metadata layer only**. It deliberately does **not**:
- Execute model training, compilation, quantization, or inference itself — it calls out to external services via HTTP (`MODELTRAININGURL`, `COMPILATIONURL`, `MODALQUANTIZATIONURL`, `INFERENCE_API_URL`, `DEPLOYMENTURL`, `DATASETDOWNLOAD`, `CHUNK_MANAGEMENT_API_URL`, `UPLOAD_TRAINING_WEIGHTS_URL`) and Kafka topics (`TOPIC_TRAINING_INIT`, `TOPIC_COMPILE_INIT`, `TOPIC_DEPLOYMENT_INIT`, `TOPIC_RAG_INIT`, `TOPIC_BATCH_INFERENCE_RESULT`, …), then just persists status/results reported back.
- Provision or manage the underlying Kubernetes/GPU infrastructure directly — it records allocation/reservation *state* (`AllocationEntity`, `InfraAllocationEntity`, `ReservationEntity`) that some other service acts on.
- Own a frontend — this is a pure JSON API (`/Infer/api/...`) plus a WebSocket push channel; UI lives in a separate repo (`FRONTENDURL`/`FRONTENDDOMAIN` env vars point at it).
- `UNVERIFIED — confirm with team`: which specific other Yotta repos own training/deployment execution, vector-store ingestion, and payment-gateway callback handling. Not derivable from this repo alone.

### 7. External integrations

| Integration | Where wired | Purpose |
|---|---|---|
| AWS S3 | `src/core/AwsService.ts` | File uploads (models, datasets, avatars) keyed `uploads/{modelName}/{id}/{filename}`; signed URLs or CDN passthrough for reads. |
| AWS Secrets Manager | `src/core/AwsService.ts` (`getSecretKey`) | Pulls UAT/PROD secret bundles by name. |
| PostgreSQL | `src/database/data-source.ts` | Primary datastore (TypeORM, `synchronize: false`). |
| Kafka (`node-rdkafka`) | `src/utils/kafka/KafkaService.ts`, `consumers.ts` | Async status updates to/from external training/deployment/compile/RAG workers; billing credit events; notifications. |
| Redis | `src/utils/webSocket/webSocketService.ts` | Pub/sub fan-out so WebSocket broadcasts reach clients connected to any pod (not used as a cache). |
| Google OAuth / GitHub OAuth | `src/utils/oauth/googleOAuth.ts`, `githubOAuth.ts` | Social login, wired into `loginController.ts`. |
| Hugging Face | `src/controllers/huggingFaceRepoVerification/`, `HUGGINGFACE_API_KEY`/`HUGGINGFACE_API_URL` | Verifies a HF model/dataset repo before import. |
| Sentry | `src/utils/sentry.ts`, `app.ts` | Error tracking + profiling (conditional on `APPLICATION_SENTRY_DSN`). |
| Grafana Tempo (OpenTelemetry OTLP) | `src/tracing.ts` | Distributed tracing export. |
| Grafana Loki | `LOKI_URL`, `src/controllers/lokiLog/` | Centralized log querying surfaced back through the API. |
| Qdrant | `QDRANT_DB_URL` (referenced in config, consumed by knowledge-base services) | Vector store backing RAG knowledge bases. |
| Cost forecasting service | `COST_FORECAST_API_URL`, `src/services/wallet/walletService.services.ts` | Produces organization wallet trend and usage-simulation cost forecasts for the frontend. |
| Payment gateways | `PaymentGateway` enum (`PHONEPE \| RAZORPAY \| STRIPE \| PAYTM`), `CCAVENUE_*` env vars | Wallet recharge / payment processing (gateway callback handling not confirmed inside this repo's route table — `UNVERIFIED`). |
| Firebase | `firebase-admin` dependency, `App.initializeFirebase()` | Declared but the init method body is an empty stub — **not actually wired up** (`UNVERIFIED` whether this is planned or abandoned). |
| Nodemailer / AWS SES | `src/utils/email/emailService.ts` | Transactional email (verification, invites, password reset). |

---

## Part B — Stack

### 8. Languages & runtimes

| Language/runtime | Version | Pinned where |
|---|---|---|
| TypeScript | `^5.9.2` (`package.json` devDependencies) | `tsconfig.json` compiler config |
| Node.js | `node:22.18.0` | `Dockerfile_Dev_App_Service`, `Dockerfile_Stage_App_Service`, `Dockerfile_UAT_App_Service` (image tag only — **no `.nvmrc`, `.node-version`, or `engines` field**, so local dev has no enforced Node version) |

### 9. Frameworks & key libraries

Versions from `package.json`; docs are the official pages consulted while building this KB.

| Library | Version | Role in this repo | Docs |
|---|---|---|---|
| Express | ^4.21.2 | Core HTTP framework, single monolith router | https://expressjs.com/ |
| TypeORM | ^0.3.26 | ORM over PostgreSQL, Active-Record style entities | https://typeorm.io/ |
| pg | ^8.16.3 | PostgreSQL driver (via TypeORM) | https://node-postgres.com/ |
| class-validator / class-transformer | ^0.14.1 / ^0.5.1 | DTO validation for request bodies (`validationMiddleware`/`validationFDMiddleware`) | https://github.com/typestack/class-validator |
| jsonwebtoken | ^9.0.2 | JWT issuing/verification (`src/utils/jwt/jwt.ts`) | https://github.com/auth0/node-jsonwebtoken |
| bcryptjs | ^3.0.2 | Password hashing | https://github.com/dcodeIO/bcrypt.js |
| passport, passport-google-oauth20 | ^0.7.0, ^2.0.0 | OAuth strategy scaffolding (actual Google/GitHub flows are hand-rolled in `src/utils/oauth/`, not through Passport strategies — `UNVERIFIED` whether Passport is still actively used vs. vestigial) | https://www.passportjs.org/ |
| node-rdkafka | ^3.5.0 | Kafka producer/consumer (the Kafka client actually used) | https://github.com/Blizzard/node-rdkafka |
| kafkajs | ^2.2.4 | Listed dependency, **zero imports found in `src/`** — dead dependency | https://kafka.js.org/ |
| redis | ^4.7.1 | WebSocket pub/sub fan-out only | https://redis.io/docs/latest/develop/clients/nodejs/ |
| ws | ^8.18.3 | WebSocket server (separate port, `WEBSOCKET_PORT=3220`) | https://github.com/websockets/ws |
| aws-sdk | ^2.1692.0 | S3 + Secrets Manager (v2, not the modular v3 SDK) | https://docs.aws.amazon.com/sdk-for-javascript/v2/developer-guide/welcome.html |
| multer, multer-s3 | ^1.4.5-lts.1, ^3.0.1 | Multipart file upload handling, applied globally (`.any()`) in `app.ts` | https://github.com/expressjs/multer |
| helmet | ^8.0.0 | Security headers — registered *after* CORS/body-parsers in `app.ts` (see [architecture.md](architecture.md)) | https://helmetjs.github.io/ |
| cors | ^2.8.5 | CORS — currently called with no options (all origins allowed) | https://github.com/expressjs/cors |
| crypto-js | ^4.2.0 | AES encryption/decryption of request/response bodies (`src/core/Encryption&Decryption.ts`) | https://github.com/brix/crypto-js |
| @opentelemetry/sdk-node + auto-instrumentations | ^0.219.0 / ^0.77.0 | Distributed tracing | https://opentelemetry.io/docs/languages/js/ |
| @sentry/node, @sentry/profiling-node | ^10.53.1 | Error tracking + profiling | https://docs.sentry.io/platforms/javascript/guides/node/ |
| firebase-admin | ^13.1.0 | Declared; init is a stub — see Part A §7 | https://firebase.google.com/docs/admin/setup |
| @huggingface/inference | ^4.7.1 | Hugging Face repo verification | https://huggingface.co/docs/huggingface.js/inference/README |
| google-auth-library | ^10.2.1 | Google token verification support for OAuth | https://github.com/googleapis/google-auth-library-nodejs |
| moment | ^2.30.1 | Date formatting throughout services (a maintenance-mode library — new code should be aware there's no migration to a modern alternative in progress) | https://momentjs.com/docs/ |
| exceljs | ^4.4.0 | Excel import/export (`/importExcel` is a special-cased URL exempt from body encryption in `app.ts`) | https://github.com/exceljs/exceljs |
| jest, ts-jest | ^30.4.2, ^29.4.12 | Test runner | https://jestjs.io/ |

### 10. Upgrade-sensitive notes

- **TypeScript `strict: true` is weakened**: `noImplicitAny: false`, `strictNullChecks: false`, `strictPropertyInitialization: false` are all explicitly re-disabled in `tsconfig.json` despite `strict: true` being set. A future move to full strict mode will surface a large number of latent null/any issues — expect it, don't assume the codebase is null-safe today.
- **`kafkajs` is dead weight** — the whole Kafka integration runs on `node-rdkafka`; don't add new code against `kafkajs`'s API, and removing the dependency is safe (`UNVERIFIED` — confirm no external tooling expects it before removing).
- **`aws-sdk` is the v2 SDK**, already in maintenance mode upstream; new AWS integration code elsewhere in the Yotta org may be on v3 (`@aws-sdk/client-s3` etc.) — don't assume API parity if porting code between repos.
- **No `.nvmrc`/`engines` pin** — local Node version drift vs. the Docker `22.18.0` pin is possible; if you hit a Node-version-specific bug locally, check this first.
- **`synchronize: false` with no visible migrations wiring** in `src/database/data-source.ts` — schema changes are applied out-of-band (manual SQL / a process not present in this repo). Don't add a new entity column and assume it will exist in any deployed database without a corresponding manual migration.
