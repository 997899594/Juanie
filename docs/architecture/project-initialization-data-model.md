# 项目初始化数据模型设计

## 表结构设计

### 1. `projects` 表（聚合根）

**职责：** 存储项目级别的聚合信息

**初始化相关字段：**
```typescript
{
  status: 'initializing' | 'active' | 'failed' | 'inactive' | 'archived',
  initializationJobId: string,           // BullMQ Job ID
  initializationStartedAt: Date,         // 开始时间
  initializationCompletedAt: Date,       // 完成时间
  initializationError: string,           // 总体错误信息
}
```

**用途：**
- ✅ 快速查询项目状态（列表页、详情页）
- ✅ 不需要 JOIN 就能获取基本信息
- ✅ 即使 steps 表被清理，仍保留完整信息
- ✅ 支持通过 `initializationJobId` 查询 BullMQ 实时进度

---

### 2. `project_initialization_steps` 表（详细记录）

**职责：** 存储每个步骤的详细信息

**字段：**
```typescript
{
  projectId: string,
  step: string,                          // 步骤标识符
  parentStep: string | null,             // 父步骤（支持子步骤）
  displayName: string,                   // 显示名称
  sequence: number,                      // 执行顺序
  status: 'pending' | 'running' | 'completed' | 'failed' | 'skipped',
  progress: number,                      // 0-100
  startedAt: Date,
  completedAt: Date,
  duration: number,                      // 毫秒
  error: string,                         // 步骤错误信息
  errorStack: string,                    // 错误堆栈
  metadata: {                            // JSONB
    filesCount?: number,
    repositoryUrl?: string,
    templateName?: string,
    [key: string]: any
  }
}
```

**用途：**
- ✅ 页面刷新后恢复详细进度
- ✅ 审计追踪（谁在什么时候做了什么）
- ✅ 性能分析（哪个步骤最慢）
- ✅ 调试支持（查看具体哪个步骤失败）
- ✅ 支持子步骤（如 push_template -> render_template）

---

## 字段冗余分析

### 是否冗余？

| 字段 | projects 表 | steps 表 | 是否冗余？ | 保留原因 |
|------|------------|---------|-----------|---------|
| **开始时间** | `initializationStartedAt` | `MIN(startedAt)` | ✅ 冗余 | ❌ 不删除：查询性能 + 数据完整性 |
| **完成时间** | `initializationCompletedAt` | `MAX(completedAt)` | ✅ 冗余 | ❌ 不删除：查询性能 + 数据完整性 |
| **错误信息** | `initializationError` | `steps.error WHERE status='failed'` | ⚠️ 部分冗余 | ❌ 不删除：语义不同（总体 vs 步骤） |
| **状态** | `status` | 聚合 `steps.status` | ⚠️ 部分冗余 | ❌ 不删除：聚合根状态 vs 步骤状态 |

**结论：** 虽然存在一定冗余，但都有合理的保留理由（性能、完整性、语义）

---

## 查询模式

### 场景 1：项目列表页
```sql
-- ✅ 只查 projects 表，无需 JOIN
SELECT id, name, status, initializationError
FROM projects
WHERE organization_id = ?
```

### 场景 2：初始化进度页（刷新恢复）
```sql
-- ✅ JOIN 获取详细步骤
SELECT 
  p.status,
  p.initialization_started_at,
  s.step,
  s.status,
  s.progress,
  s.duration,
  s.error
FROM projects p
LEFT JOIN project_initialization_steps s ON s.project_id = p.id
WHERE p.id = ?
ORDER BY s.sequence
```

### 场景 3：性能分析
```sql
-- ✅ 分析哪个步骤最慢
SELECT 
  step,
  AVG(duration) as avg_duration,
  MAX(duration) as max_duration,
  COUNT(*) as total_count,
  COUNT(CASE WHEN status = 'failed' THEN 1 END) as failed_count
FROM project_initialization_steps
WHERE created_at > NOW() - INTERVAL '7 days'
GROUP BY step
ORDER BY avg_duration DESC
```

### 场景 4：审计追踪
```sql
-- ✅ 查看某个项目的完整初始化历史
SELECT 
  step,
  status,
  started_at,
  completed_at,
  duration,
  error,
  metadata
FROM project_initialization_steps
WHERE project_id = ?
ORDER BY sequence
```

---

## 数据生命周期

### 写入策略
1. **项目创建时：** 写入 `projects` 表（`status = 'initializing'`）
2. **初始化开始时：** 
   - 更新 `projects.initializationStartedAt`
   - 批量插入 `project_initialization_steps`（所有步骤，`status = 'pending'`）
3. **步骤执行时：** 更新对应 `step` 的状态、进度、时间
4. **初始化完成/失败时：** 更新 `projects.status` 和 `initializationCompletedAt`

### 清理策略
- `projects` 表：永久保留（聚合信息）
- `project_initialization_steps` 表：
  - 保留最近 30 天的记录（用于审计）
  - 30 天后可以归档或删除（可选）

---

## 对比其他方案

### 方案 6（JSONB Summary）
```typescript
// projects 表
{
  initializationSummary: {
    steps: [
      { step: 'resolve_credentials', status: 'completed', duration: 120 },
      { step: 'create_repository', status: 'completed', duration: 1200 },
      // ...
    ],
    totalDuration: 4920,
    failedStep: 'setup_gitops'
  }
}
```

**对比：**
| 维度 | 方案 1（Steps 表） | 方案 6（JSONB） |
|------|-------------------|----------------|
| 查询性能 | ⚠️ 需要 JOIN | ✅ 单表查询 |
| 数据完整性 | ✅ 完整历史 | ❌ 只有摘要 |
| 刷新恢复 | ✅ 完整恢复 | ❌ 只能看最终结果 |
| 审计能力 | ✅ 详细追踪 | ❌ 无中间状态 |
| 性能分析 | ✅ SQL 聚合 | ❌ 需要应用层处理 |
| 写入次数 | ❌ N 次 | ✅ 1 次 |
| 架构复杂度 | ❌ 需要维护额外表 | ✅ 简单 |

**结论：** 方案 1 更适合需要完整审计和最佳用户体验的场景

---

## 总结

### 设计原则
1. ✅ **关注点分离：** `projects` 存聚合，`steps` 存详情
2. ✅ **查询优化：** 常用字段冗余到 `projects` 表
3. ✅ **数据完整性：** 即使 `steps` 被清理，`projects` 仍有完整信息
4. ✅ **审计追踪：** `steps` 表记录完整历史
5. ✅ **用户体验：** 支持页面刷新恢复详细进度

### 适用场景
- ✅ 需要完整审计追踪
- ✅ 需要性能分析
- ✅ 需要最佳用户体验（刷新恢复）
- ✅ 可以接受额外的数据库写入
- ✅ 可以接受稍微复杂的架构
