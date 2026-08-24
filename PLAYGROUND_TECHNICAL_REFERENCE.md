# Playground Models V2 — Technical Reference

> **Audience:** Engineering leadership, platform architects, on-call engineers.  
> **Last updated:** 2026-08-21  
> **Cluster:** `onprem-yotta` · **Namespace:** `playground`

---

## 1. System Overview

Ten large-language models served behind a unified OpenAI-compatible REST API (`/v1/chat/completions`). Every request passes through a three-layer pipeline:

```
Client
  │
  ▼
Layer 0 — Keyword pre-filter (regex, < 1 ms)
  │  Blocks: drug synthesis, malware, phishing, explosives, CSAM, targeted poisoning
  │  Returns: HTTP 200 with fixed refusal string (bypass: none)
  │
  ▼ (safe)
Layer 1 — Exact prompt cache (Redis, < 5 ms on hit)
  │  Key: SHA-256 of canonical messages array
  │  TTL: 3 600 s | Namespaced by: workspace + model
  │
  ▼ (miss)
Layer 2 — Semantic cache (Redis + sentence-transformer, 50–150 ms on hit)
  │  Algorithm: cosine similarity of last user message embedding
  │  Threshold: ≥ 0.92 | TTL: 7 200 s | Namespaced by: workspace + model
  │
  ▼ (miss)
Layer 3 — NeMo IORails (DeBERTa jailbreak + toxic-bert output)
  │  Input check: DeBERTa jailbreak classifier
  │  LLM inference: Triton + vLLM
  │  Output check: toxic-bert harm classifier (non-streaming only)
  │
  ▼
Response
```

**Layers 0–2 apply to 9 of 10 models.** Gemma 4 12B uses a standalone Flask proxy with no cache or guardrails.

---

## 2. Model Fleet Reference

### 2.1 Complete Fleet Table

| # | Deployment name | API `model` ID | External endpoint path | Node | GPUs | RAM | TP | Context | Max output |
|---|---|---|---|---|---|---|---|---|---|
| 1 | `deepseek-r1-8b` | `deepseek-r1-8b` | `/q0/playground/deepseek-r1-8b/v1` | k8s-worker013 | 1 | 64 Gi | 1 | 32 768 tok | 32 768 tok |
| 2 | `mn-inferor-12b` | `mn-inferor-12b` | `/q0/playground/mistral-nemo/v1` | k8s-worker112 | 1 | 96 Gi | 1 | 32 768 tok | 32 768 tok |
| 3 | `qwq-32b` | `qwq-32b` | `/q0/playground/qwq-32b/v1` | k8s-worker164 | 1 | 96 Gi | 1 | 32 768 tok | 32 768 tok |
| 4 | `llama4-scout` | `llama4-scout-instruct` | `/q0/playground/llama4-scout/v1` | k8s-worker013 | **2** | 320 Gi | **2** | 32 768 tok | 32 768 tok |
| 5 | `mixtral-8x7b` | `mixtral-8x7b-instruct` | `/q0/playground/mixtral/v1` | k8s-worker112 | **2** | 160 Gi | **2** | 32 768 tok | 32 768 tok |
| 6 | `llama3-1-70b` | `llama3.1-70b-instruct` | `/q0/playground/llama3-70b/v1` | k8s-worker164 | **2** | 160 Gi | **2** | 32 768 tok | 32 768 tok |
| 7 | `qwen3-5-27b` | `qwen35_27b` | `/q0/playground/qwen3-27b/v1` | k8s-worker164 | 1 | 640 Gi | 1 | **262 144 tok (256 K)** | 262 144 tok |
| 8 | `qwen3-5-35b-a3b` | `qwen3.5-35b-a3b` | `/q0/playground/qwen3-35b/v1` | k8s-worker013 | 1 | 640 Gi | 1 | 32 768 tok | 32 768 tok |
| 9 | `gemma4-31b` | `google/gemma-4-31b-it` | `/q0/playground/gemma4-31b/v1` | k8s-worker164 | 1 | 80 Gi | 1 | 8 192 tok | 8 192 tok |
| 10 | `gemma-4-12b` | `google/gemma-4-12b-it` | `/q0/playground/gemma4-12b/v1` | k8s-worker164 | 1 | 96 Gi | 1 | 4 096 tok (total) | **≤ 8 192 tok** (proxy-enforced) |

> **Base URL:** `https://fileupload-alpha.q0.dev`  
> **Full endpoint:** `{Base URL}{path}/chat/completions`

### 2.2 Feature Matrix

