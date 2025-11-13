# 数据库 Schema 冲突分析

## 发现的冲突和重复

### 1. deployment_approvals 表

**现有设计：**
```typescript
export const deploymentApprovals = pgTable('deployment_approvals', {
  id: uuid('id').primaryKey().defaultRandom(),
  deploymentId: uuid('deployment_id').notNull().references(() => deployments.id),
  approverId: uuid('approver_id').notNull().references(() => users.id),
  status: text('status').notNull().default('pending'), // 'pending', 'approved', 'rejected'
  comments: text('comments'),
  decidedAt: timestamp('decided_at'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
})
```

**问题：**
- 现有设计是**一对一**关系：一个 deployment 对应多条 approval 记录（每个审批人一条）
- 我的设计是**一对多**关系：一个 deployment 对应一个 approval 请求，包含多个审批人

**解决方案：**
- **保留现有设计**，它更灵活且已经实现
- 需要调整 Approval Manager 的逻辑以适配现有表结构
- 删除我设计中的 `approval_approvers` 表（不需要）

**调整后的逻辑：**
```typescript
// 创建审批请求 = 为每个审批人创建一条记录
async createApprovalRequest(deploymentId: string, approvers: string[]) {
  for (const approverId of approvers) {
    await db.insert(deploymentApprovals).values({
      deploymentId,
      approverId,
      status: 'pending',
    })
  }
}

// 检查是否所有审批都完成
async checkApprovalStatus(deploymentId: string): Promise<'pending' | 'approved' | 'rejected'> {
  const approvals = await db.query.deploymentApprovals.findMany({
    where: eq(deploymentApprovals.deploymentId, deploymentId),
  })
  
  // 如果有任何一个拒绝，整体拒绝
  if (approvals.some(a => a.status === 'rejected')) {
    return 'rejected'
  }
  
  // 如果所有都批准，整体批准
  if (approvals.every(a => a.status === 'approved')) {
    return 'approved'
  }
  
  return 'pending'
}
```

### 2. projects 表的 status 字段

**现有值：**
```typescript
status: text('status').notNull().default('active'), // 'active', 'inactive', 'archived'
```

**我的设计值：**
```typescript
status: text('status').notNull().default('active'), // 'initializing', 'active', 'archived', 'failed'
```

**冲突：**
- 现有：`'active' | 'inactive' | 'archived'`
- 我的：`'initializing' | 'active' | 'archived' | 'failed'`

**解决方案：**
- **合并两者**：`'initializing' | 'active' | 'inactive' | 'archived' | 'failed'`
- `inactive` 可以用于手动暂停的项目
- `initializing` 用于初始化中的项目
- `failed` 用于初始化失败的项目

### 3. audit_logs 表

**现有设计：**
```typescript
export const auditLogs = pgTable('audit_logs', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').references(() => users.id),
  organizationId: uuid('organization_id').references(() => organizations.id),
  action: text('action').notNull(),
  resourceType: text('resource_type'),
  resourceId: uuid('resource_id'),
  metadata: jsonb('metadata').$type<Record<string, any>>(),
  ipAddress: text('ip_address'),
  userAgent: text('user_agent'),
  violationSeverity: text('violation_severity'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
})
```

**结论：**
- **完全可以使用现有表**，不需要创建新表
- 现有设计已经很完善，包含了我需要的所有字段

### 4. notifications 表

**现有设计：**
```typescript
export const notifications = pgTable('notifications', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id),
  type: text('type').notNull(),
  title: text('title').notNull(),
  content: text('content').notNull(),
  resourceType: text('resource_type'),
  resourceId: uuid('resource_id'),
  status: text('status').notNull().default('unread'),
  readAt: timestamp('read_at'),
  priority: text('priority').notNull().default('normal'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
})
```

**结论：**
- **完全可以使用现有表**
- 已经支持我需要的所有功能

## 需要新增的表

### 1. project_templates 表（新增）

**理由：** 现有系统没有项目模板功能

```typescript
export const projectTemplates = pgTable('project_templates', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  slug: text('slug').notNull().unique(),
  description: text('description'),
  category: text('category').notNull(), // 'web', 'api', 'microservice', etc.
  
  techStack: jsonb('tech_stack').$type<{
    language: string
    framework: string
    runtime: string
  }>(),
  
  defaultConfig: jsonb('default_config'),
  k8sTemplates: jsonb('k8s_templates'),
  cicdTemplates: jsonb('cicd_templates'),
  
  tags: jsonb('tags').$type<string[]>(),
  icon: text('icon'),
  isPublic: boolean('is_public').default(true),
  isSystem: boolean('is_system').default(false),
  
  organizationId: uuid('organization_id').references(() => organizations.id),
  createdBy: uuid('created_by').references(() => users.id),
  
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
})
```

### 2. project_events 表（新增）

**理由：** 用于事件溯源和调试

