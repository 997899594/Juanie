# GitOps 模块重构计划

**日期**: 2025-12-25  
**规划人**: 资深架构师  
**状态**: 📋 规划完成

---

## 📋 执行摘要

基于深度分析，制定 GitOps 模块的详细重构计划。重点修复架构违规，使用 Foundation 层服务替代直接查询。

**关键目标**:
- ✅ 修复所有架构违规（~40 处）
- ✅ 使用 Foundation 层服务
- ✅ 保持功能完整性
- ✅ 提升代码质量

---

## 🎯 重构范围

### 需要重构的文件

| 文件 | 违规数量 | 工作量 | 优先级 |
|------|----------|--------|--------|
| organization-sync.service.ts | ~30 处 | 2-3 小时 | P0 |
| project-collaboration-sync.service.ts | ~10 处 | 1-2 小时 | P0 |
| **总计** | **~40 处** | **3-5 小时** | - |

### 不需要重构的文件

✅ 以下文件没有架构违规：
- git-sync.service.ts
- git-sync.worker.ts
- git-sync-event-handler.service.ts
- organization-event-handler.service.ts
- conflict-resolution.service.ts
- permission-mapper.ts
- git-sync-errors.ts

---

## 📝 详细重构计划

### 阶段 1: organization-sync.service.ts 重构（P0）

**工作量**: 2-3 小时

#### 1.1 注入 Foundation 层服务

```typescript
// ❌ 之前
constructor(
  @Inject(DATABASE) private readonly db: PostgresJsDatabase<typeof schema>,
  private readonly gitProvider: GitProviderService,
  private readonly errorService: GitSyncErrorService,
  private readonly logger: PinoLogger,
) {}

// ✅ 之后
constructor(
  @Inject(DATABASE) private readonly db: PostgresJsDatabase<typeof schema>, // 保留用于 gitSyncLogs
  private readonly organizationsService: OrganizationsService,
  private readonly usersService: UsersService,
  private readonly gitConnectionsService: GitConnectionsService,
  private readonly gitProvider: GitProviderService,
  private readonly errorService: GitSyncErrorService,
  private readonly logger: PinoLogger,
) {}
```

#### 1.2 替换组织查询（11 处）

**位置**: 
- `syncOrganizationMembers()` - 1 处
- `syncPersonalWorkspace()` - 0 处（参数传入）
- `syncTeamWorkspace()` - 0 处（参数传入）
- `removeOrganizationMember()` - 1 处
- `syncNewOrganization()` - 1 处
- `getOrganizationSyncStatus()` - 1 处
- `createGitOrganization()` - 1 处
- `addMemberToGitOrganization()` - 1 处
- `removeMemberFromGitOrganization()` - 1 处
- `updateMemberRoleInGitOrganization()` - 1 处
- 更新操作 - 3 处

```typescript
// ❌ 之前
const orgResult = await this.db.query.organizations.findFirst({
  where: eq(schema.organizations.id, organizationId),
})

// ✅ 之后
const organization = await this.organizationsService.getOrganization(organizationId)
```

#### 1.3 替换组织成员查询（9 处）

**位置**:
- `syncTeamWorkspace()` - 1 处（获取所有成员）
- `removeOrganizationMember()` - 1 处（获取 owner）
- `getOrganizationSyncStatus()` - 1 处（获取成员数量）
- `addMemberToGitOrganization()` - 1 处（获取 owner）
- `removeMemberFromGitOrganization()` - 1 处（获取 owner）
- `updateMemberRoleInGitOrganization()` - 1 处（获取 owner）
- 其他 - 3 处

```typescript
// ❌ 之前
const membersResult = await this.db.query.organizationMembers.findMany({
  where: eq(schema.organizationMembers.organizationId, organization.id),
  with: {
    user: {
      with: {
        gitConnections: true,
      },
    },
  },
})

// ✅ 之后
const members = await this.organizationsService.getOrganizationMembers(organizationId)
// 注意: 需要确保 OrganizationsService.getOrganizationMembers() 返回包含 user 和 gitConnections 的数据
```

#### 1.4 替换用户查询（2 处）

**位置**:
- `removeOrganizationMember()` - 1 处
- 其他 - 1 处

```typescript
// ❌ 之前
const user = await this.db.query.users.findFirst({
  where: eq(schema.users.id, userId),
  with: {
    gitConnections: true,
  },
})

// ✅ 之后
const user = await this.usersService.getUser(userId)
const gitConnections = await this.gitConnectionsService.getUserConnections(userId)
```

