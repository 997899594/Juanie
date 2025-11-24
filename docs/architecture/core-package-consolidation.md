# Core 包整合迁移

## 概述

将 8 个独立的 core 子包整合为 2 个包：
- `@juanie/core` - 所有后端基础设施
- `@juanie/core-types` - 纯类型定义（前后端共享）

## 迁移完成时间

2025-11-24

## 变更内容

### 之前的结构

```
packages/core/
├── database/       → @juanie/core-database
├── events/         → @juanie/core-events
├── queue/          → @juanie/core-queue
├── sse/            → @juanie/core-sse
├── tokens/         → @juanie/core-tokens
├── utils/          → @juanie/core-utils
├── observability/  → @juanie/core-observability
└── types/          → @juanie/core-types
```

### 现在的结构

```
packages/core/
├── core/           → @juanie/core (整合所有后端功能)
│   └── src/
│       ├── database/
│       ├── events/
│       ├── queue/
│       ├── sse/
│       ├── tokens/
│       ├── utils/
│       └── observability/
└── types/          → @juanie/core-types (保持独立)
```

## 导入变更

### 数据库

```typescript
// 之前
import * as schema from '@juanie/core-database/schemas'
import { DatabaseModule } from '@juanie/core-database/module'

// 现在
import * as schema from '@juanie/core/database'
import { DatabaseModule } from '@juanie/core/database'
```

### 事件系统

```typescript
// 之前
import { CoreEventsModule, K3sEvents } from '@juanie/core-events'

// 现在
import { CoreEventsModule, K3sEvents } from '@juanie/core/events'
```

### 队列

```typescript
// 之前
import { QueueModule, DEPLOYMENT_QUEUE } from '@juanie/core-queue'

// 现在
import { QueueModule, DEPLOYMENT_QUEUE } from '@juanie/core/queue'
```

### SSE

```typescript
// 之前
import { SSEModule } from '@juanie/core-sse'

// 现在
import { SSEModule } from '@juanie/core/sse'
```

### Tokens

```typescript
// 之前
import { DATABASE, REDIS } from '@juanie/core-tokens'

// 现在
import { DATABASE, REDIS } from '@juanie/core/tokens'
```

### 工具函数

```typescript
// 之前
import { generateId } from '@juanie/core-utils/id'

// 现在
import { generateId } from '@juanie/core/utils'
```

### 可观测性

```typescript
// 之前
import { Trace } from '@juanie/core-observability'

// 现在
import { Trace } from '@juanie/core/observability'
```

## Package.json 变更

### 之前

```json
{
  "dependencies": {
    "@juanie/core-database": "workspace:*",
    "@juanie/core-events": "workspace:*",
    "@juanie/core-queue": "workspace:*",
    "@juanie/core-sse": "workspace:*",
    "@juanie/core-tokens": "workspace:*",
    "@juanie/core-utils": "workspace:*",
    "@juanie/core-observability": "workspace:*",
    "@juanie/core-types": "workspace:*"
  }
}
```

### 现在

```json
{
  "dependencies": {
    "@juanie/core": "workspace:*",
    "@juanie/core-types": "workspace:*"
  }
}
```

## 优势

### 1. 简化依赖管理

- 从 8 个包减少到 2 个包
- package.json 更简洁
- 减少认知负担

### 2. 统一导入

```typescript
// 一次性导入所有需要的功能
import { 
  DatabaseModule, 
  QueueModule, 
  CoreEventsModule,
  DATABASE,
  generateId,
  Trace 
} from '@juanie/core'
```

### 3. 保持前端轻量

```typescript
// 前端只需要类型，零依赖
import type { User, Project } from '@juanie/core-types'
```

### 4. 子路径导出

仍然支持按需导入：

```typescript
// 只导入数据库相关
import { DatabaseModule } from '@juanie/core/database'

// 只导入事件相关
import { CoreEventsModule } from '@juanie/core/events'
```

## 迁移脚本

使用 `scripts/migrate-to-unified-core.sh` 自动完成迁移：

```bash
./scripts/migrate-to-unified-core.sh
bun install
bun run build
```

## 验证

所有后端服务构建成功：

```bash
✅ @juanie/core
✅ @juanie/service-foundation
✅ @juanie/service-business
✅ @juanie/service-extensions
✅ @juanie/api-gateway
```

## 旧包处理

旧的 core 子包（database, events, queue 等）保留在 `packages/core/` 目录中，但不再被使用。可以在确认系统稳定后删除。

## 回滚方案

如果需要回滚：

1. 恢复旧的 package.json 依赖
2. 运行 `git checkout` 恢复导入语句
3. 运行 `bun install`

## 后续工作

- [ ] 删除旧的 core 子包目录
- [ ] 更新 .kiro/steering/structure.md 文档
- [ ] 更新开发者文档