| Model | Prompt cache | Semantic cache | Layer 0 filter | NeMo guardrails | Vision | Thinking tokens | stream_options.include_usage |
|---|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| deepseek-r1-8b | ✓ | ✓ | ✓ | ✓ | — | raw thinking in output | ✓ |
| mn-inferor-12b | ✓ | ✓ | ✓ | ✓ | — | — | ✓ |
| qwq-32b | ✓ | ✓ | ✓ | ✓ | — | raw thinking in output | ✓ |
| llama4-scout | ✓ | ✓ | ✓ | ✓ | — | — | ✓ |
| mixtral-8x7b | ✓ | ✓ | ✓ | ✓ | — | — | ✓ |
| llama3-1-70b | ✓ | ✓ | ✓ | ✓ | — | — | ✓ |
| qwen3-5-27b | ✓ | ✓ | ✓ | ✓ | — | raw thinking in output | ✓ |
| qwen3-5-35b-a3b | ✓ | ✓ | ✓ | ✓ | — | raw thinking in output | ✓ |
| gemma4-31b | ✓ | ✓ | ✓ | ✓ | — | — | ✗ (returns 0/0/0) |
| gemma-4-12b | — | — | — | — | **✓** | stripped by proxy | — |

### 2.3 Current ECR Image Tags

| Deployment | Image tag |
|---|---|
| deepseek-r1-8b | `deepseek-r1-8b-v4-v4` |
| mn-inferor-12b | `mn-inferor-12b-v4-v3` |
| qwq-32b | `qwq-32b-v4-v3` |
| llama4-scout | `llama4-scout-v4-v3` |
| mixtral-8x7b | `mixtral-8x7b-v4-v3` |
| llama3-1-70b | `llama3.1-70b-v4-v3` |
| qwen3-5-27b | `qwen3.5-27b-v4-v3` |
| qwen3-5-35b-a3b | `qwen3.5-35b-a3b-v4-v3` |
| gemma4-31b | `gemma4-31b-v4-v8` |
| gemma-4-12b | `gemma4-12b-v2-proxy-v12` |

ECR registry: `534774607607.dkr.ecr.ap-south-1.amazonaws.com/q0-models` (tags are immutable).

---

## 3. Cache Subsystem — Deep Dive

### 3.1 Architecture

```
Request arrives
  │
  ├─ skip_cache = True?  (X-Skip-Cache header)   → skip both layers
  ├─ has_pii = True?     (CC/SSN regex match)    → skip both layers
  ├─ user_text empty?                             → skip both layers
  │
  ▼ (cacheable)
Layer 1 — Exact Prompt Cache
  • Redis key:   prompt:{workspace_id}:{model_id}:{sha256(canonical_messages)}
  • Hit action:  return stored response immediately
  • Miss action: fall through to Layer 2
  │
  ▼ (miss)
Layer 2 — Semantic Cache
  • Embed last user message with all-MiniLM-L6-v2 (sentence-transformers)
  • Scan Redis keys matching:  sem:{workspace_id}:{model_id}:*
  • Compute cosine similarity of query vector vs each stored entry
  • Hit condition:  best_score ≥ 0.92
  • Hit action:     return stored response
  • Miss action:    fall through to Layer 3 (live inference)
  │
  ▼ (layer 3 inference completes)
Store response
  • Exact entry:    prompt:{workspace_id}:{model_id}:{hash}   TTL 3 600 s
  • Semantic entry: sem:{workspace_id}:{model_id}:{hash[:20]}  TTL 7 200 s
  • NOT stored if response was blocked by guardrails
```

### 3.2 Exact Cache Key Formula

```
workspace_id   = X-Workspace-ID header value  (default: "default")
effective_ws   = f"{workspace_id}:{model_id}"   ← server appends model

Exact  key: f"prompt:{effective_ws}:{msgs_hash}"
Semantic key: f"sem:{effective_ws}:{sha256(last_user_text)[:20]}"

msgs_hash = sha256(json.dumps(messages, sort_keys=True, separators=(",",":")))
```

**Concrete examples:**

```
# X-Workspace-ID: team-alpha, model: qwq-32b
Exact key:    prompt:team-alpha:qwq-32b:3f8d2a1e...
Semantic key: sem:team-alpha:qwq-32b:7c4b91a2d3

# X-Workspace-ID: team-beta, model: qwq-32b  (same prompt, different workspace)
Exact key:    prompt:team-beta:qwq-32b:3f8d2a1e...   ← different namespace bucket

# Same workspace, different model
Exact key:    prompt:team-alpha:llama3.1-70b-instruct:3f8d2a1e...  ← never returns qwq-32b answer
```

### 3.3 Workspace Isolation Mechanism

The server constructs the Redis key prefix as `f"{X-Workspace-ID}:{request.model}"` before every cache read/write. This means:

| Isolation boundary | Mechanism |
|---|---|
| Between workspaces | Different `X-Workspace-ID` values → different Redis key prefix |
| Between models | Model ID appended to workspace → different Redis key prefix |
| Default namespace | No `X-Workspace-ID` → prefix is `"default:{model_id}"` (shared by all unauthenticated callers) |

