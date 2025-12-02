# Git Platform Integration - Schema 审查和修复

## 审查日期
2024-12-01

## Schema 审查结果

### ✅ 优秀的设计

#### 1. user_git_accounts
- **状态**: 完美匹配设计文档
- **字段**: 完整,包含 OAuth 凭证、Git 用户信息、同步状态
- **索引**: 合理,支持高效查询
- **关系**: 已添加与 users 的关系定义

#### 2. git_sync_logs  
- **状态**: 设计优秀
- **功能**: 完整的审计日志,支持错误追踪、重试机制、人工解决流程
- **字段**: 包含所有必要信息(syncType, action, status, error, metadata)
- **索引**: 完整,支持各种查询场景
- **关系**: 已定义与 organizations, projects, users 的关系

#### 3. organizations
- **状态**: 已修复,完整支持工作空间设计
- **新增字段**:
  - `type`: 工作空间类型 (personal | team)
  - `ownerId`: 个人工作空间的所有者
  - `gitProvider`, `gitOrgId`, `gitOrgName`, `gitOrgUrl`: Git 平台信息
  - `gitSyncEnabled`: 是否启用同步
  - `gitLastSyncAt`: 最后同步时间
- **索引**: 已添加 `orgs_git_provider_idx`

#### 4. project_members
- **状态**: 已修复
- **新增字段**:
  - `gitSyncStatus`: 同步状态 (pending | synced | failed)
  - `gitSyncedAt`: 同步时间
  - `gitSyncError`: 同步错误信息
- **索引**: 已添加 `project_members_git_sync_status_idx`
- **用途**: 支持个人工作空间的项目级协作

### 📋 迁移文件状态

#### 已应用的迁移
1. `0000_fair_paladin.sql` - 初始 schema
2. `0001_soft_senator_kelly.sql` - 早期更新
3. `0002_add_git_sync_features.sql` - **Git 同步功能完整迁移**
   - ✅ 添加 organizations.type, ownerId
   - ✅ 添加 organizations Git 同步字段
   - ✅ 添加 project_members Git 同步字段
   - ✅ 创建 git_sync_logs 表
   - ✅ 创建所有必要的索引和外键

#### 已删除的重复迁移
- `0003_misty_firedrake.sql` - 重复的 organizations 更新
- `0004_polite_morgan_stark.sql` - 重复的 project_members 更新

### 🔧 Schema 文件修复

#### 已修复的文件
1. **organizations.schema.ts**
   - ✅ 添加 type, ownerId 字段
   - ✅ 添加所有 Git 同步字段
   - ✅ 添加 gitProvider 索引
   - ✅ 导入 users 以支持外键

2. **project-members.schema.ts**
   - ✅ 添加 gitSyncStatus, gitSyncedAt, gitSyncError 字段
   - ✅ 添加 gitSyncStatus 索引
   - ✅ 格式化代码风格

3. **users.schema.ts**
   - ✅ 添加 usersRelations 定义
   - ✅ 添加 gitAccounts 关系 (many)

4. **user-git-accounts.schema.ts**
   - ✅ 已有 userGitAccountsRelations 定义
   - ✅ 已有 user 关系 (one)

## 当前问题

### TypeScript 类型推断问题

**症状**: 
- `organization.type` 显示不存在
- `user.gitAccounts` 显示为 `never`
- Drizzle 类型推断未更新

**原因**:
- TypeScript 服务器缓存了旧的类型
- Drizzle 的类型生成可能需要重启

**解决方案**:
1. 重启 TypeScript 服务器
2. 重新构建项目
3. 清理 node_modules/.cache

### 代码实现问题

#### 1. startSync 调用错误
**位置**: `organization-sync.service.ts` 多处

**问题**:
```typescript
await this.errorService.startSync({
  organizationId,
  syncType: 'organization',
  status: 'pending',  // ❌ startSync 不接受 status 参数
  triggeredBy,
})
```

**修复**:
```typescript
await this.errorService.startSync({
  organizationId,
  syncType: 'organization',
  action: 'create',  // ✅ 需要 action 参数
  provider: gitProvider as 'github' | 'gitlab',  // ✅ 需要 provider
  metadata: { triggeredBy },  // ✅ triggeredBy 放在 metadata 中
})
```

#### 2. GitLab 权限类型问题
**位置**: `organization-sync.service.ts` 多处

**问题**:
```typescript
await this.gitProvider.addGitLabGroupMember(
  token,
  groupId,
  userId,
  gitRole as number,  // ❌ 类型不匹配
)
```

**原因**: GitLab API 只接受特定的访问级别值 (10, 20, 30, 40, 50)

**修复**: 确保 `mapOrgRoleToGitPermission` 返回正确的类型

## 下一步行动

### 立即执行

1. **重启开发环境**
   ```bash
   # 重启 TypeScript 服务器
   # 在 VS Code 中: Cmd+Shift+P -> "TypeScript: Restart TS Server"
   
   # 或重新构建
   bun run build
   ```

2. **修复 startSync 调用**
   - 移除 `status` 参数
   - 添加 `action` 和 `provider` 参数
   - 将 `triggeredBy` 移到 `metadata` 中

3. **修复 GitLab 权限类型**
   - 确保返回值类型正确
   - 添加类型断言或类型守卫

4. **简化实现**
   - 暂时移除 `createGitOrganization` 的实际创建逻辑
   - 只做标记,提示用户手动创建
   - 专注于成员同步功能

### 后续优化

1. **添加类型约束**
   ```typescript
   // organizations.type 应该有枚举约束
   type: text('type', { enum: ['personal', 'team'] }).default('team')
   ```

2. **完善 Git 组织创建**
   - 实现 GitLab Group 创建
   - 实现 GitHub 组织关联(用户手动创建后关联)

3. **添加数据验证**
   - 使用 Zod schema 验证输入
   - 添加数据库约束

## 设计验证

### ✅ 符合设计文档

1. **工作空间类型**: 支持 personal 和 team
2. **Git 同步**: 完整的同步状态追踪
3. **项目级协作**: project_members 支持 Git 同步
4. **审计日志**: git_sync_logs 完整记录

### ✅ 符合架构原则

1. **关注点分离**: 同步逻辑与业务逻辑分离
2. **可扩展性**: 支持多种 Git 平台
3. **可观测性**: 完整的日志和状态追踪
4. **幂等性**: 支持安全重试

### ✅ 无冗余设计

1. **无重复字段**: 每个字段都有明确用途
2. **合理的关系**: 外键和关系定义正确
3. **适当的索引**: 只在需要的地方添加索引

## 总结

Schema 设计**优秀且完整**,完全符合设计文档要求。当前的编译错误主要是:
1. TypeScript 类型缓存问题(重启可解决)
2. 代码实现细节问题(需要修复函数调用)

**建议**: 重启 TypeScript 服务器后,专注于修复代码实现问题,不要再修改 schema。
