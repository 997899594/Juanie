# 实施任务列表（开发版）

## 任务概览

本任务列表针对个人开发项目优化，去除了备份和测试环境相关任务。

**两个主要阶段**:
- **阶段 1**: 架构简化（减法）- 删除和合并表
- **阶段 2**: 功能增强（加法）- 添加新表和修改现有表

## 阶段 1: 架构简化（减法）

- [ ] 1. 合并 roles 和 role_assignments 表
- [ ] 1.1 创建新的 user_roles 表
  - 编写 Drizzle schema 定义
  - 创建迁移脚本
  - 执行迁移
  - _需求: 1.1_

- [ ] 1.2 迁移数据从 roles 和 role_assignments 到 user_roles
  - 编写数据迁移 SQL 脚本
  - 处理数据转换逻辑（roles.permissions → user_roles.permissions）
  - 验证数据完整性
  - _需求: 1.1_

- [ ] 1.3 更新应用代码引用 user_roles 表
  - 修改权限查询逻辑
  - 更新 API 端点
  - _需求: 1.2_

- [ ]* 1.4 编写 user_roles 表的单元测试
  - 测试权限查询
  - 测试权限分配
  - 测试权限撤销
  - _需求: 1.3_

- [ ] 1.5 删除 roles 和 role_assignments 表
  - 确认应用代码已完全迁移
  - 执行 DROP TABLE 语句
  - _需求: 1.3_

- [ ] 2. 合并 webhook_endpoints 和 webhook_events 表
- [ ] 2.1 创建新的 webhooks 表
  - 编写 Drizzle schema 定义
  - 创建迁移脚本
  - 执行迁移
  - _需求: 1.1_

- [ ] 2.2 迁移数据从 webhook_endpoints 到 webhooks
  - 编写数据迁移 SQL 脚本
  - 处理事件类型数组转换
  - 验证数据完整性
  - _需求: 2.1_

- [ ] 2.3 更新 webhook 投递逻辑
  - 修改事件触发代码，不再存储 webhook_events
  - 实现异步 webhook 投递
  - 添加重试逻辑
  - _需求: 2.2_

- [ ]* 2.4 编写 webhook 投递的集成测试
  - 测试 webhook 触发
  - 测试重试机制
  - _需求: 2.3_

- [ ] 2.5 删除 webhook_endpoints 和 webhook_events 表
  - 确认应用代码已完全迁移
  - 执行 DROP TABLE 语句
  - _需求: 2.3_

- [ ] 3. 删除不必要的表
- [ ] 3.1 删除 experiments 表
  - 检查是否有代码引用该表
  - 执行 DROP TABLE experiments
  - _需求: 1.1_

- [ ] 3.2 删除 identity_providers 表
  - 将配置迁移到环境变量或配置文件
  - 更新认证代码使用新配置
  - 执行 DROP TABLE identity_providers
  - _需求: 1.1_

- [ ] 3.3 删除 auth_sessions 表
  - 实现 Redis 会话存储
  - 更新认证中间件
  - 执行 DROP TABLE auth_sessions
  - _需求: 1.1_

- [ ] 3.4 删除 oauth_flows 表
  - 实现 Redis 临时存储 OAuth state
  - 更新 OAuth 回调处理逻辑
  - 执行 DROP TABLE oauth_flows
  - _需求: 1.1_

- [ ] 3.5 删除 code_analysis_results 表
  - 配置代码分析工具 webhook
  - 将结果存储到 events 表
  - 执行 DROP TABLE code_analysis_results
  - _需求: 1.1_

- [ ] 3.6 删除 performance_metrics 表
  - 配置 Prometheus 或其他监控工具
  - 实现 metrics API 查询
  - 执行 DROP TABLE performance_metrics
  - _需求: 1.1_

- [ ] 4. 简化现有表
- [ ] 4.1 合并 intelligent_alerts 到 incidents 表
  - 为 incidents 表添加 alert_source, ai_confidence, ai_recommendation 字段
  - 迁移 intelligent_alerts 数据到 incidents
  - 更新告警创建逻辑
  - 执行 DROP TABLE intelligent_alerts
  - _需求: 1.1_

- [ ] 4.2 合并 ai_recommendations 到 ai_assistants 表
  - 为 ai_assistants 表添加 recent_recommendations JSONB 字段
  - 迁移 ai_recommendations 数据到 JSONB
  - 更新推荐生成逻辑
  - 执行 DROP TABLE ai_recommendations
  - _需求: 1.1_

## 阶段 2: 功能增强（加法）

- [ ] 5. 创建新表
- [ ] 5.1 创建 organization_members 表
  - 编写 Drizzle schema 定义
  - 创建迁移脚本（包含索引和约束）
  - 执行迁移
  - _需求: 1.1_

