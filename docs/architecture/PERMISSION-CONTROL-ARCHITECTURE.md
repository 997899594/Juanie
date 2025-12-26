# 权限控制架构 - 正确实现方式

> 创建时间: 2024-12-25  
> 状态: ✅ **架构决策**  
> 优先级: **P0（最高）**

## 🎯 核心问题

**用户提问**: "权限控制不是用 withAbility 这个来做的吗？作为资深架构师你回答我应该怎么做"

**答案**: **是的！`withAbility` 是正确的权限控制方式。** 权限检查应该在 **tRPC Router 层**完成，Business 层不应该重复检查权限。

---

## 📐 正确的权限控制架构

### 三层架构

```
┌─────────────────────────────────────────────────────────────┐
│  1️⃣ tRPC Router 层 (API Gateway)                            │
│  ✅ 使用 withAbility 中间件检查权限                           │
│  - 在请求进入前检查权限                                       │
│  - 从 input 提取 organizationId/projectId                   │
│  - 调用 rbacService.can() 检查权限                          │
│  - 无权限 → 抛出 403 FORBIDDEN                              │
│  - 有权限 → 继续执行                                         │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│  2️⃣ Business 层 (ProjectsService, DeploymentsService)       │
│  ❌ 不应该做权限检查                                         │
│  ✅ 只做业务逻辑                                             │
│  - 假设权限已经在 Router 层检查过                            │
│  - 专注于业务规则和数据操作                                  │
│  - 特殊场景: 可以注入 RbacService 用于 visibility 过滤      │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│  3️⃣ Foundation 层 (RbacService)                             │
│  ✅ 提供权限查询能力                                         │
│  - getEffectiveProjectRoleForUser()                        │
│  - can(userId, action, subject, orgId, projectId)         │
│  - defineAbilitiesForUser()                                │
└─────────────────────────────────────────────────────────────┘
```

---

## 💡 为什么这样设计？

### 原因 1: 职责分离（Single Responsibility Principle）

```typescript
// ✅ 正确: 职责清晰
// Router 层: 负责认证、权限、参数验证
// Business 层: 负责业务逻辑、数据操作
// Foundation 层: 提供基础服务（权限查询、数据访问）

// ❌ 错误: 职责混乱
// Router 层检查权限 + Business 层又检查权限 = 重复 + 混乱
```

### 原因 2: 避免重复（DRY - Don't Repeat Yourself）

```typescript
// ❌ 错误: 权限检查重复
// Router 层
create: withAbility(..., { action: 'create', subject: 'Project' })
  .mutation(async ({ ctx, input }) => {
    return await this.projectsService.create(ctx.user.id, input)
  })

// Business 层
async create(userId, data) {
  // ❌ 重复检查权限（Router 层已经检查过了）
  await this.assertCan(userId, 'create', 'Project')
  
  // 业务逻辑...
}

// ✅ 正确: 权限只检查一次
// Router 层
create: withAbility(..., { action: 'create', subject: 'Project' })
  .mutation(async ({ ctx, input }) => {
    return await this.projectsService.create(ctx.user.id, input)
  })

// Business 层
async create(userId, data) {
  // ✅ 不检查权限，假设 Router 层已经检查过
  
  // 业务逻辑...
}
```

### 原因 3: 可测试性（Testability）

```typescript
// ✅ Business 层不检查权限 → 测试简单
describe('ProjectsService.create', () => {
  it('should create project', async () => {
    // 不需要 mock 权限检查
    const project = await service.create('user-1', { name: 'Test' })
    expect(project).toBeDefined()
  })
})

// ❌ Business 层检查权限 → 测试复杂
describe('ProjectsService.create', () => {
  it('should create project', async () => {
    // 需要 mock CaslAbilityFactory
    caslAbilityFactory.createForUser.mockResolvedValue({
      can: jest.fn().mockReturnValue(true)
    })
    
    // 需要 mock RbacService
    rbacService.can.mockResolvedValue(true)
    
    const project = await service.create('user-1', { name: 'Test' })
    expect(project).toBeDefined()
  })
})
```

