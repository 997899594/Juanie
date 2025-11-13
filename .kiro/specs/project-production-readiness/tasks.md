# Implementation Plan

## Overview

将 Project 从 demo 性质改造为生产可用的企业级项目管理系统。基于 Phase 1 的 8 个核心需求，使用现代化工具减少开发工作量。

## Task List

- [x] 1. 数据库 Schema 和迁移
  - 创建新表和更新现有表的 schema
  - 编写数据库迁移脚本
  - 准备系统模板的 seed 数据
  - _Requirements: 1.1, 2.1, 2.2_

- [x] 1.1 创建 project_templates schema
  - 在 `packages/core/database/src/schemas/` 创建 `project-templates.schema.ts`
  - 定义表结构（id, name, slug, category, techStack, defaultConfig, k8sTemplates, cicdTemplates 等）
  - 导出类型定义
  - _Requirements: 2.1, 2.2_

- [x] 1.2 创建 project_events schema
  - 在 `packages/core/database/src/schemas/` 创建 `project-events.schema.ts`
  - 定义表结构（id, projectId, eventType, eventData, triggeredBy, createdAt）
  - 导出类型定义
  - _Requirements: 11.1, 11.2_

- [x] 1.3 更新 projects schema
  - 修改 `packages/core/database/src/schemas/projects.schema.ts`
  - 添加字段：initializationStatus, templateId, templateConfig, healthScore, healthStatus, lastHealthCheck
  - 更新 status 字段的类型注释
  - 更新 config 字段的类型（添加 quota）
  - _Requirements: 1.1, 5.1, 9.1_

- [x] 1.4 更新 schema index
  - 在 `packages/core/database/src/schemas/index.ts` 导出新的 schema
  - 确保所有类型正确导出
  - _Requirements: 1.1_

- [x] 1.5 编写数据库迁移脚本
  - 创建 `packages/core/database/drizzle/migrations/001_project_production_readiness.sql`
  - 添加新表（project_templates, project_events）
  - 更新 projects 表（添加新字段）
  - 创建索引
  - _Requirements: 1.1_

- [x] 1.6 准备系统模板 seed 数据
  - 创建 `packages/core/database/src/seeds/project-templates.seed.ts`
  - 定义 5 个系统模板（React、Node.js、Go、Python、静态网站）
  - 包含完整的 K8s 配置模板（使用 Handlebars 语法）
  - _Requirements: 2.1, 2.2, 2.3_

- [x] 2. 核心类型定义
  - 定义 TypeScript 类型和接口
  - 创建事件类型定义
  - 更新现有类型
  - _Requirements: 1.1, 2.1, 11.1_

- [x] 2.1 创建 project 相关类型
  - 在 `packages/core/types/src/` 创建 `project.types.ts`
  - 定义 CreateProjectInput, ProjectStatus, InitializationResult 等类型
  - 定义 ProjectHealth, HealthIssue 等类型
  - _Requirements: 1.1, 5.1_

- [x] 2.2 创建 template 相关类型
  - 在 `packages/core/types/src/` 创建 `template.types.ts`
  - 定义 ProjectTemplate, EnvironmentTemplate, ResourceTemplate 等类型
  - 定义 TemplateFilters, RenderedTemplate 等类型
  - _Requirements: 2.1, 2.2_

- [x] 2.3 创建 event 相关类型
  - 在 `packages/core/types/src/` 创建 `events.types.ts`
  - 定义 ProjectEvent, DeploymentEvent, GitOpsEvent 等类型
  - 定义具体的事件类型（ProjectCreatedEvent, DeploymentCompletedEvent 等）
  - _Requirements: 11.1, 11.2_

- [x] 2.4 更新 schemas.ts
  - 在 `packages/core/types/src/schemas.ts` 添加新的 Zod schemas
  - createProjectSchema, updateProjectSchema, createTemplateSchema 等
  - 导出所有 schema
  - _Requirements: 1.1, 2.1_

- [x] 3. Template Manager 服务
  - 实现项目模板管理功能
  - 模板渲染引擎
  - 模板验证
  - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5_

