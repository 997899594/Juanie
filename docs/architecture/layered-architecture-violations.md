# 分层架构违规分析

> 生成时间: 2024-12-24
> 状态: 🔴 **严重违规**
> 结论: **分层架构被严重破坏**

## 🚨 核心问题

### 问题：Business 层绕过 Foundation 层直接操作数据库

**理想的分层架构**:
```
Business 层 → Foundation 层 → Core 层 (Database)
```

**实际情况**:
```
Business 层 → 直接操作 Database ❌
Foundation 层 → 被绕过 ❌
```

---

## 🔍 违规详情

### 违规 1: Business 层直接查询 Foundation 层的表

**违规代码位置**: 多个 Business 层服务

#### 1.1 ProjectsService 直接查询 organizations 表

```typescript
// ❌ 违规: packages/services/business/src/projects/projects.service.ts:64-68
async create(userId: string, data: CreateProjectInput) {
  // 直接查询 organizations 表
  const [organization] = await this.db
    .select()
    .from(schema.organizations)  // ❌ 应该通过 OrganizationsService
    .where(eq(schema.organizations.id, data.organizationId))
    .limit(1)
}
```

**应该这样做**:
```typescript
// ✅ 正确: 通过 Foundation 层
constructor(
  private organizationsService: OrganizationsService  // 注入 Foundation 服务
) {}

async create(userId: string, data: CreateProjectInput) {
  // 通过 OrganizationsService 检查
  const organization = await this.organizationsService.get(
    data.organizationId, 
    userId
  )
  
  if (!organization) {
    throw new OrganizationNotFoundError(data.organizationId)
  }
}
```

#### 1.2 ProjectsService 直接查询 organizationMembers 表

```typescript
// ❌ 违规: packages/services/business/src/projects/projects.service.ts:987-992
private async getOrgMember(organizationId: string, userId: string) {
  const member = await this.db.query.organizationMembers.findFirst({
    where: and(
      eq(schema.organizationMembers.organizationId, organizationId),  // ❌
      eq(schema.organizationMembers.userId, userId),  // ❌
    ),
  })
  return member || null
}
```

**应该这样做**:
```typescript
// ✅ 正确: 通过 Foundation 层
constructor(
  private organizationsService: OrganizationsService
) {}

private async getOrgMember(organizationId: string, userId: string) {
  return this.organizationsService.getMember(organizationId, userId)
}
```

#### 1.3 ProjectsService 直接查询 teams 和 teamMembers 表

```typescript
// ❌ 违规: packages/services/business/src/projects/projects.service.ts:789-793
async assignTeam(userId: string, projectId: string, data: { teamId: string }) {
  // 直接查询 teams 表
  const [team] = await this.db
    .select()
    .from(schema.teams)  // ❌ 应该通过 TeamsService
    .where(and(eq(schema.teams.id, data.teamId), isNull(schema.teams.deletedAt)))
    .limit(1)
}

// ❌ 违规: packages/services/business/src/projects/projects.service.ts:971-977
private async checkAccess(...) {
  // 直接查询 teamMembers 表
  const [teamAccess] = await this.db
    .select({ count: sql<number>`count(*)` })
    .from(schema.teamProjects)
    .innerJoin(schema.teamMembers, ...)  // ❌ 应该通过 TeamsService
    .where(...)
}
```

### 违规 2: DeploymentsService 直接查询 organizationMembers 表

```typescript
// ❌ 违规: packages/services/business/src/deployments/deployments.service.ts:434-442
async trigger(...) {
  // 直接查询 organizationMembers 表
  const admins = await this.db
    .select()
    .from(schema.organizationMembers)  // ❌
    .where(
      and(
        eq(schema.organizationMembers.organizationId, project.organizationId),
        eq(schema.organizationMembers.role, 'admin'),
      ),
    )
}
```

**重复出现**: 
- `deployments.service.ts:648-656`
- `deployments.service.ts:693-701`

### 违规 3: RepositoriesService 直接查询 organizationMembers 表

