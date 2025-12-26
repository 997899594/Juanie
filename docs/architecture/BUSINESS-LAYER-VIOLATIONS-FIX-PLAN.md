# Business 层架构违规修复计划

> 创建时间: 2024-12-24  
> 状态: 🔴 **待修复**  
> 优先级: **P0（最高）**

## 🎯 目标

修复 Business 层 **18+ 处架构违规**，恢复正确的分层架构：

```
✅ 正确: Business → Foundation → Core (Database)
❌ 当前: Business → 直接操作 Database
```

## 📊 违规统计

| 服务 | 违规次数 | 主要问题 |
|------|---------|---------|
| ProjectsService | 6+ | 直接查询 organizations, organizationMembers, teams, teamMembers |
| DeploymentsService | 3 | 直接查询 organizationMembers |
| RepositoriesService | 5 | 直接查询 organizationMembers |
| PipelinesService | 2 | 直接查询 organizationMembers |
| EnvironmentsService | 1+ | 直接查询 organizationMembers |
| ProjectMembersService | 1 | 直接查询 teamMembers |

**总计**: **18+ 处违规**

## 🚀 修复策略

### 原则

1. **先完善 Foundation 层** - 提供 Business 层需要的所有方法
2. **再修改 Business 层** - 替换直接数据库查询为 Foundation 服务调用
3. **逐个服务修复** - 避免大规模改动导致系统不稳定
4. **测试驱动** - 每个修复都要有测试保证

### 执行顺序

```
Phase 1: Foundation 层增强（1-2 天）
  ↓
Phase 2: Business 层修复（2-3 天）
  ↓
Phase 3: 验证和清理（1 天）
```

---

## Phase 1: Foundation 层增强

### 1.1 OrganizationsService 增强

**文件**: `packages/services/foundation/src/organizations/organizations.service.ts`

**新增方法**:

```typescript
@Injectable()
export class OrganizationsService {
  // ✅ 检查组织是否存在
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
  
  // ✅ 获取组织（带权限检查）
  async getOrganization(
    organizationId: string,
    userId?: string
  ): Promise<Organization> {
    const org = await this.db.query.organizations.findFirst({
      where: and(
        eq(schema.organizations.id, organizationId),
        isNull(schema.organizations.deletedAt)
      ),
    })
    
    if (!org) {
      throw new OrganizationNotFoundError(organizationId)
    }
    
    // 如果提供了 userId，检查访问权限
    if (userId) {
      const member = await this.getMember(organizationId, userId)
      if (!member) {
        throw new ForbiddenError('无权访问该组织')
      }
    }
    
    return org
  }
  
  // ✅ 获取组织成员
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
  
  // ✅ 检查用户是否是组织成员
  async isMember(organizationId: string, userId: string): Promise<boolean> {
    const member = await this.getMember(organizationId, userId)
    return !!member
  }
  
  // ✅ 检查用户是否是组织管理员
  async isAdmin(organizationId: string, userId: string): Promise<boolean> {
    const member = await this.getMember(organizationId, userId)
    return member ? ['owner', 'admin'].includes(member.role) : false
  }
  
  // ✅ 获取组织的所有管理员
  async getAdmins(organizationId: string): Promise<OrganizationMember[]> {
    return this.db.query.organizationMembers.findMany({
      where: and(
        eq(schema.organizationMembers.organizationId, organizationId),
        sql`${schema.organizationMembers.role} IN ('owner', 'admin')`
      ),
      with: {
        user: true  // 包含用户信息
      }
    })
  }
  
  // ✅ 批量检查组织是否存在
  async existsMany(organizationIds: string[]): Promise<Map<string, boolean>> {
    const orgs = await this.db.query.organizations.findMany({
      where: and(
        inArray(schema.organizations.id, organizationIds),
        isNull(schema.organizations.deletedAt)
      ),
      columns: { id: true }
    })
    
    const result = new Map<string, boolean>()
    for (const id of organizationIds) {
      result.set(id, orgs.some(org => org.id === id))
    }
    return result
  }
}
```