- [x] 3.1 创建 TemplateManager 服务
  - 在 `packages/services/projects/src/` 创建 `template-manager.service.ts`
  - 实现 listTemplates, getTemplate, renderTemplate 方法
  - 使用 Handlebars 作为模板引擎
  - _Requirements: 2.1, 2.2_

- [x] 3.2 实现模板渲染逻辑
  - 实现 renderTemplate 方法
  - 支持变量替换（项目名、镜像、副本数、环境变量等）
  - 生成完整的 K8s YAML 配置
  - _Requirements: 2.3, 2.4_

- [x] 3.3 实现模板验证
  - 实现 validateTemplate 方法
  - 验证 K8s YAML 语法
  - 验证必需字段
  - _Requirements: 2.5_

- [x] 3.4 实现自定义模板功能
  - 实现 createCustomTemplate 方法
  - 权限检查（组织管理员）
  - 模板持久化
  - _Requirements: 2.4_

- [x] 4. Project Orchestrator 服务
  - 实现项目编排核心逻辑
  - 自动化初始化流程
  - 错误处理和回滚
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5_

- [x] 4.1 创建 ProjectOrchestrator 服务
  - 在 `packages/services/projects/src/` 创建 `project-orchestrator.service.ts`
  - 注入依赖（db, queue, environments, repositories, flux, templates, audit, notifications）
  - 实现基础结构
  - _Requirements: 1.1_

- [x] 4.2 实现 createAndInitialize 方法
  - 创建 Project 记录（status: initializing）
  - 发布 project.created 事件
  - 调用初始化流程
  - 错误处理和回滚
  - _Requirements: 1.1, 1.2, 1.5_

- [x] 4.3 实现 initializeFromTemplate 方法
  - 获取模板配置
  - 创建环境（development, staging, production）
  - 处理 Git 仓库（关联现有或创建新仓库）
  - 生成 K8s 配置文件
  - 提交到 Git
  - 创建 GitOps 资源
  - 更新项目状态
  - _Requirements: 1.1, 1.2, 1.3_

- [x] 4.4 实现 Git 仓库处理逻辑
  - 支持关联现有仓库（验证权限、检查配置）
  - 支持创建新仓库（调用 GitHub/GitLab API）
  - 生成初始文件（README, .gitignore, K8s 配置）
  - _Requirements: 1.2_

- [x] 4.5 实现错误处理和回滚
  - 捕获各步骤的错误
  - 回滚已创建的资源
  - 更新项目状态为 failed
  - 记录详细错误信息
  - 发送通知
  - _Requirements: 1.5_

- [x] 4.6 实现 getProjectStatus 方法
  - 查询项目及所有关联资源
  - 聚合统计信息（部署次数、成功率等）
  - 计算健康度
  - 查询资源使用情况
  - _Requirements: 3.1, 3.2, 5.1_

- [x] 4.7 实现项目归档和恢复
  - 实现 archiveProject 方法（更新状态、暂停 GitOps 同步）
  - 实现 restoreProject 方法（恢复状态、重启 GitOps 同步）
  - _Requirements: 10.1, 10.2, 10.3, 10.4_

- [x] 5. Health Monitor 服务
  - 实现项目健康度监控
  - 健康度计算算法
  - 问题检测和建议
  - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5_

- [x] 5.1 创建 HealthMonitor 服务
  - 在 `packages/services/projects/src/` 创建 `health-monitor.service.ts`
  - 注入依赖（db, deployments, flux, k3s）
  - 实现基础结构
  - _Requirements: 5.1_

- [x] 5.2 实现 calculateHealth 方法
  - 获取最近 10 次部署记录
  - 计算部署成功率
  - 检查 GitOps 资源状态
  - 检查 Pod 健康状态
  - 计算综合评分（0-100）
  - _Requirements: 5.1, 5.3_

- [x] 5.3 实现问题检测逻辑
  - 检测部署失败模式
  - 检测 GitOps 同步问题
  - 检测资源异常
  - 生成问题列表（severity, category, message, suggestedAction）
  - _Requirements: 5.4_