**Production recommendation:** always send `X-Workspace-ID` with a stable tenant/project identifier. Without it, all callers share the `default` namespace and one caller's cached response is returned to another.

```
Caller A (X-Workspace-ID: tenant-1)  ──┐
Caller B (X-Workspace-ID: tenant-2)  ──┤  Never share cache entries
Caller C (X-Workspace-ID: tenant-1)  ──┘  (A and C share; B is isolated)
Caller D (no header)                 ──── "default" namespace (shared with all other no-header callers)
```

### 3.4 Cache Control Headers

| Header | Values | Effect |
|---|---|---|
| `X-Workspace-ID` | any string | Namespace prefix for all cache keys |
| `X-Skip-Cache` | `true`, `1`, `yes` | Bypass read AND write for this request |

`X-Skip-Cache` skips both the lookup (so a cached response is never returned) and the store (so the new response is not written to cache). Subsequent requests for the same prompt are unaffected — they still read the previously stored entry if one exists.

### 3.5 Automatic Cache Bypass Conditions

| Condition | Why |
|---|---|
| `X-Skip-Cache: true` | Explicit caller bypass |
| Prompt contains 16-digit CC number `\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}` | PII auto-bypass |
| Prompt contains US SSN `\d{3}[\s-]?\d{2}[\s-]?\d{4}` | PII auto-bypass |
| No user message in request | Nothing to hash |
| Harmful prompt blocked by Layer 0 | Rejected before cache is reached |
| Blocked response from guardrails | Never stored (blocked responses are not cached) |
| Gemma 4 12B | No Redis wired — custom Flask proxy serves all requests |

### 3.6 Semantic Similarity Algorithm

```python
# Embedding model: all-MiniLM-L6-v2 (sentence-transformers)
# Vector type: float32, L2-normalized
# Similarity: dot product (equivalent to cosine on normalized vectors)

query_vec = model.encode(last_user_text, normalize_embeddings=True)

# Scan all semantic entries in the workspace:namespace bucket
for each sem:workspace:model:* key in Redis:
    stored_vec = entry["vec"]   # stored as hex-encoded float32 bytes
    score = dot(query_vec, stored_vec)
    if score > best_score:
        best_score, best_resp = score, entry["resp"]

if best_score >= 0.92:
    return best_resp   # semantic cache hit
```

Threshold `0.92` is configurable via env var `SEMANTIC_THRESHOLD` at pod startup. At 0.92, prompts like "What is the capital of France?" and "Which city is France's capital?" return the same cached response.

### 3.7 TTL and Eviction

| Layer | TTL (env var) | Default |
|---|---|---|
| Exact (prompt) cache | `PROMPT_CACHE_TTL` | 3 600 s (1 hour) |
| Semantic cache | `SEM_CACHE_TTL` | 7 200 s (2 hours) |

Redis uses LRU eviction (`maxmemory-policy allkeys-lru`). When memory is full, the least-recently-used key is evicted regardless of TTL.

### 3.8 Cache Hit Response Headers

When a **streaming** request is served from cache, the response includes:

```
x-cache: EXACT     ← response came from exact (prompt) cache
x-cache: SEMANTIC  ← response came from semantic cache
```

> Note: the `x-cache` header is only present on **streaming** cache hits. The Envoy ingress proxy strips custom headers from non-streaming responses, so non-streaming cache hits are transparent (no indicator in the response). Timing is the only observable difference for non-streaming requests (~5 ms vs 1–30 s for live inference).

---

## 4. Content Safety Subsystem — Deep Dive

### 4.1 Layer 0 — Keyword Regex Pre-filter

Runs **before** the cache on every request. Implemented in `chat.py` (`_keyword_safety_check`). Returns the fixed refusal string `"I'm sorry, I can't respond to that."` on any match.

#### Blocked categories and patterns (live production values)

| Category | Pattern description |
|---|---|
| **Drug synthesis** | "step-by-step / synthesis / synthesize" within 150 chars of "mdma / fentanyl / methamphetamine / heroin / cocaine" |
| **Drug synthesis (reverse)** | Drug name within 150 chars of "synthesis / reagent / purification / chemical route / step-by-step" |
| **Keylogger malware** | "keylogger" within 400 chars of "credential / password / exfiltrat / antivirus detect / without victim knowing" |
| **Keystroke capture** | "capture keystroke" within 300 chars of "email / credential / password" |
| **Phishing** | "phishing email" within 300 chars of "trick / steal / credential / password / fake login" |
| **Pipe bomb / IED** | Any mention of "pipe bomb" (no context required) |
| **Targeted poisoning** | "poison" + person reference within 250 chars of "lethal / effective / without knowing / household chemical" |
| **Elder fraud** | "elderly" within 300 chars of "account number / social security / PIN / bank detail" |
| **CSAM** | "sexual" within 200 chars of any minor-age reference (child, minor, 12/13/14-year, underage, under-18) |
| **CSAM (content request)** | "story/content/image/video/scene involving/featuring" within 60 chars of minor reference |

