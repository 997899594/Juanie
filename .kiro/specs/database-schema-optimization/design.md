# 数据库架构优化设计文档

## 概述

本设计采用**先减法后加法**的策略：
1. **阶段 1**: 删除/合并不必要的表（33 → 25 表）
2. **阶段 2**: 添加必要的新表解决核心问题（25 → 28 表）

最终从 33 表优化到 28 表，减少 15% 复杂度，同时解决核心业务问题。

## 阶段 1: 架构简化（减法）

### 1.1 删除的表（6 个）

#### 1. experiments (实验功能表)
**删除理由**: 用途不明确，A/B 测试可以用专业服务
**替代方案**: LaunchDarkly / Optimizely / GrowthBook
**迁移**: 无需迁移，该表可能未使用

#### 2. identity_providers (身份提供商表)
**删除理由**: 1-2 个 IdP 用配置文件就够了
**替代方案**: 环境变量 + SAML 库
```typescript
// config/auth.ts
export const identityProviders = {
  google: {
    clientId: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
  },
  github: {
    clientId: process.env.GITHUB_CLIENT_ID,
    clientSecret: process.env.GITHUB_CLIENT_SECRET,
  },
};
```

#### 3. auth_sessions (认证会话表)
**删除理由**: 会话管理用 Redis 更高效
**替代方案**: Redis + JWT
```typescript
// 会话存储
await redis.setex(`session:${sessionId}`, 3600, JSON.stringify(sessionData));

// 会话验证
const session = await redis.get(`session:${sessionId}`);
```

#### 4. oauth_flows (OAuth 流程表)
**删除理由**: OAuth 流程是临时的，不需要持久化
**替代方案**: 内存缓存或 Redis
```typescript
// 临时存储 OAuth state
await redis.setex(`oauth:${state}`, 600, JSON.stringify({ provider, redirectUri }));
```

#### 5. code_analysis_results (代码分析结果表)
**删除理由**: 代码分析有专业工具
**替代方案**: SonarQube / CodeClimate / Snyk
**集成方式**: Webhook 接收分析结果，存储在 events 表

#### 6. performance_metrics (性能指标表)
**删除理由**: 时序数据应该用专业时序数据库
**替代方案**: Prometheus + Grafana / Datadog / New Relic
**集成方式**: 通过 API 查询，不存储在主数据库

### 1.2 合并的表（4 个 → 2 个）

#### 1. roles + role_assignments → user_roles

**当前问题**:
- `roles` 表过于抽象，实际角色是固定的
- `role_assignments` 表只是简单的关联

**合并方案**:
```typescript
export const userRoles = pgTable('user_roles', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  
  // 作用域
  scope: text('scope').notNull(), // 'organization', 'team', 'project'
  scopeId: uuid('scope_id').notNull(),
  
  // 角色（固定枚举）
  role: text('role').notNull(), // 'owner', 'admin', 'maintainer', 'developer', 'viewer'
  
  // 权限定义（JSONB）
  permissions: jsonb('permissions').$type<{
    canRead: boolean;
    canWrite: boolean;
    canDeploy: boolean;
    canAdmin: boolean;
    customPermissions?: string[];
  }>(),
  
  grantedBy: uuid('granted_by').references(() => users.id),
  expiresAt: timestamp('expires_at'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, (table) => [
  uniqueIndex().on(table.userId, table.scope, table.scopeId, table.role),
  index().on(table.userId),
  index().on(table.scope, table.scopeId),
]);
```

**迁移脚本**:
```sql
-- 迁移数据
INSERT INTO user_roles (user_id, scope, scope_id, role, permissions, granted_by, created_at)
SELECT 
  ra.user_id,
  ra.scope,
  ra.scope_id,
  r.slug as role,
  r.permissions,
  ra.granted_by,
  ra.created_at
FROM role_assignments ra
JOIN roles r ON ra.role_id = r.id;

-- 删除旧表
DROP TABLE role_assignments;
DROP TABLE roles;
```

#### 2. webhook_endpoints + webhook_events → webhooks

**当前问题**:
- 两个表关系简单，可以合并
- webhook_events 可以用消息队列

