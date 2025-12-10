# RBAC CASL 角色定义修复

**日期**: 2025-12-08  
**状态**: ✅ 已完成

---

## 问题描述

在审查 CASL 权限定义时，发现了角色定义不一致的问题：

### 不一致的角色定义

1. **数据库 Schema** (`project-members.schema.ts`):
   ```typescript
   role: 'owner' | 'maintainer' | 'developer' | 'viewer'
   ```

2. **CASL 类型定义** (修复前):
   ```typescript
   role: 'admin' | 'member' | 'viewer'
   ```

3. **API 层** (`projects.router.ts`):
   ```typescript
   role: 'admin' | 'developer' | 'viewer'
   // 映射: developer → member
   ```

这种不一致导致：
- 类型不匹配
- 权限规则不完整
- 无法正确处理 `owner` 和 `maintainer` 角色

---

## 解决方案

### 1. 统一角色定义

更新 CASL 类型以支持所有数据库角色：

```typescript
// packages/core/src/rbac/casl/types.ts
export interface AbilityProjectMember {
  userId: string
  projectId: string
  role: 'owner' | 'maintainer' | 'admin' | 'developer' | 'member' | 'viewer'
}
```

### 2. 完善权限规则

更新 `abilities.ts` 以支持所有角色：

```typescript
// 项目所有者 - 完全控制权限
if (role === 'owner') {
  can('read', 'Project')
  can('update', 'Project')
  can('delete', 'Project')  // 只有 owner 可以删除
  can('manage_members', 'Project')
  can('manage_settings', 'Project')
  // ... 环境和部署权限
}
// 项目维护者 - 类似管理员但不能删除项目
else if (role === 'maintainer' || role === 'admin') {
  can('read', 'Project')
  can('update', 'Project')
  cannot('delete', 'Project')  // 维护者不能删除
  can('manage_members', 'Project')
  // ... 环境和部署权限
}
// 项目开发者 - 可以读写和部署
else if (role === 'developer' || role === 'member') {
  can('read', 'Project')
  can('update', 'Project')
  can('deploy', 'Deployment')
  // 不能管理成员或删除
}
// 项目查看者 - 只读权限
else if (role === 'viewer') {
  can('read', 'Project')
  can('read', 'Environment')
  can('read', 'Deployment')
}
```

### 3. 更新 Factory

更新 `CaslAbilityFactory` 的类型转换：

```typescript
// packages/core/src/rbac/casl/casl-ability.factory.ts
const projectMembers: AbilityProjectMember[] = projectMemberships.map((pm) => ({
  userId,
  projectId: pm.projectId,
  role: pm.role as 'owner' | 'maintainer' | 'admin' | 'developer' | 'member' | 'viewer',
}))
```

### 4. 完善测试覆盖

添加了针对所有角色的测试：

- ✅ Project Owner (新增)
- ✅ Project Maintainer (新增)
- ✅ Project Admin (alias for Maintainer)
- ✅ Project Developer (新增)
- ✅ Project Member (alias for Developer)
- ✅ Project Viewer (已有)

**测试结果**: 19/19 通过 ✅

---

## 角色权限矩阵

### 项目级角色

| 角色 | 读取 | 更新 | 删除 | 管理成员 | 管理环境 | 部署 |
|------|------|------|------|----------|----------|------|
| **Owner** | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| **Maintainer** | ✅ | ✅ | ❌ | ✅ | ✅ | ✅ |
| **Admin** (alias) | ✅ | ✅ | ❌ | ✅ | ✅ | ✅ |
| **Developer** | ✅ | ✅ | ❌ | ❌ | ❌ | ✅ |
| **Member** (alias) | ✅ | ✅ | ❌ | ❌ | ❌ | ✅ |
| **Viewer** | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |

### 角色说明

1. **Owner**: 项目所有者，拥有完全控制权，包括删除项目
2. **Maintainer**: 项目维护者，可以管理项目和成员，但不能删除项目
3. **Admin**: `maintainer` 的别名，用于 API 兼容性
4. **Developer**: 项目开发者，可以读写代码和部署，但不能管理成员
5. **Member**: `developer` 的别名，用于 API 兼容性
6. **Viewer**: 项目查看者，只有只读权限

---

## 角色映射关系

为了保持 API 兼容性，系统支持角色别名：

```typescript
// API 接受的角色
'admin' | 'developer' | 'viewer'

// 映射到数据库角色
admin → maintainer (或保持 admin)
developer → member (或保持 developer)
viewer → viewer
```

---

## 验证清单

- [x] 类型定义已更新
- [x] 权限规则已完善
- [x] Factory 类型转换已修复
- [x] 测试覆盖所有角色
- [x] 所有测试通过 (19/19)
- [x] 无类型错误
- [x] 角色权限矩阵已文档化

---

## 影响范围

### 已更新的文件

1. `packages/core/src/rbac/casl/types.ts` - 类型定义
2. `packages/core/src/rbac/casl/abilities.ts` - 权限规则
3. `packages/core/src/rbac/casl/casl-ability.factory.ts` - Factory 实现
4. `packages/core/src/rbac/casl/abilities.spec.ts` - 测试用例

### 向后兼容性

✅ **完全向后兼容**

- API 层继续接受 `admin | developer | viewer`
- 内部映射到完整的角色集
- 现有代码无需修改

---

## 下一步

### 建议的改进

1. **统一角色命名**
   - 考虑在整个系统中使用一致的角色名称
   - 或者明确文档化角色别名关系

2. **添加角色迁移**
   - 如果需要重命名角色，提供数据库迁移脚本

3. **扩展权限粒度**
   - 考虑添加更细粒度的权限（如 `can('read', 'Project', ['name', 'description'])`）
   - 添加基于资源所有者的权限（如 `can('delete', 'Deployment', { createdBy: user.id })`）

---

## 参考资料

- [CASL 官方文档](https://casl.js.org/)
- [项目成员 Schema](../../../packages/core/src/database/schemas/project-members.schema.ts)
- [权限映射器](../../../packages/services/business/src/gitops/git-sync/permission-mapper.ts)

---

**结论**: 角色定义不一致问题已修复，系统现在正确支持所有数据库定义的角色，并保持 API 向后兼容性。✅
