# 团队权限模型详解

**目标**: 用最简单的方式解释团队权限如何工作

---

## 1. 当前的数据结构

### 你有 3 张表

```typescript
// 1. teams - 团队基本信息
{
  id: 'team-1',
  organizationId: 'org-1',
  name: '前端团队'
}

// 2. team_members - 团队成员
{
  id: 'tm-1',
  teamId: 'team-1',
  userId: 'user-1',
  role: 'owner' | 'maintainer' | 'member'  // ✅ 这个很清楚
}

// 3. team_projects - 团队可以访问哪些项目
{
  id: 'tp-1',
  teamId: 'team-1',
  projectId: 'project-1',
  role: 'owner' | 'maintainer' | 'contributor'  // ❓ 这个是什么意思？
}
```

---

## 2. 问题在哪里？

### 问题：team_projects.role 的 'contributor' 是什么？

**场景**:
```
张三 是 "前端团队" 的 member
"前端团队" 被分配到 "电商项目"，role 是 'contributor'

问题：张三对 "电商项目" 有什么权限？
```

**当前的困惑**:
1. 'contributor' 在其他地方都不存在（组织没有、项目没有）
2. 'contributor' 的权限是什么？比 developer 高还是低？
3. 如果张三是团队 owner，但团队对项目是 contributor，最终权限是什么？

---

## 3. 两种设计方案

### 方案 A: 保留 team_projects.role（当前方案）

**优点**: 灵活，可以精确控制团队对项目的权限

**缺点**: 
- 需要定义 'contributor' 的语义
- 权限计算复杂（团队成员角色 + 团队项目角色）
- 多了一层角色体系

**权限计算**:
```typescript
// 张三的最终权限 = f(团队成员角色, 团队项目角色)
const finalRole = calculateRole(
  teamMemberRole: 'member',    // 张三在团队中的角色
  teamProjectRole: 'contributor' // 团队对项目的角色
)

// 问题：这个函数怎么写？
// contributor + member = ?
// contributor + owner = ?
```

### 方案 B: 删除 team_projects.role（我的建议）

**优点**: 简单，权限计算清晰

**缺点**: 不够灵活（但实际上够用）

**权限计算**:
```typescript
// 张三的最终权限 = 团队成员角色直接映射
const finalRole = mapTeamRoleToProjectRole(
  teamMemberRole: 'member'  // 张三在团队中的角色
)

// 映射规则很简单：
// team owner/maintainer → project maintainer
// team member → project developer
```

---

## 4. 实际使用场景分析

### 场景 1: 前端团队访问电商项目

**需求**: 前端团队的所有成员都能访问电商项目

**方案 A** (保留 role):
```typescript
// 1. 创建团队-项目关联
INSERT INTO team_projects (teamId, projectId, role)
VALUES ('frontend-team', 'ecommerce-project', 'contributor')

// 2. 团队成员权限
张三 (team member) + contributor = developer 权限？
李四 (team owner) + contributor = maintainer 权限？

// ❓ 规则不清晰
```

**方案 B** (删除 role):
```typescript
// 1. 创建团队-项目关联（没有 role）
INSERT INTO team_projects (teamId, projectId)
VALUES ('frontend-team', 'ecommerce-project')

// 2. 团队成员权限（清晰）
张三 (team member) → developer 权限
李四 (team owner) → maintainer 权限

// ✅ 规则清晰：团队角色直接映射
```

### 场景 2: 限制团队权限

**需求**: 前端团队只能读取后端项目，不能修改

**方案 A**:
```typescript
// 设置 team_projects.role = 'viewer'
// 但是 'viewer' 又不在 team_projects 的角色列表里
// 需要扩展角色：owner, maintainer, contributor, viewer
```

**方案 B**:
```typescript
// 方案 B-1: 不分配团队到项目（最简单）
// 如果需要访问，单独添加个人为项目成员

// 方案 B-2: 使用项目 visibility
// 设置项目为 'internal'，团队成员自动有读权限
// 不需要在 team_projects 中添加记录
```

### 场景 3: 团队负责人需要更高权限

**需求**: 团队 owner 需要管理项目，但团队 member 只能开发

**方案 A**:
```typescript
// team_projects.role = 'contributor'
// 团队 owner → contributor + owner = maintainer？
// 团队 member → contributor + member = developer？

// ❓ 需要复杂的权限计算矩阵
```

**方案 B**:
```typescript
// 自动映射
// 团队 owner → maintainer 权限（可以管理项目）
// 团队 member → developer 权限（只能开发）

// ✅ 简单直接
```

---

## 5. 我的建议（方案 B）

### 5.1 删除 team_projects.role

```sql
ALTER TABLE team_projects DROP COLUMN role;
```

### 5.2 权限计算规则

```typescript
// 用户访问项目的权限来源（按优先级）：

// 1. 直接项目成员（最高优先级）
const directRole = await getProjectMemberRole(userId, projectId)
if (directRole) {
  return directRole // owner/maintainer/developer/viewer
}

// 2. 组织管理员
const orgRole = await getOrgMemberRole(userId, organizationId)
if (orgRole === 'owner') {
  return 'maintainer' // 组织 owner 对所有项目有 maintainer 权限
}
if (orgRole === 'admin') {
  return 'developer' // 组织 admin 对所有项目有 developer 权限
}

// 3. 团队成员（通过团队访问）
const teamRole = await getTeamMemberRole(userId, teamId)
const hasTeamAccess = await checkTeamProjectAccess(teamId, projectId)

if (hasTeamAccess && teamRole) {
  // 团队角色映射到项目角色
  if (teamRole === 'owner' || teamRole === 'maintainer') {
    return 'maintainer'
  }
  if (teamRole === 'member') {
    return 'developer'
  }
}

// 4. 项目可见性
if (projectVisibility === 'public') {
  return 'viewer' // 公开项目，所有人可见
}
if (projectVisibility === 'internal' && orgRole) {
  return 'viewer' // 内部项目，组织成员可见
}

// 5. 无权限
return null
```

