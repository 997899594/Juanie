---
inclusion: always
---

# 项目指南

## 技术栈

**后端**: NestJS + tRPC + Drizzle ORM + PostgreSQL + Redis + BullMQ  
**前端**: Vue 3 + Vite 7 + Tailwind 4 + shadcn-vue + Pinia  
**基础设施**: K3s + Flux CD + Docker  
**工具**: Bun + Turborepo + Biome + TypeScript 严格模式

## 项目结构

```
apps/
  api-gateway/          # NestJS + tRPC 后端
  web/                  # Vue 3 前端

packages/
  core/                 # 核心 (database, queue, events, utils)
  services/
    foundation/         # 基础层 (auth, users, storage)
    business/           # 业务层 (projects, deployments, gitops)
    extensions/         # 扩展层 (ai, monitoring)
  ui/                   # shadcn-vue 组件库
  types/                # 类型定义
```

**依赖关系**: Extensions → Business → Foundation → Core

## 命名规范

**包**: `@juanie/[name]`  
**文件**: 组件 PascalCase, 其他 kebab-case  
**代码**: 类/类型 PascalCase, 函数 camelCase, 常量 UPPER_SNAKE_CASE

## 核心原则

1. **使用成熟工具** - 不重复造轮子
2. **类型安全优先** - TS 严格模式，避免 any，用 Zod 验证
3. **避免临时方案** - 找根本原因，用官方方案
4. **关注点分离** - Service 业务逻辑，DTO 验证，组件 UI
5. **绝不向后兼容** - 直接替换，删除旧代码

## 常用命令

```bash
bun install && bun run dev     # 启动开发
bun run dev:web                # 只启动前端
bun run dev:api                # 只启动后端
bun run db:push                # 应用数据库迁移
biome check --write            # 格式化代码
bun test                       # 运行测试
bun run health                 # Monorepo 健康检查
bun run reinstall              # 清理并重新安装依赖
```

## Monorepo 管理

**单一依赖树**: 所有依赖安装在根 `node_modules`，子包不创建独立的 `node_modules`

**关键配置**:
- `bunfig.toml`: `hoisting = true`, `flattenWorkspace = true`
- `package.json`: 使用 `resolutions` 统一关键依赖版本
- `.gitignore`: 忽略 `.bun-cache`, `.turbo`, `node_modules`

**常见问题**:
- 依赖版本冲突: 运行 `bun run reinstall`
- 子包有 node_modules: 运行 `./scripts/enforce-single-dependency-tree.sh`
- 构建失败: 运行 `bun run health` 检查配置

参考: `docs/guides/monorepo-best-practices.md`

## 导入示例

### 数据库操作

```typescript
// ✅ Schema - 从 @juanie/database 导入
import * as schema from '@juanie/database'

// ✅ 数据库类型 - 从 drizzle-orm 导入
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js'

// ✅ 注入令牌 - 从 @juanie/core/tokens 导入
import { DATABASE } from '@juanie/core/tokens'

// ✅ 使用示例
@Injectable()
export class MyService {
  constructor(
    @Inject(DATABASE) private readonly db: PostgresJsDatabase<typeof schema>,
  ) {}

  async getProject(id: string) {
    // 使用 Drizzle 关系查询
    return this.db.query.projects.findFirst({
      where: eq(schema.projects.id, id),
      with: {
        environments: true,
        team: true
      }
    })
  }
}
```

### Flux 和 K8s 操作

```typescript
// ✅ Business 层直接使用 Core 层服务
import { FluxCliService } from '@juanie/core/flux'
import { K8sClientService } from '@juanie/core/k8s'

@Injectable()
export class GitSyncService {
  constructor(
    private readonly fluxCli: FluxCliService,      // 直接注入 Core 服务
    private readonly k8sClient: K8sClientService,  // 直接注入 Core 服务
  ) {}

  async syncRepository(options: SyncOptions) {
    // 直接使用 FluxCliService，不需要包装
    await this.fluxCli.createGitRepository({
      name: `project-${options.projectId}`,
      namespace: options.namespace,
      url: options.repoUrl,
      branch: options.branch
    })
  }
}
```

### 事件处理

```typescript
// ✅ 直接使用 EventEmitter2，不需要自定义包装器
import { EventEmitter2, OnEvent } from '@nestjs/event-emitter'
import { DomainEvents } from '@juanie/core/events'

@Injectable()
export class ProjectsService {
  constructor(
    private readonly eventEmitter: EventEmitter2,  // 直接注入
  ) {}

  async createProject(data: NewProject) {
    const project = await this.db.insert(schema.projects).values(data).returning()

    // 直接发射事件
    this.eventEmitter.emit(DomainEvents.PROJECT_CREATED, {
      projectId: project.id,
      userId: data.userId
    })

    return project
  }

  // 直接监听事件
  @OnEvent(DomainEvents.PROJECT_CREATED)
  async handleProjectCreated(payload: ProjectCreatedEvent) {
    // 处理事件
  }

  // 支持通配符
  @OnEvent('project.*')
  async handleAnyProjectEvent(payload: any) {
    // 处理所有项目事件
  }
}
```

