# ProjectsService 重构执行方案

> 创建时间: 2024-12-25  
> 架构师: 资深架构师  
> 状态: 🚀 **执行中**

## 🎯 核心原则：利用上游能力 + 第三方工具

作为资深架构师，我的重构原则是：
1. **不重复造轮子** - 优先使用 Foundation 层已有能力
2. **利用第三方工具** - 使用成熟的库（CASL, Drizzle Relational Query）
3. **分层清晰** - Business → Foundation → Core
4. **最小化代码** - 删除重复逻辑，委托给上游

---

## 📊 上游能力盘点

### Foundation 层已提供的能力

#### 1. OrganizationsService
```typescript
✅ exists(orgId): Promise<boolean>           // 检查组织是否存在
✅ get(orgId, userId): Promise<Org | null>   // 获取组织详情
✅ getMember(orgId, userId): Promise<Member> // 获取成员信息
✅ isAdmin(orgId, userId): Promise<boolean>  // 检查是否管理员
```

#### 2. TeamsService
```typescript
✅ get(userId, teamId): Promise<Team>        // 获取团队详情
✅ getTeamMember(teamId, userId): Promise<Member> // 获取团队成员
✅ hasProjectAccess(userId, projectId): Promise<boolean> // 检查项目访问权限
```

#### 3. RbacService（最强大的上游能力）
```typescript
✅ defineAbilitiesForUser(userId, orgId?, projectId?): Promise<AppAbility>
   // 生成完整权限对象（考虑组织、项目、团队）

✅ can(userId, action, subject, orgId?, projectId?): Promise<boolean>
   // 检查用户是否有特定权限

✅ getEffectiveProjectRoleForUser(userId, projectId): Promise<ProjectRole | null>
   // 获取用户在项目中的有效角色（考虑组织、直接、团队继承）
```

**关键发现**: RbacService 已经实现了所有权限逻辑！

---

## 🚨 当前问题分析

### 问题 1: 重复实现权限逻辑

**症状**: ProjectsService 重新实现了 RbacService 已有的功能

```typescript
// ❌ 当前: ProjectsService.list() 重复实现权限检查
async list(userId, organizationId) {
  // 1. 查询组织成员（重复）
  const member = await this.getOrgMember(organizationId, userId)
  
  // 2. 检查是否管理员（重复）
  const isOrgAdmin = member && ['owner', 'admin'].includes(member.role)
  
  // 3. 检查项目成员（重复）
  const projectMember = await this.getProjectMember(project.id, userId)
  
  // 4. 检查团队访问（重复）
  const teamAccess = await this.db.select(...)
}

// ✅ RbacService 已经实现了这些逻辑！
async getEffectiveProjectRoleForUser(userId, projectId) {
  // 自动处理:
  // 1. 组织角色映射 (owner → maintainer)
  // 2. 直接项目成员角色
  // 3. 团队继承的项目角色
}
```

**解决方案**: 删除重复代码，直接调用 RbacService

---

## 🎯 重构方案

### 方案 1: 简化 list() 方法（利用 RbacService）

**当前代码**: 80+ 行，重复实现权限逻辑

**重构后**: 30 行，委托给 RbacService

```typescript
// ✅ 重构后: 简洁清晰
@Trace('projects.list')
async list(userId: string, organizationId: string) {
  // 1. 获取所有项目
  const allProjects = await this.db.query.projects.findMany({
    where: and(
      eq(schema.projects.organizationId, organizationId),
      isNull(schema.projects.deletedAt),
    ),
  })

  // 2. 根据 visibility 过滤（利用 RbacService）
  const accessibleProjects = []
  for (const project of allProjects) {
    if (project.visibility === 'public') {
      accessibleProjects.push(project)
      continue
    }

    // ✅ 委托给 RbacService（自动处理组织、项目、团队权限）
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

**优势**:
- ✅ 代码减少 60%（80 行 → 30 行）
- ✅ 利用 RbacService 的完整能力（组织、项目、团队）
- ✅ 无需手动查询 organizationMembers, projectMembers, teamMembers
- ✅ 权限逻辑集中在 RbacService，易于维护

---


### 方案 2: 删除辅助方法（利用 Foundation 层）

**当前代码**: ProjectsService 有 3 个辅助方法，直接查询 Foundation 层表

```typescript
// ❌ 当前: 直接查询 Foundation 层表（架构违规）
private async getOrgMember(organizationId, userId) {
  return this.db.query.organizationMembers.findFirst(...)  // ❌ 违规
}

