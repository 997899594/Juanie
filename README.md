# Juanie - Modern DevOps Platform

A modern AI-driven DevOps platform built with Next.js, PostgreSQL, Atlas, and Kubernetes.

## Features

- **Multi-team Support**: Create and manage teams with role-based access control
- **Project Management**: Create projects from templates with automatic environment setup
- **GitOps Integration**: Automatic deployment via Flux CD
- **Kubernetes Integration**: Seamless K8s namespace and resource management
- **Real-time Deployments**: Live deployment status via Server-Sent Events (SSE)
- **CI/CD Pipeline**: GitHub Actions integration
- **Pod Logs & Exec**: View logs and execute commands in pods
- **Secrets & ConfigMaps**: Manage Kubernetes secrets and config maps
- **Audit Logging**: Track all team activities
- **Atlas Migrations**: Single control-plane migration system with validation in CI

## Tech Stack

- **Framework**: Next.js 16 (App Router)
- **Database**: PostgreSQL + Drizzle ORM schema modeling + Atlas migrations
- **Auth**: NextAuth.js (GitHub/GitLab OAuth)
- **K8s SDK**: @kubernetes/client-node
- **UI**: Tailwind CSS + Radix UI
- **GitOps**: Flux CD
- **Queue**: BullMQ + Redis

## Getting Started

### Prerequisites

- Node.js 22+
- Bun
- PostgreSQL database
- Docker (recommended for Atlas dev diff/validation)
- Kubernetes cluster (optional, for deployments)

### Installation

```bash
# Install dependencies
bun install

# Copy environment variables
cp .env.example .env

# Configure your .env file
# DATABASE_URL=postgresql://...
# NEXTAUTH_SECRET=...
# GITHUB_CLIENT_ID=...
# GITHUB_CLIENT_SECRET=...

# Apply control-plane migrations
bun run db:push

# Start development server
bun run dev
```

## Database Workflow

Juanie uses one active control-plane migration flow:

- `src/lib/db/schema.ts` defines the desired schema in Drizzle ORM
- `atlas.hcl` exports that schema and lets Atlas diff against the migration directory
- `migrations/` contains the only active control-plane migration history
- `archive/legacy-control-plane-migrations/` stores the retired SQL chain for reference only

Commands:

```bash
bun run db:generate add_feature   # Generate a new Atlas migration
bun run db:hash                   # Refresh migrations/atlas.sum
bun run db:validate               # Validate replayability of the migration directory
bun run db:status                 # Show pending migrations for DATABASE_URL
bun run db:push                   # Apply Atlas migrations
bun run db:studio                 # Open Drizzle Studio against DATABASE_URL
```

Notes:

- CI validates Atlas migrations and checksum, but does not run interactive local hooks.
- Drizzle remains the schema authoring layer, not the runtime migration executor.
- `drizzle.schema.config.ts` is for offline schema export only; `drizzle.studio.config.ts` is for live database tooling.

### Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| DATABASE_URL | Yes | PostgreSQL connection string for runtime, `db:status`, `db:push`, and `db:studio` |
| NEXTAUTH_URL | Yes | Your app URL |
| NEXTAUTH_SECRET | Yes | Secret for NextAuth |
| GITHUB_CLIENT_ID | Yes | GitHub OAuth app client ID |
| GITHUB_CLIENT_SECRET | Yes | GitHub OAuth app client secret |
| GITLAB_CLIENT_ID | No | GitLab OAuth app client ID |
| GITLAB_CLIENT_SECRET | No | GitLab OAuth app client secret |
| KUBECONFIG | No | Kubernetes config path |

## Project Structure

```text
src/
├── app/                    # Next.js App Router
├── components/             # React components
├── hooks/                  # Custom React hooks
└── lib/
    ├── db/                 # Drizzle ORM schema and DB client
    ├── queue/              # Worker and scheduler runtime
    ├── k8s.ts              # K8s client
    ├── flux.ts             # Flux CD integration
    └── git/                # GitHub/GitLab provider abstraction
migrations/                 # Active Atlas migration directory
archive/legacy-control-plane-migrations/
atlas.hcl                   # Atlas project config
```

## API Endpoints

- `POST /api/projects` - Create project
- `GET /api/projects` - List projects
- `GET /api/projects/[id]` - Get project details
- `POST /api/projects/[id]/deployments` - Trigger deployment
- `GET /api/events/deployments` - SSE for deployment updates
- `POST /api/releases` - Create a release
- `GET /api/projects/[id]/resources` - Get K8s resources
- `GET /api/projects/[id]/resources/logs` - Get pod logs

## Architecture Notes

- [Deployment Architecture](./DEPLOYMENT_ARCHITECTURE.md)

## License

MIT
