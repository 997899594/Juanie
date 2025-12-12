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
```

## 导入示例

```typescript
// 数据库
import * as schema from '@juanie/core/database'

// 队列
import { QueueModule, DEPLOYMENT_QUEUE } from '@juanie/core/queue'

// 服务
import { ProjectsService } from '@juanie/service-business'

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

```vue
<script setup lang="ts">
import { Button, Card } from '@juanie/ui'
import { Plus } from 'lucide-vue-next'
import { ref } from 'vue'

const count = ref(0)
</script>

<template>
  <Card class="p-4">
    <Button @click="count++">
      <Plus :size="16" class="mr-2" />
      点击 {{ count }}
    </Button>
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
