# 性能优化方案

## 🎯 问题总结

1. **缺少缓存策略** - 热点数据重复查询
2. **没有 DataLoader** - GraphQL/tRPC 批量查询未优化
3. **前端包体积大** - 未充分利用代码分割
4. **API 响应慢** - 缺少响应缓存

## 📋 解决方案

### 1. Redis 缓存策略

**安装依赖**:
```bash
bun add ioredis
bun add -D @types/ioredis
```

**缓存服务实现**:
```typescript
// packages/core/src/cache/cache.service.ts
import { Injectable } from '@nestjs/common'
import { REDIS } from '@juanie/core/tokens'
import { Inject } from '@nestjs/common'
import type Redis from 'ioredis'

@Injectable()
export class CacheService {
  constructor(@Inject(REDIS) private redis: Redis) {}

  /**
   * 获取缓存
   */
  async get<T>(key: string): Promise<T | null> {
    const value = await this.redis.get(key)
    return value ? JSON.parse(value) : null
  }

  /**
   * 设置缓存
   */
  async set(key: string, value: unknown, ttl: number = 3600): Promise<void> {
    await this.redis.setex(key, ttl, JSON.stringify(value))
  }

  /**
   * 删除缓存
   */
  async del(key: string): Promise<void> {
    await this.redis.del(key)
  }

  /**
   * 批量删除（按模式）
   */
  async delPattern(pattern: string): Promise<void> {
    const keys = await this.redis.keys(pattern)
    if (keys.length > 0) {
      await this.redis.del(...keys)
    }
  }
}
```

**缓存装饰器**:
```typescript
// packages/core/src/cache/cache.decorator.ts
import { CacheService } from './cache.service'

export function Cacheable(options: {
  ttl?: number
  keyPrefix?: string
  keyGenerator?: (...args: any[]) => string
}) {
  return function (
    target: any,
    propertyKey: string,
    descriptor: PropertyDescriptor,
  ) {
    const originalMethod = descriptor.value
    const cacheService: CacheService = target.cacheService

    descriptor.value = async function (...args: any[]) {
      const key = options.keyGenerator
        ? `${options.keyPrefix}:${options.keyGenerator(...args)}`
        : `${options.keyPrefix}:${propertyKey}:${JSON.stringify(args)}`

      // 尝试从缓存获取
      const cached = await cacheService.get(key)
      if (cached !== null) {
        return cached
      }

      // 执行原方法
      const result = await originalMethod.apply(this, args)

      // 存入缓存
      await cacheService.set(key, result, options.ttl || 3600)

      return result
    }

    return descriptor
  }
}
```

**使用示例**:
```typescript
@Injectable()
export class ProjectsService {
  constructor(
    private readonly cacheService: CacheService,
  ) {}

  @Cacheable({
    ttl: 300, // 5分钟
    keyPrefix: 'project',
    keyGenerator: (id: string) => id,
  })
  async getProject(id: string) {
    return this.db.query.projects.findFirst({
      where: eq(schema.projects.id, id),
    })
  }

  async updateProject(id: string, data: UpdateProjectInput) {
    const updated = await this.db.update(schema.projects)
      .set(data)
      .where(eq(schema.projects.id, id))
      .returning()

    // 清除缓存
    await this.cacheService.del(`project:${id}`)

    return updated[0]
  }
}
```

### 2. DataLoader 实现

**安装依赖**:
```bash
bun add dataloader
```

**DataLoader 服务**:

```typescript
// packages/core/src/dataloader/dataloader.service.ts
import DataLoader from 'dataloader'
import { Injectable, Scope } from '@nestjs/common'
import * as schema from '@juanie/core/database'
import { DATABASE } from '@juanie/core/tokens'
import { Inject } from '@nestjs/common'
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js'
import { inArray } from 'drizzle-orm'

@Injectable({ scope: Scope.REQUEST }) // 每个请求一个实例
export class DataLoaderService {
  private projectLoader: DataLoader<string, any>
  private memberLoader: DataLoader<string, any[]>

  constructor(@Inject(DATABASE) private db: PostgresJsDatabase<typeof schema>) {
    this.projectLoader = new DataLoader(async (ids: readonly string[]) => {
      const projects = await this.db.select()
        .from(schema.projects)
        .where(inArray(schema.projects.id, [...ids]))

      const projectMap = new Map(projects.map(p => [p.id, p]))
      return ids.map(id => projectMap.get(id) || null)
    })

    this.memberLoader = new DataLoader(async (projectIds: readonly string[]) => {
      const members = await this.db.select()
        .from(schema.projectMembers)
        .where(inArray(schema.projectMembers.projectId, [...projectIds]))

      const membersByProject = new Map<string, any[]>()
      for (const member of members) {
        if (!membersByProject.has(member.projectId)) {
          membersByProject.set(member.projectId, [])
        }
        membersByProject.get(member.projectId)!.push(member)
      }

      return projectIds.map(id => membersByProject.get(id) || [])
    })
  }

  loadProject(id: string) {
    return this.projectLoader.load(id)
  }

  loadProjectMembers(projectId: string) {
    return this.memberLoader.load(projectId)
  }
}
```

