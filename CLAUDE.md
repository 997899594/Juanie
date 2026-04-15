# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build, Lint, and Development Commands

```bash
# Install dependencies
bun install

# Start both web app and worker (recommended for normal dev)
bun run dev

# Start web app only (Next.js on port 3001)
bun run dev:web

# Start worker only (BullMQ job processor)
bun run dev:worker

# Ensure local Redis is running (required by BullMQ queues)
bun run dev:redis

# Build production bundle
bun run build

# Start production web server
bun run start

# Start production worker process
bun run start:worker

# Lint (Biome)
bun run lint

# Format (Biome)
bun run format

# Database (Atlas + Drizzle schema)
bun run db:generate foo # Generate a new Atlas migration from schema changes
bun run db:hash         # Refresh Atlas migration checksums
bun run db:validate     # Validate the Atlas migration directory
bun run db:status       # Show Atlas migration status for the configured control-plane DB
bun run db:push         # Apply Atlas migrations to database
bun run db:studio       # Open Drizzle Studio against the configured control-plane DB
bun run db:seed        # Seed database
```

## Runtime Prerequisites

- Bun + Node.js 22+
- PostgreSQL (`DATABASE_HOST`, `DATABASE_NAME`, `DATABASE_USER`, `DATABASE_PASSWORD`)
- Redis for queue processing (`REDIS_HOST`, `REDIS_PORT`, optional `REDIS_PASSWORD`)
- Optional Kubernetes access (`KUBECONFIG`) for real cluster operations
- Auth-related env vars for NextAuth and OAuth providers (GitHub/GitLab)

## High-Level Architecture

Juanie is a multi-tenant DevOps control plane for deploying app services to Kubernetes with Git-driven workflows.

### Main Execution Model

1. **Next.js App Router app** (`src/app/`)
   - Serves UI and API routes.
   - Creates projects/environments/deployments and enqueues background jobs.
   - Exposes SSE endpoints for long-running progress and deployment events.

2. **Queue layer** (`src/lib/queue/index.ts`)
   - Defines two BullMQ queues:
     - `project-init` for project bootstrap/import flows
     - `deployment` for deployment execution
   - Uses Redis connection from environment variables.

3. **Worker runtime** (`src/lib/queue/worker.ts`)
   - Runs queue consumers outside the web server process.
   - Boots both project-init and deployment workers.
   - Optionally starts drift detection (`ENABLE_DRIFT_DETECTOR`).

4. **Domain + persistence** (`src/lib/db/`, `atlas.hcl`, `migrations/`)
   - Drizzle schema models teams, projects, repositories, services, environments, deployments, webhooks, etc.
   - Atlas is the only active control-plane migration executor.
   - Workers and API handlers coordinate state transitions through the DB.

5. **Infrastructure adapters**
   - **Kubernetes adapter** (`src/lib/k8s.ts`, `src/lib/k8s/`): namespace/workload/service/secrets/configmaps/gateway routing operations.
   - **Git provider abstraction** (`src/lib/git/`): unified GitHub/GitLab operations (repo, files, webhook).
   - **Environment sync** (`src/lib/env-sync`): syncs env vars into K8s Secret/ConfigMap before deployment.

### Key Async Flows

#### Project initialization/import

- Implemented in `src/lib/queue/project-init.ts`.
- Step-based pipeline (differs for create vs import) including:
  - repository validation/creation
  - CI/CD template or config push
  - webhook setup
  - namespace/service/database/DNS provisioning
- If Kubernetes is unavailable, K8s-dependent steps are gracefully skipped so local development still works.

#### Deployment processing

- Implemented in `src/lib/queue/deployment.ts`.
- Worker transitions deployment status (`building` → `deploying` → `running`/`failed`), updates progress, syncs env vars, resolves image tag from repository URL + commit SHA, then updates/creates deployments in target namespace.

### API and Real-Time Patterns

- API routes are under `src/app/api/` (App Router handlers).
- Long-running operations stream status through SSE endpoints, notably:
  - `/api/projects/[id]/init/stream`
  - `/api/events/deployments`
- Resource operation routes under `/api/projects/[id]/resources/*` proxy operational interactions (logs/exec/resource management) via K8s layer.

### Auth and Multi-Tenancy

- NextAuth + Drizzle adapter with JWT sessions.
- OAuth providers: GitHub and GitLab.
- Team-scoped access model (owner/admin/member) drives project/repository/operation permissions.

### Codebase Conventions

- Biome formatting/linting (`single quotes`, `2-space indent`, `line width 100`).
- TS path alias: `@/*` → `./src/*`.
- UI stack uses Radix UI primitives + Tailwind CSS.
