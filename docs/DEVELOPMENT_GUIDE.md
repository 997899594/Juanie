# Juanie 开发指南

## 📖 目录

1. [项目概述](#项目概述)
2. [快速开始](#快速开始)
3. [架构设计](#架构设计)
4. [开发规范](#开发规范)
5. [错误处理](#错误处理)
6. [AI 代码审查](#ai-代码审查)
7. [API 文档](#api-文档)
8. [测试指南](#测试指南)
9. [部署指南](#部署指南)

---

## 项目概述

Juanie 是一个现代化的 AI 驱动 DevOps 平台，采用 Monorepo 架构，提供：

- 🚀 **项目管理**: 多租户项目管理和模板化初始化
- 🔄 **GitOps**: Flux CD + K3s 深度集成
- 🤖 **AI 助手**: 本地 Ollama 模型驱动的代码审查和智能建议
- 📊 **监控告警**: OpenTelemetry 全链路可观测
- 💰 **成本追踪**: 资源使用和成本分析

### 技术栈

#### 后端
- **运行时**: Bun 1.0+ (极速性能)
- **框架**: NestJS 11 + Fastify
- **API**: tRPC (端到端类型安全)
- **数据库**: PostgreSQL 15 + Drizzle ORM
- **缓存/队列**: Dragonfly (Redis 兼容) + BullMQ

#### 前端
- **框架**: Vue 3.5 (Composition API)
- **构建**: Vite 7.x
- **UI**: Shadcn/ui (Radix Vue + Tailwind CSS 4)
- **状态**: Pinia 3
- **工具**: VueUse + Lucide Icons

---

## 快速开始

### 环境要求

- Bun 1.0+
- PostgreSQL 15+
- Redis (或 Dragonfly)
- Docker & Docker Compose
- Node.js 20+ (用于某些工具)

### 安装依赖

```bash
# 安装所有依赖
bun install

# 启动开发环境（包括数据库、Redis、Ollama 等）
docker compose up -d

# 运行数据库迁移
bun run db:migrate

# 启动开发服务器
bun run dev
```

### 项目结构

```
juanie/
├── apps/
│   ├── api-gateway/        # 后端 API 网关
│   └── web/                # 前端 Web 应用
├── packages/
│   ├── core/              # 核心基础设施 (数据库、队列、SSE)
│   ├── services/          # 三层服务架构
│   │   ├── foundation/    # 基础层 (用户、认证、组织)
│   │   ├── business/      # 业务层 (项目、部署、GitOps)
│   │   └── extensions/    # 扩展层 (AI、监控、通知)
│   ├── ui/                # UI 组件库
│   ├── types/             # TypeScript 类型定义 ⭐
│   └── config/            # 共享配置
├── docs/                  # 文档
├── scripts/               # 工具脚本
└── templates/             # 项目模板
```

---

## 架构设计

### Monorepo 架构

使用 **Turborepo** 管理多包仓库：

- ✅ **代码复用**: 共享类型、工具、配置
- ✅ **类型安全**: 跨包类型共享
- ✅ **增量构建**: 智能缓存和并行构建
- ✅ **统一工作流**: 一致的开发体验

### 三层服务架构

```
┌─────────────────────────────────────┐
│      Extensions Layer (扩展层)       │
│  AI / 监控 / 通知 / 安全             │
└─────────────────────────────────────┘
              ↓ 依赖
┌─────────────────────────────────────┐
│      Business Layer (业务层)         │
│  项目 / 部署 / GitOps / 流水线        │
└─────────────────────────────────────┘
              ↓ 依赖
┌─────────────────────────────────────┐
│      Foundation Layer (基础层)       │
│  认证 / 用户 / 组织 / 团队           │
└─────────────────────────────────────┘
```

**核心原则**:
1. 单向依赖（上层依赖下层）
2. 职责清晰（每层有明确边界）
3. 易于测试（独立可测试）
4. 支持独立部署

### 类型定义规范 ⭐

**所有共享类型必须定义在 `@juanie/types` 包中！**

```typescript
// ❌ 错误：在服务中定义类型
// packages/services/extensions/src/ai/types.ts
export interface CodeReviewRequest { ... }

// ✅ 正确：在 types 包中定义
// packages/types/src/ai.types.ts
export interface CodeReviewRequest { ... }

// 服务中导入使用
import type { CodeReviewRequest } from '@juanie/types'
```

**类型包结构**:

```
packages/types/src/
├── index.ts              # 统一导出入口
├── ai.types.ts          # AI 相关类型
├── api.ts               # API 响应类型
├── dtos.ts              # DTO 类型
├── errors/              # 错误相关
│   ├── error-codes.ts   # 错误码定义
│   └── app-error.ts     # 错误类
├── events.types.ts      # 事件类型
├── git-auth.types.ts    # Git 认证类型
├── models.ts            # 数据模型
├── project.types.ts     # 项目类型
├── schemas.ts           # 数据库 Schema
└── template.types.ts    # 模板类型
```

---

## 开发规范

### 代码风格

使用 **Biome** 进行代码格式化和 lint：

```bash
# 格式化代码
bun run format

# Lint 检查
bun run lint

# 自动修复
bun run lint:fix
```

**核心规则**:
- 使用 TypeScript strict 模式
- 优先使用 `const` 和 `readonly`
- 函数参数使用解构
- 导出类型使用 `export type`

### Git 工作流

```bash
# 创建功能分支
git checkout -b feature/your-feature

# 提交（使用语义化提交）
git commit -m "feat: add code review service"

# 推送并创建 PR
git push origin feature/your-feature
```

**提交消息规范**:
- `feat:` 新功能
- `fix:` Bug 修复
- `docs:` 文档更新
- `refactor:` 代码重构
- `test:` 测试相关
- `chore:` 构建/工具相关

---

## 错误处理

### 统一错误处理系统

项目使用统一的错误码和错误类：

```typescript
import { AppError, ErrorCode } from '@juanie/types'

// 创建业务错误
throw AppError.create(ErrorCode.PROJECT_NOT_FOUND, {
  detail: `Project ${projectId} not found`,
  context: { projectId },
})

// 创建验证错误
throw AppError.validation('Invalid email format', {
  field: 'email',
  value: email,
})

// 创建未授权错误
throw AppError.unauthorized('Please login first')
```

### 错误码分类

所有错误码定义在 `packages/types/src/errors/error-codes.ts`:

```typescript
// 通用错误 (1xxx)
INTERNAL_ERROR: 'ERR_1000'
VALIDATION_ERROR: 'ERR_1001'
UNAUTHORIZED: 'ERR_1002'

// 认证错误 (2xxx)
AUTH_INVALID_CREDENTIALS: 'ERR_2001'
AUTH_SESSION_EXPIRED: 'ERR_2002'

// 项目错误 (3xxx)
PROJECT_NOT_FOUND: 'ERR_3001'
PROJECT_ALREADY_EXISTS: 'ERR_3002'

// AI 错误 (7xxx)
AI_SERVICE_ERROR: 'ERR_7001'
AI_SERVICE_TIMEOUT: 'ERR_7002'
```

### 全局异常过滤器

已自动注册在 `AppModule`，会自动捕获并格式化所有错误响应：

```typescript
{
  "success": false,
  "code": "ERR_3001",
  "message": "Project not found",
  "detail": "Project 123 not found",
  "statusCode": 404,
  "timestamp": "2025-12-03T10:00:00.000Z"
}
```

---

## AI 代码审查

### Ollama 本地模型

项目使用 Ollama 运行本地 AI 模型，无需调用云服务：

#### 安装 Ollama

```bash
# macOS
brew install ollama

# Linux
curl -fsSL https://ollama.com/install.sh | sh

# 启动 Ollama 服务
ollama serve
```

#### 下载推荐模型

```bash
# 通义千问代码模型（推荐，7B 参数）
ollama pull qwen2.5-coder:7b

# DeepSeek 代码模型
ollama pull deepseek-coder:6.7b

# CodeLlama
ollama pull codellama:7b
```

### 使用代码审查 API

#### 全面审查

```typescript
import { trpc } from '@/lib/trpc'

const result = await trpc.aiCodeReview.comprehensive.mutate({
  code: myCode,
  language: 'typescript',
  fileName: 'user.service.ts',
  model: 'qwen2.5-coder:7b',
  context: {
    projectType: 'web',
    framework: 'nestjs',
  },
})

console.log(`Score: ${result.score}/100`)
console.log(`Issues: ${result.statistics.totalIssues}`)
result.issues.forEach(issue => {
  console.log(`[${issue.severity}] ${issue.title}`)
})
```

#### 快速审查

```typescript
// 仅检查关键问题
const result = await trpc.aiCodeReview.quick.mutate({
  code: myCode,
  language: 'typescript',
})
```

#### 安全审查

```typescript
// 专注安全漏洞
const result = await trpc.aiCodeReview.security.mutate({
  code: myCode,
  language: 'typescript',
})
```

#### 批量审查

```typescript
const result = await trpc.aiCodeReview.batch.mutate({
  files: [
    { path: 'src/user.service.ts', code: code1, language: 'typescript' },
    { path: 'src/auth.service.ts', code: code2, language: 'typescript' },
  ],
  mode: 'comprehensive',
})

console.log(`Total files: ${result.overallStatistics.totalFiles}`)
console.log(`Average score: ${result.overallStatistics.averageScore}`)
```

### 审查结果结构

```typescript
interface CodeReviewResult {
  score: number                 // 0-100 分
  summary: string              // 总体评价
  issues: CodeReviewIssue[]    // 问题列表
  strengths: string[]          // 优点
  improvements: string[]       // 改进建议
  statistics: {
    critical: number           // 严重问题数
    warning: number            // 警告数
    info: number              // 信息数
    suggestion: number        // 建议数
    totalIssues: number       // 总问题数
  }
  duration: number             // 审查耗时 (ms)
  model: AIModel              // 使用的模型
}

interface CodeReviewIssue {
  id: string
  severity: 'critical' | 'warning' | 'info' | 'suggestion'
  category: 'security' | 'performance' | 'bug' | 'code_smell' | ...
  title: string
  description: string
  line?: number               // 问题行号
  suggestion?: string         // 修复建议
  fixedCode?: string         // 修复后代码
}
```

---

## API 文档

### tRPC Panel（推荐）

开发环境下访问 **http://localhost:3000/panel** 查看交互式 API 文档。

**优势**:
- ✅ 实时反映代码更改
- ✅ 端到端类型安全
- ✅ 可直接测试 API
- ✅ 自动生成，零维护成本

### 类型导出

前端自动获得完整类型支持：

```typescript
import { trpc } from '@/lib/trpc'
import type { AppRouter } from '@juanie/api-gateway/router-types'

// 完全类型安全的 API 调用
const projects = await trpc.projects.list.query({ 
  page: 1,      // ✅ 自动提示
  limit: 10,
  // unknown: 1  // ❌ 类型错误
})

// 返回值也是类型安全的
projects.data.forEach(project => {
  console.log(project.name)  // ✅ 自动提示
})
```

---

## 测试指南

### 单元测试

```bash
# 运行所有测试
bun test

# 运行特定包的测试
bun test --filter @juanie/service-business

# 监听模式
bun test --watch
```

**测试文件命名**: `*.spec.ts` 或 `*.test.ts`

### E2E 测试

```bash
# 启动测试环境
docker compose -f docker-compose.test.yml up -d

# 运行 E2E 测试
bun run test:e2e
```

### 测试覆盖率

```bash
bun run test:coverage
```

---

## 部署指南

### Docker 部署

```bash
# 构建镜像
docker build -t juanie:latest .

# 运行容器
docker run -p 3000:3000 juanie:latest
```

### Kubernetes 部署

```bash
# 应用配置
kubectl apply -f k8s/

# 查看状态
kubectl get pods -n juanie
```

### 环境变量

创建 `.env` 文件：

```bash
# 数据库
DATABASE_URL=postgresql://user:pass@localhost:5432/juanie

# Redis
REDIS_URL=redis://localhost:6379

# Ollama
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_DEFAULT_MODEL=qwen2.5-coder:7b

# 认证
JWT_SECRET=your-secret-key
COOKIE_SECRET=your-cookie-secret

# 其他
NODE_ENV=production
PORT=3000
```

---

## 常见问题

### Ollama 连接失败

```bash
# 检查 Ollama 服务状态
curl http://localhost:11434/api/tags

# 启动 Ollama
ollama serve

# 检查模型是否下载
ollama list
```

### 数据库迁移问题

```bash
# 重置数据库
bun run db:reset

# 重新运行迁移
bun run db:migrate
```

### 类型错误

```bash
# 重新生成类型
bun run typecheck

# 清除缓存
rm -rf node_modules/.cache
bun install
```

---

## 贡献指南

1. Fork 项目
2. 创建功能分支 (`git checkout -b feature/amazing-feature`)
3. 提交更改 (`git commit -m 'feat: add amazing feature'`)
4. 推送到分支 (`git push origin feature/amazing-feature`)
5. 创建 Pull Request

---

## 许可证

MIT License

---

## 联系方式

- 项目主页: [https://github.com/your-org/juanie](https://github.com/your-org/juanie)
- 问题反馈: [GitHub Issues](https://github.com/your-org/juanie/issues)