```typescript
// ❌ 违规: packages/services/business/src/repositories/repositories.service.ts:35-43
async create(...) {
  const [orgMember] = await this.db
    .select()
    .from(schema.organizationMembers)  // ❌
    .where(...)
}
```

**重复出现**:
- `repositories.service.ts:135-143`
- `repositories.service.ts:262-270`
- `repositories.service.ts:471-479`
- `repositories.service.ts:516-524`

### 违规 4: PipelinesService 直接查询 organizationMembers 表

```typescript
// ❌ 违规: packages/services/business/src/pipelines/pipelines.service.ts:286-294
async trigger(...) {
  const [orgMember] = await this.db
    .select()
    .from(schema.organizationMembers)  // ❌
    .where(...)
}
```

**重复出现**:
- `pipelines.service.ts:327-335`

### 违规 5: EnvironmentsService 直接查询 organizationMembers 表

```typescript
// ❌ 违规: packages/services/business/src/environments/environments.service.ts:184-185
const [orgMember] = await this.db
  .select()
  .from(schema.organizationMembers)  // ❌
```

---

## 📊 违规统计

| 服务 | 违规次数 | 违规表 |
|------|---------|--------|
| **ProjectsService** | 6+ | organizations, organizationMembers, teams, teamMembers |
| **DeploymentsService** | 3 | organizationMembers |
| **RepositoriesService** | 5 | organizationMembers |
| **PipelinesService** | 2 | organizationMembers |
| **EnvironmentsService** | 1+ | organizationMembers |
| **ProjectMembersService** | 1 | teamMembers |

**总计**: **18+ 处违规**

---

## 🎯 违规的严重性

### 为什么这是严重问题？

#### 1. 破坏了分层架构
```
❌ 当前:
Business 层 ──┐
              ├──> Database (直接访问)
Foundation 层 ┘

✅ 应该:
Business 层 ──> Foundation 层 ──> Database
```

#### 2. 代码重复

**同样的查询在多个地方重复**:
```typescript
// 在 6+ 个服务中重复
const [orgMember] = await this.db
  .select()
  .from(schema.organizationMembers)
  .where(
    and(
      eq(schema.organizationMembers.organizationId, organizationId),
      eq(schema.organizationMembers.userId, userId),
    ),
  )
```

**应该统一在 Foundation 层**:
```typescript
// OrganizationsService.getMember()
async getMember(organizationId: string, userId: string) {
  // 统一实现，所有服务复用
}
```

#### 3. 难以维护

**问题**:
- 修改 organizationMembers 表结构需要改 6+ 个文件
- 修改权限逻辑需要改 18+ 处代码
- 无法统一缓存策略
- 无法统一错误处理

#### 4. 违反单一职责原则

**Business 层的职责**:
- ✅ 项目管理逻辑
- ✅ 部署管理逻辑
- ❌ 组织成员查询（应该是 Foundation 层的职责）
- ❌ 团队成员查询（应该是 Foundation 层的职责）

#### 5. 测试困难

**当前**:
```typescript
// 测试 ProjectsService 需要 mock 数据库
// 需要准备 organizations, organizationMembers, teams, teamMembers 等表的数据
```

**应该**:
```typescript
// 测试 ProjectsService 只需要 mock OrganizationsService, TeamsService
// 更简单，更清晰
```

---

## 🔧 修复方案

### 方案 1: 完善 Foundation 层服务（推荐）

#### 1.1 OrganizationsService 增加方法