**测试文件**: `packages/services/foundation/src/organizations/organizations.service.spec.ts`

```typescript
describe('OrganizationsService - New Methods', () => {
  describe('exists', () => {
    it('should return true if organization exists', async () => {
      const exists = await service.exists('org-1')
      expect(exists).toBe(true)
    })
    
    it('should return false if organization not found', async () => {
      const exists = await service.exists('invalid')
      expect(exists).toBe(false)
    })
    
    it('should return false if organization is deleted', async () => {
      const exists = await service.exists('deleted-org')
      expect(exists).toBe(false)
    })
  })
  
  describe('getMember', () => {
    it('should return member if exists', async () => {
      const member = await service.getMember('org-1', 'user-1')
      expect(member).toBeDefined()
      expect(member?.role).toBe('admin')
    })
    
    it('should return null if not a member', async () => {
      const member = await service.getMember('org-1', 'user-999')
      expect(member).toBeNull()
    })
  })
  
  describe('isAdmin', () => {
    it('should return true for owner', async () => {
      const isAdmin = await service.isAdmin('org-1', 'owner-user')
      expect(isAdmin).toBe(true)
    })
    
    it('should return true for admin', async () => {
      const isAdmin = await service.isAdmin('org-1', 'admin-user')
      expect(isAdmin).toBe(true)
    })
    
    it('should return false for member', async () => {
      const isAdmin = await service.isAdmin('org-1', 'member-user')
      expect(isAdmin).toBe(false)
    })
  })
  
  describe('getAdmins', () => {
    it('should return all admins', async () => {
      const admins = await service.getAdmins('org-1')
      expect(admins.length).toBeGreaterThan(0)
      expect(admins.every(a => ['owner', 'admin'].includes(a.role))).toBe(true)
    })
  })
})
```

### 1.2 TeamsService 增强

**文件**: `packages/services/foundation/src/teams/teams.service.ts`

**新增方法**:

```typescript
@Injectable()
export class TeamsService {
  // ✅ 检查团队是否存在
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
  
  // ✅ 获取团队详情
  async getTeam(teamId: string): Promise<Team> {
    const team = await this.db.query.teams.findFirst({
      where: and(
        eq(schema.teams.id, teamId),
        isNull(schema.teams.deletedAt)
      ),
    })
    
    if (!team) {
      throw new TeamNotFoundError(teamId)
    }
    
    return team
  }
  
  // ✅ 获取团队成员
  async getMember(teamId: string, userId: string): Promise<TeamMember | null> {
    return this.db.query.teamMembers.findFirst({
      where: and(
        eq(schema.teamMembers.teamId, teamId),
        eq(schema.teamMembers.userId, userId),
      ),
    })
  }
  
  // ✅ 检查用户是否是团队成员
  async isMember(teamId: string, userId: string): Promise<boolean> {
    const member = await this.getMember(teamId, userId)
    return !!member
  }
  
  // ✅ 检查用户是否通过团队访问项目
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
  
  // ✅ 获取用户在项目中的团队角色
  async getUserProjectTeamRole(
    userId: string,
    projectId: string
  ): Promise<string | null> {
    const result = await this.db
      .select({ role: schema.teamMembers.role })
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
      .limit(1)
    
    return result[0]?.role || null
  }
  
  // ✅ 验证团队属于组织
  async validateTeamBelongsToOrganization(
    teamId: string,
    organizationId: string
  ): Promise<boolean> {
    const team = await this.getTeam(teamId)
    return team.organizationId === organizationId
  }
}
```

**测试文件**: `packages/services/foundation/src/teams/teams.service.spec.ts`

