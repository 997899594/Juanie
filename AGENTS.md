# Juanie - AI DevOps Platform

This document provides coding guidelines and conventions for agentic coding agents working in this repository.

## Project Overview

Juanie is a modern AI-driven DevOps platform built with:
- **Framework**: Next.js 16 (App Router)
- **Language**: TypeScript (strict mode)
- **Database**: PostgreSQL + Drizzle ORM
- **Auth**: NextAuth.js (GitHub/GitLab OAuth)
- **UI**: Tailwind CSS + Radix UI components
- **K8s SDK**: @kubernetes/client-node
- **Queue**: BullMQ + Redis
- **Runtime**: Bun

## Build/Lint/Test Commands

```bash
# Development (同时启动 Web + Worker)
bun run dev              # 启动开发服务器 (web:3001) + 队列 worker

# 单独启动
bun run dev:web          # 只启动 Next.js 开发服务器
bun run dev:worker       # 只启动队列 worker (热重载)
bun run dev:redis        # 启动 Redis Docker 容器

# Build
bun run build            # Build for production

# Production
bun run start            # 启动 Next.js 生产服务器
bun run start:worker     # 启动队列 worker (生产模式)

# Linting & Formatting
bun run lint             # Run Biome linter
bun run format           # Format code with Biome

# Database
bun run db:generate      # Generate Drizzle migrations
bun run db:push          # Push schema changes to database
bun run db:studio        # Open Drizzle Studio
```

**Note**: No test framework is currently configured. When adding tests, prefer Vitest and update this document.

## Architecture

### 项目初始化流程

```
创建项目 API (POST /api/projects)
    ↓
插入 projectInitSteps (pending)
    ↓
添加 BullMQ Job
    ↓
Worker 处理 (project-init queue)
    ↓
SSE 推送进度
```

### 初始化步骤

**Import 模式** (导入现有仓库):
1. `validate_repository` - 验证仓库访问权限
2. `setup_namespace` - 创建 K8s Namespace
3. `deploy_services` - 部署所有服务
4. `provision_databases` - 创建托管数据库
5. `configure_dns` - 配置域名和 TLS

**Create 模式** (从模板创建):
1. `create_repository` - 在 Git Provider 创建仓库
2. `push_template` - 推送模板代码
3. `setup_namespace` - 创建 K8s Namespace
4. `deploy_services` - 部署所有服务
5. `provision_databases` - 创建托管数据库
6. `configure_dns` - 配置域名和 TLS

### 部署流程

```
创建部署 API (POST /api/projects/[id]/deployments)
    ↓
插入 deployment (status: queued)
    ↓
添加 BullMQ Job (deployment queue)
    ↓
Worker 处理
    ↓
更新 deployment status
```

## Code Style Guidelines

### Formatting (Biome)

- **Indent**: 2 spaces
- **Line width**: 100 characters
- **Quotes**: Single quotes for strings
- **Trailing commas**: ES5 style
- **Imports**: Auto-organized by Biome

### TypeScript

- Strict mode is enabled
- Prefer explicit return types for exported functions
- Use `interface` for object types, `type` for unions/intersections
- Avoid `any`; use `unknown` when type is truly unknown
- Use type assertions sparingly (`as`)

### Imports

Order your imports as follows (Biome auto-organizes):

```typescript
// 1. External packages
import { eq } from 'drizzle-orm'
import { NextResponse } from 'next/server'

// 2. Internal imports with @ alias
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { users } from '@/lib/db/schema'

// 3. Relative imports (avoid when possible)
```

Use `@/*` alias for imports from `src/`:

```typescript
// Correct
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

// Avoid
import { Button } from '../../../components/ui/button'
```

### Naming Conventions

| Type | Convention | Example |
|------|------------|---------|
| Files (components) | PascalCase.tsx | `Button.tsx` |
| Files (utilities) | camelCase.ts | `utils.ts` |
| Files (routes) | lowercase/route.ts | `api/users/route.ts` |
| React components | PascalCase | `UserProfile` |
| Functions | camelCase | `getUserById` |
| Constants | camelCase or SCREAMING_SNAKE_CASE | `MAX_RETRIES`, `defaultTimeout` |
| Database tables | camelCase (plural) | `users`, `teamMembers` |
| Types/Interfaces | PascalCase | `User`, `DeploymentStatus` |
| Enums | camelCase values | `'pending'`, `'queued'` |

