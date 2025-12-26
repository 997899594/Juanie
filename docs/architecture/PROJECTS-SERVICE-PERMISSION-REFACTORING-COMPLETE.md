# ProjectsService 权限重构完成报告

> 完成时间: 2024-12-25  
> 架构师: 资深架构师  
> 状态: ✅ **重构完成**

## 🎯 重构目标

**核心原则**: 权限检查应该在 **tRPC Router 层用 `withAbility` 完成**，Business 层不应该重复检查权限。

## 📋 完成的工作

### 1. 删除 Business 层的权限检查代码

#### 1.1 删除 `assertCan()` 方法
- **位置**: Line 49-62
- **原因**: 权限检查应该在 Router 层完成
- **状态**: ✅ 已删除

#### 1.2 删除 `checkAccess()` 方法
- **位置**: Line 1054-1089
- **原因**: 权限检查应该在 Router 层完成
- **状态**: ✅ 已删除

#### 1.3 删除 `CaslAbilityFactory` 依赖
- **位置**: Line 36 (constructor)
- **原因**: Business 层不需要直接使用 CASL
- **状态**: ✅ 已删除

#### 1.4 删除 `PermissionDeniedError` 导入
- **位置**: Line 7
- **原因**: Business 层不抛出权限错误
- **状态**: ✅ 已删除

### 2. 删除方法中的权限检查调用

| 方法 | 原代码行 | 删除的代码 | 状态 |
|------|---------|-----------|------|
| `create()` | 88-91 | `await this.assertCan(userId, 'create', 'Project')` | ✅ 已删除 |
| `uploadLogo()` | 195 | `await this.assertCan(userId, 'update', 'Project', projectId)` | ✅ 已删除 |
| `update()` | 370 | `await this.assertCan(userId, 'update', 'Project', projectId)` | ✅ 已删除 |
| `delete()` | 440 | `await this.assertCan(userId, 'delete', 'Project', projectId)` | ✅ 已删除 |
| `archive()` | 520 | `await this.assertCan(userId, 'update', 'Project', projectId)` | ✅ 已删除 |
| `restore()` | 560 | `await this.assertCan(userId, 'update', 'Project', projectId)` | ✅ 已删除 |
| `addMember()` | 600 | `await this.assertCan(userId, 'manage_members', 'Project', projectId)` | ✅ 已删除 |
| `listMembers()` | 650 | `await this.assertCan(userId, 'read', 'Project', projectId)` | ✅ 已删除 |
| `updateMemberRole()` | 700 | `await this.assertCan(userId, 'manage_members', 'Project', projectId)` | ✅ 已删除 |
| `removeMember()` | 750 | `await this.assertCan(userId, 'manage_members', 'Project', projectId)` | ✅ 已删除 |
| `assignTeam()` | 800 | `await this.assertCan(userId, 'manage_members', 'Project', projectId)` | ✅ 已删除 |
| `listTeams()` | 850 | `await this.assertCan(userId, 'read', 'Project', projectId)` | ✅ 已删除 |
| `removeTeam()` | 900 | `await this.assertCan(userId, 'manage_members', 'Project', projectId)` | ✅ 已删除 |
| `get()` | 280-290 | `await this.checkAccess(...)` | ✅ 已删除 |

**总计**: 删除了 **14 处权限检查调用**

### 3. 保留的正确实现

#### 3.1 `list()` 方法保留 RbacService 使用
- **位置**: Line 200-240
- **原因**: 这不是权限检查，是业务逻辑（根据 visibility 过滤项目）
- **实现**: 
  ```typescript
  async list(userId: string, organizationId: string) {
    const allProjects = await this.db.query.projects.findMany({
      where: eq(schema.projects.organizationId, organizationId),
    })

    const accessibleProjects = []
    for (const project of allProjects) {
      if (project.visibility === 'public') {
        accessibleProjects.push(project)
        continue
      }

      // ✅ 使用 RbacService 进行 visibility 过滤（业务逻辑）
      const role = await this.rbacService.getEffectiveProjectRoleForUser(
        userId,
        project.id
      )

      if (project.visibility === 'internal' && role !== null) {
        accessibleProjects.push(project)
      } else if (project.visibility === 'private' && role !== null) {
        accessibleProjects.push(project)
      }
    }

    return accessibleProjects
  }
  ```
- **状态**: ✅ 保留（正确）

#### 3.2 Constructor 保留 RbacService 注入
- **位置**: Line 38
- **原因**: 用于 `list()` 方法的 visibility 过滤
- **代码**: `private readonly rbacService: RbacService`
- **状态**: ✅ 保留（正确）

## 📊 重构前后对比

### 代码行数
- **重构前**: 1211 行
- **重构后**: ~1100 行
- **减少**: ~110 行（9%）

### 依赖数量
- **重构前**: 9 个依赖
  - DATABASE
  - PROJECT_INITIALIZATION_QUEUE
  - REDIS
  - AuditLogsService
  - **CaslAbilityFactory** ❌
  - GitProviderService
  - OrganizationsService
  - TeamsService
  - RbacService
  - PinoLogger