- [x] 5.4 实现优化建议生成
  - 基于问题列表生成建议
  - 提供可操作的修复步骤
  - _Requirements: 5.5_

- [-] 6. Approval Manager 服务
  - 实现部署审批流程
  - 适配现有的 deployment_approvals 表
  - 审批超时处理
  - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5_

- [x] 6.1 创建 ApprovalManager 服务
  - 在 `packages/services/projects/src/` 创建 `approval-manager.service.ts`
  - 注入依赖（db, deployments, notifications）
  - 实现基础结构
  - _Requirements: 4.1_

- [x] 6.2 实现 createApprovalRequest 方法
  - 获取审批人列表（项目管理员）
  - 为每个审批人创建一条 approval 记录
  - 发送审批通知
  - _Requirements: 4.2_

- [x] 6.3 实现 approve 和 reject 方法
  - 更新审批记录
  - 检查是否所有审批都完成
  - 如果全部批准，执行部署
  - 如果有拒绝，标记部署失败
  - 记录审计日志
  - _Requirements: 4.3, 4.4_

- [ ] 6.4 实现审批超时检查
  - 创建定时任务（每小时执行）
  - 检查超过 24 小时未响应的审批
  - 自动拒绝超时的审批
  - 发送通知
  - _Requirements: 4.5_

- [x] 7. Event Bus 集成
  - 实现事件发布和订阅
  - 集成 Queue Service
  - 事件处理器
  - _Requirements: 11.1, 11.2, 11.3, 11.4, 11.5_

- [x] 7.1 实现事件发布逻辑                           
  - 在 ProjectOrchestrator 中实现 publishEvent 方法
  - 发布到 Queue Service
  - 记录到 project_events 表
  - _Requirements: 11.1, 11.2_

- [x] 7.2 实现事件订阅逻辑
  - 在 ProjectOrchestrator 中实现 subscribeToEvents 方法
  - 订阅 deployment.completed 事件
  - 订阅 gitops.sync.status 事件
  - 订阅 environment.updated 事件
  - _Requirements: 11.3, 11.4, 11.5_

- [x] 7.3 实现事件处理器
  - 实现 handleDeploymentCompleted（更新健康度）
  - 实现 handleGitOpsSyncStatus（更新项目状态）
  - 实现 handleEnvironmentUpdated（触发重新计算）
  - _Requirements: 11.5_

- [x] 7.4 更新其他服务发布事件
  - 在 DeploymentsService 中发布 deployment.completed 事件
  - 在 FluxService 中发布 gitops.sync.status 事件
  - 在 EnvironmentsService 中发布 environment.updated 事件
  - _Requirements: 11.2, 11.4_

- [x] 8. Projects Service 更新
  - 更新现有的 ProjectsService
  - 集成新的功能模块
  - 更新 CRUD 方法
  - _Requirements: 1.1, 3.1, 5.1, 6.1_

- [x] 8.1 更新 ProjectsService
  - 在 `packages/services/projects/src/projects.service.ts` 中集成 ProjectOrchestrator
  - 更新 create 方法调用 orchestrator.createAndInitialize
  - 更新 get 方法返回完整的 ProjectStatus
  - _Requirements: 1.1, 3.1_

- [x] 8.2 添加健康度查询方法
  - 实现 getHealth 方法
  - 实现 updateHealth 方法（定时任务调用）
  - _Requirements: 5.1, 5.3_

- [x] 8.3 添加审计日志集成
  - 在所有关键操作中调用 AuditService
  - 记录项目创建、更新、删除、归档等操作
  - _Requirements: 6.1, 6.2, 6.3_

- [x] 9. API Router 更新
  - 更新 Projects Router
  - 添加 Templates Router
  - 更新 tRPC 接口
  - _Requirements: 1.1, 2.1, 3.1, 5.1_

- [x] 9.1 更新 ProjectsRouter
  - 在 `apps/api-gateway/src/routers/projects.router.ts` 更新路由
  - 添加 getStatus 端点（返回完整状态）
  - 添加 getHealth 端点（返回健康度）
  - 添加 archive 和 restore 端点
  - _Requirements: 3.1, 5.1, 10.1_