#### 1.5 替换 Git 连接查询（8 处）

**位置**:
- `syncTeamWorkspace()` - 2 处（owner 和 member）
- `removeOrganizationMember()` - 2 处（user 和 owner）
- `addMemberToGitOrganization()` - 2 处（user 和 owner）
- `removeMemberFromGitOrganization()` - 2 处（user 和 owner）
- `updateMemberRoleInGitOrganization()` - 2 处（user 和 owner）

```typescript
// ❌ 之前
const [gitConnection] = await this.db
  .select()
  .from(schema.gitConnections)
  .where(
    and(
      eq(schema.gitConnections.userId, userId),
      eq(schema.gitConnections.provider, org.gitProvider),
    ),
  )
  .limit(1)

// ✅ 之后
const gitConnections = await this.gitConnectionsService.getUserConnections(userId)
const gitConnection = gitConnections.find(conn => conn.provider === org.gitProvider)
```

#### 1.6 更新 git-sync.module.ts

```typescript
// ✅ 添加 Foundation 层服务导入
import { OrganizationsModule } from '@juanie/service-foundation'
import { UsersModule } from '@juanie/service-foundation'
import { GitConnectionsModule } from '@juanie/service-foundation'

@Module({
  imports: [
    DatabaseModule,
    QueueModule,
    ConfigModule,
    GitProvidersModule,
    CredentialsModule,
    OrganizationsModule,  // ✅ 新增
    UsersModule,          // ✅ 新增
    GitConnectionsModule, // ✅ 新增
  ],
  // ...
})
```

---

### 阶段 2: project-collaboration-sync.service.ts 重构（P0）

**工作量**: 1-2 小时

#### 2.1 注入 Foundation 层服务

```typescript
// ❌ 之前
constructor(
  @Inject(DATABASE) private readonly db: PostgresJsDatabase<typeof schema>,
  private readonly gitProvider: GitProviderService,
  private readonly errorService: GitSyncErrorService,
  private readonly logger: PinoLogger,
) {}

// ✅ 之后
constructor(
  @Inject(DATABASE) private readonly db: PostgresJsDatabase<typeof schema>, // 保留用于 gitSyncLogs
  private readonly projectMembersService: ProjectMembersService,
  private readonly gitConnectionsService: GitConnectionsService,
  private readonly gitProvider: GitProviderService,
  private readonly errorService: GitSyncErrorService,
  private readonly logger: PinoLogger,
) {}
```

#### 2.2 替换项目成员查询（~10 处）

**位置**:
- `syncProjectCollaborators()` - 1 处（获取所有成员）
- `addCollaborator()` - 1 处（插入成员）
- `removeCollaborator()` - 2 处（查询 + 删除）
- `getProjectCollaborators()` - 1 处（获取所有成员）
- 更新同步状态 - 5 处

```typescript
// ❌ 之前: 查询
const members = await this.db.query.projectMembers.findMany({
  where: eq(schema.projectMembers.projectId, projectId),
  with: {
    user: {
      with: {
        gitConnections: true,
      },
    },
  },
})

// ✅ 之后: 使用 ProjectMembersService
const members = await this.projectMembersService.getProjectMembers(projectId)

// ❌ 之前: 插入
await this.db.insert(schema.projectMembers).values({
  projectId,
  userId,
  role,
})

// ✅ 之后: 使用 ProjectMembersService
await this.projectMembersService.addMember(projectId, userId, role)

// ❌ 之前: 删除
await this.db
  .delete(schema.projectMembers)
  .where(
    and(
      eq(schema.projectMembers.projectId, projectId),
      eq(schema.projectMembers.userId, userId),
    ),
  )

// ✅ 之后: 使用 ProjectMembersService
await this.projectMembersService.removeMember(projectId, userId)
```

#### 2.3 处理同步状态更新

**问题**: `projectMembers` 表有 `status` 字段用于 Git 同步状态，但 `ProjectMembersService` 可能没有更新状态的方法。

**解决方案 1**: 保留 DATABASE 注入，只用于更新同步状态

```typescript
// ✅ 保留 DATABASE 用于同步状态更新
await this.db
  .update(schema.projectMembers)
  .set({
    status: 'synced',
    gitSyncedAt: new Date(),
  })
  .where(
    and(
      eq(schema.projectMembers.projectId, projectId),
      eq(schema.projectMembers.userId, member.userId),
    ),
  )
```

**解决方案 2**: 在 ProjectMembersService 添加更新同步状态的方法