```typescript
// packages/services/foundation/src/organizations/organizations.service.ts

@Injectable()
export class OrganizationsService {
  // ✅ 新增: 检查组织是否存在
  async exists(organizationId: string): Promise<boolean> {
    const org = await this.db.query.organizations.findFirst({
      where: and(
        eq(schema.organizations.id, organizationId),
        isNull(schema.organizations.deletedAt)
      ),
      columns: { id: true }
    })
    return !!org
  }
  
  // ✅ 新增: 获取组织成员
  async getMember(
    organizationId: string, 
    userId: string
  ): Promise<OrganizationMember | null> {
    return this.db.query.organizationMembers.findFirst({
      where: and(
        eq(schema.organizationMembers.organizationId, organizationId),
        eq(schema.organizationMembers.userId, userId),
      ),
    })
  }
  
  // ✅ 新增: 检查用户是否是组织管理员
  async isAdmin(organizationId: string, userId: string): Promise<boolean> {
    const member = await this.getMember(organizationId, userId)
    return member ? ['owner', 'admin'].includes(member.role) : false
  }
  
  // ✅ 新增: 获取组织的所有管理员
  async getAdmins(organizationId: string): Promise<OrganizationMember[]> {
    return this.db.query.organizationMembers.findMany({
      where: and(
        eq(schema.organizationMembers.organizationId, organizationId),
        sql`${schema.organizationMembers.role} IN ('owner', 'admin')`
      ),
    })
  }
}
```

#### 1.2 TeamsService 增加方法

```typescript
// packages/services/foundation/src/teams/teams.service.ts

@Injectable()
export class TeamsService {
  // ✅ 新增: 检查团队是否存在
  async exists(teamId: string): Promise<boolean> {
    const team = await this.db.query.teams.findFirst({
      where: and(
        eq(schema.teams.id, teamId),
        isNull(schema.teams.deletedAt)
      ),
      columns: { id: true }
    })
    return !!team
  }
  
  // ✅ 新增: 获取团队详情
  async get(teamId: string): Promise<Team | null> {
    return this.db.query.teams.findFirst({
      where: and(
        eq(schema.teams.id, teamId),
        isNull(schema.teams.deletedAt)
      ),
    })
  }
  
  // ✅ 新增: 检查用户是否是团队成员
  async isMember(teamId: string, userId: string): Promise<boolean> {
    const member = await this.db.query.teamMembers.findFirst({
      where: and(
        eq(schema.teamMembers.teamId, teamId),
        eq(schema.teamMembers.userId, userId),
      ),
      columns: { id: true }
    })
    return !!member
  }
  
  // ✅ 新增: 检查用户是否通过团队访问项目
  async hasProjectAccess(
    userId: string, 
    projectId: string
  ): Promise<boolean> {
    const [result] = await this.db
      .select({ count: sql<number>`count(*)` })
      .from(schema.teamProjects)
      .innerJoin(
        schema.teamMembers, 
        eq(schema.teamProjects.teamId, schema.teamMembers.teamId)
      )
      .where(
        and(
          eq(schema.teamProjects.projectId, projectId),
          eq(schema.teamMembers.userId, userId),
        ),
      )
    
    return (result?.count || 0) > 0
  }
}
```

#### 1.3 修改 Business 层使用 Foundation 层

```typescript
// packages/services/business/src/projects/projects.service.ts

@Injectable()
export class ProjectsService {
  constructor(
    @Inject(DATABASE) private db: PostgresJsDatabase<typeof schema>,
    // ✅ 注入 Foundation 层服务
    private organizationsService: OrganizationsService,
    private teamsService: TeamsService,
    private orchestrator: ProjectOrchestrator,
    private auditLogs: AuditLogsService,
    private caslAbilityFactory: CaslAbilityFactory,
    private gitProviderService: GitProviderService,
    private readonly logger: Logger,
  ) {
    this.logger.setContext(ProjectsService.name)
  }

  async create(userId: string, data: CreateProjectInput) {
    // ✅ 通过 Foundation 层检查组织
    const orgExists = await this.organizationsService.exists(data.organizationId)
    if (!orgExists) {
      throw new OrganizationNotFoundError(data.organizationId)
    }
    
    // ... 其他逻辑
  }
  
  async assignTeam(userId: string, projectId: string, data: { teamId: string }) {
    // ✅ 通过 Foundation 层获取团队
    const team = await this.teamsService.get(data.teamId)
    if (!team || team.organizationId !== project.organizationId) {
      throw new ValidationError('teamId', '团队不存在或不属于该组织')
    }
    
    // ... 其他逻辑
  }
  
  private async getOrgMember(organizationId: string, userId: string) {
    // ✅ 通过 Foundation 层获取成员
    return this.organizationsService.getMember(organizationId, userId)
  }
  
  private async checkAccess(...) {
    // ✅ 通过 Foundation 层检查团队访问
    const hasTeamAccess = await this.teamsService.hasProjectAccess(
      userId, 
      projectId
    )
    
    return hasTeamAccess
  }
}
```