- [x] 9.2 创建 TemplatesRouter
  - 在 `apps/api-gateway/src/routers/` 创建 `templates.router.ts`
  - 实现 list, get, render, create 端点
  - 权限检查（自定义模板需要管理员权限）
  - _Requirements: 2.1, 2.2, 2.4_

- [x] 9.3 更新 app.module.ts
  - 注册新的 Router
  - 注册新的 Service
  - _Requirements: 1.1_

- [x] 10. 前端 - 项目创建向导
  - 实现多步骤向导组件
  - 模板选择界面
  - 仓库配置界面
  - 环境配置界面
  - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5_

- [x] 10.1 创建 ProjectWizard 组件
  - 在 `apps/web/src/components/` 创建 `ProjectWizard.vue`
  - 实现多步骤导航（基本信息 → 模板选择 → 仓库配置 → 环境配置 → 确认）
  - 使用 shadcn-vue 的 Stepper 组件
  - _Requirements: 7.1, 7.2_

- [x] 10.2 实现模板选择步骤
  - 创建 `TemplateSelector.vue` 组件
  - 显示模板卡片（图标、名称、描述、技术栈）
  - 支持按分类筛选
  - 显示模板预览
  - _Requirements: 7.2, 2.2_

- [x] 10.3 实现仓库配置步骤
  - 创建 `RepositoryConfig.vue` 组件
  - 支持两种模式切换（关联现有 / 创建新仓库）
  - 表单验证（URL、访问令牌）
  - _Requirements: 7.3_

- [x] 10.4 实现环境配置步骤
  - 创建 `EnvironmentConfig.vue` 组件
  - 显示模板的默认环境配置
  - 允许自定义环境变量、资源限制
  - _Requirements: 7.3_

- [x] 10.5 实现初始化进度显示
  - 创建 `InitializationProgress.vue` 组件
  - 显示 10 步初始化进度
  - 实时更新进度（轮询或 WebSocket）
  - 显示错误信息和修复建议
  - _Requirements: 7.4, 7.5_

- [x] 11. 前端 - 项目详情页面增强
  - 更新项目详情页面
  - 显示完整的资源关系
  - 显示健康度信息
  - 显示审批状态
  - _Requirements: 3.1, 3.2, 5.2, 5.3, 4.2_

- [x] 11.1 更新 ProjectDetail 组件
  - 在 `apps/web/src/views/ProjectDetail.vue` 添加新的 tab
  - 添加"资源拓扑"tab
  - 添加"健康度"tab
  - 更新"概览"tab 显示更多信息
  - _Requirements: 3.1, 5.2_

- [x] 11.2 创建资源拓扑视图
  - 创建 `ResourceTopology.vue` 组件
  - 使用图表库（如 vue-flow）显示资源关系
  - 显示环境 → GitOps 资源 → K8s 资源的层级关系
  - 支持点击查看详情
  - _Requirements: 3.2_

- [x] 11.3 创建健康度仪表板
  - 创建 `HealthDashboard.vue` 组件
  - 显示健康度评分和状态
  - 显示各项指标（部署成功率、GitOps 状态、Pod 状态）
  - 显示问题列表和建议
  - 显示健康度趋势图表
  - _Requirements: 5.2, 5.3, 5.4, 5.5_

- [x] 11.4 创建审批状态显示
  - 创建 `ApprovalStatus.vue` 组件
  - 显示待审批的部署列表
  - 显示审批进度（已批准 / 总数）
  - 提供批准和拒绝按钮
  - _Requirements: 4.2, 4.3_

- [x] 12. 前端 - Composables 更新
  - 更新 useProjects composable
  - 创建 useTemplates composable
  - 创建 useApprovals composable
  - _Requirements: 1.1, 2.1, 4.1_

- [x] 12.1 更新 useProjects
  - 在 `apps/web/src/composables/useProjects.ts` 添加新方法
  - 添加 getStatus, getHealth, archive, restore 方法
  - 更新 create 方法支持模板和仓库配置
  - _Requirements: 1.1, 3.1, 5.1, 10.1_

