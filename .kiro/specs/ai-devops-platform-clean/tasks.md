# AI DevOps 平台 - 实施任务列表

## 项目初始化

- [x] 1. 创建新项目结构
- [x] 1.1 创建 apps/api-clean 目录
  - 复制 api-ai 的基础配置文件
  - 更新 package.json 名称和依赖
  - 配置 TypeScript 和 Drizzle
  - _需求: 无_

- [x] 1.2 初始化 NestJS 项目结构
  - 创建 src/app.module.ts
  - 创建 src/main.ts
  - 配置 Fastify 适配器
  - 配置全局管道和过滤器
  - _需求: 1.1_

- [x] 1.3 配置数据库连接
  - 创建 src/database/database.module.ts
  - 配置 Drizzle 连接池
  - 配置 Redis 连接
  - _需求: 1.2_

- [x] 1.4 配置 tRPC
  - 创建 src/trpc/trpc.module.ts
  - 创建 src/trpc/trpc.router.ts
  - 配置 tRPC 上下文
  - _需求: 1.2_

## 数据库 Schema 设计

- [x] 2. 创建核心表 Schema
- [x] 2.1 创建用户相关表
  - 创建 users schema (含 deletedAt)
  - 创建 oauth_accounts schema
  - 创建迁移文件
  - _需求: 1.1_

- [x] 2.2 创建组织相关表
  - 创建 organizations schema (含 deletedAt, quotas JSONB)
  - 创建 organization_members schema
  - 创建迁移文件
  - _需求: 2.1_

- [x] 2.3 创建团队相关表
  - 创建 teams schema (含 deletedAt)
  - 创建 team_members schema
  - 创建迁移文件
  - _需求: 2.2_

- [x] 2.4 创建项目相关表
  - 创建 projects schema (含 deletedAt, config JSONB)
  - 创建 project_members schema
  - 创建 team_projects schema
  - 创建迁移文件
  - _需求: 2.3_

- [x] 2.5 创建仓库和环境表
  - 创建 repositories schema
  - 创建 environments schema (含 deletedAt, config JSONB, permissions JSONB)
  - 创建迁移文件
  - _需求: 2.4_

- [x] 2.6 创建 CI/CD 相关表
  - 创建 pipelines schema (含 config JSONB)
  - 创建 pipeline_runs schema
  - 创建 deployments schema (含 deletedAt)
  - 创建 deployment_approvals schema
  - 创建迁移文件
  - _需求: 2.5_

- [x] 2.7 创建监控和系统表
  - 创建 cost_tracking schema (含 costs JSONB)
  - 创建 security_policies schema (含 rules JSONB)
  - 创建 incidents schema
  - 创建 audit_logs schema (含 metadata JSONB)
  - 创建 notifications schema
  - 创建 ai_assistants schema (含 modelConfig JSONB)
  - 创建迁移文件
  - _需求: 2.6_

- [x] 2.8 执行数据库迁移
  - 运行 drizzle-kit generate
  - 运行 drizzle-kit migrate
  - 验证所有表创建成功
  - _需求: 2.7_

## 认证模块

- [x] 3. 实现认证功能
- [x] 3.1 创建 Auth 模块
  - 创建 src/modules/auth/auth.module.ts
  - 创建 src/modules/auth/auth.service.ts
  - 创建 src/modules/auth/auth.router.ts
  - _需求: 1.1_

- [x] 3.2 实现 GitHub OAuth
  - 配置 Arctic GitHub provider
  - 实现 /auth/github 端点
  - 实现 /auth/github/callback 端点
  - 创建或更新用户记录
  - _需求: 3.1_

- [x] 3.3 实现 GitLab OAuth
  - 配置 Arctic GitLab provider
  - 实现 /auth/gitlab 端点
  - 实现 /auth/gitlab/callback 端点
  - 创建或更新用户记录
  - _需求: 3.1_

- [x] 3.4 实现会话管理
  - 实现 JWT 生成和验证
  - 实现 Redis 会话存储
  - 实现 /auth/me 端点
  - 实现 /auth/logout 端点
  - _需求: 3.2, 3.3_

- [x] 3.5 实现认证中间件
  - 创建 tRPC 认证中间件
  - 实现用户上下文注入
  - 实现权限检查装饰器
  - _需求: 3.4_

## 用户模块