**在 tRPC 中使用**:
```typescript
// apps/api-gateway/src/routers/projects.router.ts
export const projectsRouter = router({
  list: protectedProcedure
    .query(async ({ ctx }) => {
      const projects = await ctx.projectsService.listProjects(ctx.user.organizationId)
      
      // 使用 DataLoader 批量加载成员
      const projectsWithMembers = await Promise.all(
        projects.map(async (project) => ({
          ...project,
          members: await ctx.dataLoader.loadProjectMembers(project.id),
        }))
      )
      
      return projectsWithMembers
    }),
})
```

### 3. 前端性能优化

**代码分割 - 路由懒加载**:
```typescript
// apps/web/src/router/index.ts
const routes = [
  {
    path: '/projects',
    component: () => import('@/views/Projects.vue'), // ✅ 懒加载
  },
  {
    path: '/projects/:id',
    component: () => import('@/views/ProjectDetail.vue'),
  },
  {
    path: '/gitops',
    component: () => import('@/views/gitops/GitOpsResources.vue'),
  },
]
```

**组件懒加载**:
```vue
<script setup lang="ts">
import { defineAsyncComponent } from 'vue'

// ✅ 异步组件
const AIAssistant = defineAsyncComponent(() => 
  import('@/components/AIAssistant.vue')
)

const ProjectWizard = defineAsyncComponent(() => 
  import('@/components/ProjectWizard.vue')
)
</script>

<template>
  <Suspense>
    <AIAssistant v-if="showAI" />
    <template #fallback>
      <div>Loading...</div>
    </template>
  </Suspense>
</template>
```

**Vite 配置优化**:
```typescript
// apps/web/vite.config.ts
export default defineConfig({
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          'vue-vendor': ['vue', 'vue-router', 'pinia'],
          'ui-vendor': ['lucide-vue-next', '@vueuse/core'],
          'chart-vendor': ['echarts'],
        },
      },
    },
    chunkSizeWarningLimit: 1000,
  },
  optimizeDeps: {
    include: ['vue', 'vue-router', 'pinia'],
  },
})
```

### 4. API 响应缓存

**HTTP 缓存头**:
```typescript
// apps/api-gateway/src/main.ts
app.use((req, res, next) => {
  // 静态资源缓存
  if (req.url.startsWith('/api/public/')) {
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable')
  }
  
  // API 响应缓存
  if (req.method === 'GET' && req.url.startsWith('/api/')) {
    res.setHeader('Cache-Control', 'private, max-age=60')
  }
  
  next()
})
```

**tRPC 响应缓存**:
```typescript
// 使用 @trpc/server 的缓存中间件
const cachedProcedure = publicProcedure.use(async ({ ctx, next, path }) => {
  const cacheKey = `trpc:${path}:${JSON.stringify(ctx.input)}`
  
  const cached = await ctx.cache.get(cacheKey)
  if (cached) {
    return { ok: true, data: cached }
  }
  
  const result = await next()
  
  if (result.ok) {
    await ctx.cache.set(cacheKey, result.data, 60)
  }
  
  return result
})
```

## 📊 实施清单

### Phase 1: 缓存基础设施 (2天)

- [ ] 实现 CacheService
- [ ] 实现缓存装饰器
- [ ] 为热点查询添加缓存
- [ ] 实现缓存失效策略

### Phase 2: DataLoader (2天)

- [ ] 实现 DataLoaderService
- [ ] 识别 N+1 查询位置
- [ ] 使用 DataLoader 重写
- [ ] 性能测试

### Phase 3: 前端优化 (2天)

- [ ] 实现路由懒加载
- [ ] 实现组件懒加载
- [ ] 优化 Vite 配置
- [ ] 分析包体积

### Phase 4: API 缓存 (1天)

- [ ] 添加 HTTP 缓存头
- [ ] 实现 tRPC 响应缓存
- [ ] CDN 配置（如果有）

## 🎯 预期效果

- **API 响应时间**: 从 500ms 降到 100ms
- **前端首屏加载**: 从 3s 降到 1s
- **包体积**: 减少 40%
- **缓存命中率**: 80%+

## 🔗 相关文档

- [DataLoader 文档](https://github.com/graphql/dataloader)
- [Vite 性能优化](https://vitejs.dev/guide/performance.html)
- [Redis 缓存策略](https://redis.io/docs/manual/patterns/)