```typescript
describe('TeamsService - New Methods', () => {
  describe('exists', () => {
    it('should return true if team exists', async () => {
      const exists = await service.exists('team-1')
      expect(exists).toBe(true)
    })
    
    it('should return false if team not found', async () => {
      const exists = await service.exists('invalid')
      expect(exists).toBe(false)
    })
  })
  
  describe('hasProjectAccess', () => {
    it('should return true if user has access through team', async () => {
      const hasAccess = await service.hasProjectAccess('user-1', 'project-1')
      expect(hasAccess).toBe(true)
    })
    
    it('should return false if user has no access', async () => {
      const hasAccess = await service.hasProjectAccess('user-999', 'project-1')
      expect(hasAccess).toBe(false)
    })
  })
  
  describe('validateTeamBelongsToOrganization', () => {
    it('should return true if team belongs to organization', async () => {
      const valid = await service.validateTeamBelongsToOrganization('team-1', 'org-1')
      expect(valid).toBe(true)
    })
    
    it('should return false if team does not belong to organization', async () => {
      const valid = await service.validateTeamBelongsToOrganization('team-1', 'org-2')
      expect(valid).toBe(false)
    })
  })
})
```

### 1.3 Foundation 层导出更新

**文件**: `packages/services/foundation/src/index.ts`

```typescript
// 确保新方法被导出
export { OrganizationsService } from './organizations/organizations.service'
export { TeamsService } from './teams/teams.service'
```

---

## Phase 2: Business 层修复

### 2.1 ProjectsService 修复

**文件**: `packages/services/business/src/projects/projects.service.ts`

**修改点 1: 构造函数注入**

```typescript
@Injectable()
export class ProjectsService {
  constructor(
    @Inject(DATABASE) private db: PostgresJsDatabase<typeof schema>,
    // ✅ 新增: 注入 Foundation 服务
    private readonly organizationsService: OrganizationsService,
    private readonly teamsService: TeamsService,
    // 保留原有依赖
    private orchestrator: ProjectOrchestrator,
    private auditLogs: AuditLogsService,
    private caslAbilityFactory: CaslAbilityFactory,
    private gitProviderService: GitProviderService,
    private readonly logger: Logger,
  ) {
    this.logger.setContext(ProjectsService.name)
  }
}
```

**修改点 2: create 方法**

```typescript
// ❌ 修复前
async create(userId: string, data: CreateProjectInput) {
  const [organization] = await this.db
    .select()
    .from(schema.organizations)
    .where(eq(schema.organizations.id, data.organizationId))
    .limit(1)
  
  if (!organization) {
    throw new OrganizationNotFoundError(data.organizationId)
  }
}

// ✅ 修复后
async create(userId: string, data: CreateProjectInput) {
  // 通过 Foundation 层验证组织
  await this.organizationsService.getOrganization(
    data.organizationId,
    userId  // 同时检查用户权限
  )
  
  // ... 其他逻辑
}
```

**修改点 3: assignTeam 方法**

```typescript
// ❌ 修复前
async assignTeam(userId: string, projectId: string, data: { teamId: string }) {
  const [team] = await this.db
    .select()
    .from(schema.teams)
    .where(and(
      eq(schema.teams.id, data.teamId),
      isNull(schema.teams.deletedAt)
    ))
    .limit(1)
  
  if (!team || team.organizationId !== project.organizationId) {
    throw new ValidationError('teamId', '团队不存在或不属于该组织')
  }
}

// ✅ 修复后
async assignTeam(userId: string, projectId: string, data: { teamId: string }) {
  // 通过 Foundation 层获取团队
  const team = await this.teamsService.getTeam(data.teamId)
  
  // 验证团队属于项目的组织
  const valid = await this.teamsService.validateTeamBelongsToOrganization(
    data.teamId,
    project.organizationId
  )
  
  if (!valid) {
    throw new ValidationError('teamId', '团队不属于该组织')
  }
  
  // ... 其他逻辑
}
```

**修改点 4: getOrgMember 私有方法**

```typescript
// ❌ 修复前
private async getOrgMember(organizationId: string, userId: string) {
  const member = await this.db.query.organizationMembers.findFirst({
    where: and(
      eq(schema.organizationMembers.organizationId, organizationId),
      eq(schema.organizationMembers.userId, userId),
    ),
  })
  return member || null
}

// ✅ 修复后
private async getOrgMember(organizationId: string, userId: string) {
  return this.organizationsService.getMember(organizationId, userId)
}
```