**合并方案**:
```typescript
export const webhooks = pgTable('webhooks', {
  id: uuid('id').primaryKey().defaultRandom(),
  organizationId: uuid('organization_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  projectId: uuid('project_id').references(() => projects.id, { onDelete: 'cascade' }),
  
  name: text('name').notNull(),
  url: text('url').notNull(),
  secret: text('secret').notNull(), // 用于签名验证
  
  // 订阅的事件类型
  events: text('events').array().notNull(), // ['deployment.success', 'deployment.failure', ...]
  
  // 配置
  isActive: boolean('is_active').notNull().default(true),
  retryCount: integer('retry_count').notNull().default(3),
  timeout: integer('timeout').notNull().default(30), // 秒
  
  // 统计
  lastTriggeredAt: timestamp('last_triggered_at'),
  successCount: integer('success_count').notNull().default(0),
  failureCount: integer('failure_count').notNull().default(0),
  
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (table) => [
  index().on(table.organizationId),
  index().on(table.projectId),
  index().on(table.isActive),
]);
```

**事件投递** (不存储，直接发送):
```typescript
async function triggerWebhooks(eventType: string, payload: any) {
  const webhooks = await db
    .select()
    .from(webhooks)
    .where(and(
      eq(webhooks.isActive, true),
      sql`${eventType} = ANY(events)`
    ));
  
  for (const webhook of webhooks) {
    // 异步发送，不等待结果
    sendWebhook(webhook, eventType, payload).catch(err => {
      logger.error('Webhook failed', { webhookId: webhook.id, error: err });
    });
  }
}
```

### 1.3 简化的表（2 个）

#### 1. intelligent_alerts → 合并到 incidents

**当前问题**: intelligent_alerts 和 incidents 功能重叠

**方案**: 删除 intelligent_alerts，在 incidents 表添加字段
```sql
ALTER TABLE incidents ADD COLUMN alert_source TEXT; -- 'manual', 'ai', 'monitoring'
ALTER TABLE incidents ADD COLUMN ai_confidence DECIMAL(3, 2); -- AI 检测的置信度
ALTER TABLE incidents ADD COLUMN ai_recommendation TEXT; -- AI 建议
```

#### 2. ai_recommendations → 合并到 ai_assistants

**当前问题**: ai_recommendations 可以作为 ai_assistants 的子记录

**方案**: 删除 ai_recommendations，用 JSONB 存储
```sql
ALTER TABLE ai_assistants ADD COLUMN recent_recommendations JSONB DEFAULT '[]'::jsonb;

-- 示例数据结构
{
  "recommendations": [
    {
      "id": "rec-1",
      "type": "cost_optimization",
      "title": "减少闲置资源",
      "description": "检测到 3 个环境在过去 7 天无部署",
      "impact": "high",
      "estimatedSavings": 500,
      "createdAt": "2024-01-15T10:00:00Z"
    }
  ]
}
```

### 1.4 阶段 1 总结

**删除**: 6 个表
**合并**: 4 个表 → 2 个表（净减少 2 个）
**简化**: 2 个表合并到现有表（净减少 2 个）

**总计**: 33 - 6 - 2 - 2 = **23 个表**

## 阶段 2: 核心功能增强（加法）

### 2.1 新增表（5 个）

#### 1. organization_members (组织成员表) - P0

**问题**: 当前没有组织成员表，无法管理用户-组织关系

**方案**:
```typescript
export const organizationMembers = pgTable('organization_members', {
  id: uuid('id').primaryKey().defaultRandom(),
  organizationId: uuid('organization_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  role: text('role').notNull().default('member'), // 'owner', 'admin', 'member', 'billing'
  status: text('status').notNull().default('active'), // 'active', 'pending', 'suspended'
  invitedBy: uuid('invited_by').references(() => users.id),
  joinedAt: timestamp('joined_at').notNull().defaultNow(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (table) => [
  uniqueIndex().on(table.organizationId, table.userId),
  index().on(table.userId),
  index().on(table.status),
]);
```

#### 2. environment_permissions (环境权限表) - P0

**问题**: environments 表用逗号分隔的文本存储权限，无法查询和维护

**方案**:
```typescript
export const environmentPermissions = pgTable('environment_permissions', {
  id: uuid('id').primaryKey().defaultRandom(),
  environmentId: uuid('environment_id').notNull().references(() => environments.id, { onDelete: 'cascade' }),
  subjectType: text('subject_type').notNull(), // 'user', 'team', 'role'
  subjectId: uuid('subject_id').notNull(),
  permission: text('permission').notNull(), // 'read', 'deploy', 'configure', 'admin'
  grantedBy: uuid('granted_by').references(() => users.id),
  expiresAt: timestamp('expires_at'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, (table) => [
  uniqueIndex().on(table.environmentId, table.subjectType, table.subjectId, table.permission),
  index().on(table.environmentId),
  index().on(table.subjectType, table.subjectId),
]);
```

