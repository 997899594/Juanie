# 分层架构修复进度

> 创建时间: 2024-12-24
> 状态: 🟡 进行中

## 📋 问题概述

**核心问题**: Business 层绕过 Foundation 层直接查询数据库

**违规统计**: 18+ 处违规
- ProjectsService: 6+ 处
- DeploymentsService: 3 处
- RepositoriesService: 5 处
- PipelinesService: 2 处
- EnvironmentsService: 1+ 处

## 🎯 修复策略

**方案**: "Patch and Replace" - 自底向上修复

### Phase 1: 扩展 Foundation 层（1-2 天）
**目标**: 添加 Business 层需要的方法

#### 1.1 OrganizationsService 新增方法
- [x] `exists(organizationId)` - 检查组织是否存在
- [x] `getMember(organizationId, userId)` - 获取成员（公共方法）
- [x] `isMember(organizationId, userId)` - 检查是否成员
- [x] `isAdmin(organizationId, userId)` - 检查是否管理员
- [x] `getAdmins(organizationId)` - 获取所有管理员

#### 1.2 TeamsService 新增方法
- [ ] `exists(teamId)` - 检查团队是否存在
- [ ] `getTeam(teamId)` - 获取团队详情（公共方法）
- [ ] `isMember(teamId, userId)` - 检查是否成员
- [ ] `hasProjectAccess(userId, projectId)` - 检查项目访问权限

#### 1.3 导出新方法
- [ ] 更新 `packages/services/foundation/src/index.ts`

### Phase 2: 修改 Business 层（2-3 天）
**目标**: 替换所有直接数据库查询

#### 2.1 ProjectsService
- [ ] 注入 OrganizationsService, TeamsService
- [ ] 替换 6+ 处直接查询
- [ ] 删除私有方法 `getOrgMember()`
- [ ] 更新测试

#### 2.2 DeploymentsService
- [ ] 注入 OrganizationsService
- [ ] 替换 3 处 organizationMembers 查询
- [ ] 更新测试

#### 2.3 RepositoriesService
- [ ] 注入 OrganizationsService
- [ ] 替换 5 处 organizationMembers 查询
- [ ] 更新测试

#### 2.4 PipelinesService
- [ ] 注入 OrganizationsService
- [ ] 替换 2 处 organizationMembers 查询
- [ ] 更新测试

#### 2.5 EnvironmentsService
- [ ] 注入 OrganizationsService
- [ ] 替换 1 处 organizationMembers 查询
- [ ] 更新测试

### Phase 3: 验证和清理（1 天）
- [ ] 运行所有测试
- [ ] 添加 ESLint 规则防止回归
- [ ] 更新文档

## 📝 已完成工作

### OrganizationsService 扩展 ✅
**文件**: `packages/services/foundation/src/organizations/organizations.service.ts`

**新增方法**:
```typescript
// 检查组织是否存在
async exists(organizationId: string): Promise<boolean>

// 获取成员信息（公共方法）
async getMember(organizationId: string, userId: string)

// 检查是否成员
async isMember(organizationId: string, userId: string): Promise<boolean>

// 检查是否管理员
async isAdmin(organizationId: string, userId: string): Promise<boolean>

// 获取所有管理员
async getAdmins(organizationId: string)
```

**重构**: 原私有方法 `getMember()` 改为公共方法，内部调用改为 `getOrgMemberInternal()`

## 🔄 下一步

1. **完成 TeamsService 扩展**
   - 添加 4 个新方法
   - 重构私有方法为公共方法

2. **导出新方法**
   - 更新 Foundation 层的 index.ts

3. **开始修改 ProjectsService**
   - 注入 Foundation 服务
   - 替换第一批违规代码

## 📚 相关文档

- `docs/architecture/layered-architecture-violations.md` - 详细违规分析
- `docs/architecture/layered-architecture-analysis.md` - 分层架构分析
- `docs/architecture/business-service-refactoring-plan.md` - 重构计划

## ⏱️ 时间估算

- **Phase 1**: 1-2 天（进行中）
- **Phase 2**: 2-3 天
- **Phase 3**: 1 天
- **总计**: 4-6 天

## 🎯 成功标准

1. ✅ Business 层不再直接查询 Foundation 层的表
2. ✅ 所有测试通过
3. ✅ 代码减少约 200 行
4. ✅ ESLint 规则防止回归
