# 需求文档

## 简介

本文档概述了 AI DevOps 平台数据库架构优化的需求。当前架构包含 33 个表，存在多个业务逻辑问题、权限模型不一致以及架构问题，需要解决这些问题以支持企业级多租户操作。

## 术语表

- **系统**: AI DevOps 平台数据库架构
- **RBAC**: 基于角色的访问控制系统
- **多租户**: 支持多个组织并隔离数据
- **软删除**: 标记记录为已删除而不进行物理删除
- **物化视图**: 预计算的查询结果存储为表
- **审计追踪**: 关键数据所有变更的历史记录
- **策略引擎**: 评估和执行安全策略的系统组件

## 需求

### 需求 1: 权限模型统一

**用户故事:** 作为平台管理员，我希望在组织、团队和项目之间有清晰一致的权限模型，以便访问控制可预测且易于维护。

#### 验收标准

1. WHEN 创建组织时，THE 系统 SHALL 在 organization_members 表中创建默认条目，将创建者关联为所有者
2. THE 系统 SHALL 定义清晰的层级结构：组织 → 团队 → 项目，每个层级都有明确的成员关系表
3. WHEN 用户被添加到团队时，THE 系统 SHALL 支持通过团队-项目关联自动继承项目访问权限（可选）
4. THE 系统 SHALL 将角色定义（roles 表）与角色分配（role_assignments 表）分离，支持组织/团队/项目作用域
5. WHEN 查询用户权限时，THE 系统 SHALL 提供统一的权限解析算法，综合考虑组织、团队和项目成员身份

### 需求 2: 资源配额管理

**用户故事:** 作为系统架构师，我希望资源配额和当前使用量动态计算而非存储，以保证数据一致性。

#### 验收标准

1. THE 系统 SHALL 从 organizations 和 projects 表中移除所有 current_* 字段
2. THE 系统 SHALL 为 currentProjects、currentUsers、currentComputeUnits 和 currentStorageGb 提供数据库视图或应用层计算属性
3. WHEN 项目被创建或删除时，THE 系统 SHALL 在配额计算中自动反映变化，无需手动更新
4. THE 系统 SHALL 实现 CHECK 约束，在插入/更新时防止配额违规
5. THE 系统 SHALL 为性能关键的配额查询提供物化视图，按定义的计划刷新

### 需求 3: 环境访问控制

**用户故事:** 作为安全工程师，我希望通过适当的关系表管理环境访问权限，以便权限可审计和可维护。

#### 验收标准

1. THE 系统 SHALL 创建 environment_permissions 表，替代 allowedUserIds 和 allowedTeamIds 文本字段
2. THE 系统 SHALL 支持每个环境的细粒度权限，包含主体类型（用户、团队、角色）
3. WHEN 添加或删除环境权限时，THE 系统 SHALL 在审计日志中记录变更
4. THE 系统 SHALL 提供高效查询："用户 X 可以访问哪些环境"和"谁可以访问环境 Y"
5. WHEN 用户、团队或环境被删除时，THE 系统 SHALL 级联删除相关权限

### 需求 4: 多阶段部署审批

**用户故事:** 作为 DevOps 经理，我希望为部署配置多阶段审批工作流，以便生产变更需要适当的签署。

#### 验收标准

1. THE 系统 SHALL 创建 deployment_approvals 表，跟踪审批历史，包含审批人、时间戳、状态和评论
2. THE 系统 SHALL 支持每个环境的可配置审批要求（例如，生产环境需要 2 个审批）
3. WHEN 部署需要审批时，THE 系统 SHALL 阻止执行，直到获得所有必需的审批
4. THE 系统 SHALL 允许审批人批准、拒绝或请求变更，并强制要求评论
5. THE 系统 SHALL 在审计日志中记录所有审批操作及完整上下文

### 需求 5: 细粒度成本追踪

**用户故事:** 作为 FinOps 分析师，我希望以日粒度追踪成本数据并关联到特定资源，以便识别成本驱动因素并优化支出。

#### 验收标准