### 队列和作业

```typescript
// ✅ 使用 BullMQ 内置功能
import { Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq'
import { Job } from 'bullmq'
import { QueueModule } from '@juanie/core/queue'

@Processor('project-initialization')
export class ProjectInitializationWorker extends WorkerHost {
  async process(job: Job<InitJobData>) {
    // 使用 BullMQ 内置进度跟踪
    await job.updateProgress(10)
    await this.step1()

    await job.updateProgress(50)
    await this.step2()

    await job.updateProgress(100)
  }

  // 使用 BullMQ 内置事件
  @OnWorkerEvent('completed')
  onCompleted(job: Job) {
    this.logger.info({ jobId: job.id }, 'Job completed')
  }

  @OnWorkerEvent('failed')
  onFailed(job: Job, error: Error) {
    this.logger.error({ jobId: job.id, error }, 'Job failed')
  }
}
```

### 错误处理

```typescript
// ✅ 使用 SDK 原生错误类型
import { RequestError } from '@octokit/request-error'
import { GitbeakerRequestError } from '@gitbeaker/requester-utils'
import { ErrorFactory } from '@juanie/types'

@Injectable()
export class GitService {
  async createRepository(name: string) {
    try {
      return await this.githubClient.repos.create({ name })
    } catch (error) {
      // 直接使用 SDK 错误类型
      if (error instanceof RequestError) {
        if (error.status === 422) {
          throw ErrorFactory.conflict('Repository already exists', { cause: error })
        }
        if (error.status === 404) {
          throw ErrorFactory.notFound('Organization not found', { cause: error })
        }
      }
      // 保留原始错误
      throw error
    }
  }
}
```

### 其他常用导入

```typescript
// 加密 - 纯函数从 Core 导入
import { encrypt, decrypt, getEncryptionKey } from '@juanie/core/encryption'

// Logger - 直接使用 nestjs-pino
import { PinoLogger } from 'nestjs-pino'

// 存储 - 从 Foundation 层导入
import { StorageService } from '@juanie/service-foundation'

// 日期工具 - 使用 date-fns
import { format, parseISO, addDays } from 'date-fns'

// 字符串工具 - 使用 lodash
import { camelCase, kebabCase, startCase } from 'lodash'

// ID 生成
import { generateId } from '@juanie/core/utils'

// 追踪装饰器
import { Trace } from '@juanie/core/observability'

// UI 组件
import { Button, Card } from '@juanie/ui'

// 类型
import type { Project } from '@juanie/types'
```

## 前端开发

**组件**: 使用 shadcn-vue (Button, Card, Input, Dialog, Select 等)  
**样式**: Tailwind CSS + CSS 变量 (--primary, --background 等)  
**图标**: lucide-vue-next  
**状态**: Pinia + @vueuse/core

**自动导入**: 
- Vue API (`ref`, `computed`, `watch` 等) - 无需导入
- VueUse (`useLocalStorage`, `useDebounce` 等) - 无需导入
- Vue Router (`useRoute`, `useRouter`) - 无需导入
- Pinia (`defineStore`, `storeToRefs`) - 无需导入
- Composables (`src/composables/*`) - 无需导入
- UI 组件 (`UiButton`, `UiCard` 等) - 无需导入，使用 `Ui` 前缀
- 图标 (`lucide-vue-next`) - **需要手动导入**

```vue
<script setup lang="ts">
// ✅ 自动导入 - 无需 import
// import { ref } from 'vue'
// import { Button, Card } from '@juanie/ui'

// ❌ 需要手动导入
import { Plus } from 'lucide-vue-next'

const count = ref(0)
</script>

<template>
  <Card class="p-4">
    <UiButton @click="count++">
      <Plus :size="16" class="mr-2" />
      点击 {{ count }}
    </UiButton>
  </Card>
</template>
```

## 文档组织

```
docs/
  guides/              # 操作指南
  architecture/        # 架构设计
  troubleshooting/     # 问题排查和修复记录
  tutorials/           # 深入教程
```

**规则**: 问题修复放 troubleshooting/, 操作指南放 guides/, 架构设计放 architecture/

## 协作建议

- **明确具体** - 说清楚要做什么
- **提供上下文** - 当前功能、错误日志、期望行为
- **用项目术语** - "项目初始化状态机"、"三层服务架构"
- **引用具体文件** - 提供完整路径
- **及时反馈** - 不对就说

## 环境变量

**必需**: `DATABASE_URL`, `REDIS_URL`, `CORS_ORIGIN`  
**K3s**: `K3S_HOST`, `K3S_TOKEN`  
**Git**: `GITHUB_TOKEN`, `GITLAB_TOKEN`

参考 `.env.example` 查看完整配置