### API Routes (Next.js App Router)

- Export async functions for HTTP methods: `GET`, `POST`, `PUT`, `DELETE`
- Always authenticate requests using `auth()` from `@/lib/auth`
- Return `NextResponse.json()` for JSON responses
- Include proper HTTP status codes

```typescript
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const session = await auth()

  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // ... logic

  return NextResponse.json(data)
}
```

### Database (Drizzle ORM)

- Schema is defined in `src/lib/db/schema.ts`
- Use `db.query.*` for queries with relations
- Use `db.select()`, `db.insert()`, `db.update()`, `db.delete()` for direct operations

```typescript
// Query with relations
const user = await db.query.users.findFirst({
  where: eq(users.id, userId),
})

// Direct select with join
const result = await db
  .select({ project: projects, teamName: teams.name })
  .from(projects)
  .innerJoin(teams, eq(teams.id, projects.teamId))
```

### Queue (BullMQ)

- Queue definitions: `src/lib/queue/index.ts`
- Project init processor: `src/lib/queue/project-init.ts`
- Deployment processor: `src/lib/queue/deployment.ts`
- Worker entry point: `src/lib/queue/worker.ts`

```typescript
// Add job to queue
import { addProjectInitJob, addDeploymentJob } from '@/lib/queue'

await addProjectInitJob(projectId, 'import')
await addDeploymentJob(deploymentId, projectId, environmentId)
```

### Kubernetes Client

```typescript
// 自动初始化（从环境变量读取 kubeconfig）
import { getK8sClient, createNamespace } from '@/lib/k8s'

const { core, apps, custom } = getK8sClient()
await createNamespace('my-namespace')
```

### Flux CD (Custom Resources)

```typescript
import { createGitRepository, createKustomization } from '@/lib/flux'

await createGitRepository(name, namespace, { 
  url, 
  ref: { branch },
  secretRef: { name: 'git-credentials' }
})
await createKustomization(name, namespace, { 
  sourceRef: { kind: 'GitRepository', name },
  path: './k8s',
  prune: true
})
```

## Project Structure

```
src/
├── app/                    # Next.js App Router
│   ├── api/               # API routes
│   │   ├── projects/      # 项目 CRUD
│   │   ├── git/           # Git Provider API
│   │   ├── teams/         # 团队管理
│   │   └── webhooks/      # Git Webhook 接收
│   ├── projects/          # 项目页面
│   │   ├── new/           # 创建项目
│   │   └── [id]/
│   │       ├── initializing/  # 初始化进度
│   │       ├── deployments/   # 部署列表
│   │       └── ...
│   ├── teams/             # 团队页面
│   ├── layout.tsx         # Root layout
│   └── page.tsx           # Home page
├── components/
│   ├── ui/                # Radix UI + Tailwind components
│   └── projects/          # 项目相关组件
├── lib/                   # Core libraries
│   ├── db/                # Drizzle ORM setup & schema
│   ├── git/               # Git Provider 抽象层
│   ├── config/            # juanie.yaml 解析器
│   ├── queue/             # BullMQ 队列
│   ├── auth.ts            # NextAuth configuration
│   ├── k8s.ts             # Kubernetes client
│   ├── flux.ts            # Flux CD integration
│   └── utils.ts           # Utility functions (cn)
└── types/                 # TypeScript type augmentations
```

## Environment Variables

Required environment variables (see `.env.example`):

```bash
# Database
DATABASE_URL=postgresql://user:password@localhost:5432/juanie

# Auth
NEXTAUTH_SECRET=your-secret-key
NEXTAUTH_URL=http://localhost:3001

# OAuth
GITHUB_CLIENT_ID=xxx
GITHUB_CLIENT_SECRET=xxx

# Redis (BullMQ)
REDIS_HOST=localhost
REDIS_PORT=6379

# Kubernetes
KUBECONFIG=~/.kube/config
# 或
KUBECONFIG_CONTENT=<base64-encoded>
```

## Development Workflow

1. **Before starting**: 
   - Run `bun install` to ensure dependencies are installed
   - Run `bun run dev:redis` to start Redis (首次需要)
   - Run `bun run db:push` to sync database schema

2. **Development**: Run `bun run dev` (启动 Web + Worker)

3. **Database changes**: Edit `src/lib/db/schema.ts`, then run `bun run db:push`

4. **Before committing**: Run `bun run lint` to check for issues