- [x] 4. 实现用户管理
- [x] 4.1 创建 Users 模块
  - 创建 src/modules/users/users.module.ts
  - 创建 src/modules/users/users.service.ts
  - 创建 src/modules/users/users.router.ts
  - _需求: 3.5_

- [x] 4.2 实现用户 CRUD
  - 实现 getMe (获取当前用户)
  - 实现 updateMe (更新当前用户)
  - 实现 getUser (获取用户详情)
  - 实现 listUsers (列出用户)
  - _需求: 4.1_

- [x] 4.3 实现用户偏好设置
  - 实现 updatePreferences (更新偏好)
  - 支持语言、主题、通知设置
  - _需求: 4.2_

## 组织模块

- [x] 5. 实现组织管理
- [x] 5.1 创建 Organizations 模块
  - 创建 src/modules/organizations/organizations.module.ts
  - 创建 src/modules/organizations/organizations.service.ts
  - 创建 src/modules/organizations/organizations.router.ts
  - _需求: 4.3_

- [x] 5.2 实现组织 CRUD
  - 实现 create (创建组织，自动添加创建者为 owner)
  - 实现 list (列出用户的组织)
  - 实现 get (获取组织详情)
  - 实现 update (更新组织)
  - 实现 delete (软删除组织)
  - _需求: 5.1_

- [x] 5.3 实现组织成员管理
  - 实现 inviteMember (邀请成员)
  - 实现 listMembers (列出成员)
  - 实现 updateMemberRole (更新成员角色)
  - 实现 removeMember (移除成员)
  - _需求: 5.2_

- [x] 5.4 实现配额检查
  - 实现配额查询（动态计算）
  - 实现配额检查中间件
  - 在创建资源时检查配额
  - _需求: 5.3_

## 团队模块

- [x] 6. 实现团队管理
- [x] 6.1 创建 Teams 模块
  - 创建 src/modules/teams/teams.module.ts
  - 创建 src/modules/teams/teams.service.ts
  - 创建 src/modules/teams/teams.router.ts
  - _需求: 5.4_

- [x] 6.2 实现团队 CRUD
  - 实现 create (创建团队)
  - 实现 list (列出组织的团队)
  - 实现 get (获取团队详情)
  - 实现 update (更新团队)
  - 实现 delete (软删除团队)
  - _需求: 6.1_

- [x] 6.3 实现团队成员管理
  - 实现 addMember (添加成员)
  - 实现 listMembers (列出成员)
  - 实现 updateMemberRole (更新成员角色)
  - 实现 removeMember (移除成员)
  - _需求: 6.2_

## 项目模块

- [x] 7. 实现项目管理
- [x] 7.1 创建 Projects 模块
  - 创建 src/modules/projects/projects.module.ts
  - 创建 src/modules/projects/projects.service.ts
  - 创建 src/modules/projects/projects.router.ts
  - _需求: 6.3_

- [x] 7.2 实现项目 CRUD
  - 实现 create (创建项目)
  - 实现 list (列出组织的项目)
  - 实现 get (获取项目详情)
  - 实现 update (更新项目)
  - 实现 delete (软删除项目)
  - _需求: 7.1_

- [x] 7.3 实现项目成员管理
  - 实现 addMember (添加成员)
  - 实现 listMembers (列出成员)
  - 实现 updateMemberRole (更新成员角色)
  - 实现 removeMember (移除成员)
  - _需求: 7.2_

- [x] 7.4 实现团队-项目关联
  - 实现 assignTeam (分配团队到项目)
  - 实现 listTeams (列出项目的团队)
  - 实现 removeTeam (移除团队)
  - 实现权限继承逻辑
  - _需求: 7.3_

## 仓库模块

- [x] 8. 实现仓库集成
- [x] 8.1 创建 Repositories 模块
  - 创建 src/modules/repositories/repositories.module.ts
  - 创建 src/modules/repositories/repositories.service.ts
  - 创建 src/modules/repositories/repositories.router.ts
  - _需求: 7.4_

- [x] 8.2 实现仓库 CRUD
  - 实现 connect (连接仓库)
  - 实现 list (列出项目的仓库)
  - 实现 get (获取仓库详情)
  - 实现 sync (同步仓库元数据)
  - 实现 disconnect (断开仓库)
  - _需求: 8.1_

- [x] 8.3 实现 Webhook 处理
  - 实现 GitHub webhook 接收
  - 实现 GitLab webhook 接收
  - 解析 push/pr 事件
  - 触发 pipeline 运行
  - _需求: 8.2_