1. THE 系统 SHALL 修改 cost_tracking 表，除月度外还支持日粒度周期（YYYY-MM-DD 格式）
2. THE 系统 SHALL 添加外键，将成本与 deployments、pipeline_runs 和 environments 关联
3. THE 系统 SHALL 创建 cost_alerts 表，定义预算阈值和通知规则
4. WHEN 成本超过定义的阈值时，THE 系统 SHALL 创建告警记录并触发通知
5. THE 系统 SHALL 提供周、月、季度成本汇总的聚合视图

### 需求 6: 团队-项目关联

**用户故事:** 作为团队负责人，我希望将团队分配给项目，以便团队成员根据其团队角色自动继承项目访问权限。

#### 验收标准

1. THE 系统 SHALL 创建 team_projects 表，将团队与项目关联，并包含团队级别的角色
2. WHEN 用户被添加到团队时，THE 系统 SHALL 可选地授予他们访问所有团队关联项目的权限
3. THE 系统 SHALL 同时支持直接的用户-项目成员关系和继承的团队-项目成员关系
4. THE 系统 SHALL 提供查询，列出团队拥有的所有项目和与项目关联的所有团队
5. WHEN 团队从项目中移除时，THE 系统 SHALL 根据配置的策略处理继承权限的清理

### 需求 7: 统一软删除策略

**用户故事:** 作为数据治理官，我希望所有关键实体支持软删除，以便数据可以恢复且审计追踪得以保留。

#### 验收标准

1. THE 系统 SHALL 为 users、organizations、teams、projects、environments 和 deployments 表添加 deletedAt 时间戳字段
2. THE 系统 SHALL 添加 deletedBy 外键字段，跟踪执行删除的人员
3. WHEN 记录被软删除时，THE 系统 SHALL 将 deletedAt 设置为当前时间戳并保留所有数据
4. THE 系统 SHALL 从默认查询中排除软删除的记录，除非明确请求
5. THE 系统 SHALL 提供管理功能，永久删除或恢复软删除的记录

### 需求 8: 安全策略执行

**用户故事:** 作为安全官，我希望安全策略自动执行并跟踪违规情况，以便合规性可衡量和可审计。

#### 验收标准

1. THE 系统 SHALL 创建 security_policy_violations 表，记录策略违规，包含严重性、资源和修复状态
2. THE 系统 SHALL 为 security_policies.rules 字段定义标准 JSON 架构并进行验证
3. WHEN 尝试部署或配置变更时，THE 系统 SHALL 评估适用的安全策略
4. IF 检测到策略违规，THEN THE 系统 SHALL 阻止操作（如果强制执行）或记录警告（如果仅审计）
5. THE 系统 SHALL 提供合规报告，显示策略遵守率和违规趋势

### 需求 9: AI 助手使用追踪

**用户故事:** 作为产品经理，我希望详细记录 AI 助手交互日志，以便衡量采用率并改进助手质量。

#### 验收标准

1. THE 系统 SHALL 创建 ai_assistant_conversations 表，存储对话历史，包含用户、助手、提示、响应和元数据
2. THE 系统 SHALL 在适用时将对话链接到特定资源（项目、部署、事件）
3. WHEN 调用 AI 助手时，THE 系统 SHALL 记录交互，包含时间戳、持续时间和 token 使用量
4. THE 系统 SHALL 支持对话线程，跟踪多轮交互
5. THE 系统 SHALL 提供分析视图，按类型、用户、组织和结果质量统计助手使用情况

### 需求 10: Pipeline 阶段管理

**用户故事:** 作为 CI/CD 工程师，我希望 pipeline 由明确的阶段组成，以便在细粒度级别跟踪进度和失败。

#### 验收标准

1. THE 系统 SHALL 创建 pipeline_stages 表，定义阶段（构建、测试、部署），包含顺序和配置
2. THE 系统 SHALL 创建 pipeline_stage_runs 表，跟踪 pipeline 运行中每个阶段的执行
3. WHEN pipeline 执行时，THE 系统 SHALL 创建阶段运行记录，包含状态、开始时间、结束时间和日志
4. THE 系统 SHALL 支持阶段级别的重试和阶段之间的手动审批
5. THE 系统 SHALL 根据所有阶段运行的聚合状态计算 pipeline_runs.status