### 5.3 实际例子

```typescript
// 场景：张三访问电商项目

// 数据：
// - 张三是组织成员（role: member）
// - 张三是前端团队成员（role: member）
// - 前端团队被分配到电商项目（team_projects 有记录）
// - 电商项目是 private

// 权限计算：
// 1. 张三不是项目直接成员 → 跳过
// 2. 张三是组织 member（不是 owner/admin）→ 跳过
// 3. 张三是团队 member + 团队有项目访问权 → developer 权限 ✅
// 4. 项目是 private → 跳过

// 结果：张三对电商项目有 developer 权限
```

---

## 6. 为什么这样设计？

### 6.1 简单性

**方案 A** (保留 role):
- 3 层角色：组织角色 + 团队角色 + 团队项目角色
- 需要定义权限计算矩阵
- 容易出错

**方案 B** (删除 role):
- 2 层角色：组织角色 + 团队角色
- 直接映射，规则清晰
- 不容易出错

### 6.2 够用性

**实际需求**:
1. 团队成员能访问团队的项目 ✅
2. 团队负责人有更高权限 ✅
3. 限制某些团队只读 ✅（通过 visibility）
4. 灵活控制个人权限 ✅（直接添加为项目成员）

**方案 B 都能满足**

### 6.3 参考业界

**GitHub**:
- 组织成员 → 仓库权限（直接映射）
- 团队成员 → 仓库权限（直接映射）
- 没有 "团队对仓库的角色" 这个概念

**GitLab**:
- 组 (Group) 成员 → 项目权限（直接映射）
- 子组继承父组权限
- 也没有 "组对项目的角色"

---

## 7. 如果你真的需要更灵活的控制

### 方案 C: 保留 role，但重新定义

如果你确实需要 team_projects.role，那么：

```typescript
// 重新定义 team_projects.role
export type TeamProjectRole = 'admin' | 'write' | 'read'

// 权限计算：取最低权限
function calculateFinalRole(
  teamMemberRole: TeamRole,
  teamProjectRole: TeamProjectRole
): ProjectRole {
  // 团队对项目的最高权限
  const maxProjectRole = mapTeamProjectRole(teamProjectRole)
  // admin → maintainer
  // write → developer
  // read → viewer
  
  // 团队成员的权限
  const memberProjectRole = mapTeamMemberRole(teamMemberRole)
  // owner/maintainer → maintainer
  // member → developer
  
  // 取较低权限
  return min(maxProjectRole, memberProjectRole)
}

// 例子：
// 团队 member + 团队对项目 admin = developer（受团队成员角色限制）
// 团队 owner + 团队对项目 read = viewer（受团队项目角色限制）
```

**但这样会更复杂，我不推荐。**

---

## 8. 最终建议

### 推荐：方案 B（删除 team_projects.role）

**理由**:
1. ✅ 简单清晰，易于理解和维护
2. ✅ 满足 90% 的实际需求
3. ✅ 参考 GitHub/GitLab 的设计
4. ✅ 减少权限计算复杂度
5. ✅ 减少出错可能性

**如果需要更细粒度控制**:
- 直接添加用户为项目成员（最灵活）
- 使用项目 visibility 控制可见性
- 创建多个团队，不同团队不同权限

### 你的项目完全适用

你的项目是 PaaS 平台，权限模型应该：
- **简单** - 用户容易理解
- **安全** - 不容易出错
- **够用** - 覆盖常见场景

方案 B 完全满足这些要求。

---

## 9. 迁移影响

### 数据迁移

```sql
-- 1. 检查现有数据
SELECT role, COUNT(*) FROM team_projects GROUP BY role;

-- 2. 如果有数据，需要决策：
-- - 如果 role = 'owner' → 团队 owner 自动有 maintainer 权限
-- - 如果 role = 'maintainer' → 团队 maintainer 自动有 maintainer 权限
-- - 如果 role = 'contributor' → 团队 member 自动有 developer 权限

-- 3. 删除字段
ALTER TABLE team_projects DROP COLUMN role;
```

### 代码影响

```typescript
// 之前（如果有实现）
const teamProjectRole = await getTeamProjectRole(teamId, projectId)
const finalRole = calculate(teamMemberRole, teamProjectRole)

// 之后
const teamMemberRole = await getTeamMemberRole(userId, teamId)
const hasAccess = await checkTeamProjectAccess(teamId, projectId)
const finalRole = hasAccess ? mapTeamRole(teamMemberRole) : null
```

---

## 10. 你的决定

我需要你确认：

**选项 1: 方案 B（删除 team_projects.role）**
- ✅ 简单清晰
- ✅ 够用
- ✅ 易于维护

**选项 2: 方案 C（保留但重新定义）**
- ⚠️ 更灵活
- ⚠️ 更复杂
- ⚠️ 需要更多测试

**选项 3: 方案 A（保留当前设计）**
- ❌ 需要定义 'contributor' 语义
- ❌ 权限计算复杂
- ❌ 容易出错

**我强烈推荐选项 1（方案 B）**

你觉得呢？