```typescript
export const projectEvents = pgTable('project_events', {
  id: uuid('id').primaryKey().defaultRandom(),
  projectId: uuid('project_id').notNull().references(() => projects.id),
  eventType: text('event_type').notNull(),
  eventData: jsonb('event_data'),
  triggeredBy: uuid('triggered_by').references(() => users.id),
  createdAt: timestamp('created_at').notNull().defaultNow(),
})
```

**注意：** 这个表与 audit_logs 的区别：
- `audit_logs`：用于安全审计，记录用户操作
- `project_events`：用于事件溯源，记录系统事件

## 需要更新的表

### 1. projects 表（更新）

**需要添加的字段：**

```typescript
export const projects = pgTable('projects', {
  // ... 现有字段 ...
  
  // 新增字段：
  status: text('status').notNull().default('active'), 
  // 更新值：'initializing' | 'active' | 'inactive' | 'archived' | 'failed'
  
  initializationStatus: jsonb('initialization_status').$type<{
    step: string
    progress: number
    error?: string
    completedSteps: string[]
  }>(),
  
  templateId: text('template_id'),
  templateConfig: jsonb('template_config'),
  
  healthScore: integer('health_score'),
  healthStatus: text('health_status'), // 'healthy', 'warning', 'critical'
  lastHealthCheck: timestamp('last_health_check'),
  
  config: jsonb('config').$type<{
    defaultBranch: string
    enableCiCd: boolean
    enableAi: boolean
    // 新增：
    quota?: {
      maxEnvironments: number
      maxRepositories: number
      maxPods: number
      maxCpu: string
      maxMemory: string
    }
  }>(),
})
```

## 最终的数据库变更清单

### 新增表（2 个）
1. ✅ `project_templates` - 项目模板
2. ✅ `project_events` - 项目事件

### 更新表（1 个）
1. ✅ `projects` - 添加初始化状态、模板信息、健康度字段

### 复用现有表（3 个）
1. ✅ `deployment_approvals` - 部署审批（调整使用逻辑）
2. ✅ `audit_logs` - 审计日志
3. ✅ `notifications` - 通知

### 删除的表（1 个）
1. ❌ `approval_approvers` - 不需要（使用现有的 deployment_approvals）

## 迁移脚本

```sql
-- Migration: 001_project_production_readiness.sql

-- 1. 更新 projects 表
ALTER TABLE projects 
  ADD COLUMN IF NOT EXISTS initialization_status JSONB,
  ADD COLUMN IF NOT EXISTS template_id TEXT,
  ADD COLUMN IF NOT EXISTS template_config JSONB,
  ADD COLUMN IF NOT EXISTS health_score INTEGER,
  ADD COLUMN IF NOT EXISTS health_status TEXT,
  ADD COLUMN IF NOT EXISTS last_health_check TIMESTAMP;

-- 更新 status 字段的注释（文档用途）
COMMENT ON COLUMN projects.status IS 'Project status: initializing, active, inactive, archived, failed';

-- 2. 创建 project_templates 表
CREATE TABLE IF NOT EXISTS project_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  description TEXT,
  category TEXT NOT NULL,
  tech_stack JSONB,
  default_config JSONB,
  k8s_templates JSONB,
  cicd_templates JSONB,
  tags JSONB,
  icon TEXT,
  is_public BOOLEAN DEFAULT true,
  is_system BOOLEAN DEFAULT false,
  organization_id UUID REFERENCES organizations(id),
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- 3. 创建 project_events 表
CREATE TABLE IF NOT EXISTS project_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  event_data JSONB,
  triggered_by UUID REFERENCES users(id),
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- 4. 创建索引
CREATE INDEX IF NOT EXISTS idx_projects_health_status ON projects(health_status);
CREATE INDEX IF NOT EXISTS idx_projects_template_id ON projects(template_id);
CREATE INDEX IF NOT EXISTS idx_project_templates_category ON project_templates(category);
CREATE INDEX IF NOT EXISTS idx_project_templates_slug ON project_templates(slug);
CREATE INDEX IF NOT EXISTS idx_project_events_project_id ON project_events(project_id);
CREATE INDEX IF NOT EXISTS idx_project_events_type ON project_events(event_type);
CREATE INDEX IF NOT EXISTS idx_project_events_created_at ON project_events(created_at);

-- 5. 插入系统模板（将在 seed 脚本中完成）
```

## 总结

**好消息：**
- 大部分基础设施已经存在（audit_logs、notifications、deployment_approvals）
- 只需要新增 2 个表，更新 1 个表
- 现有的表设计都很合理，可以直接复用

**需要调整的地方：**
- Approval Manager 的逻辑需要适配现有的 deployment_approvals 表结构
- projects.status 字段需要扩展支持的值
- 删除设计中的 approval_approvers 表

**影响：**
- 设计文档需要更新 Approval Manager 部分
- 数据库迁移脚本更简单了
- 实现工作量减少了（复用现有表）