### 原因 4: 性能优化（Performance）

```typescript
// ✅ 权限只检查一次（Router 层）
// 请求 → withAbility 检查权限 → Business 层执行 → 返回

// ❌ 权限检查两次（Router 层 + Business 层）
// 请求 → withAbility 检查权限 → Business 层再检查权限 → 返回
// 浪费数据库查询 + 浪费计算资源
```

---

## 🔧 实现细节

### 1. tRPC Router 层 - 使用 `withAbility`

**文件**: `apps/api-gateway/src/routers/projects.router.ts`

```typescript
import { withAbility } from '../trpc/rbac.middleware'

@Injectable()
export class ProjectsRouter {
  constructor(
    private readonly trpc: TrpcService,
    private readonly projectsService: ProjectsService,
    private readonly rbacService: RbacService,
  ) {}

  get router() {
    return this.trpc.router({
      // ✅ 创建项目 - 需要 create Project 权限
      create: withAbility(this.trpc.protectedProcedure, this.rbacService, {
        action: 'create',
        subject: 'Project',
      })
        .input(createProjectSchema)
        .mutation(async ({ ctx, input }) => {
          // ✅ 权限已检查，直接调用 Service
          return await this.projectsService.create(ctx.user.id, input)
        }),

      // ✅ 更新项目 - 需要 update Project 权限
      update: withAbility(this.trpc.protectedProcedure, this.rbacService, {
        action: 'update',
        subject: 'Project',
      })
        .input(updateProjectSchema)
        .mutation(async ({ ctx, input }) => {
          // ✅ 权限已检查，直接调用 Service
          return await this.projectsService.update(ctx.user.id, input.projectId, input)
        }),

      // ✅ 删除项目 - 需要 delete Project 权限
      delete: withAbility(this.trpc.protectedProcedure, this.rbacService, {
        action: 'delete',
        subject: 'Project',
      })
        .input(deleteProjectSchema)
        .mutation(async ({ ctx, input }) => {
          // ✅ 权限已检查，直接调用 Service
          return await this.projectsService.delete(ctx.user.id, input.projectId)
        }),
    })
  }
}
```

### 2. `withAbility` 中间件实现

**文件**: `apps/api-gateway/src/trpc/rbac.middleware.ts`

```typescript
export function createRbacMiddleware(rbacService: RbacService, ability: RequiredAbility) {
  return async ({ ctx, next }: { ctx: Context; next: () => Promise<unknown> }) => {
    // 1. 检查用户是否已认证
    if (!ctx.user) {
      throw new TRPCError({
        code: 'UNAUTHORIZED',
        message: '未登录',
      })
    }

    // 2. 从 input 中提取 organizationId 和 projectId
    const input = ctx.input as Record<string, unknown> | undefined
    const organizationId = input?.organizationId as string | undefined
    const projectId = input?.projectId as string | undefined

    // 3. 调用 RbacService 检查权限
    const hasPermission = await rbacService.can(
      ctx.user.id,
      ability.action,
      ability.subject,
      organizationId,
      projectId,
    )

    // 4. 无权限 → 抛出 403 FORBIDDEN
    if (!hasPermission) {
      throw new TRPCError({
        code: 'FORBIDDEN',
        message: `无权限执行此操作: ${ability.action} ${ability.subject}`,
      })
    }

    // 5. 有权限 → 继续执行
    return next()
  }
}

export function withAbility<T>(
  procedure: T,
  rbacService: RbacService,
  ability: RequiredAbility,
): T {
  // @ts-expect-error - tRPC procedure type is complex
  return procedure.use(createRbacMiddleware(rbacService, ability))
}
```

### 3. Business 层 - 不检查权限

**文件**: `packages/services/business/src/projects/projects.service.ts`