### 方案 2: 引入 Repository 层（不推荐）

**原因**: 增加了额外的抽象层，违反 KISS 原则

---

## 📋 修复清单

### Phase 1: 完善 Foundation 层（1-2 天）

- [ ] OrganizationsService 增加方法
  - [ ] `exists(organizationId)` - 检查组织是否存在
  - [ ] `getMember(organizationId, userId)` - 获取成员
  - [ ] `isAdmin(organizationId, userId)` - 检查是否管理员
  - [ ] `getAdmins(organizationId)` - 获取所有管理员

- [ ] TeamsService 增加方法
  - [ ] `exists(teamId)` - 检查团队是否存在
  - [ ] `get(teamId)` - 获取团队详情
  - [ ] `isMember(teamId, userId)` - 检查是否成员
  - [ ] `hasProjectAccess(userId, projectId)` - 检查项目访问权限

- [ ] 添加单元测试

### Phase 2: 修改 Business 层（2-3 天）

- [ ] ProjectsService
  - [ ] 注入 OrganizationsService, TeamsService
  - [ ] 替换所有直接数据库查询
  - [ ] 移除 `getOrgMember()` 私有方法
  - [ ] 更新测试

- [ ] DeploymentsService
  - [ ] 注入 OrganizationsService
  - [ ] 替换 3 处 organizationMembers 查询
  - [ ] 更新测试

- [ ] RepositoriesService
  - [ ] 注入 OrganizationsService
  - [ ] 替换 5 处 organizationMembers 查询
  - [ ] 更新测试

- [ ] PipelinesService
  - [ ] 注入 OrganizationsService
  - [ ] 替换 2 处 organizationMembers 查询
  - [ ] 更新测试

- [ ] EnvironmentsService
  - [ ] 注入 OrganizationsService
  - [ ] 替换 1 处 organizationMembers 查询
  - [ ] 更新测试

- [ ] ProjectMembersService
  - [ ] 注入 TeamsService
  - [ ] 替换 1 处 teamMembers 查询
  - [ ] 更新测试

### Phase 3: 验证和清理（1 天）

- [ ] 运行所有测试
- [ ] 检查是否还有遗漏的违规
- [ ] 更新文档
- [ ] Code Review

---

## 🎯 预期收益

### 1. 代码减少
- **重复代码**: 18+ 处 → 0 处
- **Business 层代码**: 减少约 200 行

### 2. 可维护性提升
- ✅ 修改组织逻辑只需要改 Foundation 层
- ✅ 统一的错误处理
- ✅ 统一的缓存策略
- ✅ 更容易添加新功能

### 3. 测试简化
- ✅ Business 层测试只需要 mock Foundation 服务
- ✅ 不需要准备复杂的数据库数据
- ✅ 测试更快，更可靠

### 4. 架构清晰
- ✅ 分层职责明确
- ✅ 依赖关系清晰
- ✅ 易于理解和扩展

---

## 📝 总结

### 当前状态: 🔴 严重违规

- **违规数量**: 18+ 处
- **影响范围**: 6 个 Business 层服务
- **严重程度**: 高（破坏分层架构）

### 修复优先级: P0（最高）

**原因**:
1. 破坏了分层架构的基本原则
2. 导致大量代码重复
3. 难以维护和扩展
4. 必须在重构 Business 层之前修复

### 修复策略

1. **先修复分层违规**（Phase 1-2）
2. **再重构 Business 层内部**（简化 Projects, GitOps）

**时间估算**: 4-6 天

---

**结论**: 你说得对！分层架构确实没有被好好遵守。Business 层绕过 Foundation 层直接操作数据库，这是一个严重的架构问题，必须优先修复。