private async getProjectMember(projectId, userId) {
  return this.db.query.projectMembers.findFirst(...)  // ❌ 违规
}

private async checkAccess(userId, projectId, organizationId, visibility) {
  // 手动实现权限检查逻辑  // ❌ 重复
}
```

**重构后**: 删除所有辅助方法，直接使用 Foundation 层服务

```typescript
// ✅ 重构后: 无需辅助方法

// 需要组织成员信息？
const member = await this.organizationsService.getMember(orgId, userId)

// 需要检查权限？
const role = await this.rbacService.getEffectiveProjectRoleForUser(userId, projectId)

// 需要检查团队访问？
const hasAccess = await this.teamsService.hasProjectAccess(userId, projectId)
```

**优势**:
- ✅ 删除 100+ 行重复代码
- ✅ 修复架构违规（不再直接查询 Foundation 层表）
- ✅ 利用 Foundation 层的完整能力

---

### 方案 3: 利用 Drizzle Relational Query（第三方工具）

**当前代码**: 手动 JOIN 查询，代码冗长

```typescript
// ❌ 当前: 手动 JOIN
const [teamAccess] = await this.db
  .select({ count: sql<number>`count(*)` })
  .from(schema.teamProjects)
  .innerJoin(schema.teamMembers, eq(schema.teamProjects.teamId, schema.teamMembers.teamId))
  .where(
    and(
      eq(schema.teamProjects.projectId, project.id),
      eq(schema.teamMembers.userId, userId),
    ),
  )
```

**重构后**: 使用 Drizzle Relational Query

```typescript
// ✅ 重构后: 使用 Relational Query（更简洁）
const projects = await this.db.query.projects.findMany({
  where: eq(schema.projects.organizationId, organizationId),
  with: {
    members: {
      where: eq(schema.projectMembers.userId, userId)
    },
    teamProjects: {
      with: {
        team: {
          with: {
            members: {
              where: eq(schema.teamMembers.userId, userId)
            }
          }
        }
      }
    }
  }
})
```

**优势**:
- ✅ 代码更简洁
- ✅ 类型安全
- ✅ 自动优化查询

---

### 方案 4: 利用 CASL（第三方工具）

**当前代码**: 手动检查权限

```typescript
// ❌ 当前: 手动检查
const member = await this.getOrgMember(organizationId, userId)
if (!member || !['owner', 'admin'].includes(member.role)) {
  throw new PermissionDeniedError(...)
}
```

**重构后**: 使用 CASL + RbacService

```typescript
// ✅ 重构后: 使用 CASL（在 Router 层）
withAbility(trpc.protectedProcedure, rbacService, {
  action: 'create',
  subject: 'Project'
})

