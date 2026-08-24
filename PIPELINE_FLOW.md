# AWS CodePipeline — Trigger & Deployment Flow

## High-Level Flow Diagram

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                          AWS CodePipeline (V2)                                   │
│                     Name: application-service-pipeline                            │
└─────────────────────────────────────────────────────────────────────────────────┘

     ┌──────────┐         ┌──────────┐         ┌──────────┐         ┌──────────┐
     │  TRIGGER │────────▶│  SOURCE  │────────▶│  BUILD   │────────▶│  DEPLOY  │
     └──────────┘         └──────────┘         └──────────┘         └──────────┘
          │                     │                     │                     │
          │                     │                     │                     │
    Git push to           Pull source            Build Docker          Update ECS
    `develop`             from GitHub            image & push          Service with
    branch                                      to ECR                new image
```

---

## Detailed Stage-by-Stage Flow

```
┌─────────────────────────────────────────────────────────────────────────────────────┐
│                                                                                     │
│   DEVELOPER                                                                         │
│   ─────────                                                                         │
│                                                                                     │
│   git push origin develop                                                           │
│        │                                                                            │
│        ▼                                                                            │
│   ┌─────────────────────┐                                                           │
│   │   GitHub Repository  │                                                           │
│   │   (develop branch)   │                                                           │
│   └──────────┬──────────┘                                                           │
│              │                                                                      │
│              │  Webhook event (via GitHub Connection/CodeStar)                       │
│              ▼                                                                      │
│   ┌─────────────────────────────────────────────────────────────────────────┐       │
│   │                     STAGE 1: SOURCE                                      │       │
│   │                                                                         │       │
│   │   Provider: GitHub (Version 2 — CodeStar Connection)                    │       │
│   │   Action:   Downloads source code as ZIP artifact                       │       │
│   │   Output:   SourceArtifact (stored in S3 pipeline bucket)               │       │
│   │                                                                         │       │
│   │   Trigger: ON PUSH to `develop` branch                                  │       │
│   │   ┌───────────────────────────────────────────────────────┐             │       │
│   │   │ Connection: AWS CodeStar ↔ GitHub App installed       │             │       │
│   │   │ on psharmayotta/Application-service-cicd repo         │             │       │
│   │   └───────────────────────────────────────────────────────┘             │       │
│   └──────────────────────────────┬──────────────────────────────────────────┘       │
│                                  │                                                  │
│                                  │  Passes SourceArtifact                           │
│                                  ▼                                                  │
│   ┌─────────────────────────────────────────────────────────────────────────┐       │
│   │                     STAGE 2: BUILD (CodeBuild)                           │       │
│   │                                                                         │       │
│   │   Project: application-service-build                                    │       │
│   │   Image:   aws/codebuild/amazonlinux2-x86_64-standard:5.0              │       │
│   │   Privileged: YES (needed for Docker daemon)                            │       │
│   │                                                                         │       │
│   │   ┌─────────────────────────────────────────────────────────────┐       │       │
│   │   │  buildspec.yml phases:                                       │       │       │
│   │   │                                                             │       │       │
│   │   │  pre_build:                                                 │       │       │
│   │   │    • Login to ECR (aws ecr get-login-password)              │       │       │
│   │   │    • Set IMAGE_TAG from commit hash                         │       │       │
│   │   │                                                             │       │       │
│   │   │  build:                                                     │       │       │
│   │   │    • docker build -t <ecr-uri>:latest .                     │       │       │
│   │   │    • docker tag <ecr-uri>:latest <ecr-uri>:<commit-hash>    │       │       │
│   │   │                                                             │       │       │
│   │   │  post_build:                                                │       │       │
│   │   │    • docker push <ecr-uri>:latest                           │       │       │
│   │   │    • docker push <ecr-uri>:<commit-hash>                    │       │       │
│   │   │    • Generate imagedefinitions.json                         │       │       │
│   │   └─────────────────────────────────────────────────────────────┘       │       │
│   │                                                                         │       │
│   │   Output: BuildArtifact (imagedefinitions.json in S3)                   │       │
│   └──────────────────────────────┬──────────────────────────────────────────┘       │
│                                  │                                                  │
│                                  │  Passes imagedefinitions.json                    │
│                                  ▼                                                  │
│   ┌─────────────────────────────────────────────────────────────────────────┐       │
│   │                     STAGE 3: DEPLOY (ECS)                                │       │
│   │                                                                         │       │
│   │   Provider: Amazon ECS                                                  │       │
│   │   Cluster:  application-service-cluster                                 │       │
│   │   Service:  application-service-svc                                     │       │
│   │                                                                         │       │
│   │   ┌─────────────────────────────────────────────────────────────┐       │       │
│   │   │  imagedefinitions.json content:                              │       │       │
│   │   │  [{"name":"application-service",                            │       │       │
│   │   │    "imageUri":"<account>.dkr.ecr.<region>.amazonaws.com/    │       │       │
│   │   │               application-service:<commit-hash>"}]          │       │       │
│   │   └─────────────────────────────────────────────────────────────┘       │       │
│   │                                                                         │       │
│   │   Action:                                                               │       │
│   │     1. ECS reads imagedefinitions.json                                  │       │
│   │     2. Creates NEW task definition revision with updated image          │       │
│   │     3. Updates the Service to use the new task definition               │       │
│   │     4. ECS performs ROLLING UPDATE:                                      │       │
│   │        - Starts new task with new image                                 │       │
│   │        - Waits for health check to pass                                 │       │
│   │        - Drains old task                                                │       │
│   │        - Stops old task                                                 │       │
│   └─────────────────────────────────────────────────────────────────────────┘       │
│                                                                                     │
└─────────────────────────────────────────────────────────────────────────────────────┘
```

---

## Trigger Mechanism — How it Works

```
┌──────────────┐    push event     ┌──────────────────┐    webhook     ┌─────────────────┐
│   Developer  │──────────────────▶│  GitHub.com      │──────────────▶│ AWS CodeStar    │
│   (git push) │                   │  (develop branch)│               │ Connection      │
└──────────────┘                   └──────────────────┘               └────────┬────────┘
                                                                               │
                                                                               │ Notifies
                                                                               ▼
                                                                      ┌─────────────────┐
                                                                      │  CodePipeline   │
                                                                      │  (auto-starts)  │
                                                                      └─────────────────┘
```

### How the GitHub → AWS connection works:

1. **One-time setup**: You create a **CodeStar Connection** in AWS that installs a GitHub App on your repo
2. **On every push**: GitHub sends a webhook to AWS via this connection
3. **CodePipeline V2** has an **event-based trigger** — it listens for push events on the `develop` branch
4. **No polling** — it's instant (triggers within seconds of the push)

---

## What Happens Inside ECS During Deploy

```
┌─────────────────────────────────────────────────────────────────┐
│                    ECS Rolling Deployment                         │
│                                                                  │
│   Time ─────────────────────────────────────────────────────▶   │
│                                                                  │
│   ┌────────────────┐                                            │
│   │ Old Task v1    │ ← running, serving traffic                 │
│   │ (old image)    │                                            │
│   └────────────────┘                                            │
│                                                                  │
│          Deploy triggered                                        │
│               │                                                  │
│               ▼                                                  │
│   ┌────────────────┐  ┌────────────────┐                       │
│   │ Old Task v1    │  │ New Task v2    │ ← starting up          │
│   │ (still serving)│  │ (pulling image)│                        │
│   └────────────────┘  └────────────────┘                        │
│                                                                  │
│          Health check passes on v2                               │
│               │                                                  │
│               ▼                                                  │
│   ┌────────────────┐  ┌────────────────┐                       │
│   │ Old Task v1    │  │ New Task v2    │ ← healthy, receives    │
│   │ (draining)     │  │ (serving)      │   traffic              │
│   └────────────────┘  └────────────────┘                        │
│                                                                  │
│          Drain complete                                          │
│               │                                                  │
│               ▼                                                  │
│                        ┌────────────────┐                       │
│                        │ New Task v2    │ ← only task running    │
│                        │ (serving)      │                        │
│                        └────────────────┘                       │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## Environment Variables Flow

```
┌─────────────────────────────────────────────────────────────┐
│                    Where env vars live                        │
│                                                             │
│  CodeBuild (build-time):                                    │
│  ┌────────────────────────────────────────────────────┐     │
│  │ AWS_ACCOUNT_ID    = 123456789012                   │     │
│  │ AWS_DEFAULT_REGION = ap-south-1                    │     │
│  │ IMAGE_REPO_NAME   = application-service            │     │
│  │ CONTAINER_NAME    = application-service            │     │
│  └────────────────────────────────────────────────────┘     │
│                                                             │
│  ECS Task Definition (runtime):                             │
│  ┌────────────────────────────────────────────────────┐     │
│  │ NODE_ENV           = development                   │     │
│  │ DB_HOST            = (from Secrets Manager or env)  │     │
│  │ DB_PORT            = 5432                          │     │
│  │ KAFKA_BROKERS      = (from Secrets Manager)        │     │
│  │ ... other app env vars                             │     │
│  └────────────────────────────────────────────────────┘     │
│                                                             │
│  Secrets (sensitive values):                                │
│  ┌────────────────────────────────────────────────────┐     │
│  │ Use AWS Secrets Manager or SSM Parameter Store     │     │
│  │ Referenced in Task Definition as:                  │     │
│  │   "secrets": [                                     │     │
│  │     {"name":"DB_PASSWORD",                         │     │
│  │      "valueFrom":"arn:aws:secretsmanager:..."}     │     │
│  │   ]                                                │     │
│  └────────────────────────────────────────────────────┘     │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## Quick Reference: AWS Console Selections

| Setting | What to Select |
|---------|---------------|
| Pipeline type | **V2** (event-driven, no polling) |
| Source provider | **GitHub (Version 2)** via CodeStar Connection |
| Trigger type | **Push on branch** → `develop` |
| Build provider | **AWS CodeBuild** |
| Build image | Amazon Linux 2, Standard 5.0 |
| Privileged mode | **Enabled** (for Docker) |
| Deploy provider | **Amazon ECS** |
| Deploy input | `imagedefinitions.json` (from build output) |
| ECS launch type | **Fargate** |
| ECS deployment type | **Rolling update** (default) |
