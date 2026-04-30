# Juanie - AI DevOps Platform

Juanie 是一个面向项目交付、预览环境、受控放量和数据库 Schema 治理的 AI DevOps 平台。

当前架构真源：[`docs/current-architecture.md`](./docs/current-architecture.md)。

`docs/plans/` 只保留历史方案和取舍记录，不作为实现真源。

## 主能力

- 多团队与团队级 Git 集成绑定
- 创建/导入项目并注入 Juanie 管理的 CI 与 `juanie.yaml`
- preview / staging / production 环境主线
- 基于 Argo CD ApplicationSet 的预览环境脚手架
- 基于 Argo CD Application 的平台自身 GitOps 发布
- 基于 Argo Rollouts 的生产受控放量
- CloudNativePG 托管 PostgreSQL
- Atlas 控制面迁移与应用 Schema 门禁
- External Secrets / cert-manager / RBAC 安全基线
- BullMQ + Redis 后台队列
- release / deployment / migration 统一 trace id
- SSE 实时推送初始化、发布、部署和 Schema 修复状态
- AI 摘要、任务中心、动态插件与 eval 校验

## Tech Stack

- **Framework**: Next.js 16 (App Router)
- **Database**: PostgreSQL + Drizzle ORM schema modeling + Atlas migrations
- **Auth**: NextAuth.js (GitHub/GitLab OAuth)
- **K8s SDK**: @kubernetes/client-node
- **UI**: Tailwind CSS + Radix UI
- **GitOps / Rollout**: Argo CD ApplicationSet + Argo Rollouts
- **Queue**: BullMQ + Redis
- **Runtime**: Bun-first; Web production uses Node 24 + Next standalone

## Getting Started

### Prerequisites

- Node.js 24+
- Bun 1.3.9+
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
# DATABASE_HOST=localhost
# DATABASE_PORT=5432
# DATABASE_NAME=juanie
# DATABASE_USER=postgres
# DATABASE_PASSWORD=...
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

平台生产发布同样走 GitOps：

- CI 构建镜像后只更新 `deploy/k8s/charts/juanie/values-gitops.yaml`
- Argo CD Application 读取 `values-prod.yaml + values-gitops.yaml` 同步 Helm chart
- 控制面 Atlas 迁移由 chart 内的 Argo PreSync `schema-runner` Job 执行
- SSH 远程 Helm 部署脚本已删除，避免平台自身发布出现第二条路径

Commands:

```bash
bun run db:generate add_feature   # Generate a new Atlas migration
bun run db:hash                   # Refresh migrations/atlas.sum
bun run db:validate               # Validate replayability of the migration directory
bun run db:status                 # Show pending migrations for the configured control-plane DB
bun run db:push                   # Apply Atlas migrations
bun run db:studio                 # Open Drizzle Studio against the configured control-plane DB
```

Notes:

- CI validates Atlas migrations and checksum, but does not run interactive local hooks.
- Drizzle remains the schema authoring layer, not the runtime migration executor.
- `drizzle.schema.config.ts` is for offline schema export only; `drizzle.studio.config.ts` is for live database tooling.

### Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| DATABASE_HOST | Yes | PostgreSQL host for control-plane runtime config |
| DATABASE_PORT | No | PostgreSQL port for control-plane runtime config |
| DATABASE_NAME | Yes | PostgreSQL database name for control-plane runtime config |
| DATABASE_USER | Yes | PostgreSQL username for control-plane runtime config |
| DATABASE_PASSWORD | Yes | PostgreSQL password for control-plane runtime config |
| NEXTAUTH_URL | Yes | Your app URL |
| NEXTAUTH_SECRET | Yes | Secret for NextAuth |
| GITHUB_CLIENT_ID | Yes | GitHub OAuth app client ID |
| GITHUB_CLIENT_SECRET | Yes | GitHub OAuth app client secret |
| GITLAB_CLIENT_ID | No | GitLab OAuth app client ID |
| GITLAB_CLIENT_SECRET | No | GitLab OAuth app client secret |
| KUBECONFIG | No | Kubernetes config path |

## 当前结构入口

```text
src/
├── app/                    # Next.js App Router
├── components/             # React components
├── hooks/                  # Custom React hooks
└── lib/
    ├── db/                 # Drizzle ORM schema and DB client
    ├── queue/              # Worker and scheduler runtime
    ├── k8s.ts              # K8s client
    ├── argocd.ts           # Argo CD / Argo Rollouts helpers
    ├── schema-safety/      # Schema 门禁对外入口
    ├── schema-management/  # Schema inspect / repair / runner internals
    └── git/                # GitHub/GitLab provider abstraction
deploy/k8s/                 # Helm chart and platform bootstrap scripts
migrations/                 # Active Atlas migration directory
archive/legacy-control-plane-migrations/
atlas.hcl                   # Atlas project config
scripts/update-platform-gitops-values.ts # CI 更新平台 GitOps 镜像指针
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

- [当前架构入口](./docs/current-architecture.md)
- [部署架构历史说明](./DEPLOYMENT_ARCHITECTURE.md)

## License

MIT