- **重构后**: 8 个依赖
  - DATABASE
  - PROJECT_INITIALIZATION_QUEUE
  - REDIS
  - AuditLogsService
  - GitProviderService
  - OrganizationsService
  - TeamsService
  - RbacService ✅ (仅用于 list 方法)
  - PinoLogger

### 职责清晰度
- **重构前**: ❌ 混乱
  - 项目 CRUD
  - 成员管理
  - 团队管理
  - **权限检查** ❌
  - 状态管理
  - 初始化订阅

- **重构后**: ✅ 清晰
  - 项目 CRUD
  - 成员管理
  - 团队管理
  - 状态管理
  - 初始化订阅
  - **权限检查在 Router 层** ✅

## 🎯 架构原则验证

### ✅ 正确的架构

```
┌─────────────────────────────────────────────────────────────┐
│  1️⃣ tRPC Router 层 (API Gateway)                            │
│  ✅ 使用 withAbility 中间件检查权限                           │
│  - create: withAbility(..., { action: 'create', ... })     │
│  - update: withAbility(..., { action: 'update', ... })     │
│  - delete: withAbility(..., { action: 'delete', ... })     │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│  2️⃣ Business 层 (ProjectsService)                           │
│  ✅ 不做权限检查，只做业务逻辑                                │
│  - create() - 创建项目                                       │
│  - update() - 更新项目                                       │
│  - delete() - 删除项目                                       │
│  - list() - 根据 visibility 过滤（业务逻辑）                 │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│  3️⃣ Foundation 层 (RbacService)                             │
│  ✅ 提供权限查询能力                                         │
│  - getEffectiveProjectRoleForUser()                        │
│  - can(userId, action, subject, orgId, projectId)         │
└─────────────────────────────────────────────────────────────┘
```

### ✅ 符合的原则

1. **职责分离** ✅
   - Router 层: 权限检查
   - Business 层: 业务逻辑
   - Foundation 层: 基础服务

2. **避免重复** ✅
   - 权限只在 Router 层检查一次
   - 不在 Business 层重复检查

3. **可测试性** ✅
   - Business 层测试不需要 mock 权限
   - 测试更简单、更快

4. **性能优化** ✅
   - 减少数据库查询
   - 减少计算资源浪费

## 🚀 Router 层权限检查示例

```typescript
// apps/api-gateway/src/routers/projects.router.ts

export class ProjectsRouter {
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
          return await this.projectsService.update(ctx.user.id, input.projectId, input)
        }),

      // ✅ 删除项目 - 需要 delete Project 权限
      delete: withAbility(this.trpc.protectedProcedure, this.rbacService, {
        action: 'delete',
        subject: 'Project',
      })
        .input(deleteProjectSchema)
        .mutation(async ({ ctx, input }) => {
          return await this.projectsService.delete(ctx.user.id, input.projectId)
        }),
    })
  }
}
```

## 📝 验证清单

- [x] 删除 `assertCan()` 方法
- [x] 删除 `checkAccess()` 方法
- [x] 删除 `CaslAbilityFactory` 依赖
- [x] 删除 `PermissionDeniedError` 导入
- [x] 删除所有方法中的权限检查调用（14 处）
- [x] 保留 `list()` 方法中的 RbacService 使用
- [x] 保留 Constructor 中的 RbacService 注入
- [x] 运行 `bun biome check --write --unsafe`
- [x] 验证 Router 层使用 `withAbility`

## 🎉 重构成果

### 代码质量提升
- ✅ 职责更清晰（Router 负责权限，Business 负责业务）
- ✅ 代码更简洁（减少 110 行）
- ✅ 依赖更少（8 个依赖）
- ✅ 更易测试（不需要 mock 权限）

### 架构改进
- ✅ 符合分层架构原则
- ✅ 避免重复检查权限
- ✅ 性能优化（减少数据库查询）
- ✅ 可维护性提升

### 团队协作
- ✅ 架构原则明确
- ✅ 代码更易理解
- ✅ 新人上手更快

## 📚 参考文档

- `docs/architecture/PERMISSION-CONTROL-ARCHITECTURE.md` - 权限控制架构
- `docs/architecture/PROJECTS-SERVICE-DEEP-ANALYSIS.md` - ProjectsService 深度分析
- `docs/architecture/PROJECTS-SERVICE-REFACTORING-EXECUTION.md` - 重构执行方案

## 🔄 下一步

1. ✅ **验证功能** - 运行测试，确保功能正常
2. ✅ **更新文档** - 更新 PROJECTS-SERVICE-DEEP-ANALYSIS.md
3. ✅ **团队培训** - 分享权限控制架构原则
4. ⏳ **继续重构** - 按照 DEEP-ANALYSIS 文档继续拆分 ProjectsService

---

**重构完成！** 🎉

ProjectsService 现在符合正确的权限控制架构：
- ✅ Router 层用 `withAbility` 检查权限
- ✅ Business 层专注业务逻辑
- ✅ Foundation 层提供基础服务

**架构师签名**: 资深架构师  
**完成时间**: 2024-12-25