## 环境模块

- [x] 9. 实现环境管理
- [x] 9.1 创建 Environments 模块
  - 创建 src/modules/environments/environments.module.ts
  - 创建 src/modules/environments/environments.service.ts
  - 创建 src/modules/environments/environments.router.ts
  - _需求: 8.3_

- [x] 9.2 实现环境 CRUD
  - 实现 create (创建环境)
  - 实现 list (列出项目的环境)
  - 实现 get (获取环境详情)
  - 实现 update (更新环境)
  - 实现 delete (软删除环境)
  - _需求: 9.1_

- [x] 9.3 实现环境权限管理
  - 实现 grantPermission (授予权限，更新 JSONB)
  - 实现 revokePermission (撤销权限)
  - 实现 listPermissions (列出权限)
  - 实现权限检查函数
  - _需求: 9.2_

## Pipeline 模块

- [x] 10. 实现 Pipeline 管理
- [x] 10.1 创建 Pipelines 模块
  - 创建 src/modules/pipelines/pipelines.module.ts
  - 创建 src/modules/pipelines/pipelines.service.ts
  - 创建 src/modules/pipelines/pipelines.router.ts
  - _需求: 9.3_

- [x] 10.2 实现 Pipeline CRUD
  - 实现 create (创建 pipeline)
  - 实现 list (列出项目的 pipelines)
  - 实现 get (获取 pipeline 详情)
  - 实现 update (更新 pipeline 配置)
  - 实现 delete (删除 pipeline)
  - _需求: 10.1_

- [x] 10.3 实现 Pipeline 执行
  - 实现 trigger (手动触发)
  - 实现 run (执行 pipeline)
  - 实现 cancel (取消运行)
  - 记录运行日志
  - _需求: 10.2_

- [x] 10.4 实现 Pipeline Runs 查询
  - 实现 listRuns (列出运行记录)
  - 实现 getRun (获取运行详情)
  - 实现 getLogs (获取日志)
  - _需求: 10.3_

## 部署模块

- [x] 11. 实现部署管理
- [x] 11.1 创建 Deployments 模块
  - 创建 src/modules/deployments/deployments.module.ts
  - 创建 src/modules/deployments/deployments.service.ts
  - 创建 src/modules/deployments/deployments.router.ts
  - _需求: 10.4_

- [x] 11.2 实现部署 CRUD
  - 实现 create (创建部署)
  - 实现 list (列出部署记录)
  - 实现 get (获取部署详情)
  - 实现 rollback (回滚部署)
  - _需求: 11.1_

- [x] 11.3 实现部署审批
  - 检查环境是否需要审批
  - 创建审批请求
  - 实现 approve (批准部署)
  - 实现 reject (拒绝部署)
  - 检查审批状态
  - _需求: 11.2_

- [x] 11.4 实现部署执行
  - 验证审批状态
  - 执行部署策略
  - 更新部署状态
  - 发送通知
  - _需求: 11.3_

## 成本追踪模块

- [x] 12. 实现成本管理
- [x] 12.1 创建 Cost Tracking 模块
  - 创建 src/modules/cost-tracking/cost-tracking.module.ts
  - 创建 src/modules/cost-tracking/cost-tracking.service.ts
  - 创建 src/modules/cost-tracking/cost-tracking.router.ts
  - _需求: 11.4_

- [x] 12.2 实现成本记录
  - 实现 record (记录成本数据)
  - 实现 list (列出成本记录)
  - 实现 getSummary (获取成本汇总)
  - _需求: 12.1_

- [x] 12.3 实现成本告警
  - 实现预算检查定时任务
  - 检测成本超限
  - 发送告警通知
  - _需求: 12.2_

## 安全策略模块

- [x] 13. 实现安全管理
- [x] 13.1 创建 Security Policies 模块
  - 创建 src/modules/security-policies/security-policies.module.ts
  - 创建 src/modules/security-policies/security-policies.service.ts
  - 创建 src/modules/security-policies/security-policies.router.ts
  - _需求: 12.3_

- [x] 13.2 实现策略 CRUD
  - 实现 create (创建策略)
  - 实现 list (列出策略)
  - 实现 get (获取策略详情)
  - 实现 update (更新策略)
  - 实现 delete (删除策略)
  - _需求: 13.1_