- [x] 12.2 创建 useTemplates
  - 在 `apps/web/src/composables/` 创建 `useTemplates.ts`
  - 实现 listTemplates, getTemplate, renderTemplate 方法
  - 实现模板筛选和搜索
  - _Requirements: 2.1, 2.2_

- [x] 12.3 创建 useApprovals
  - 在 `apps/web/src/composables/` 创建 `useApprovals.ts`
  - 实现 listPendingApprovals, approve, reject 方法
  - 实现审批状态查询
  - _Requirements: 4.1, 4.2, 4.3_

- [ ] 13. 测试
  - 单元测试
  - 集成测试
  - E2E 测试
  - _Requirements: All_

- [ ] 13.1 编写 ProjectOrchestrator 单元测试
  - 测试 createAndInitialize 方法
  - 测试错误处理和回滚
  - 测试事件发布
  - Mock 所有依赖
  - _Requirements: 1.1, 1.5_

- [ ] 13.2 编写 TemplateManager 单元测试
  - 测试模板渲染
  - 测试变量替换
  - 测试模板验证
  - _Requirements: 2.2, 2.3, 2.5_

- [ ] 13.3 编写 HealthMonitor 单元测试
  - 测试健康度计算
  - 测试问题检测
  - 测试建议生成
  - _Requirements: 5.1, 5.4, 5.5_

- [ ] 13.4 编写集成测试
  - 测试完整的项目初始化流程
  - 测试事件驱动的模块间通信
  - 测试审批流程
  - _Requirements: 1.1, 11.1, 4.1_

- [x] 14. 文档和部署
  - 更新 API 文档
  - 编写用户指南
  - 准备部署脚本
  - _Requirements: All_

- [x] 14.1 更新 API 文档
  - 在 `docs/api/` 更新 API 参考文档
  - 添加新的端点说明
  - 添加请求/响应示例
  - _Requirements: 1.1, 2.1_

- [x] 14.2 编写用户指南
  - 在 `docs/` 创建项目创建指南
  - 添加模板使用说明
  - 添加审批流程说明
  - 添加故障排查指南
  - _Requirements: 7.1, 2.1, 4.1_

- [x] 14.3 准备部署脚本
  - 编写数据库迁移脚本
  - 编写 seed 脚本（插入系统模板）
  - 更新 Kubernetes 部署配置
  - 编写部署验证脚本
  - _Requirements: 1.1, 2.1_

## 现代化工具使用建议

### 1. AI 代码生成
- 使用 GitHub Copilot 生成模板配置
- 使用 ChatGPT 生成 K8s YAML 模板
- 使用 AI 生成测试用例

### 2. 模板引擎
- 使用 Handlebars 进行 K8s 配置模板化
- 减少手动编写重复的 YAML 配置

### 3. 代码生成工具
- 使用 Drizzle Kit 自动生成数据库迁移
- 使用 tRPC 自动生成类型安全的 API 客户端

### 4. 测试工具
- 使用 Vitest 的快照测试减少测试代码
- 使用 MSW 模拟 API 请求

### 5. UI 组件库
- 使用 shadcn-vue 的预制组件减少 UI 开发
- 使用 vue-flow 快速实现资源拓扑图

## 预估工作量

- **数据库和类型定义**：1-2 天
- **后端服务实现**：5-7 天
- **前端组件开发**：4-5 天
- **测试和文档**：2-3 天

**总计：12-17 天（约 2-3 周）**

## 依赖关系

```
1. 数据库 Schema → 2. 类型定义 → 3-6. 后端服务 → 9. API Router → 10-12. 前端
                                                    ↓
                                                7. Event Bus
                                                    ↓
                                                8. Service 集成
```

## 注意事项

1. **优先级**：按照任务编号顺序执行，确保依赖关系正确
2. **测试驱动**：每完成一个服务，立即编写单元测试
3. **增量交付**：每完成一个大模块（如 Template Manager），立即集成测试
4. **代码审查**：关键模块（ProjectOrchestrator、HealthMonitor）需要代码审查
5. **性能考虑**：健康度计算可能需要缓存，避免频繁查询数据库