### 需求 11: 密钥管理

**用户故事:** 作为安全工程师，我希望有专用的密钥管理系统，以便安全存储敏感凭证且访问可审计。

#### 验收标准

1. THE 系统 SHALL 创建 secrets 表，包含加密值存储、作用域（组织/项目/环境）和键值对
2. THE 系统 SHALL 支持密钥版本控制，跟踪 created_at 和 updated_at
3. WHEN 访问密钥时，THE 系统 SHALL 在审计日志中记录访问，包含用户和时间戳
4. THE 系统 SHALL 支持密钥轮换，并自动通知依赖资源
5. THE 系统 SHALL 通过提供商配置集成外部密钥管理器（AWS Secrets Manager、HashiCorp Vault）

### 需求 12: 通知系统

**用户故事:** 作为用户，我希望通过首选渠道接收重要事件的通知，以便在无需持续监控的情况下保持知情。

#### 验收标准

1. THE 系统 SHALL 创建 notifications 表，存储通知记录，包含类型、接收者、渠道、状态和内容
2. THE 系统 SHALL 支持多种通知渠道（邮件、Slack、webhook、应用内）
3. WHEN 发生重大事件（部署失败、成本告警、安全违规）时，THE 系统 SHALL 为相关用户创建通知记录
4. THE 系统 SHALL 遵守 users 表中定义的用户通知偏好
5. THE 系统 SHALL 跟踪通知投递状态，并支持失败投递的重试逻辑

### 需求 13: 数据类型修正

**用户故事:** 作为数据库管理员，我希望数组字段使用正确的数据类型，以便强制类型安全且查询高效。

#### 验收标准

1. THE 系统 SHALL 将所有逗号分隔的文本字段转换为 PostgreSQL 数组类型（text[]）
2. THE 系统 SHALL 更新受影响的字段：protectedBranchNames、secondaryTags、riskFactors、allowedIps、complianceFrameworks
3. WHEN 查询数组字段时，THE 系统 SHALL 支持原生 PostgreSQL 数组操作符（ANY、ALL、@>）
4. THE 系统 SHALL 在数组字段上添加 GIN 索引，以实现高效的包含查询
5. THE 系统 SHALL 将现有的逗号分隔数据迁移为数组格式，不丢失数据

### 需求 14: 复合唯一约束

**用户故事:** 作为数据完整性专家，我希望在 slug 字段上添加适当的唯一约束，限定在其父实体范围内，以防止命名冲突。

#### 验收标准

1. THE 系统 SHALL 为 teams 表添加 (organizationId, slug) 唯一约束
2. THE 系统 SHALL 为 roles 表添加 (organizationId, slug) 唯一约束（当 organizationId 不为空时）
3. THE 系统 SHALL 为 environments 表添加 (projectId, name) 唯一约束（已存在）
4. THE 系统 SHALL 为 pipelines 表添加 (projectId, name) 唯一约束（已存在）
5. WHEN 插入重复的 slug 时，THE 系统 SHALL 拒绝操作并返回清晰的错误消息

### 需求 15: 性能优化

**用户故事:** 作为平台工程师，我希望为常见查询优化数据库性能，以便应用程序在规模扩展时保持响应。

#### 验收标准

1. THE 系统 SHALL 为频繁查询模式添加复合索引（例如，projects(organizationId, status, deletedAt)）
2. THE 系统 SHALL 为时间序列数据（deployments、audit_logs、cost_tracking）按月实现表分区
3. THE 系统 SHALL 为昂贵的聚合查询（组织配额、成本汇总）创建物化视图
4. THE 系统 SHALL 为高变动表配置自动 VACUUM 和 ANALYZE 计划
5. THE 系统 SHALL 在应用层实现连接池和预编译语句缓存