**Why a regex pre-filter?** The Layer 3 classifiers (DeBERTa, toxic-bert) were tested and found to score 0.001 on drug synthesis, malware, and CSAM prompts — wrong model family for structured harmful instructions. The regex layer catches these categories with 100% precision at < 1 ms latency, before any cache lookup or model call.

### 4.2 Layer 3 — NeMo IORails Classifiers

Applied only on cache **miss** (live inference path). Two classifiers run in series:

#### Input classifier — `jailbreak_clf` (DeBERTa)
- Model: HuggingFace `DeBERTa`-based jailbreak detector
- Checks: DAN prompts, role-play bypass attempts, system prompt injection
- Fires: before LLM call
- Applies to: both streaming and non-streaming

#### Output classifier — `harm_clf` (`unitary/toxic-bert`)
- Model: `toxic-bert` (toxicity detection)
- Checks: hate speech, toxic content in the generated response
- Fires: after LLM call, before response is returned to client
- Applies to: **non-streaming only** (streaming output is not checked by harm_clf)

#### Refusal string
All blocked responses (Layer 0 or Layer 3) return the identical fixed string:
```
I'm sorry, I can't respond to that.
```
Returned as HTTP 200 in the normal response envelope — not as an HTTP error code.

#### Streaming output caveat
For streaming requests, only the **input** is checked (jailbreak_clf). The output classifier (harm_clf) does not run on streaming responses because the full generated text is not available until the stream ends. If you need output safety on streaming, use non-streaming mode.

### 4.3 Layer-by-Layer Coverage Table

| Threat | Layer 0 regex | Layer 3 input (DeBERTa) | Layer 3 output (toxic-bert) |
|---|:---:|:---:|:---:|
| Drug synthesis instructions | ✓ | — (scores ~0.001) | — |
| Malware / keylogger code | ✓ | — | — |
| Phishing templates | ✓ | — | — |
| IED construction | ✓ | — | — |
| Targeted poisoning | ✓ | — | — |
| Elder fraud scripts | ✓ | — | — |
| CSAM | ✓ | — | — |
| DAN / system-prompt injection | — | ✓ | — |
| Generic jailbreak role-play | — | ✓ | — |
| Hate speech in output | — | — | ✓ (non-stream only) |
| Toxic LLM output | — | — | ✓ (non-stream only) |

### 4.4 Models Without Guardrails

**Gemma 4 12B** (`gemma-4-12b`) has no Layer 0, no cache, and no NeMo IORails. It runs a standalone Flask proxy that handles Triton gRPC directly. All safety checks are absent — suitable only for controlled internal use or vision tasks.

---

## 5. Infrastructure Reference

### 5.1 Node Assignment

| Node | Models deployed |
|---|---|
| k8s-worker013 | deepseek-r1-8b, llama4-scout, qwen3-5-35b-a3b |
| k8s-worker112 | mn-inferor-12b, mixtral-8x7b |
| k8s-worker164 | qwq-32b, qwen3-5-27b, llama3-1-70b, gemma4-31b, gemma-4-12b |

llama4-scout and mixtral-8x7b and llama3-1-70b use tensor parallelism across 2 GPUs on their respective nodes.

### 5.2 ConfigMap Patches (live code overlays)

Two ConfigMaps shadow files inside running pods without requiring image rebuilds:

#### `nemo-chat-patch` — applied to all 9 guardrail models

Mounts at: `/opt/tritonserver/python/openai/openai_frontend/frontend/fastapi/routers/chat.py`

Contains: the full patched `chat.py` with:
- Layer 0 keyword pre-filter
- Redis two-layer cache (exact + semantic)
- `X-Workspace-ID` / `X-Skip-Cache` header support
- `stream_options.include_usage` support
- NeMo IORails integration

Applied to: deepseek-r1-8b, mn-inferor-12b, qwq-32b, llama4-scout, mixtral-8x7b, llama3-1-70b, qwen3-5-27b, qwen3-5-35b-a3b, gemma4-31b

#### `gemma4-proxy-patch` — applied to gemma-4-12b only

Mounts at: `/opt/proxy.py`

Contains: patched proxy with:
- Hard cap: `max_tokens > 8192` → HTTP 400 (prevents 440-second timeout on very large requests)
- `_strip_thinking()`: removes `"thought\n"` markers leaked by the model before returning response to client

```bash
# Verify patches are live
kubectl --context onprem-yotta -n playground get configmap nemo-chat-patch -o jsonpath='{.metadata.resourceVersion}'
kubectl --context onprem-yotta -n playground get configmap gemma4-proxy-patch -o jsonpath='{.metadata.resourceVersion}'
```