- [ ] 5.2 为现有组织创建默认成员记录
  - 编写数据迁移脚本，为每个组织的创建者添加 owner 角色
  - 执行迁移
  - _需求: 5.1_

- [ ] 5.3 更新组织管理 API 使用 organization_members
  - 修改组织成员列表查询
  - 实现成员邀请功能
  - 实现成员角色管理
  - _需求: 5.2_

- [ ]* 5.4 编写 organization_members 的单元测试
  - 测试成员添加
  - 测试成员移除
  - 测试角色变更
  - _需求: 5.3_

- [ ] 5.5 创建 environment_permissions 表
  - 编写 Drizzle schema 定义
  - 创建迁移脚本（包含索引和约束）
  - 执行迁移
  - _需求: 1.1_

- [ ] 5.6 迁移 environments 表的权限数据
  - 编写迁移脚本，从 allowed_user_ids 和 allowed_team_ids 迁移
  - 处理逗号分隔字符串转换
  - 验证数据完整性
  - _需求: 5.5_

- [ ] 5.7 删除 environments 表的旧权限字段
  - 执行 ALTER TABLE DROP COLUMN allowed_user_ids
  - 执行 ALTER TABLE DROP COLUMN allowed_team_ids
  - _需求: 5.6_

- [ ] 5.8 更新环境权限检查逻辑
  - 实现新的权限查询函数
  - 更新部署权限验证
  - 更新环境配置权限验证
  - _需求: 5.7_

- [ ]* 5.9 编写 environment_permissions 的单元测试
  - 测试权限授予
  - 测试权限撤销
  - 测试权限查询
  - _需求: 5.8_

- [ ] 5.10 创建 deployment_approvals 表
  - 编写 Drizzle schema 定义
  - 创建迁移脚本（包含索引和约束）
  - 执行迁移
  - _需求: 1.1_

- [ ] 5.11 为 environments 表添加 approval_config 字段
  - 执行 ALTER TABLE 添加 JSONB 字段
  - 设置默认配置
  - _需求: 5.10_

- [ ] 5.12 实现部署审批工作流
  - 实现审批请求创建逻辑
  - 实现审批/拒绝 API 端点
  - 实现审批状态检查
  - 阻止未审批的部署执行
  - _需求: 5.11_

- [ ]* 5.13 编写部署审批的集成测试
  - 测试单人审批流程
  - 测试多人审批流程
  - 测试拒绝流程
  - _需求: 5.12_

- [ ] 5.14 创建 team_projects 表
  - 编写 Drizzle schema 定义
  - 创建迁移脚本（包含索引和约束）
  - 执行迁移
  - _需求: 1.1_

- [ ] 5.15 实现团队-项目关联管理
  - 实现团队分配到项目 API
  - 实现权限继承逻辑
  - 更新项目成员查询包含团队成员
  - _需求: 5.14_

- [ ]* 5.16 编写 team_projects 的单元测试
  - 测试团队分配
  - 测试权限继承
  - _需求: 5.15_

- [ ] 5.17 创建 notifications 表
  - 编写 Drizzle schema 定义
  - 创建迁移脚本（包含索引和约束）
  - 执行迁移
  - _需求: 1.1_

- [ ] 5.18 实现通知创建和投递系统
  - 实现通知创建 API
  - 实现邮件投递
  - 实现应用内通知
  - _需求: 5.17_

- [ ] 5.19 集成通知到现有功能
  - 部署成功/失败时发送通知
  - 审批请求时发送通知
  - 成本告警时发送通知
  - _需求: 5.18_

- [ ]* 5.20 编写通知系统的集成测试
  - 测试邮件发送
  - 测试重试逻辑
  - _需求: 5.19_

- [ ] 6. 修改现有表
- [ ] 6.1 移除 organizations 表的冗余字段
  - 执行 ALTER TABLE DROP COLUMN current_projects
  - 执行 ALTER TABLE DROP COLUMN current_users
  - 执行 ALTER TABLE DROP COLUMN current_storage_gb
  - 执行 ALTER TABLE DROP COLUMN current_monthly_runs
  - _需求: 2.1_

- [ ] 6.2 移除 projects 表的冗余字段
  - 执行 ALTER TABLE DROP COLUMN current_compute_units
  - 执行 ALTER TABLE DROP COLUMN current_storage_gb
  - 执行 ALTER TABLE DROP COLUMN current_monthly_cost
  - _需求: 2.1_

- [ ] 6.3 为关键表添加软删除字段
  - 为 organizations, projects, teams, environments 添加 deleted_at 和 deleted_by
  - 创建索引
  - _需求: 7.1_

- [ ] 6.4 实现软删除逻辑
  - 实现软删除函数
  - 更新删除 API 使用软删除
  - 更新查询默认过滤软删除记录
  - _需求: 6.3_