**迁移**:
```sql
-- 从 environments.allowed_user_ids 迁移
INSERT INTO environment_permissions (environment_id, subject_type, subject_id, permission)
SELECT 
  id,
  'user',
  unnest(string_to_array(allowed_user_ids, ',')),
  'deploy'
FROM environments
WHERE allowed_user_ids IS NOT NULL AND allowed_user_ids != '';

-- 删除旧字段
ALTER TABLE environments DROP COLUMN allowed_user_ids;
ALTER TABLE environments DROP COLUMN allowed_team_ids;
```

#### 3. deployment_approvals (部署审批表) - P0

**问题**: deployments 表只有一个 approvedBy 字段，无法支持多级审批

**方案**:
```typescript
export const deploymentApprovals = pgTable('deployment_approvals', {
  id: uuid('id').primaryKey().defaultRandom(),
  deploymentId: uuid('deployment_id').notNull().references(() => deployments.id, { onDelete: 'cascade' }),
  approverId: uuid('approver_id').notNull().references(() => users.id),
  status: text('status').notNull().default('pending'), // 'pending', 'approved', 'rejected', 'cancelled'
  decision: text('decision'), // 'approve', 'reject', 'request_changes'
  comments: text('comments').notNull(),
  decidedAt: timestamp('decided_at'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, (table) => [
  index().on(table.deploymentId),
  index().on(table.approverId),
  index().on(table.status),
]);
```

**审批配置** (存储在 environments 表):
```sql
ALTER TABLE environments ADD COLUMN approval_config JSONB DEFAULT '{
  "required": false,
  "minApprovals": 1,
  "approverRoles": ["maintainer", "owner"],
  "autoApproveOnSuccess": false
}'::jsonb;
```

#### 4. team_projects (团队-项目关联表) - P1

**问题**: 团队和项目的关系不明确，权限继承复杂

**方案**:
```typescript
export const teamProjects = pgTable('team_projects', {
  id: uuid('id').primaryKey().defaultRandom(),
  teamId: uuid('team_id').notNull().references(() => teams.id, { onDelete: 'cascade' }),
  projectId: uuid('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),
  role: text('role').notNull().default('contributor'), // 'owner', 'maintainer', 'contributor'
  autoInherit: boolean('auto_inherit').notNull().default(true),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (table) => [
  uniqueIndex().on(table.teamId, table.projectId),
  index().on(table.teamId),
  index().on(table.projectId),
]);
```

#### 5. notifications (通知表) - P1

**问题**: 缺少统一的通知管理

**方案**:
```typescript
export const notifications = pgTable('notifications', {
  id: uuid('id').primaryKey().defaultRandom(),
  type: text('type').notNull(), // 'deployment_success', 'cost_alert', 'approval_request'
  recipientId: uuid('recipient_id').notNull().references(() => users.id),
  title: text('title').notNull(),
  content: text('content').notNull(),
  metadata: jsonb('metadata'),
  resourceType: text('resource_type'),
  resourceId: uuid('resource_id'),
  channels: text('channels').array().notNull(), // ['email', 'slack', 'in_app']
  status: text('status').notNull().default('pending'), // 'pending', 'sent', 'failed', 'read'
  sentAt: timestamp('sent_at'),
  readAt: timestamp('read_at'),
  priority: text('priority').notNull().default('normal'), // 'low', 'normal', 'high', 'urgent'
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, (table) => [
  index().on(table.recipientId),
  index().on(table.status),
  index().on(table.type),
]);
```

### 2.2 表结构修改

#### 1. 移除冗余字段

```sql
-- organizations 表
ALTER TABLE organizations DROP COLUMN current_projects;
ALTER TABLE organizations DROP COLUMN current_users;
ALTER TABLE organizations DROP COLUMN current_storage_gb;
ALTER TABLE organizations DROP COLUMN current_monthly_runs;

-- projects 表
ALTER TABLE projects DROP COLUMN current_compute_units;
ALTER TABLE projects DROP COLUMN current_storage_gb;
ALTER TABLE projects DROP COLUMN current_monthly_cost;
```

#### 2. 添加软删除