### 5.3 Liveness Probe Configuration

| Model | `initialDelaySeconds` | Reasoning |
|---|---|---|
| deepseek-r1-8b | 150 s | Actual startup ~67 s |
| mn-inferor-12b | 150 s | Actual startup ~86 s |
| qwq-32b | 240 s | Actual startup ~175 s |
| llama4-scout | 900 s | Actual startup ~794 s |
| mixtral-8x7b | 480 s | Actual startup ~316 s |
| llama3-1-70b | 720 s | Actual startup ~408 s |
| qwen3-5-27b | **1 800 s** | FlashInfer JIT compilation on cold start (up to 30 min) |
| qwen3-5-35b-a3b | **1 800 s** | FlashInfer JIT compilation on cold start (up to 30 min) |
| gemma4-31b | 300 s | Actual startup ~239 s |
| gemma-4-12b | 360 s | Actual startup ~360 s |

**Critical:** qwen3-5-27b and qwen3-5-35b-a3b require 1 800 s (30 min) because FlashInfer JIT-compiles CUDA kernels on first cold start after an image pull or node drain. Probes set lower than 1 800 s will kill the pod during JIT and cause an infinite restart loop.

### 5.4 Redis Cache Service

```
Service:   playground-redis  (ClusterIP, port 6379)
Env var:   REDIS_URL=redis://playground-redis:6379  (set on all 9 guardrail models)
Gemma 4 12B: no REDIS_URL — cache disabled
```

---

## 6. Per-Model Technical Sheets

---

### Model 1 — DeepSeek R1 Distill 8B

| Field | Value |
|---|---|
| Deployment | `deepseek-r1-8b` |
| API model ID | `deepseek-r1-8b` |
| Endpoint | `https://fileupload-alpha.q0.dev/q0/playground/deepseek-r1-8b/v1` |
| Base model | DeepSeek-R1 distilled to 8B parameters |
| Architecture | Reasoning / chain-of-thought; produces extended thinking in output |
| Node | k8s-worker013 |
| GPUs | 1 |
| Memory limit | 64 Gi |
| Tensor parallel | 1 |
| Context window | 32 768 tokens |
| Max output | 32 768 tokens |
| GPU utilization | 90 % |
| DTYPE | (default) |
| Image | `deepseek-r1-8b-v4-v4` |
| Liveness delay | 150 s |
| Cache | ✓ (exact + semantic) |
| Guardrails | ✓ (Layer 0 + NeMo IORails) |
| stream_options.include_usage | ✓ (prompt + completion tokens) |
| Known issues | Thinking tokens appear in raw output (reasoning chain visible to caller) |
| CUDA_VISIBLE_DEVICES | Not pinned (kai scheduler assigns) |

---

### Model 2 — Mistral Nemo Inferor 12B

| Field | Value |
|---|---|
| Deployment | `mn-inferor-12b` |
| API model ID | `mn-inferor-12b` |
| Endpoint | `https://fileupload-alpha.q0.dev/q0/playground/mistral-nemo/v1` |
| Base model | Infermatic MN-12B-Inferor-v0.1 (Mistral Nemo fine-tune) |
| Architecture | Standard instruction-following |
| Node | k8s-worker112 |
| GPUs | 1 |
| Memory limit | 96 Gi |
| Tensor parallel | 1 |
| Context window | 32 768 tokens |
| Max output | 32 768 tokens |
| GPU utilization | 90 % |
| DTYPE | (default) |
| Image | `mn-inferor-12b-v4-v3` |
| Liveness delay | 150 s |
| Cache | ✓ (exact + semantic) |
| Guardrails | ✓ (Layer 0 + NeMo IORails) |
| stream_options.include_usage | ✓ |
| Known issues | None |

---

### Model 3 — QwQ 32B

| Field | Value |
|---|---|
| Deployment | `qwq-32b` |
| API model ID | `qwq-32b` |
| Endpoint | `https://fileupload-alpha.q0.dev/q0/playground/qwq-32b/v1` |
| Base model | QwQ-32B (Qwen reasoning model) |
| Architecture | Extended chain-of-thought reasoning; produces long thinking chains |
| Node | k8s-worker164 |
| GPUs | 1 |
| Memory limit | 96 Gi |
| Tensor parallel | 1 |
| Context window | 32 768 tokens |
| Max output | 32 768 tokens |
| GPU utilization | 90 % |
| DTYPE | bfloat16 |
| Image | `qwq-32b-v4-v3` |
| Liveness delay | 240 s |
| Cache | ✓ (exact + semantic) |
| Guardrails | ✓ (Layer 0 + NeMo IORails) |
| stream_options.include_usage | ✓ |
| Known issues | Thinking tokens appear raw in output; typical generation 5–30 s for complex queries |
| Notes | Cold inference significantly slower than other models due to reasoning chains |