// ✅ Business 层不检查权限，假设 Router 层已经检查过
async create(userId, data) {
  // 直接执行业务逻辑，无需检查权限
}
```

**优势**:
- ✅ 权限检查集中在 Router 层
- ✅ Business 层专注业务逻辑
- ✅ 职责清晰

---

## 📋 执行计划

### Phase 1: 重构 list() 方法（1 小时）

**目标**: 利用 RbacService，删除重复代码

**步骤**:
1. 删除 `getOrgMember()` 辅助方法
2. 删除 `getProjectMember()` 辅助方法
3. 删除手动权限检查逻辑
4. 使用 `rbacService.getEffectiveProjectRoleForUser()`

**预期结果**:
- ✅ 代码减少 60%（80 行 → 30 行）
- ✅ 修复 3 处架构违规
- ✅ 利用 RbacService 的完整能力

---

### Phase 2: 重构 create() 方法（30 分钟）

**目标**: 利用 OrganizationsService

**步骤**:
1. 删除直接查询 `organizations` 表的代码
2. 使用 `organizationsService.exists()`

**预期结果**:
- ✅ 修复 1 处架构违规
- ✅ 代码更简洁

---

### Phase 3: 删除所有辅助方法（30 分钟）

**目标**: 删除重复代码，利用 Foundation 层

**步骤**:
1. 删除 `getOrgMember()` 方法
2. 删除 `getProjectMember()` 方法
3. 删除 `checkAccess()` 方法
4. 更新所有调用方

**预期结果**:
- ✅ 删除 100+ 行重复代码
- ✅ 修复所有架构违规
- ✅ 依赖关系清晰

---

### Phase 4: 测试和验证（1 小时）

**目标**: 确保重构不破坏功能

**步骤**:
1. 运行单元测试
2. 运行集成测试
3. 手动测试关键流程
4. 性能测试

**预期结果**:
- ✅ 所有测试通过
- ✅ 性能不下降
- ✅ 功能正常

---

## 📊 重构前后对比

### 代码行数

| 方法 | 重构前 | 重构后 | 减少 |
|------|--------|--------|------|
| `list()` | 80 行 | 30 行 | **-62%** |
| `create()` | 50 行 | 40 行 | **-20%** |
| 辅助方法 | 100 行 | 0 行 | **-100%** |
| **总计** | **230 行** | **70 行** | **-70%** |

### 依赖关系

```
❌ 重构前:
ProjectsService
├── DATABASE (直接查询 Foundation 层表)  // ❌ 违规
├── OrganizationsService
├── TeamsService
├── RbacService
└── 其他...

✅ 重构后:
ProjectsService
├── DATABASE (只查询 Business 层表)  // ✅ 正确
├── OrganizationsService  // ✅ 利用上游
├── RbacService          // ✅ 利用上游
└── 其他...
```

### 架构违规

| 类型 | 重构前 | 重构后 |
|------|--------|--------|
| 直接查询 Foundation 层表 | 18+ 处 | **0 处** |
| 重复实现权限逻辑 | 5+ 处 | **0 处** |
| 手动 JOIN 查询 | 3+ 处 | **0 处** |

---

## 🎯 关键决策

### 决策 1: 不创建 ProjectAccessService

**原因**:
- ✅ RbacService 已经提供了所有权限检查能力
- ✅ 创建 ProjectAccessService 会重复实现权限逻辑
- ✅ Router 层用 `withAbility` 检查权限更清晰

**正确方案**:
- Router 层: 使用 `withAbility` 检查权限
- Business 层: 直接注入 `RbacService`（仅用于 `list()` 方法）

### 决策 2: list() 方法使用 RbacService 不是重复检查

**原因**:
- Router 层: 检查用户是否可以读取组织（粗粒度）
- Business 层: 根据 visibility 过滤项目（细粒度）
- 两者职责不同，不是重复

**类比**:
- Router 层: "你有进入大楼的权限吗？" → 是/否
- Business 层: "你可以进入哪些房间？" → 返回可访问的房间列表

### 决策 3: 优先使用 Foundation 层服务

**原因**:
- ✅ 避免重复实现
- ✅ 利用上游的完整能力
- ✅ 修复架构违规
- ✅ 代码更简洁

**示例**:
```typescript
// ❌ 错误: 直接查询
const member = await this.db.query.organizationMembers.findFirst(...)

// ✅ 正确: 使用 Foundation 层
const member = await this.organizationsService.getMember(orgId, userId)
```

---

## 🚀 开始执行

**下一步**: 执行 Phase 1 - 重构 list() 方法

**预计时间**: 3 小时（包括测试）

**优先级**: 🔴 P0 - 立即执行

---

**总结**: 通过利用上游能力（RbacService, OrganizationsService）和第三方工具（Drizzle Relational Query, CASL），我们可以将 ProjectsService 的代码减少 70%，同时修复所有架构违规，提升代码质量和可维护性。