**修改点 5: checkAccess 私有方法**

```typescript
// ❌ 修复前
private async checkAccess(...) {
  const [teamAccess] = await this.db
    .select({ count: sql<number>`count(*)` })
    .from(schema.teamProjects)
    .innerJoin(schema.teamMembers, ...)
    .where(...)
  
  return (teamAccess?.count || 0) > 0
}

// ✅ 修复后
private async checkAccess(userId: string, projectId: string, ...) {
  // 通过 Foundation 层检查团队访问
  return this.teamsService.hasProjectAccess(userId, projectId)
}
```

### 2.2 DeploymentsService 修复

**文件**: `packages/services/business/src/deployments/deployments.service.ts`

**修改点 1: 构造函数**

```typescript
constructor(
  @Inject(DATABASE) private db: PostgresJsDatabase<typeof schema>,
  // ✅ 新增
  private readonly organizationsService: OrganizationsService,
  // 保留原有依赖
  private readonly logger: Logger,
) {}
```

**修改点 2: trigger 方法（3 处）**

```typescript
// ❌ 修复前
const admins = await this.db
  .select()
  .from(schema.organizationMembers)
  .where(
    and(
      eq(schema.organizationMembers.organizationId, project.organizationId),
      eq(schema.organizationMembers.role, 'admin'),
    ),
  )

// ✅ 修复后
const admins = await this.organizationsService.getAdmins(
  project.organizationId
)
```

### 2.3 RepositoriesService 修复

**文件**: `packages/services/business/src/repositories/repositories.service.ts`

**修改点 1: 构造函数**

```typescript
constructor(
  @Inject(DATABASE) private db: PostgresJsDatabase<typeof schema>,
  // ✅ 新增
  private readonly organizationsService: OrganizationsService,
  // 保留原有依赖
  private readonly logger: Logger,
) {}
```

**修改点 2: 所有权限检查（5 处）**

```typescript
// ❌ 修复前
const [orgMember] = await this.db
  .select()
  .from(schema.organizationMembers)
  .where(...)

if (!orgMember) {
  throw new ForbiddenError('无权访问该组织')
}

// ✅ 修复后
const isMember = await this.organizationsService.isMember(
  organizationId,
  userId
)

if (!isMember) {
  throw new ForbiddenError('无权访问该组织')
}
```

### 2.4 PipelinesService 修复

**文件**: `packages/services/business/src/pipelines/pipelines.service.ts`

**修改点**: 同 RepositoriesService（2 处）

### 2.5 EnvironmentsService 修复

**文件**: `packages/services/business/src/environments/environments.service.ts`

**修改点**: 同 RepositoriesService（1 处）

### 2.6 ProjectMembersService 修复

**文件**: `packages/services/business/src/projects/project-members.service.ts`

**修改点 1: 构造函数**

```typescript
constructor(
  @Inject(DATABASE) private db: PostgresJsDatabase<typeof schema>,
  // ✅ 新增
  private readonly teamsService: TeamsService,
  // 保留原有依赖
  private readonly logger: Logger,
) {}
```

**修改点 2: 团队成员查询**

```typescript
// ❌ 修复前
const teamMember = await this.db.query.teamMembers.findFirst({
  where: and(
    eq(schema.teamMembers.teamId, teamId),
    eq(schema.teamMembers.userId, userId),
  ),
})

// ✅ 修复后
const teamMember = await this.teamsService.getMember(teamId, userId)
```

---

## Phase 3: 验证和清理

### 3.1 运行测试

```bash
# 运行 Foundation 层测试
bun test packages/services/foundation

# 运行 Business 层测试
bun test packages/services/business

# 运行集成测试
bun test apps/api-gateway
```

### 3.2 代码检查