---

### Model 4 — Llama 4 Scout 17B-16E

| Field | Value |
|---|---|
| Deployment | `llama4-scout` |
| API model ID | `llama4-scout-instruct` |
| Endpoint | `https://fileupload-alpha.q0.dev/q0/playground/llama4-scout/v1` |
| Base model | Llama 4 Scout (17B active / 16-expert MoE) |
| Architecture | Mixture-of-Experts |
| Node | k8s-worker013 |
| GPUs | **2** |
| Memory limit | 320 Gi |
| Tensor parallel | **2** |
| Context window | 32 768 tokens |
| Max output | 32 768 tokens |
| GPU utilization | 95 % |
| DTYPE | bfloat16 |
| Image | `llama4-scout-v4-v3` |
| Liveness delay | 900 s |
| Cache | ✓ (exact + semantic) |
| Guardrails | ✓ (Layer 0 + NeMo IORails) |
| stream_options.include_usage | ✓ |
| Known issues | Longest startup time (794 s measured); requires 900 s liveness delay |

---

### Model 5 — Mixtral 8×7B

| Field | Value |
|---|---|
| Deployment | `mixtral-8x7b` |
| API model ID | `mixtral-8x7b-instruct` |
| Endpoint | `https://fileupload-alpha.q0.dev/q0/playground/mixtral/v1` |
| Base model | Mistral Mixtral 8×7B Instruct |
| Architecture | Sparse Mixture-of-Experts |
| Node | k8s-worker112 |
| GPUs | **2** |
| Memory limit | 160 Gi |
| Tensor parallel | **2** |
| Context window | 32 768 tokens |
| Max output | 32 768 tokens |
| GPU utilization | 92 % |
| DTYPE | bfloat16 |
| Image | `mixtral-8x7b-v4-v3` |
| Liveness delay | 480 s |
| Cache | ✓ (exact + semantic) |
| Guardrails | ✓ (Layer 0 + NeMo IORails) |
| stream_options.include_usage | ✓ |
| Known issues | None |

---

### Model 6 — Llama 3.1 70B

| Field | Value |
|---|---|
| Deployment | `llama3-1-70b` |
| API model ID | `llama3.1-70b-instruct` |
| Endpoint | `https://fileupload-alpha.q0.dev/q0/playground/llama3-70b/v1` |
| Base model | Meta Llama 3.1 70B Instruct |
| Architecture | Dense transformer |
| Node | k8s-worker164 |
| GPUs | **2** |
| Memory limit | 160 Gi |
| Tensor parallel | **2** |
| Context window | 32 768 tokens |
| Max output | 32 768 tokens |
| GPU utilization | 92 % |
| DTYPE | bfloat16 |
| Image | `llama3.1-70b-v4-v3` |
| Liveness delay | 720 s |
| Cache | ✓ (exact + semantic) |
| Guardrails | ✓ (Layer 0 + NeMo IORails) |
| stream_options.include_usage | ✓ |
| Known issues | None |

---

### Model 7 — Qwen 3.5 27B

| Field | Value |
|---|---|
| Deployment | `qwen3-5-27b` |
| API model ID | `qwen35_27b` |
| Endpoint | `https://fileupload-alpha.q0.dev/q0/playground/qwen3-27b/v1` |
| Base model | Qwen3.5-27B |
| Architecture | Extended reasoning; 256K context; MoE-style inference backend |
| Node | k8s-worker164 |
| GPUs | 1 |
| Memory limit | **640 Gi** |
| Tensor parallel | 1 |
| Context window | **262 144 tokens (256 K)** |
| Max output | 262 144 tokens |
| GPU utilization | 95 % |
| DTYPE | bfloat16 |
| Image | `qwen3.5-27b-v4-v3` |
| Liveness delay | **1 800 s** |
| Cache | ✓ (exact + semantic) |
| Guardrails | ✓ (Layer 0 + NeMo IORails) |
| stream_options.include_usage | ✓ |
| Known issues | FlashInfer JIT compilation on first cold start can take 25–30 min. Liveness probe set to 1 800 s to prevent kill-loop during JIT. Warm restarts (JIT cache populated) take ~207 s. |
| Special config | `ENFORCE_EAGER=true`, `GDN_PREFILL_BACKEND=triton`, `ENABLE_PREFIX_CACHING=false` |

---

### Model 8 — Qwen 3.5 35B-A3B (MoE)