```sql
ALTER TABLE organizations ADD COLUMN deleted_at TIMESTAMP;
ALTER TABLE organizations ADD COLUMN deleted_by UUID REFERENCES users(id);

ALTER TABLE projects ADD COLUMN deleted_at TIMESTAMP;
ALTER TABLE projects ADD COLUMN deleted_by UUID REFERENCES users(id);

ALTER TABLE teams ADD COLUMN deleted_at TIMESTAMP;
ALTER TABLE teams ADD COLUMN deleted_by UUID REFERENCES users(id);

ALTER TABLE environments ADD COLUMN deleted_at TIMESTAMP;
ALTER TABLE environments ADD COLUMN deleted_by UUID REFERENCES users(id);

-- 创建索引
CREATE INDEX organizations_deleted_at_idx ON organizations(deleted_at);
CREATE INDEX projects_deleted_at_idx ON projects(deleted_at);
CREATE INDEX teams_deleted_at_idx ON teams(deleted_at);
CREATE INDEX environments_deleted_at_idx ON environments(deleted_at);
```

#### 3. 数组类型转换

```sql
-- repositories.protected_branch_names
ALTER TABLE repositories ADD COLUMN protected_branch_names_new text[];
UPDATE repositories SET protected_branch_names_new = string_to_array(protected_branch_names, ',') 
WHERE protected_branch_names IS NOT NULL AND protected_branch_names != '';
ALTER TABLE repositories DROP COLUMN protected_branch_names;
ALTER TABLE repositories RENAME COLUMN protected_branch_names_new TO protected_branch_names;
CREATE INDEX repositories_protected_branches_gin ON repositories USING GIN (protected_branch_names);

-- projects.secondary_tags
ALTER TABLE projects ADD COLUMN secondary_tags_new text[];
UPDATE projects SET secondary_tags_new = string_to_array(secondary_tags, ',')
WHERE secondary_tags IS NOT NULL AND secondary_tags != '';
ALTER TABLE projects DROP COLUMN secondary_tags;
ALTER TABLE projects RENAME COLUMN secondary_tags_new TO secondary_tags;
CREATE INDEX projects_secondary_tags_gin ON projects USING GIN (secondary_tags);

-- deployments.risk_factors
ALTER TABLE deployments ADD COLUMN risk_factors_new text[];
UPDATE deployments SET risk_factors_new = string_to_array(risk_factors, ',')
WHERE risk_factors IS NOT NULL AND risk_factors != '';
ALTER TABLE deployments DROP COLUMN risk_factors;
ALTER TABLE deployments RENAME COLUMN risk_factors_new TO risk_factors;

-- environments.allowed_ips
ALTER TABLE environments ADD COLUMN allowed_ips_new text[];
UPDATE environments SET allowed_ips_new = string_to_array(allowed_ips, ',')
WHERE allowed_ips IS NOT NULL AND allowed_ips != '';
ALTER TABLE environments DROP COLUMN allowed_ips;
ALTER TABLE environments RENAME COLUMN allowed_ips_new TO allowed_ips;
CREATE INDEX environments_allowed_ips_gin ON environments USING GIN (allowed_ips);

-- environments.compliance_frameworks
ALTER TABLE environments ADD COLUMN compliance_frameworks_new text[];
UPDATE environments SET compliance_frameworks_new = string_to_array(compliance_frameworks, ',')
WHERE compliance_frameworks IS NOT NULL AND compliance_frameworks != '';
ALTER TABLE environments DROP COLUMN compliance_frameworks;
ALTER TABLE environments RENAME COLUMN compliance_frameworks_new TO compliance_frameworks;
```

#### 4. 添加唯一约束

```sql
ALTER TABLE teams ADD CONSTRAINT teams_org_slug_unique UNIQUE (organization_id, slug);
```

#### 5. 扩展 audit_logs 表

```sql
ALTER TABLE audit_logs ADD COLUMN violation_severity TEXT;
ALTER TABLE audit_logs ADD COLUMN remediation_status TEXT DEFAULT 'open';
ALTER TABLE audit_logs ADD COLUMN resolved_by UUID REFERENCES users(id);
ALTER TABLE audit_logs ADD COLUMN resolved_at TIMESTAMP;

CREATE INDEX audit_logs_violation_idx ON audit_logs(violation_severity) 
WHERE violation_severity IS NOT NULL;
```

### 2.3 创建视图

#### 1. organization_quotas_view

