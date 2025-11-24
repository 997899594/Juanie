# @juanie/core-*

核心基础设施包集合。

## 包列表

### 后端专用

- `@juanie/core-database` - 数据库 Schema 和 Drizzle ORM
- `@juanie/core-queue` - BullMQ 队列系统
- `@juanie/core-sse` - Server-Sent Events
- `@juanie/core-observability` - OpenTelemetry 可观测性

### 前后端共享

- `@juanie/core-types` - TypeScript 类型定义（零依赖）
- `@juanie/core-utils` - 工具函数
- `@juanie/core-tokens` - NestJS DI tokens

### 横切关注点

- `@juanie/core-events` - 事件系统（基于 EventEmitter2）

## 使用指南

### 前端项目
```typescript
// 只导入类型，不会引入后端依赖
import type { User, Project } from '@juanie/core-types'
```

### 后端服务
```typescript
// 按需导入
import { DatabaseModule } from '@juanie/core-database'
import { CoreEventsModule } from '@juanie/core-events'
import { QueueModule } from '@juanie/core-queue'
```

## 设计原则

1. **按需加载** - 只安装需要的依赖
2. **依赖隔离** - 每个包有明确的依赖边界
3. **类型安全** - 所有包都有完整的 TypeScript 类型
4. **零配置** - 使用 workspace 协议自动链接

## 依赖关系

```
core-types (零依赖)
    ↑
    ├── core-database
    ├── core-queue
    ├── core-events
    └── core-utils
```