| Field | Value |
|---|---|
| Deployment | `qwen3-5-35b-a3b` |
| API model ID | `qwen3.5-35b-a3b` |
| Endpoint | `https://fileupload-alpha.q0.dev/q0/playground/qwen3-35b/v1` |
| Base model | Qwen3.5-35B-A3B (35B total, 3B active via MoE) |
| Architecture | Hybrid MoE — 35B total parameters, 3B active per token |
| Node | k8s-worker013 |
| GPUs | 1 |
| Memory limit | **640 Gi** |
| Tensor parallel | 1 |
| Context window | 32 768 tokens |
| Max output | 32 768 tokens |
| GPU utilization | 95 % |
| DTYPE | bfloat16 |
| Image | `qwen3.5-35b-a3b-v4-v3` |
| Liveness delay | **1 800 s** |
| Cache | ✓ (exact + semantic) |
| Guardrails | ✓ (Layer 0 + NeMo IORails) |
| stream_options.include_usage | ✓ |
| Known issues | Same FlashInfer JIT issue as qwen3-5-27b (cold start up to 30 min). Warm restarts ~219 s. |
| Special config | `ENFORCE_EAGER=true`, `GDN_PREFILL_BACKEND=triton`, `MOE_BACKEND=triton`, `ENABLE_PREFIX_CACHING=false` |
| Additional overlay | `vllm-model-py-patch` ConfigMap also mounted (vLLM model.py patch) |

---

### Model 9 — Gemma 4 31B

| Field | Value |
|---|---|
| Deployment | `gemma4-31b` |
| API model ID | `google/gemma-4-31b-it` |
| Endpoint | `https://fileupload-alpha.q0.dev/q0/playground/gemma4-31b/v1` |
| Base model | Google Gemma 4 31B Instruct |
| Architecture | Dense transformer; text-only (vision disabled via `IMAGE_LIMIT=0`) |
| Node | k8s-worker164 |
| GPUs | 1 |
| Memory limit | 80 Gi |
| Tensor parallel | 1 |
| Context window | 8 192 tokens |
| Max output | 8 192 tokens |
| GPU utilization | 93 % |
| DTYPE | bfloat16 |
| Image | `gemma4-31b-v4-v8` |
| Liveness delay | 300 s |
| Cache | ✓ (exact + semantic) |
| Guardrails | ✓ (Layer 0 + NeMo IORails) |
| stream_options.include_usage | ✗ — vLLM backend returns 0/0/0 for all token counts in streaming |
| Known issues | Token counts in streaming usage chunk are always `{prompt_tokens: 0, completion_tokens: 0, total_tokens: 0}`. Non-streaming token counts are correct. Root cause: vLLM version in this image does not populate streaming usage fields. |

---

### Model 10 — Gemma 4 12B (Vision)

| Field | Value |
|---|---|
| Deployment | `gemma-4-12b` |
| API model ID | `google/gemma-4-12b-it` |
| Endpoint | `https://fileupload-alpha.q0.dev/q0/playground/gemma4-12b/v1` |
| Base model | Google Gemma 4 12B Instruct (multimodal) |
| Architecture | Multimodal vision-language; served via custom Flask proxy → Triton gRPC |
| Node | k8s-worker164 |
| GPUs | 1 |
| Memory limit | 96 Gi |
| Tensor parallel | 1 |
| Context window | **4 096 tokens** (total: input + output combined) |
| Max output | **8 192 tokens** (proxy-enforced; returns HTTP 400 if exceeded) |
| GPU utilization | 90 % |
| DTYPE | bfloat16 |
| Image | `gemma4-12b-v2-proxy-v12` |
| Liveness delay | 360 s |
| Cache | ✗ — Flask proxy does not connect to Redis |
| Guardrails | ✗ — no NeMo IORails; no Layer 0 filter |
| Vision | ✓ — accepts base64-encoded images in messages |
| stream_options.include_usage | ✗ — custom proxy does not implement this |
| Known issues | (1) **Context window is 4 096 tokens total** — if prompt is 2 000 tokens, only 2 096 tokens are available for output. (2) Thinking tokens are stripped by proxy before response reaches client. |
| Special behaviour | Requesting `max_tokens > 8 192` returns: `HTTP 400 {"error": {"type": "invalid_request_error", "code": "context_length_exceeded"}}` |

---

## 7. API Request Headers Reference

| Header | Required | Default | Description |
|---|:---:|---|---|
| `Content-Type` | ✓ | — | Must be `application/json` |
| `X-Workspace-ID` | — | `"default"` | Cache namespace. **Always set in production** — omitting it puts all callers in a shared cache pool. |
| `X-Skip-Cache` | — | `"false"` | Set to `true`, `1`, or `yes` to bypass read and write for this request. |

### Request body — optional fields