```sql
CREATE VIEW organization_quotas_view AS
SELECT 
  o.id,
  o.name,
  o.max_projects,
  o.max_users,
  o.max_storage_gb,
  o.max_monthly_runs,
  COUNT(DISTINCT p.id) FILTER (WHERE p.deleted_at IS NULL) as current_projects,
  COUNT(DISTINCT om.user_id) FILTER (WHERE om.status = 'active') as current_users,
  COALESCE(SUM(CASE 
    WHEN e.storage_gb IS NOT NULL THEN e.storage_gb 
    ELSE 0 
  END), 0) as current_storage_gb,
  COALESCE((
    SELECT COUNT(*) 
    FROM pipeline_runs pr
    JOIN projects p2 ON pr.project_id = p2.id
    WHERE p2.organization_id = o.id
    AND pr.created_at >= date_trunc('month', CURRENT_DATE)
  ), 0) as current_monthly_runs
FROM organizations o
LEFT JOIN projects p ON o.id = p.organization_id
LEFT JOIN organization_members om ON o.id = om.organization_id
LEFT JOIN environments e ON p.id = e.project_id
WHERE o.deleted_at IS NULL
GROUP BY o.id;
```

#### 2. project_quotas_view

```sql
CREATE VIEW project_quotas_view AS
SELECT 
  p.id,
  p.name,
  p.max_compute_units,
  p.max_storage_gb,
  p.max_monthly_cost,
  COALESCE(SUM(e.storage_gb), 0) as current_storage_gb,
  COALESCE((
    SELECT SUM(total_cost)
    FROM cost_tracking ct
    WHERE ct.project_id = p.id
    AND ct.period >= to_char(date_trunc('month', CURRENT_DATE), 'YYYY-MM-DD')
  ), 0) as current_monthly_cost
FROM projects p
LEFT JOIN environments e ON p.id = e.project_id
WHERE p.deleted_at IS NULL
GROUP BY p.id;
```

## 最终架构

### 表数量对比

| 阶段 | 表数量 | 变化 |
|------|--------|------|
| 当前 | 33 | - |
| 阶段 1 (减法) | 23 | -10 |
| 阶段 2 (加法) | 28 | +5 |
| **最终** | **28** | **-5 (-15%)** |

### 表分类

**用户与权限 (6 表)**
- users
- organizations
- organization_members ✨ 新增
- teams
- team_members
- user_roles ✨ 合并

**项目与资源 (7 表)**
- projects
- project_memberships
- team_projects ✨ 新增
- environments
- environment_permissions ✨ 新增
- repositories
- monitoring_configs

**CI/CD (4 表)**
- pipelines
- pipeline_runs
- deployments
- deployment_approvals ✨ 新增

**安全与合规 (2 表)**
- security_policies
- vulnerability_scans

**成本与监控 (2 表)**
- cost_tracking
- incidents

**AI 功能 (2 表)**
- ai_assistants
- ~~ai_recommendations~~ (已合并)

**审计与事件 (2 表)**
- audit_logs (扩展)
- events

**集成 (2 表)**
- webhooks ✨ 合并
- oauth_accounts

**通知 (1 表)**
- notifications ✨ 新增

## 迁移计划

### 阶段 1: 准备（1 周）
1. 备份数据库
2. 编写迁移脚本
3. 在测试环境验证

### 阶段 2: 执行减法（2 小时停机）
1. 迁移数据到合并后的表
2. 删除废弃的表
3. 验证数据完整性

### 阶段 3: 执行加法（1 小时停机）
1. 创建新表
2. 迁移数据（environment_permissions）
3. 创建视图和索引

### 阶段 4: 验证（1 周）
1. 功能测试
2. 性能测试
3. 监控运行状况

### 阶段 5: 清理（1 周后）
1. 确认稳定
2. 删除备份
3. 优化查询

## 总结

**优化成果**:
- 表数量: 33 → 28 (-15%)
- 删除 6 个不必要的表
- 合并 4 个表为 2 个
- 新增 5 个核心表
- 解决所有核心业务问题

**核心改进**:
✅ 简化架构，降低复杂度
✅ 解决权限模型混乱
✅ 支持多级审批工作流
✅ 消除数据冗余
✅ 统一软删除策略
✅ 修正数据类型

**未来扩展**:
- 业务规模扩大后可考虑添加 pipeline_stages
- 用户量大了可考虑添加 ai_conversations
- 需要复杂告警时可考虑添加 cost_alerts