```typescript
@Injectable()
export class ProjectsService {
  constructor(
    @Inject(DATABASE) private db: PostgresJsDatabase<typeof schema>,
    private organizationsService: OrganizationsService,
    private auditLogs: AuditLogsService,
    private logger: PinoLogger,
  ) {}

  // ✅ 不检查权限，假设 Router 层已经检查过
  async create(userId: string, data: CreateProjectInput) {
    // 1. 验证业务规则（不是权限）
    const organizationExists = await this.organizationsService.exists(data.organizationId)
    if (!organizationExists) {
      throw new OrganizationNotFoundError(data.organizationId)
    }

    // 2. 检查业务约束（不是权限）
    const existing = await this.db.query.projects.findFirst({
      where: and(
        eq(schema.projects.organizationId, data.organizationId),
        eq(schema.projects.slug, data.slug),
      ),
    })
    if (existing) {
      throw new ProjectAlreadyExistsError(data.slug)
    }

    // 3. 执行业务逻辑
    const [project] = await this.db
      .insert(schema.projects)
      .values({
        organizationId: data.organizationId,
        name: data.name,
        slug: data.slug,
        createdBy: userId,
      })
      .returning()

    // 4. 记录审计日志
    await this.auditLogs.log({
      userId,
      action: 'project.created',
      resourceType: 'project',
      resourceId: project.id,
    })

    return project
  }

  // ✅ 不检查权限
  async update(userId: string, projectId: string, data: UpdateProjectInput) {
    // 业务逻辑...
  }

  // ✅ 不检查权限
  async delete(userId: string, projectId: string) {
    // 业务逻辑...
  }
}
```

### 4. 特殊场景: 基于 `visibility` 的访问控制

对于 `list()` 方法需要根据 `visibility` 过滤项目的场景：

```typescript
@Injectable()
export class ProjectsService {
  constructor(
    @Inject(DATABASE) private db: PostgresJsDatabase<typeof schema>,
    private rbacService: RbacService,  // ✅ 注入 RbacService（仅用于特殊场景）
    private logger: PinoLogger,
  ) {}

  // ✅ 特殊场景: 需要根据 visibility 过滤项目
  async list(userId: string, organizationId: string) {
    // 获取所有项目
    const allProjects = await this.db.query.projects.findMany({
      where: eq(schema.projects.organizationId, organizationId),
    })

    // 过滤用户有权限访问的项目
    const accessibleProjects = []
    for (const project of allProjects) {
      // public 项目: 所有人可见
      if (project.visibility === 'public') {
        accessibleProjects.push(project)
        continue
      }

      // internal/private 项目: 使用 RbacService 检查
      const role = await this.rbacService.getEffectiveProjectRoleForUser(
        userId,
        project.id
      )

      if (project.visibility === 'internal' && role !== null) {
        // internal 项目: 组织成员可见
        accessibleProjects.push(project)
      } else if (project.visibility === 'private' && role !== null) {
        // private 项目: 有项目角色可见
        accessibleProjects.push(project)
      }
    }

    return accessibleProjects
  }
}
```

**为什么这里可以使用 RbacService？**

1. **不是权限检查，是业务逻辑**
   - `list()` 方法的业务逻辑就是"返回用户可见的项目"
   - `visibility` 是项目的业务属性，不是权限系统的一部分

2. **Router 层无法处理**
   - Router 层的 `withAbility` 只能检查"用户是否有 read Organization 权限"
   - 无法处理"根据每个项目的 visibility 过滤"这种复杂逻辑

3. **RbacService 是 Foundation 层服务**
   - Business 层可以调用 Foundation 层服务
   - 符合分层架构原则

---

## 🚫 常见错误

### 错误 1: Business 层重复检查权限

```typescript
// ❌ 错误
@Injectable()
export class ProjectsService {
  constructor(
    private caslAbilityFactory: CaslAbilityFactory,  // ❌ 不需要
  ) {}

  async create(userId: string, data: CreateProjectInput) {
    // ❌ 重复检查权限（Router 层已经检查过了）
    const ability = await this.caslAbilityFactory.createForUser(userId)
    if (!ability.can('create', 'Project')) {
      throw new PermissionDeniedError('Project', 'create')
    }

    // 业务逻辑...
  }
}

// ✅ 正确
@Injectable()
export class ProjectsService {
  // ✅ 不注入 CaslAbilityFactory

  async create(userId: string, data: CreateProjectInput) {
    // ✅ 不检查权限，假设 Router 层已经检查过

    // 业务逻辑...
  }
}
```

