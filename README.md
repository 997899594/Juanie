# Juanie - Modern DevOps Platform

A modern AI-driven DevOps platform built with Next.js 15, Drizzle ORM, and Kubernetes.

## Features

- **Multi-team Support**: Create and manage teams with role-based access control
- **Project Management**: Create projects from templates with automatic environment setup
- **GitOps Integration**: Automatic deployment via Flux CD
- **Kubernetes Integration**: Seamless K8s namespace and resource management
- **Real-time Deployments**: Live deployment status via Server-Sent Events (SSE)
- **CI/CD Pipeline**: GitHub Actions integration
- **Pod Logs & Exec**: View logs and execute commands in pods
- **Secrets & ConfigMaps**: Manage Kubernetes secrets and config maps
- **Webhook Notifications**: Deploy event notifications
- **Audit Logging**: Track all team activities

## Tech Stack

- **Framework**: Next.js 15 (App Router)
- **Database**: PostgreSQL + Drizzle ORM
- **Auth**: NextAuth.js (GitHub/GitLab OAuth)
- **K8s SDK**: @kubernetes/client-node
- **UI**: Tailwind CSS + Radix UI
- **GitOps**: Flux CD

## Getting Started

### Prerequisites

- Node.js 22+
- Bun
- PostgreSQL database
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

# Generate database schema
bun run db:generate
bun run db:push

# Start development server
bun run dev
```

### Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| DATABASE_URL | Yes | PostgreSQL connection string |
| NEXTAUTH_URL | Yes | Your app URL |
| NEXTAUTH_SECRET | Yes | Secret for NextAuth |
| GITHUB_CLIENT_ID | Yes | GitHub OAuth app client ID |
| GITHUB_CLIENT_SECRET | Yes | GitHub OAuth app client secret |
| GITLAB_CLIENT_ID | No | GitLab OAuth app client ID |
| GITLAB_CLIENT_SECRET | No | GitLab OAuth app client secret |
| KUBECONFIG | No | Kubernetes config path |

## Project Structure

```
src/
├── app/                    # Next.js App Router
│   ├── api/               # API routes
│   │   ├── auth/         # NextAuth
│   │   ├── projects/    # Projects CRUD
│   │   ├── teams/       # Teams CRUD
│   │   ├── deployments/ # Deployments
│   │   └── clusters/    # K8s clusters
│   ├── projects/        # Project pages
│   └── teams/           # Team pages
├── components/            # React components
│   └── ui/              # UI components (Radix)
├── hooks/                 # Custom React hooks
└── lib/                  # Core libraries
    ├── db/               # Drizzle ORM schema
    ├── k8s.ts           # K8s client
    ├── flux.ts           # Flux CD integration
    └── github.ts         # GitHub API
```

## API Endpoints

- `POST /api/projects` - Create project
- `GET /api/projects` - List projects
- `GET /api/projects/[id]` - Get project details
- `POST /api/projects/[id]/deployments` - Trigger deployment
- `GET /api/events/deployments` - SSE for deployment updates
- `POST /api/projects/init` - Initialize project (K8s/Flux)
- `GET /api/projects/[id]/resources` - Get K8s resources
- `GET /api/projects/[id]/resources/logs` - Get pod logs

## License

MIT