| Field | Type | Default | Notes |
|---|---|---|---|
| `max_tokens` | int | model default | Hard-capped per model (see Section 2.1). Gemma 4 12B returns HTTP 400 above 8 192. |
| `temperature` | float | 1.0 | 0 = deterministic |
| `top_p` | float | 1.0 | Nucleus sampling |
| `stream` | bool | false | SSE streaming |
| `stream_options` | object | null | `{"include_usage": true}` adds usage chunk to stream end. Supported by 8 of 10 models. |
| `stop` | string / array | null | Stop sequences |
| `frequency_penalty` | float | 0.0 | |
| `presence_penalty` | float | 0.0 | |

---

## 8. Error Codes

| HTTP | Trigger | Example body |
|---|---|---|
| 200 | Success or guardrail refusal | Normal response or `{"choices":[{"message":{"content":"I'm sorry, I can't respond to that."}}]}` |
| 400 | Bad request: wrong model ID, malformed JSON, `max_tokens > 8192` on gemma-4-12b | `{"error":{"type":"invalid_request_error","code":"context_length_exceeded"}}` |
| 422 | Validation error (Pydantic) | Missing required field |
| 500 | Inference engine not attached | Internal server error |
| 503 | Pod not ready | Upstream connection refused |

---

## 9. Verification and Health Checks

### Quick health check

```bash
# Check all 10 pods are Running/Ready
kubectl --context onprem-yotta -n playground get pods \
  -l 'app in (deepseek-r1-8b,mn-inferor-12b,qwq-32b,llama4-scout,mixtral-8x7b,llama3-1-70b,qwen3-5-27b,qwen3-5-35b-a3b,gemma4-31b,gemma-4-12b)'

# Triton HTTP health endpoint (substitute any model path)
curl -s https://fileupload-alpha.q0.dev/q0/playground/deepseek-r1-8b/v2/health/ready
# Returns HTTP 200 when ready

# List registered model IDs
curl -s https://fileupload-alpha.q0.dev/q0/playground/deepseek-r1-8b/v1/models
```

### Quick-check test script

```bash
# Runs 9 checks on all 10 models (basic, stream, guard_block, guard_allow,
# cache_exact, cache_skip, cache_isolate, usage, max_tokens)
python test_models.py

# Single model
python test_models.py qwq-32b
```

Each run uses a fresh `X-Workspace-ID: quickcheck-{timestamp}` so cache checks start from a cold state.

### Full test suite

```bash
python -m pytest tests/test_01_health.py        # 21 tests
python -m pytest tests/test_02_basic.py         # 50 tests
python -m pytest tests/test_03_streaming.py     # 50 tests
python -m pytest tests/test_04_guardrails.py    # 144 tests (16 skip for gemma-4-12b)
python -m pytest tests/test_05_cache.py         # 54 tests (6 skip for gemma-4-12b)
python -m pytest tests/test_06_multi_turn.py    # 16 tests
python -m pytest tests/test_07_vision.py        # 4 tests + 1 skip
python -m pytest tests/test_08_error_handling.py # 80 tests
# Total: 419/419 PASS (as of 2026-08-21)
```

---

## 10. Known Limitations

| Issue | Affected model | Severity | Status |
|---|---|---|---|
| Thinking tokens visible in output | deepseek-r1-8b, qwq-32b, qwen3-5-27b, qwen3-5-35b-a3b | Low — cosmetic | Intentional (reasoning visible to caller) |
| Streaming output not checked by harm_clf | All 9 guardrail models | Medium | By design — output safety requires complete text |
| Token counts always 0 in streaming | gemma4-31b | Medium | vLLM version in image does not report streaming usage |
| Cold start up to 30 min | qwen3-5-27b, qwen3-5-35b-a3b | High (deployment) | FlashInfer JIT; mitigated by 1 800 s liveness probe |
| gemma-4-12b has no guardrails | gemma-4-12b | High — internal use only | Custom proxy architecture; not connected to NeMo stack |
| Default cache namespace shared | All 9 cache models | Medium | Callers without `X-Workspace-ID` share `default` pool |
| 4 096-token total context on gemma-4-12b | gemma-4-12b | Medium | Deployment-time configuration decision |

---

## 11. Deployment Quick Reference

```bash
# Apply a single model YAML (picks up ConfigMap mounts and probe values)
kubectl --context onprem-yotta -n playground apply -f k8s_yamls/<model>.yaml

# Roll out all 10 models
for f in k8s_yamls/*.yaml; do
  kubectl --context onprem-yotta -n playground apply -f "$f"
done

# Watch rollout
kubectl --context onprem-yotta -n playground rollout status deployment/<model>

# Update a ConfigMap patch (e.g. after editing chat.py)
kubectl --context onprem-yotta -n playground create configmap nemo-chat-patch \
  --from-file=chat.py=/tmp/chat.py --dry-run=client -o yaml | \
  kubectl --context onprem-yotta -n playground apply -f -
# Then restart affected pods:
kubectl --context onprem-yotta -n playground rollout restart deployment/<model>
```
