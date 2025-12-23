# 模板选择器 API 修复

**日期**: 2024-12-22  
**问题**: 前端创建项目时报错 `No procedure found on path "projectTemplates.list"`  
**状态**: ✅ 已解决

## 问题描述

用户在创建项目时，模板选择器组件调用了不存在的 API：

```
TRPCError: No procedure found on path "projectTemplates.list"
```

## 根本原因

1. **API 路径错误**: 前端调用 `trpc.projectTemplates.list`，但后端只有 `trpc.templates`
2. **功能混淆**: 
   - `templates` router: AI 辅助生成工具（Dockerfile、CI/CD）
   - `projectTemplates`: 项目初始化模板列表（数据库表）
3. **缺少 list 方法**: `templates` router 没有查询项目模板列表的功能
4. **缺少种子数据**: 数据库 `project_templates` 表为空

## 解决方案

### 1. 修复 API 路径

**文件**: `apps/web/src/components/TemplateSelector.vue`

```typescript
// ❌ 错误
const result = await trpc.projectTemplates.list.query({})

// ✅ 正确
const result = await trpc.templates.list.query({})
```

### 2. 添加 list 方法

**文件**: `apps/api-gateway/src/routers/templates.router.ts`

```typescript
import { DATABASE } from '@juanie/core/tokens'
import * as schema from '@juanie/core/database'
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js'
import { eq, and, or, isNull } from 'drizzle-orm'

@Injectable()
export class TemplatesRouter {
  constructor(
    private readonly trpc: TrpcService,
    private readonly templatesService: TemplatesService,
    @Inject(DATABASE) private db: PostgresJsDatabase<typeof schema>,
  ) {}

  get router() {
    return this.trpc.router({
      /**
       * 列出可用的项目模板
       */
      list: this.trpc.procedure.query(async ({ ctx }) => {
        const userId = ctx.user?.id
        
        // 查询公开模板 + 系统模板 + 用户所在组织的模板
        const templates = await this.db.query.projectTemplates.findMany({
          where: or(
            eq(schema.projectTemplates.isPublic, true),
            eq(schema.projectTemplates.isSystem, true),
            userId ? eq(schema.projectTemplates.createdBy, userId) : undefined,
          ),
          orderBy: (templates, { desc }) => [desc(templates.createdAt)],
        })
        
        return templates
      }),
      
      // ... 其他方法
    })
  }
}
```

### 3. 初始化模板数据

**文件**: `scripts/seed-project-templates.ts`

创建脚本将 `templates/nextjs-15-app` 注册到数据库：

```bash
# 运行种子脚本
DATABASE_URL="postgresql://..." bun run scripts/seed-project-templates.ts
```

模板数据：
- **slug**: `nextjs-15-app`
- **name**: Next.js 15 App Router
- **category**: web
- **isPublic**: true
- **isSystem**: true
- **techStack**: TypeScript + Next.js 15 + Node.js 20
- **defaultConfig**: 3 个环境 + K8s 资源配置 + 健康检查 + GitOps

## 验证

1. 启动后端：`bun run dev:api`
2. 启动前端：`bun run dev:web`
3. 打开创建项目向导
4. 模板选择器应该显示 "Next.js 15 App Router" 模板
5. 可以正常选择模板并创建项目

## 相关文件

- `apps/web/src/components/TemplateSelector.vue` - 前端模板选择器
- `apps/api-gateway/src/routers/templates.router.ts` - 后端 API
- `packages/core/src/database/schemas/project-templates.schema.ts` - 数据库表定义
- `scripts/seed-project-templates.ts` - 种子数据脚本

## 经验教训

1. **API 命名一致性**: 前后端 API 路径要保持一致
2. **功能分离**: 区分"项目模板"和"配置生成工具"
3. **种子数据**: 系统模板应该在部署时自动初始化
4. **错误提示**: tRPC 的错误信息很清晰，直接指出了问题所在

## 后续优化

1. 将种子脚本集成到部署流程（`bun run db:push` 后自动运行）
2. 支持用户自定义模板
3. 支持组织级别的模板共享
4. 模板版本管理