```typescript
// ✅ 在 ProjectMembersService 添加方法
async updateMemberSyncStatus(
  projectId: string,
  userId: string,
  status: 'pending' | 'synced' | 'failed',
  error?: string
): Promise<void>

// ✅ 使用
await this.projectMembersService.updateMemberSyncStatus(
  projectId,
  member.userId,
  'synced'
)
```

**推荐**: 使用解决方案 1（保留 DATABASE），因为同步状态是 Git 同步特有的，不应该暴露给 ProjectMembersService。

#### 2.4 更新 git-sync.module.ts

```typescript
// ✅ 添加 ProjectMembersModule 导入
import { ProjectMembersModule } from '../projects/members'

@Module({
  imports: [
    // ...
    ProjectMembersModule,  // ✅ 新增
  ],
  // ...
})
```

---

## 🔍 Foundation 层服务检查

### 需要确认的服务方法

#### OrganizationsService

```typescript
// ✅ 需要的方法
getOrganization(organizationId: string): Promise<Organization>
getOrganizationMembers(organizationId: string): Promise<OrganizationMember[]>
// 注意: 需要确保返回包含 user 和 gitConnections 的数据
```

#### UsersService

```typescript
// ✅ 需要的方法
getUser(userId: string): Promise<User>
```

#### GitConnectionsService

```typescript
// ✅ 需要的方法
getUserConnections(userId: string): Promise<GitConnection[]>
getUserConnection(userId: string, provider: string): Promise<GitConnection | null>
```

#### ProjectMembersService

```typescript
// ✅ 需要的方法
getProjectMembers(projectId: string): Promise<ProjectMember[]>
addMember(projectId: string, userId: string, role: ProjectRole): Promise<void>
removeMember(projectId: string, userId: string): Promise<void>
// 注意: 需要确保返回包含 user 和 gitConnections 的数据
```

### 如果方法不存在

**选项 1**: 在 Foundation 层服务添加方法（推荐）

```typescript
// ✅ 在 OrganizationsService 添加
async getOrganizationMembersWithGitConnections(organizationId: string) {
  return this.db.query.organizationMembers.findMany({
    where: eq(schema.organizationMembers.organizationId, organizationId),
    with: {
      user: {
        with: {
          gitConnections: true,
        },
      },
    },
  })
}
```

**选项 2**: 分别调用多个服务（不推荐，性能差）

```typescript
// ❌ 不推荐: 多次查询
const members = await this.organizationsService.getOrganizationMembers(organizationId)
for (const member of members) {
  member.user = await this.usersService.getUser(member.userId)
  member.user.gitConnections = await this.gitConnectionsService.getUserConnections(member.userId)
}
```

---

## 📊 预期成果

### 代码变化

| 指标 | 之前 | 之后 | 变化 |
|------|------|------|------|
| 架构违规 | ~40 处 | 0 处 | -100% |
| DATABASE 直接查询 | ~40 处 | ~5 处（仅同步状态） | -87.5% |
| Foundation 层服务使用 | 0 处 | ~35 处 | +∞ |

### 质量提升

| 指标 | 目标 | 说明 |
|------|------|------|
| 架构符合度 | 100% | 完全符合三层架构 |
| 代码复用 | ⭐⭐⭐⭐⭐ | 使用 Foundation 层服务 |
| 可测试性 | ⭐⭐⭐⭐⭐ | 易于 mock Foundation 层服务 |
| 可维护性 | ⭐⭐⭐⭐⭐ | 统一的数据访问方式 |

---

## 🚀 执行步骤

### 步骤 1: 准备工作（30 分钟）

1. **检查 Foundation 层服务**
   ```bash
   # 检查 OrganizationsService
   grep -n "getOrganization\|getOrganizationMembers" \
     packages/services/foundation/src/organizations/organizations.service.ts
   
   # 检查 UsersService
   grep -n "getUser" \
     packages/services/foundation/src/users/users.service.ts
   
   # 检查 GitConnectionsService
   grep -n "getUserConnections" \
     packages/services/foundation/src/git-connections/git-connections.service.ts
   
   # 检查 ProjectMembersService
   grep -n "getProjectMembers\|addMember\|removeMember" \
     packages/services/business/src/projects/members/project-members.service.ts
   ```

2. **如果方法不存在，先添加到 Foundation 层**
   - 在 OrganizationsService 添加 `getOrganizationMembersWithGitConnections()`
   - 在 ProjectMembersService 添加必要的方法