- [x] 13.3 实现策略执行
  - 实现策略评估引擎
  - 在关键操作前检查策略
  - 记录违规到审计日志
  - _需求: 13.2_

## 审计日志模块

- [x] 14. 实现审计日志
- [x] 14.1 创建 Audit Logs 模块
  - 创建 src/modules/audit-logs/audit-logs.module.ts
  - 创建 src/modules/audit-logs/audit-logs.service.ts
  - 创建 src/modules/audit-logs/audit-logs.router.ts
  - _需求: 13.3_

- [x] 14.2 实现日志记录
  - 实现 log (记录审计日志)
  - 集成到所有关键操作
  - 记录用户、时间、IP、操作
  - _需求: 14.1_

- [x] 14.3 实现日志查询
  - 实现 list (列出日志)
  - 实现 search (搜索日志)
  - 实现 export (导出日志)
  - _需求: 14.2_

## 通知模块

- [x] 15. 实现通知系统
- [x] 15.1 创建 Notifications 模块
  - 创建 src/modules/notifications/notifications.module.ts
  - 创建 src/modules/notifications/notifications.service.ts
  - 创建 src/modules/notifications/notifications.router.ts
  - _需求: 14.3_

- [x] 15.2 实现通知 CRUD
  - 实现 create (创建通知)
  - 实现 list (列出用户通知)
  - 实现 markAsRead (标记已读)
  - 实现 delete (删除通知)
  - _需求: 15.1_

- [x] 15.3 实现通知投递
  - 实现邮件发送
  - 实现应用内通知
  - 实现重试逻辑
  - _需求: 15.2_

## AI 助手模块

- [x] 16. 实现 AI 助手
- [x] 16.1 创建 AI Assistants 模块
  - 创建 src/modules/ai-assistants/ai-assistants.module.ts
  - 创建 src/modules/ai-assistants/ai-assistants.service.ts
  - 创建 src/modules/ai-assistants/ai-assistants.router.ts
  - _需求: 15.3_

- [x] 16.2 实现助手 CRUD
  - 实现 create (创建助手)
  - 实现 list (列出助手)
  - 实现 get (获取助手详情)
  - 实现 update (更新助手)
  - 实现 delete (删除助手)
  - _需求: 16.1_

- [x] 16.3 实现 AI 对话
  - 集成 Vercel AI SDK
  - 实现 chat (与助手对话)
  - 支持流式响应
  - 记录使用统计
  - _需求: 16.2_

## 可观测性模块 (OpenTelemetry)

- [ ] 17. 实现 OpenTelemetry 分布式追踪
- [x] 17.1 修复 OpenTelemetry 配置
  - 修复 src/observability/tracing.ts 中的类型错误
  - 安装缺失的 OpenTelemetry 依赖包
  - 配置正确的 Resource 导入
  - 验证 OpenTelemetry SDK 正常启动
  - _需求: 16.3_

- [x] 17.2 集成 OpenTelemetry 到 NestJS
  - 在 main.ts 中初始化 OpenTelemetry
  - 确保在应用启动前初始化追踪
  - 配置优雅关闭逻辑
  - 测试追踪数据导出
  - _需求: 17.1_

- [x] 17.3 实现自定义追踪装饰器
  - 创建 @Trace() 装饰器用于服务方法
  - 实现自动 Span 创建和管理
  - 添加错误捕获和记录
  - 支持自定义 Span 属性
  - _需求: 17.2_

- [x] 17.4 为关键服务添加追踪
  - 为 AuthService 添加追踪
  - 为 OrganizationsService 添加追踪
  - 为 ProjectsService 添加追踪
  - 为 DeploymentsService 添加追踪
  - 为 PipelinesService 添加追踪
  - _需求: 17.3_

- [x] 17.5 实现业务指标收集
  - 创建 src/observability/metrics.ts
  - 实现 HTTP 请求计数器
  - 实现响应时间直方图
  - 实现数据库查询指标
  - 实现业务指标（部署数、Pipeline 运行数）
  - _需求: 17.4_

- [x] 17.6 配置 Prometheus 导出
  - 验证 Prometheus 端口 9464 可访问
  - 测试 /metrics 端点
  - 配置指标标签（环境、服务名）
  - 文档化指标列表
  - _需求: 17.5_

- [x] 17.7 实现追踪上下文传播
  - 在 tRPC 中间件中传播追踪上下文
  - 在数据库查询中关联追踪
  - 在 BullMQ 任务中传播上下文
  - 测试跨服务追踪链路
  - _需求: 17.6_

