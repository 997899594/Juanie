# RBAC 组织权限 403 Bug 修复记录

## 问题描述

用户创建新组织后，访问项目列表页面时收到 403 Forbidden 错误：

```
GET /trpc/projects.list?input={"0":{"organizationId":"09b4faf7-a107-4a6b-a4dd-edf34eb2b2b9"}}
[HTTP/1.1 403 Forbidden]
Error: 无权限执行此操作: read Organization
```

## 根本原因

**tRPC 中间件在 `.input()` 之前执行**，导致权限检查时无法访问已解析的 input 数据。

### 问题代码

```typescript
// ❌ 错误：中间件无法访问 input
list: withAbility(this.trpc.protectedProcedure, this.rbacService, {
  action: 'read',
  subject: 'Organization',
})
  .input(organizationIdQuerySchema)  // input 在中间件之后才解析
  .query(async ({ ctx, input }) => {
    return await this.projectsService.list(ctx.user.id, input.organizationId)
  })
```

### 调试日志显示

```
[RBAC Debug] {
  userId: "0bd7e1b5-2595-45fd-b1f0-9998e2da9c1b",
  action: "read",
  subject: "Organization",
  organizationId: undefined,  // ❌ 无法获取
  projectId: undefined,
  hasPermission: false,
  input: undefined,  // ❌ input 为空
}
```

## 解决方案

**采用 tRPC 官方推荐方案**：在 resolver 内部检查权限，而不是使用中间件。

### 修复后的代码

```typescript
// ✅ 正确：在 resolver 内部检查权限
list: this.trpc.protectedProcedure
  .input(organizationIdQuerySchema)
  .query(async ({ ctx, input }) => {
    // 此时 input 已经被 zod 解析和验证
    await checkPermission(
      this.rbacService,
      ctx.user.id,
      'read',
      'Organization',
      input.organizationId,  // ✅ 可以访问
    )
    return await this.projectsService.list(ctx.user.id, input.organizationId)
  })
```

### 新的辅助函数

```typescript
// apps/api-gateway/src/trpc/rbac.middleware.ts
export async function checkPermission(
  rbacService: RbacService,
  userId: string,
  action: Action,
  subject: Subject,
  organizationId?: string,
  projectId?: string,
): Promise<void> {
  const hasPermission = await rbacService.can(
    userId,
    action,
    subject,
    organizationId,
    projectId,
  )

  if (!hasPermission) {
    throw new TRPCError({
      code: 'FORBIDDEN',
      message: `无权限执行此操作: ${action} ${subject}`,
    })
  }
}
```

## 为什么这是正确方案

1. ✅ **符合 tRPC 设计理念**：中间件用于通用逻辑（如认证），业务逻辑（如权限）在 resolver 内部
2. ✅ **可以访问完整的、已验证的 input**：不需要手动解析 rawInput
3. ✅ **代码更清晰**：权限检查逻辑就在业务逻辑旁边，易于理解和维护
4. ✅ **类型安全**：input 已经过 zod 验证，类型完全正确
5. ✅ **不需要复杂的中间件魔法**：避免 rawInput、类型转换等 hack

## tRPC 执行顺序

```
1. procedure.use(middleware)  ← 中间件执行（此时 input 未解析）
2. .input(schema)             ← zod 解析和验证 input
3. .query() / .mutation()     ← resolver 执行（input 已解析）
```

## 相关文件

- `apps/api-gateway/src/trpc/rbac.middleware.ts` - 新的 checkPermission 辅助函数
- `apps/api-gateway/src/routers/projects.router.ts` - 修复 projects.list
- `packages/services/foundation/src/rbac/rbac.service.ts` - RBAC 服务（未修改）
- `packages/services/foundation/src/organizations/organizations.service.ts` - 组织创建逻辑（未修改）

## 后续工作

需要将所有使用 `withAbility()` 的 endpoints 重构为使用 `checkPermission()`：

```bash
# 查找所有使用 withAbility 的地方
grep -r "withAbility" apps/api-gateway/src/routers/
```

## 经验教训

1. **优先使用官方推荐方案**：不要自己发明中间件模式
2. **理解框架的执行顺序**：tRPC 中间件 → input 解析 → resolver
3. **权限检查属于业务逻辑**：应该在 resolver 内部，而不是中间件
4. **遇到问题先查官方文档**：避免走弯路