### 步骤 2: 重构 organization-sync.service.ts（2-3 小时）

1. **更新 imports**
   ```typescript
   import { OrganizationsService } from '@juanie/service-foundation'
   import { UsersService } from '@juanie/service-foundation'
   import { GitConnectionsService } from '@juanie/service-foundation'
   ```

2. **更新 constructor**
   - 注入 Foundation 层服务
   - 保留 DATABASE（用于 gitSyncLogs 和组织更新）

3. **替换查询（按顺序）**
   - 组织查询（11 处）
   - 组织成员查询（9 处）
   - 用户查询（2 处）
   - Git 连接查询（8 处）

4. **更新 git-sync.module.ts**
   - 添加 Foundation 层模块导入

5. **运行测试**
   ```bash
   bun biome check --write packages/services/business/src/gitops/git-sync/organization-sync.service.ts
   bun test packages/services/business/src/gitops/git-sync/
   ```

### 步骤 3: 重构 project-collaboration-sync.service.ts（1-2 小时）

1. **更新 imports**
   ```typescript
   import { ProjectMembersService } from '../../projects/members'
   import { GitConnectionsService } from '@juanie/service-foundation'
   ```

2. **更新 constructor**
   - 注入 ProjectMembersService 和 GitConnectionsService
   - 保留 DATABASE（用于同步状态更新）

3. **替换查询（按顺序）**
   - 项目成员查询（~10 处）
   - 保留同步状态更新（使用 DATABASE）

4. **更新 git-sync.module.ts**
   - 添加 ProjectMembersModule 导入

5. **运行测试**
   ```bash
   bun biome check --write packages/services/business/src/gitops/git-sync/project-collaboration-sync.service.ts
   bun test packages/services/business/src/gitops/git-sync/
   ```

### 步骤 4: 验证和文档（30 分钟）

1. **运行完整测试**
   ```bash
   bun test packages/services/business/src/gitops/
   ```

2. **检查编译错误**
   ```bash
   bun run build
   ```

3. **创建重构报告**
   - `GITOPS-MODULE-REFACTORING-COMPLETE.md`

---

## ⚠️ 注意事项

### 1. 保留 DATABASE 注入的场景

以下场景需要保留 DATABASE 注入：
- ✅ 查询/更新 `gitSyncLogs` 表（Business 层表）
- ✅ 更新 `organizations.gitLastSyncAt` 字段（特殊场景）
- ✅ 更新 `projectMembers.status` 字段（Git 同步状态）

### 2. 性能考虑

**问题**: 使用 Foundation 层服务可能导致多次查询

**解决方案**:
- 在 Foundation 层服务添加 `with` 选项，支持关联查询
- 例如: `getOrganizationMembers(organizationId, { includeUser: true, includeGitConnections: true })`

### 3. 错误处理

**问题**: Foundation 层服务可能抛出不同的错误

**解决方案**:
- 统一错误处理
- 使用 try-catch 捕获并转换为 Git 同步错误

### 4. 类型安全

**问题**: Foundation 层服务返回的类型可能不完全匹配

**解决方案**:
- 使用类型断言（谨慎）
- 或者在 Foundation 层服务添加新的返回类型

---

## 📝 检查清单

### 重构前

- [ ] 检查 Foundation 层服务是否有所需方法
- [ ] 如果没有，先在 Foundation 层添加方法
- [ ] 备份当前代码（Git commit）

### 重构中

- [ ] 更新 imports
- [ ] 更新 constructor
- [ ] 替换所有直接查询
- [ ] 保留必要的 DATABASE 使用
- [ ] 更新 module imports

### 重构后

- [ ] 运行 `bun biome check --write`
- [ ] 运行测试
- [ ] 检查编译错误
- [ ] 验证功能完整性
- [ ] 创建重构报告

---

## 🎉 总结

### 重构范围

- 2 个文件需要重构
- ~40 处架构违规需要修复
- 预计工作量: 3-5 小时

### 重构策略

1. ✅ 使用 Foundation 层服务替代直接查询
2. ✅ 保留 DATABASE 用于 Business 层表和特殊场景
3. ✅ 确保功能完整性
4. ✅ 提升代码质量

### 预期收益

- 架构清晰度 ⭐⭐⭐⭐⭐
- 代码质量 ⭐⭐⭐⭐⭐
- 可维护性 ⭐⭐⭐⭐⭐
- 可测试性 ⭐⭐⭐⭐⭐

---

**计划完成时间**: 2025-12-25  
**下一步**: 开始执行重构