- [ ] 6.5 实现软删除恢复功能
  - 实现恢复 API 端点
  - 添加管理员权限检查
  - 记录恢复操作到审计日志
  - _需求: 6.4_

- [ ]* 6.6 编写软删除的单元测试
  - 测试软删除
  - 测试恢复
  - 测试查询过滤
  - _需求: 6.5_

- [ ] 6.7 转换数组字段类型
  - 转换 repositories.protected_branch_names 为 text[]
  - 转换 projects.secondary_tags 为 text[]
  - 转换 deployments.risk_factors 为 text[]
  - 转换 environments.allowed_ips 为 text[]
  - 转换 environments.compliance_frameworks 为 text[]
  - _需求: 13.1, 13.2_

- [ ] 6.8 为数组字段创建 GIN 索引
  - 创建 repositories.protected_branch_names GIN 索引
  - 创建 projects.secondary_tags GIN 索引
  - 创建 environments.allowed_ips GIN 索引
  - _需求: 13.4_

- [ ] 6.9 更新应用代码使用数组操作符
  - 修改查询使用 ANY, ALL, @> 操作符
  - 更新数据插入逻辑
  - 更新数据更新逻辑
  - _需求: 6.8_

- [ ]* 6.10 编写数组字段的单元测试
  - 测试数组查询
  - 测试数组更新
  - 测试包含查询
  - _需求: 6.9_

- [ ] 6.11 添加唯一约束
  - 为 teams 表添加 (organization_id, slug) 唯一约束
  - _需求: 14.1_

- [ ] 6.12 扩展 audit_logs 表
  - 添加 violation_severity 字段
  - 添加 remediation_status 字段
  - 添加 resolved_by 和 resolved_at 字段
  - 创建索引
  - _需求: 8.1_

- [ ] 6.13 更新安全违规记录逻辑
  - 修改安全策略检查代码
  - 记录违规到 audit_logs
  - 实现违规查询 API
  - _需求: 6.12_

- [ ]* 6.14 编写安全违规记录的单元测试
  - 测试违规记录
  - 测试违规查询
  - _需求: 6.13_

- [ ] 7. 创建数据库视图
- [ ] 7.1 创建 organization_quotas_view
  - 编写 SQL 视图定义
  - 创建视图
  - 验证查询结果正确性
  - _需求: 2.2_

- [ ] 7.2 更新应用代码使用 organization_quotas_view
  - 修改配额查询逻辑
  - 更新配额检查函数
  - 更新 API 响应
  - _需求: 7.1_

- [ ]* 7.3 编写 organization_quotas_view 的单元测试
  - 测试配额计算准确性
  - 测试边界情况
  - _需求: 7.2_

- [ ] 7.4 创建 project_quotas_view
  - 编写 SQL 视图定义
  - 创建视图
  - 验证查询结果正确性
  - _需求: 2.2_

- [ ] 7.5 更新应用代码使用 project_quotas_view
  - 修改配额查询逻辑
  - 更新配额检查函数
  - 更新 API 响应
  - _需求: 7.4_

- [ ]* 7.6 编写 project_quotas_view 的单元测试
  - 测试配额计算准确性
  - 测试边界情况
  - _需求: 7.5_

- [ ] 8. 性能优化
- [ ] 8.1 添加复合索引
  - 为 projects 添加 (organization_id, status, deleted_at) 索引
  - 为 deployments 添加 (project_id, status, created_at) 索引
  - 为 pipeline_runs 添加 (project_id, status, created_at) 索引
  - _需求: 15.1_

- [ ] 8.2 分析慢查询
  - 启用 pg_stat_statements
  - 收集查询统计
  - 识别最慢的查询
  - _需求: 15.1_

- [ ] 8.3 优化慢查询
  - 为慢查询添加索引
  - 重写低效查询
  - _需求: 8.2_

- [ ]* 8.4 性能基准测试
  - 测试常见查询性能
  - 对比优化前后
  - _需求: 8.3_

## 任务统计

- **总任务数**: 8 个主任务
- **子任务数**: 60 个子任务
- **可选任务**: 13 个测试任务
- **预计工期**: 3-4 周
  - 阶段 1: 1-2 周
  - 阶段 2: 2 周

## 快速开始

1. **从阶段 1 开始**: 先简化架构，删除不必要的表
2. **逐个任务执行**: 每完成一个任务验证功能正常
3. **测试任务可选**: 标记 * 的测试任务可以跳过
4. **遇到问题随时回滚**: 使用 Git 版本控制

## 注意事项

⚠️ **开发环境建议**:
- 使用 Git 做好版本控制
- 每完成一个大任务提交一次
- 重要变更前打 tag
- 可以随时回滚到之前的状态

💡 **执行顺序**:
- 阶段 1 和阶段 2 可以分开执行
- 建议先完成阶段 1，验证稳定后再做阶段 2
- 每个主任务内的子任务按顺序执行