- [x] 17.8 配置 Jaeger/Zipkin 后端
  - 配置 OTLP 导出器端点
  - 设置环境变量
  - 测试追踪数据可视化
  - 编写可观测性文档
  - _需求: 17.7_

## 测试框架 (Vitest)

- [x] 18. 配置 Vitest 测试框架
- [x] 18.1 安装和配置 Vitest
  - 安装 vitest 和相关依赖
  - 创建 vitest.config.ts
  - 配置 TypeScript 路径别名
  - 配置测试环境（node）
  - _需求: 17.8_

- [x] 18.2 配置测试数据库
  - 创建测试数据库配置
  - 实现测试前数据库初始化
  - 实现测试后数据库清理
  - 配置事务回滚策略
  - _需求: 18.1_

- [x] 18.3 创建测试工具函数
  - 创建 test/utils/factories.ts（测试数据工厂）
  - 创建 test/utils/db-helpers.ts（数据库辅助函数）
  - 创建 test/utils/auth-helpers.ts（认证辅助函数）
  - 创建 test/utils/assertions.ts（自定义断言）
  - _需求: 18.2_

- [x] 18.4 编写 AuthService 单元测试
  - 测试 GitHub OAuth 流程
  - 测试 GitLab OAuth 流程
  - 测试会话创建和验证
  - 测试登出逻辑
  - _需求: 18.3_

- [x] 18.5 编写 OrganizationsService 单元测试
  - 测试组织创建（含 owner 自动添加）
  - 测试组织列表查询
  - 测试组织成员管理
  - 测试软删除
  - _需求: 18.4_

- [x] 18.6 编写 ProjectsService 单元测试
  - 测试项目创建
  - 测试项目成员管理
  - 测试团队-项目关联
  - 测试配额检查
  - _需求: 18.5_

- [x] 18.7 编写 DeploymentsService 单元测试
  - 测试部署创建
  - 测试审批流程
  - 测试部署执行
  - 测试回滚逻辑
  - _需求: 18.6_

- [x] 18.8 编写 API 集成测试
  - 测试认证端点
  - 测试组织 CRUD 端点
  - 测试项目 CRUD 端点
  - 测试部署端点
  - _需求: 18.7_

- [x] 18.9 配置测试覆盖率
  - 配置 coverage 收集
  - 设置覆盖率阈值（80%）
  - 生成 HTML 覆盖率报告
  - 配置 CI 覆盖率上传
  - _需求: 18.8_

- [x] 18.10 编写测试文档
  - 编写测试指南（TESTING.md）
  - 文档化测试工具函数
  - 提供测试示例
  - 说明如何运行和调试测试
  - _需求: 18.9_

## CI/CD 和部署

- [ ] 19. 配置 CI/CD 流程
- [ ] 19.1 配置 GitHub Actions
  - 创建 .github/workflows/test.yml
  - 配置测试运行
  - 配置覆盖率上传
  - 配置 PR 检查
  - _需求: 18.10_

- [ ] 19.2 配置 Docker
  - 编写 Dockerfile
  - 编写 docker-compose.yml
  - 配置环境变量
  - 测试容器构建和运行
  - _需求: 19.1_

- [ ] 19.3 编写部署文档
  - 编写 README.md
  - 编写部署指南
  - 文档化环境变量
  - 提供故障排查指南
  - _需求: 19.2_

- [ ] 19.4 配置生产监控
  - 配置 Prometheus 抓取
  - 配置 Grafana 仪表板
  - 配置告警规则
  - 测试端到端监控
  - _需求: 19.3_

## 任务统计

- **总任务数**: 19 个主任务
- **子任务数**: 100+ 个子任务
- **预计工期**: 8-10 周
- **技术栈**: NestJS 11 + tRPC 11 + Drizzle + Bun

## 开发建议

1. **按模块开发**: 从认证开始，逐步实现各个模块
2. **测试驱动**: 每个模块完成后编写测试
3. **增量部署**: 完成核心功能后就可以部署
4. **持续优化**: 根据使用情况优化性能

## 架构优势

✅ **类型安全**: 端到端 TypeScript
✅ **高性能**: Bun + Fastify + Drizzle
✅ **可维护**: 模块化架构
✅ **可扩展**: JSONB 灵活配置
✅ **现代化**: 2025 年最前沿技术栈