## 问题 3: 组织被软删除后，RBAC 仍然认为用户有权限

### 现象

用户删除组织后，再次尝试在该组织下创建项目时遇到错误：

```
Error: 组织不存在
```

调试日志显示数据不一致：

```
[RBAC defineAbilities] Organization member query: {
  userId: "0bd7e1b5-2595-45fd-b1f0-9998e2da9c1b",
  organizationId: "09b4faf7-a107-4a6b-a4dd-edf34eb2b2b9",
  found: true,  // ✅ organization_members 表有记录
  role: "owner"
}

[OrganizationsService.exists] {
  organizationId: "09b4faf7-a107-4a6b-a4dd-edf34eb2b2b9",
  found: false,  // ❌ organizations 表记录被软删除
  org: undefined
}
```

数据库查询显示组织已被软删除：

```sql
SELECT id, name, deleted_at FROM organizations 
WHERE id = '09b4faf7-a107-4a6b-a4dd-edf34eb2b2b9';

-- deleted_at: 2025-12-29T01:47:14.228Z  ❌ 已软删除
```

### 根本原因

**软删除的组织，成员记录仍然存在**：

1. `organizations` 表有 `deleted_at` 字段（软删除）
2. `organization_members` 表**没有** `deleted_at` 字段
3. 软删除组织时，只设置 `organizations.deleted_at`，不删除成员记录
4. RBAC 查询 `organization_members` 时，没有检查组织是否被软删除
5. 导致 RBAC 认为用户有权限，但业务逻辑过滤了软删除的组织

**为什么不用数据库级联删除？**

- Schema 配置了 `onDelete: 'cascade'`，但这是**硬删除**的级联
- 软删除（`deleted_at`）不会触发数据库的 `CASCADE`
- 需要在应用层处理软删除的关联数据

### 解决方案

**RBAC 查询时，使用 Relational Query 关联查询组织，检查是否被软删除**：

```typescript
// ❌ 错误：只查 organization_members，不检查组织状态
const orgMemberRecord = await this.db.query.organizationMembers.findFirst({
  where: and(
    eq(schema.organizationMembers.userId, userId),
    eq(schema.organizationMembers.organizationId, organizationId),
  ),
})

// ✅ 正确：关联查询组织，检查 deletedAt
const orgMemberRecord = await this.db.query.organizationMembers.findFirst({
  where: and(
    eq(schema.organizationMembers.userId, userId),
    eq(schema.organizationMembers.organizationId, organizationId),
  ),
  with: {
    organization: {
      columns: {
        id: true,
        deletedAt: true,
      },
    },
  },
})

// ✅ 只有组织未被删除时，才使用该角色
if (orgMemberRecord && orgMemberRecord.organization && !orgMemberRecord.organization.deletedAt) {
  orgMember = {
    userId: orgMemberRecord.userId,
    organizationId: orgMemberRecord.organizationId,
    role: orgMemberRecord.role as AbilityOrgMember['role'],
  }
}
```

### 修复文件

- `packages/services/foundation/src/rbac/rbac.service.ts` - 添加组织软删除检查

### 最佳实践

1. **软删除的关联数据处理**：
   - 方案 A：应用层查询时检查主表的 `deletedAt`（本次采用）
   - 方案 B：软删除时同步更新关联表（复杂，容易遗漏）
   - 方案 C：关联表也添加 `deletedAt` 字段（冗余，但查询简单）

2. **使用 Drizzle Relational Query**：
   ```typescript
   // ✅ 一次查询获取关联数据
   const member = await db.query.organizationMembers.findFirst({
     where: eq(organizationMembers.userId, userId),
     with: {
       organization: true,  // 自动关联查询
     },
   })
   ```

3. **RBAC 权限检查要考虑软删除**：
   - 组织被删除 → 用户失去该组织的所有权限
   - 项目被删除 → 用户失去该项目的所有权限
   - 团队被删除 → 用户失去该团队的所有权限

---

**修复时间**: 2025-12-29  
**修复人**: Kiro AI  
**状态**: ✅ 已修复
