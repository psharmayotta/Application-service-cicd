# API Contracts — Q0-Application-Service

This repo **hosts** an API (no outbound API-consumption layer exists — it calls a handful of external ML-pipeline URLs by plain `axios`/`fetch` calls inside services, not through a shared client wrapper worth documenting separately). Every route below was read directly from `src/core/AppRoutes.ts`, `src/server.ts` (the definitive list of what's actually mounted), and each controller file — not from `src/swagger.json`, which is confirmed stale (see [caveat](#swagger-is-not-authoritative)).

_Last verified: 2026-08-07 (kb-builder)_ · Back to [AGENTS.md](../AGENTS.md) · See also [architecture.md](architecture.md) for the `BaseController`/`BaseServices` template these routes are built on.

## How routes are constructed

Full path = `PATH` (`/Infer/api`, `src/config.ts`) + the controller's `APP_ROUTES` base value + any sub-path the controller defines. Example: `AllocationController(APP_ROUTES.ALLOCATION)` where `ALLOCATION = '/allocation'` → `GET /Infer/api/allocation/getall`.

## Auth mechanism

The only auth primitive is **`authMiddleware`** (`src/middlewares/authMiddleware.ts`): expects `Authorization: Bearer <JWT>`, verifies the token, looks up (but — see [architecture.md](architecture.md#known-gotchas--dead-code) — does not actually enforce) a matching session row, and merges the decoded claims (`member_id`, `company_id`, etc.) into `req.body.decryptToken`. There is **no role/permission-check middleware** — routes are either behind `authMiddleware` or not; nothing in this repo enforces the `RolesEntity`/`ModulesEntity`/`RoleModulePermissionEntity` RBAC data model per-route. A separate, ad hoc header-based check (`api-key`/`model-id` headers, validated inline in the handler, not via middleware) gates `InferenceController`'s two routes instead of JWT.

**Every route not explicitly marked "public" below requires `authMiddleware`.** Routes marked "public" have no auth middleware attached in code — this was verified by reading each controller's `_initialiseRoutes()`, not inferred from the path.

## Request/response body encryption

`ENABLE_ENCRYPTION` is hardcoded `true` in `src/config.ts`. For any `POST` whose URL is **not** in `NON_ENCRYPTION_ENDPOINTS` (`src/config.ts` — currently: `/security/encryption`, `/security/decryption`, `/security/saltencryption`, `/inference`, `/inference/api-key`, `/model/my-model/update-status`, `/model-training/update-status`, `/dataset/update-status`, `/pub/api/v1/sync-ext-customer`, `/pub/api/v1/get-ext-customer`, `/pub/api/v1/generate-token`, `/validate-api-key/validate`, `/playground/model-details`) and not `/importExcel`, the app expects `req.body.data` to be an AES-encrypted JSON string (`src/core/Encryption&Decryption.ts`) and decrypts it before validation runs. Response bodies get the mirror treatment in `ApiResponse.prepare()`. **The example bodies in this doc and in the generated Postman collection are the plain, unencrypted JSON shapes** — against an environment with encryption actually enforced end-to-end, a real client must AES-encrypt the body into `{ "data": "<ciphertext>" }` first. This is a genuine gap in the Postman collection's out-of-the-box usability against such an environment; it is called out here rather than silently glossed over.

## Base CRUD pattern (applies to most resources below)

Defined once on `BaseController`/`BaseServices` (full detail in [architecture.md](architecture.md#the-crud-template-basecontroller--baseservices)). Unless a resource is listed under "Custom routes" as overriding `_initialiseRoutes()` entirely, it exposes exactly these 8 routes, **all behind `authMiddleware`**:

| Method | Path suffix | Body | Notes |
|---|---|---|---|
| GET | `/getall` | — | Full unpaginated list. |
| GET | `/getbyid/:id` | — | |
| DELETE | `/delete/:id` | — | Soft delete (`is_delete=1`). |
| POST | `/save` | resource DTO fields (+ files if the resource declares a `MetaModel`) | Create or update — presence of an `id` field in the body decides which, per `BaseController.getPostSuccessMsg`. |
| POST | `/updateDeleteFlagData` | `{ "id": 1 }` or `{ "id": [1,2,3] }` | Bulk soft-delete. |
| POST | `/savemulti` | array-shaped resource DTO fields | Bulk create, same validation as `/save`. |
| POST | `/getdata` | `Pagination` shape — `{ "pageNumber": 0, "pageSize": 25, "filter": { "search": "", "year": "" }, "sortBy": null, "sortType": null, "company_id": null, "search_text": null, "is_delete": null }` | Filtered/paginated list — feature-specific filtering happens in the resource's `prepareQuery` override; some resources add extra filter fields (e.g. `ModelFilter`, `WalletFilter` in `src/core/InferParams.ts`). |
| POST | `/getdatabyid` | Same `Pagination` shape | Filtered single-record variant. |

The exact `/save`/`savemulti` body fields are resource-specific and validated against `src/database/repository/<feature>/<feature>.dto.ts` — with ~90 resources, those field lists aren't reproduced per-resource in this doc; open the matching `.dto.ts` file for the authoritative shape. The generated Postman collection uses an empty `{}` placeholder body for these two routes per resource for the same reason — see [the collection section](#postman-collection) below.

## Base-CRUD-only resources

These 55 resources expose **only** the 8 base routes above (no custom routes, no override of `_initialiseRoutes()`). Grouped roughly by product area (see [product-and-stack.md](product-and-stack.md#3-core-features--modules)):

| Resource | Base path (append to `/Infer/api`) |
|---|---|
| Get Scaling Metrics | `/get-scaling-metrics` |
| Get Clusters | `/get-clusters` |
| Clusters | `/clusters` |
| Infra Nodes | `/infra-nodes` |
| Private Endpoint — Dashboard | `/private-endpoint` (shares base path with the custom Graph controller, below) |
| Private Endpoint — Model | `/private-model` |
| Timezone | `/timezone` |
| Cloud Service | `/cloud-service` |
| Cloud Region | `/cloud-region` |
| Get Secret Along Cloud | `/get-secret` |
| Hosted Zone | `/hosted-zone` (registered **twice** in `server.ts` — duplicate, not two resources; see [architecture.md](architecture.md#known-gotchas--dead-code)) |
| Cloud Account | `/cloud-account` |
| Cloud Provider | `/cloud-provider` |
| Usage | `/usage` |
| Chat Session | `/chat-session` |
| Company | `/company` |
| Roles | `/roles` |
| Modules | `/modules` |
| Role-Module-Permission | `/role-module-permission` |
| Member Logins | `/member-login` |
| Model | `/models` |
| API Key Token | `/apiKeyToken` |
| Cloud Secrets | `/cloud-secrets` |
| Model Class | `/model-class` |
| Hardware Specs | `/hardware-specs` |
| Benchmarking | `/benchmarking` |
| Model Category | `/model-category` |
| Model Task | `/model-task` |
| Allocation | `/allocation` |
| Pod Details | `/pod-details` |
| Hardware Utilization | `/hardware-utilization` |
| Deployment Model | `/deployment-model` |
| Marketplace Filter | `/marketplace-filter` |
| Access Management | `/access-management` |
| Deployment Quota | `/deployment-quota` |
| Reservation | `/reservation` |
| CMS Docs | `/cms-docs` |
| Model Training Listing | `/model-training-listing` |
| Dashboard | `/dashboard` (non-functional — backing entity `dashboardEntity.ts` is a 0-byte file) |
| Monthly Billing | `/monthly-billing` |
| Hardware Master | `/hardware-master` |
| Contact Us | `/contact-us` |
| Billing Usage | `/billing-usage` |
| Node Groups | `/node-groups` |
| Embedding Model | `/embedding-model` |
| Knowledge Base Source | `/knowledge-base-source` |
| Knowledge Base Database Type | `/database-type` |
| Knowledge Base Vector Store | `/knowledge-base-vector-store` |
| Evaluation Tasks | `/evaluation-tasks` |
| Batch Inference Job | `/batch-inference-job` |
| Knowledge Base Job | `/knowledge-base-job` |
| Knowledge Base Deployments (listing) | `/kb-deployments` |
| Training Weights | `/training-weights` |
| Webhook Platforms | `/webhook-platforms` |
| Guardrails | `/guardrails` |

## Resources with custom or fully custom routes

Every route not covered by the base-CRUD table above. **Auth** column states exactly what's attached in code (`authMiddleware`, a specific `validation*Middleware`, header-based ad hoc check, or none). Handler file paths are relative to `src/controllers/`.

| Resource (base path) | Method | Path | Auth | Body / params | Handler |
|---|---|---|---|---|---|
| Private Endpoint — Graph (`/private-endpoint`) | POST | `/usage` | authMiddleware | — | `privateEndpoints/privateEndPointGraphController.controller.ts` — no base CRUD (overrides `_initialiseRoutes`) |
| Deployment — Metrics (`/deployment`) | POST | `/metrics` | `validationMiddleware(DeploymentMetricsDto)` only, **no authMiddleware** | `DeploymentMetricsDto` fields | `deployments/deploymentMetricsController.controller.ts` — no base CRUD |
| Deployment (`/deployment`) | base CRUD | `/deployment/*` | authMiddleware | resource DTO | `deployments/deploymentController.controller.ts` |
| Deployment (`/deployment`) | POST | `/update-deployment-status` | `validationMiddleware(UpdateDeploymentStatusDto)` only, **no authMiddleware** (listed in `NON_ENCRYPTION_ENDPOINTS`) | `UpdateDeploymentStatusDto` fields | `deployments/deploymentController.controller.ts` |
| Wallet (`/wallet`) | base CRUD | `/wallet/*` | authMiddleware | resource DTO | `wallet/walletController.controller.ts` |
| Wallet (`/wallet`) | POST | `/usage` | **none (public)** | — | `wallet/walletController.controller.ts` → `getUsageByModel` |
| Wallet (`/wallet`) | POST | `/cost-forecast` | authMiddleware + `validationMiddleware(CostForecastDto)` + active organization-membership check | `{ "company_id": 1, "months": 3 }`; `months` is optional | `wallet/walletController.controller.ts` → `getCostForecast`; resolves the organization's wallet and calls the configured cost-forecast service's `GET /forecast` with a fixed growth factor |
| API Health Check (`/apiHealthCheck`) | GET | `/apihealth` | **none (public)** | — | `apiHealthCheck/apiHealthCheckController.controller.ts` — no base CRUD; also the k8s liveness/readiness probe target for all 3 environments |
| Security (`/security`) | POST | `/encryption` | **none (public)** | plaintext to encrypt | `secuirtyController/secuirtyController.controller.ts` — no base CRUD |
| Security (`/security`) | POST | `/decryption` | **none (public)** | ciphertext to decrypt | same file |
| Members (`/members`) | base CRUD | `/members/*` | authMiddleware | resource DTO | `member/memberController.controller.ts` |
| Members (`/members`) | POST | `/check-email` | **none (public)** | `{ "email": "..." }` (inferred from handler name; verify against `checkEmail` body usage before relying on exact field name) | same file |
| Login (`/logins`) | POST | `/signup` | **none (public)** | `validationFDMiddleware` against `LoginController`'s signup DTO | `loginController/loginController.ts` |
| Login (`/logins`) | GET | `/verify-email/:token` | none | — | same file |
| Login (`/logins`) | POST | `/login` | none | signup/login DTO | same file |
| Login (`/logins`) | POST | `/resend-verification` | none | — | same file |
| Login (`/logins`) | POST | `/forgot-password` | none | — | same file |
| Login (`/logins`) | POST | `/reset-password` | none | — | same file |
| Login (`/logins`) | POST | `/forgot-password-link-verify` | none | — | same file |
| Login (`/logins`) | POST | `/sso` | none | `SsoLoginDto` | same file |
| Login (`/logins`) | GET | `/google/auth` | none | — | same file |
| Login (`/logins`) | GET | `/google/callback` | none | — | same file |
| Login (`/logins`) | GET | `/github/auth` | none | — | same file |
| Login (`/logins`) | GET | `/github/callback` | none | — | same file |
| Invite (`/invite`) | base CRUD | `/invite/*` | authMiddleware | resource DTO | `invite/inviteController.controller.ts` |
| Invite (`/invite`) | POST | `/validate` | `validationFDMiddleware` only, no auth | invite DTO | same file |
| Invite (`/invite`) | POST | `/resend-invite` | `validationFDMiddleware` only, no auth | invite DTO | same file |
| Invite (`/invite`) | POST | `/copy-invite-link` | `validationFDMiddleware` only, no auth | invite DTO | same file |
| Invite (`/invite`) | POST | `/cancel-invite` | `validationFDMiddleware` only, no auth | invite DTO | same file |
| Playground (`/playground`) | base CRUD | `/playground/*` | authMiddleware | resource DTO | `playground/playgroundController.controller.ts` |
| Playground (`/playground`) | GET | `/model-details` | **none (public, in `NON_ENCRYPTION_ENDPOINTS`)** | — | same file |
| Inference (`/inference`) | base CRUD | `/inference/*` | authMiddleware | resource DTO | `inference/inferenceController.controller.ts` |
| Inference (`/inference`) | POST | `/` (i.e. `/Infer/api/inference`) | **none via middleware** — ad hoc `api-key`/`model-id` header check inside the handler | inference request payload | same file → `handleInference` |
| Inference (`/inference`) | POST | `/api-key` | same ad hoc header check | inference request payload | same file → `handleInferenceNew` |
| Logout (`/logout`) | POST | `/` (i.e. `/Infer/api/logout`) | authMiddleware | `validationFDMiddleware` DTO | `logout/logoutController.ts` — no base CRUD |
| Refresh Token (`/refresh-token`) | POST | `/` | **none (public)** | `validationFDMiddleware` DTO (refresh token) | `login/refreshTokenController.ts` — no base CRUD |
| Update Password (`/update-password`) | POST | `/` | authMiddleware | `validationFDMiddleware` DTO | `login/updatePasswordController.ts` — no base CRUD |
| Hugging Face Repo Verification (`/hugging-face-repo-verification`) | base CRUD | `/hugging-face-repo-verification/*` | authMiddleware | resource DTO | `huggingFaceRepoVerification/huggingFaceRepoVerificationController.controller.ts` |
| Hugging Face Repo Verification | POST | `/` | `validationFDMiddleware` only, no auth | repo DTO | same file → `verifyRepo` |
| Hugging Face Repo Verification | POST | `/dataset` | `validationFDMiddleware` only, no auth | repo DTO | same file → `verifyDatasetRepo` |
| My Model (`/model/my-model`) | base CRUD | `/model/my-model/*` | authMiddleware | resource DTO | `myModel/myModelController.controller.ts` |
| My Model | POST | `/update-status` | **none (public, in `NON_ENCRYPTION_ENDPOINTS`)** | status update payload | same file → `updateStatus` |
| Dataset (`/dataset`) | base CRUD | `/dataset/*` | authMiddleware | resource DTO | `dataSet/dataSetController.controller.ts` |
| Dataset | POST | `/restore` | **none (public)** | — | same file → `restoreData` |
| Model Training (`/model-training`) | base CRUD | `/model-training/*` | authMiddleware | resource DTO | `modelTraining/modelTrainingController.controller.ts` |
| Model Training | POST | `/update-status` | **none (public, in `NON_ENCRYPTION_ENDPOINTS`)** | status update payload | same file → `updateStatus` |
| Join Company (`/join-company`) | POST | `/` | authMiddleware | `validationFDMiddleware` DTO | `company/joinCompanyController.controller.ts` — no base CRUD |
| Notification (`/notification`) | base CRUD | `/notification/*` | authMiddleware | resource DTO | `notification/notificationController.controller.ts` |
| Notification | POST | `/mark-as-read` | **none (public)** | notification id(s) | same file → `markAsRead` |
| Company Member Roles (`/company-member-roles`) | base CRUD | `/company-member-roles/*` | authMiddleware | resource DTO | `companyMemberRoles/companyMemberRolesController.controller.ts` |
| Company Member Roles | POST | `/approve` | **none (public)** | — | same file → `approve` |
| Company Member Roles | POST | `/reject` | **none (public)** | — | same file → `reject` |
| Company Member Roles | POST | `/de-activate` | authMiddleware + `validationFDMiddleware` | DTO | same file → `deActivate` |
| Loki Logs (`/loki-logs`) | POST | `/get-logs` | authMiddleware | Loki query params | `lokiLog/lokiLogController.controller.ts` — no base CRUD |
| Knowledge Base (`/knowledge-base`) | base CRUD | `/knowledge-base/*` | authMiddleware | resource DTO | `knowledgeBase/knowledgeBaseController.controller.ts` |
| Knowledge Base | POST | `/sync-now` | authMiddleware + `validationMiddleware(SyncNowDto)` | `SyncNowDto` fields | same file → `syncNow` |
| Inference Setting (`/inference-setting`) | base CRUD | `/inference-setting/*` | authMiddleware | resource DTO | `benchmarking/inferenceSettingController.controller.ts` |
| Inference Setting | POST | `/get` | authMiddleware | filter payload | same file → `getInferenceSettings` |
| Knowledge Base Source Mapping (`/knowledge-base-source-mapping`) | base CRUD | `/knowledge-base-source-mapping/*` | authMiddleware | resource DTO | `knowledgeBase/knowledgeBaseSourceMappingController.controller.ts` |
| Knowledge Base Source Mapping | GET | `/getByKnowledgeBaseId/:kbId` | authMiddleware | — | same file |
| Benchmarking Dataset (`/benchmarking-dataset`) | base CRUD | `/benchmarking-dataset/*` | authMiddleware | resource DTO | `benchmarking/benchmarkingDatasetController.controller.ts` |
| Benchmarking Dataset | POST | `/download-sample-dataset` | authMiddleware | — | same file |
| Batch Inference (`/batch-inference`) | base CRUD | `/batch-inference/*` | authMiddleware | resource DTO | `batchInference/batchInferenceController.controller.ts` |
| Batch Inference | GET | `/run/:id` | authMiddleware | — | same file → `runInference` |
| Batch Inference | GET | `/status/:id` | authMiddleware | — | same file → `getJobStatus` |
| Batch Inference | GET | `/results/:id` | authMiddleware | — | same file → `getResults` |
| Batch Inference | GET | `/latest-status/:id` | authMiddleware | — | same file → `getLatestStatus` |
| Batch Inference | GET | `/retry/:id` | authMiddleware | — | same file → `retryJob` |
| Batch Inference | GET | `/cancel/:id` | authMiddleware | — | same file → `cancelJob` |
| Batch Inference | POST | `/download-sample-dataset` | authMiddleware | — | same file → `downloadSampleDataset` |
| KB Deployment Integration (`/kb-deployment-integration`) | base CRUD | `/kb-deployment-integration/*` | authMiddleware | resource DTO | `knowledgeBase/deploymentKbIntegrationController.controller.ts` |
| KB Deployment Integration | POST | `/deintegrate` | authMiddleware + `validationFDMiddleware(DeintegrateDto)` | `DeintegrateDto` fields | same file → `deintegrate` |
| GPU Cost (`/gpu-cost`) | base CRUD | `/gpu-cost/*` | authMiddleware | resource DTO | `gpuCost/gpuCostController.controller.ts` |
| GPU Cost | POST | `/get-cost` | authMiddleware | cost query payload | same file → `getGpuCost` |
| Validate API Key (`/validate-api-key`) | POST | `/validate` | **none (public, in `NON_ENCRYPTION_ENDPOINTS`)** | `ValidateApiKeyDto` via `validationFDMiddleware` | `apiKeyToken/validateApiKeyController.controller.ts` — no base CRUD |
| Budget Control (`/budget-control`) | base CRUD | `/budget-control/*` | authMiddleware | resource DTO | `budgetControl/budgetControlController.controller.ts` |
| Budget Control | POST | `/seen-alert` | authMiddleware | alert id | same file → `seenAlert` |
| Webhook Config (`/webhook-config`) | base CRUD | `/webhook-config/*` | authMiddleware | resource DTO | `webhookConfig/webhookController.controller.ts` |
| Webhook Config | POST | `/verify` | authMiddleware | webhook payload | same file → `verifyWebhook` |
| Webhook Config | POST | `/active` | authMiddleware | `{ "id": ..., "is_active": ... }` (inferred name) | same file → `toggleActive` |
| Webhook Config | GET | `/get-users` | authMiddleware | — | same file → `getWebhookUsers` |
| Integrations (`/integrations`) | base CRUD | `/integrations/*` | authMiddleware | resource DTO | `integration/integrationController.controller.ts` |
| Integrations | POST | `/toggle-active` | authMiddleware | `{ "id": ..., "is_active": ... }` (inferred name) | same file → `toggleActive` |
| Yotta Integration (absolute paths, not `APP_ROUTES.YOTTA_INTEGRATION`) | POST | `/pub/api/v1/generate-token` | **none (public, in `NON_ENCRYPTION_ENDPOINTS`)** | external-customer credentials | `registration/registerationController.ts` → `generateToken` |
| Yotta Integration | POST | `/pub/api/v1/sync-ext-customer` | authMiddleware (also in `NON_ENCRYPTION_ENDPOINTS`) | external customer payload | same file → `syncExtCustomer` |
| Yotta Integration | POST | `/pub/api/v1/get-ext-customer` | authMiddleware (also in `NON_ENCRYPTION_ENDPOINTS`) | external customer lookup payload | same file → `getExtCustomer` |
| Audit Log (`/audit-log`) | base CRUD | `/audit-log/*` | authMiddleware | resource DTO; see the [audit-log date filter contract](audit-log-date-filter-contract.md) for `/getdata` | `auditLog/auditLogController.controller.ts` |
| Audit Log | GET | `/test_members` | **none (public — debug endpoint)** | — | same file (inline handler) |
| Audit Log | POST | `/members` | authMiddleware | filter payload | same file → `getAuditLogMembers` |
| Audit Log | POST | `/modules` | authMiddleware | filter payload | same file → `getAuditLogModules` |
| Audit Log | POST | `/actions` | authMiddleware | filter payload | same file → `getAuditLogActions` |
| Public Models (`/public/models`) | GET | `/` (i.e. `/Infer/api/public/models`) | **none (public)** | — | `publicModel/publicModelController.controller.ts` — no base CRUD, comment in code explicitly says no auth |
| Public Models | POST | `/detail` | **none (public)** | `{ "model_id": ... }` (inferred) | same file → `getPublicModelDetail` |

## Dead / non-mounted routes (not in the collection, listed so they're not mistaken for missing coverage)

These exist as code under `src/controllers/` but are **not** imported/instantiated in `src/server.ts`, so they don't exist at runtime — verified by checking every import in `server.ts` against every file in `controllers/`:

| File | Why it's dead |
|---|---|
| `controllers/login/loginController.ts`, `verifyEmailController.ts`, `resendVerificationController.ts`, `googleAuth/googleAuthController.ts`, `googleAuth/googleCallbackController.ts` | Empty files (0 bytes) |
| `controllers/login/forgotPasswordControllet.ts` | Has code (`ForgotPasswordController`, `POST {FORGOTPASSWORD}`), never imported in `server.ts` |
| `controllers/login/resetPasswordController.ts` | Has code (`ResetPasswordController`, `POST {RESETPASSWORD}`), never imported |
| `controllers/login/signUpController.ts` | Has code but handler body is commented out; also never imported |

The live signup/login/verify-email/forgot-password/reset-password/SSO/OAuth flow is entirely inside `controllers/loginController/loginController.ts` (see table above).

## Swagger is not authoritative

`src/swagger.json` documents roughly 75 paths — a small fraction of the several hundred routes above (entire resource groups like `budgetControl`, `guardrails`, `knowledgeBase`, `webhookConfig`, `auditLog`, `batchInference`, `benchmarking`, `publicModel`, `notification`, `integration`, `gpuCost` are absent from it). Do not update `swagger.json` in isolation and assume it's now correct, and don't trust it over this page or the actual controller code.

## Postman collection

Generated at [`docs/api/Q0-Application-Service.postman_collection.json`](api/Q0-Application-Service.postman_collection.json), Postman Collection v2.1 format. One folder per resource (matching the two tables above), one request per route. Collection variables `{{base_url}}` (set to e.g. `http://localhost:3210/Infer/api` for local dev) and `{{token}}` (a JWT for the `Authorization: Bearer {{token}}` header) are declared **empty** — no environment values are baked in.

**How it was produced**: hand-curated from the exact route/middleware evidence in the tables above (this file), then emitted as JSON by a small one-off generation script (not committed — the source of truth is this page; regenerate the collection from an updated version of this table if routes change, don't hand-patch the JSON).

**Known limitations, stated rather than hidden**:
- Base-CRUD `/save`, `/savemulti`, `/getdata`, `/getdatabyid`, `/updateDeleteFlagData` bodies use the generic shapes documented above (`{}` for save/savemulti, the `Pagination` shape for getdata/getdatabyid, `{"id": ...}` for updateDeleteFlagData) rather than each resource's exact DTO fields — see the linked `.dto.ts` file per resource for the real shape before using these against a live server.
- Bodies are **not** pre-encrypted. Against an environment with the request-encryption gate actually enforced, `/save`-style requests need a pre-request script (or manual step) to AES-encrypt the body into `{"data": "<ciphertext>"}` first — see [Request/response body encryption](#requestresponse-body-encryption) above.
- The literal duplicate `Hosted Zone` controller registration is represented once, not twice, in the collection.