### 错误 2: 创建 ProjectAccessService

```typescript
// ❌ 错误: 创建专门的权限检查服务
@Injectable()
export class ProjectAccessService {
  async checkAccess(userId, projectId) {
    // ❌ 这些逻辑应该在 Router 层用 withAbility 完成
  }

  async assertCan(userId, action, subject) {
    // ❌ 这些逻辑应该在 Router 层用 withAbility 完成
  }
}

// ✅ 正确: 不创建 ProjectAccessService
// 权限检查在 Router 层用 withAbility 完成
```

### 错误 3: 在 Business 层调用 `rbacService.can()`

```typescript
// ❌ 错误: 在 Business 层检查权限
@Injectable()
export class ProjectsService {
  constructor(
    private rbacService: RbacService,
  ) {}

  async create(userId: string, data: CreateProjectInput) {
    // ❌ 不应该在 Business 层检查权限
    const canCreate = await this.rbacService.can(
      userId,
      'create',
      'Project',
      data.organizationId
    )
    if (!canCreate) {
      throw new PermissionDeniedError('Project', 'create')
    }

    // 业务逻辑...
  }
}

// ✅ 正确: 权限检查在 Router 层
// Router 层
create: withAbility(..., { action: 'create', subject: 'Project' })
  .mutation(async ({ ctx, input }) => {
    return await this.projectsService.create(ctx.user.id, input)
  })

// Business 层
async create(userId: string, data: CreateProjectInput) {
  // ✅ 不检查权限
  // 业务逻辑...
}
```

---

## 📋 架构决策记录（ADR）

### 决策

**权限检查应该在 tRPC Router 层使用 `withAbility` 中间件完成，Business 层不应该重复检查权限。**

### 理由

1. **职责分离**: Router 层负责权限，Business 层负责业务逻辑
2. **避免重复**: 权限只检查一次，不浪费资源
3. **可测试性**: Business 层测试不需要 mock 权限
4. **性能优化**: 减少数据库查询
5. **代码简洁**: Business 层代码更简洁

### 影响

1. **删除 ProjectAccessService**: 不需要专门的权限检查服务
2. **删除 Business 层的权限检查代码**: 删除 `assertCan()`, `checkAccess()` 等方法
3. **简化 Business 层依赖**: 不需要注入 `CaslAbilityFactory`
4. **特殊场景**: `list()` 方法可以注入 `RbacService` 用于 visibility 过滤

### 例外

**唯一例外**: `list()` 方法需要根据 `visibility` 过滤项目

- 这不是权限检查，是业务逻辑
- Router 层无法处理这种复杂过滤
- 可以在 Business 层注入 `RbacService` 用于 `getEffectiveProjectRoleForUser()`

---

## 🎯 总结

### ✅ 正确的做法

1. **tRPC Router 层**: 使用 `withAbility` 检查权限
2. **Business 层**: 不检查权限，专注业务逻辑
3. **Foundation 层**: 提供权限查询能力（`RbacService`）
4. **特殊场景**: Business 层可以注入 `RbacService` 用于 visibility 过滤

### ❌ 错误的做法

1. ❌ 在 Business 层重复检查权限
2. ❌ 创建 ProjectAccessService
3. ❌ 在 Business 层调用 `rbacService.can()`（除非是 visibility 过滤）
4. ❌ 在 Business 层注入 `CaslAbilityFactory`

### 📊 架构对比

```
❌ 错误架构:
tRPC Router (withAbility 检查权限)
  ↓
Business Service (再次检查权限) ← 重复！
  ↓
Foundation Service

✅ 正确架构:
tRPC Router (withAbility 检查权限)
  ↓
Business Service (只做业务逻辑) ← 清晰！
  ↓
Foundation Service
```

---

**下一步**: 按照这个架构原则重构 ProjectsService，删除所有权限检查代码。