```bash
# 检查是否还有直接查询 Foundation 层表的代码
grep -r "schema.organizations" packages/services/business/src
grep -r "schema.organizationMembers" packages/services/business/src
grep -r "schema.teams" packages/services/business/src
grep -r "schema.teamMembers" packages/services/business/src

# 应该返回 0 结果
```

### 3.3 更新文档

- [ ] 更新 `docs/architecture/business-layer-architecture.md`
- [ ] 更新 `docs/architecture/foundation-layer-architecture-analysis.md`
- [ ] 标记 `docs/architecture/layered-architecture-violations.md` 为已修复

### 3.4 Code Review

- [ ] 检查所有修改的文件
- [ ] 确认没有引入新的违规
- [ ] 确认测试覆盖率

---

## 📋 执行清单

### Day 1: Foundation 层增强

- [ ] OrganizationsService 增加 7 个新方法
- [ ] OrganizationsService 添加单元测试
- [ ] TeamsService 增加 7 个新方法
- [ ] TeamsService 添加单元测试
- [ ] 运行 Foundation 层测试，确保通过

### Day 2: Business 层修复（第一批）

- [ ] ProjectsService 修复（6 处违规）
  - [ ] 修改构造函数
  - [ ] 修改 create 方法
  - [ ] 修改 assignTeam 方法
  - [ ] 修改 getOrgMember 方法
  - [ ] 修改 checkAccess 方法
  - [ ] 更新测试
- [ ] DeploymentsService 修复（3 处违规）
  - [ ] 修改构造函数
  - [ ] 修改 trigger 方法（3 处）
  - [ ] 更新测试

### Day 3: Business 层修复（第二批）

- [ ] RepositoriesService 修复（5 处违规）
- [ ] PipelinesService 修复（2 处违规）
- [ ] EnvironmentsService 修复（1 处违规）
- [ ] ProjectMembersService 修复（1 处违规）

### Day 4: 验证和清理

- [ ] 运行所有测试
- [ ] 代码检查（grep 搜索）
- [ ] 更新文档
- [ ] Code Review
- [ ] 合并到主分支

---

## 🎯 成功标准

### 1. 代码质量

- ✅ Business 层不再直接查询 Foundation 层的表
- ✅ 所有数据库查询通过 Foundation 服务
- ✅ 代码重复减少 200+ 行

### 2. 测试覆盖

- ✅ Foundation 层新方法测试覆盖率 > 90%
- ✅ Business 层修改后测试全部通过
- ✅ 集成测试全部通过

### 3. 架构合规

- ✅ 分层架构清晰：Business → Foundation → Core
- ✅ 依赖关系正确
- ✅ 职责分离明确

### 4. 性能

- ✅ 查询性能不下降
- ✅ 可以添加缓存优化（Foundation 层统一管理）

---

## 🚨 风险和注意事项

### 风险 1: 破坏现有功能

**缓解措施**:
- 逐个服务修复，不要一次性改动太多
- 每个修复都要有测试保证
- 修复后立即运行测试

### 风险 2: 性能下降

**缓解措施**:
- Foundation 层方法可以添加缓存
- 批量查询优化（如 `existsMany`）
- 监控查询性能

### 风险 3: 引入新的 Bug

**缓解措施**:
- 仔细 Code Review
- 完善的测试覆盖
- 灰度发布

---

## 📝 总结

### 当前状态

- 🔴 **18+ 处架构违规**
- 🔴 **分层架构被破坏**
- 🔴 **代码重复严重**

### 修复后状态

- ✅ **0 处架构违规**
- ✅ **分层架构清晰**
- ✅ **代码简洁可维护**

### 时间估算

- **Phase 1**: 1-2 天（Foundation 层增强）
- **Phase 2**: 2-3 天（Business 层修复）
- **Phase 3**: 1 天（验证和清理）
- **总计**: **4-6 天**

### 优先级

**P0（最高）** - 必须在其他 Business 层重构之前完成

---

**下一步**: 开始执行 Phase 1 - Foundation 层增强
