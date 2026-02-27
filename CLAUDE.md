# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build, Test, and Development Commands

```bash
# Development (runs web server + background worker)
bun run dev

# Development server only (port 3001)
bun run dev:web

# Background worker only (BullMQ job processor)
bun run dev:worker

# Start Redis container (required for job queues)
bun run dev:redis

# Build for production
bun run build

# Production server
bun run start

# Production worker
bun run start:worker

# Linting (Biome)
bun run lint

# Format code (Biome)
bun run format

# Database operations (Drizzle)
bun run db:generate    # Generate migrations from schema changes
bun run db:push        # Push schema directly to database
bun run db:studio      # Open Drizzle Studio
bun run db:seed        # Run seed script
```

## High-Level Architecture

Juanie is a DevOps platform for deploying applications to Kubernetes. The architecture consists of:

### Core Components

1. **Next.js 16 App** (`src/app/`): Web UI and API routes using App Router
2. **BullMQ Workers** (`src/lib/queue/`): Background job processing for project initialization and deployments
3. **PostgreSQL + Drizzle ORM** (`src/lib/db/`): Data persistence with comprehensive schema
4. **Kubernetes Client** (`src/lib/k8s.ts`): Direct K8s API interactions
5. **Flux CD Integration** (`src/lib/flux.ts`): GitOps-based deployments

### Key Data Model

- **Teams** → Multi-tenant organization with owner/admin/member roles
- **Projects** → Deployable applications belonging to a team
- **Services** → Workloads within a project (web, worker, cron)
- **Environments** → Deployment targets (production, preview, etc.)
- **Deployments** → Individual deployment records with status tracking
- **GitProviders/Repositories** → Git integration (GitHub, GitLab)

### Background Jobs

Two BullMQ queues handle async operations:

1. **project-init** (`src/lib/queue/project-init.ts`): Initializes new projects
   - Steps: validate/create repository → setup namespace → deploy services → provision databases → configure DNS
   - Uses Cilium Gateway API for ingress

2. **deployment** (`src/lib/queue/deployment.ts`): Handles deployment jobs

Both queues require Redis. The worker process (`src/lib/queue/worker.ts`) runs independently from the web server.

### Kubernetes Integration

The K8s client (`src/lib/k8s.ts`) provides:
- Namespace, Deployment, Service, StatefulSet, ConfigMap, Secret management
- Cilium Gateway API (Gateway + HTTPRoute) instead of traditional Ingress
- Pod logs and exec capabilities

The system gracefully degrades when no K8s cluster is available (useful for development).

### Authentication

- NextAuth.js with Drizzle adapter
- OAuth providers: GitHub, GitLab
- Dev mode: Credentials provider with auto-created dev user
- Session strategy: JWT

### Code Style

- Linter/formatter: Biome (single quotes, 2-space indent, 100-char line width)
- Path alias: `@/*` maps to `./src/*`
- UI: Radix UI primitives with Tailwind CSS

### API Patterns

API routes in `src/app/api/` follow Next.js App Router conventions. Key endpoints:
- `/api/projects/[id]/init/stream` - SSE for project initialization progress
- `/api/events/deployments` - SSE for real-time deployment updates
- `/api/projects/[id]/resources/*` - K8s resource operations

### Git Provider Abstraction

`src/lib/git/` provides a unified interface for GitHub and GitLab (self-hosted or cloud). Each provider implements:
- OAuth flow, repository listing/creation, file pushing, webhook management
