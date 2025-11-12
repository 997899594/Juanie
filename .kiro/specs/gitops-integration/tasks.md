# GitOps 集成 - 实施任务列表（精简版）

## 项目概述

基于现有 AI DevOps 平台架构，实现双向 GitOps 集成。只新增 1 个表，扩展 3 个现有表，最小化侵入，最大化复用。

**核心创新**: 双向 GitOps - UI 操作自动生成 Git commit，Git push 自动触发部署。

## 数据库变更总结

- ✅ 新增 1 个表：`gitops_resources`
- ✅ 扩展 3 个表：`repositories`、`deployments`、`environments`
- ✅ 复用 2 个表：`audit_logs`、`notifications`

## 阶段 1: 数据库 Schema 变更

- [x] 1. 数据库 Schema 设计和迁移
- [x] 1.1 创建 gitops_resources 表
  - 创建 packages/core/database/src/schemas/gitops-resources.schema.ts
  - 定义表结构（projectId、environmentId、repositoryId、type、config JSONB）
  - 添加索引和外键约束
  - 导出类型定义
  - _需求: 3.1, 3.2, 3.3, 3.4, 3.5_

- [x] 1.2 扩展 repositories 表
  - 修改 packages/core/database/src/schemas/repositories.schema.ts
  - 添加 gitopsConfig (JSONB) 字段
  - 添加 fluxSyncStatus、fluxLastSyncCommit、fluxLastSyncTime 字段
  - 添加 fluxErrorMessage 字段
  - 更新类型定义
  - _需求: 2.1, 2.2, 2.3, 2.4, 2.5_

- [x] 1.3 扩展 deployments 表
  - 修改 packages/core/database/src/schemas/deployments.schema.ts
  - 添加 gitopsResourceId (uuid, nullable) 字段
  - 添加 deploymentMethod (text, default 'manual') 字段
  - 添加 gitCommitSha (text, nullable) 字段
  - 更新类型定义
  - _需求: 6.1, 6.2, 6.3, 6.4, 6.5_

- [x] 1.4 扩展 environments 表的 config JSONB
  - 修改 packages/core/database/src/schemas/environments.schema.ts
  - 在 config JSONB 类型中添加 gitops 配置
  - 包含：enabled、autoSync、gitBranch、gitPath、syncInterval
  - 更新类型定义
  - _需求: 8.1, 8.2, 8.3, 8.4, 8.5_

- [x] 1.5 生成和执行数据库迁移
  - 运行 drizzle-kit generate
  - 审查生成的迁移文件
  - 在开发环境测试迁移
  - 运行 drizzle-kit migrate
  - 验证所有表和字段创建成功
  - _需求: 所有_

## 阶段 2: Flux 核心服务

- [x] 2. 创建 Flux Service 模块
- [x] 2.1 创建基础模块结构
  - 创建 packages/services/flux 目录
  - 创建 flux.module.ts
  - 创建 flux.service.ts
  - 配置依赖注入（注入 K3sService）
  - _需求: 1.1, 1.2, 1.3, 1.4, 1.5_

- [x] 2.2 安装 Flux CLI 依赖
  - 在 Dockerfile 中添加 Flux CLI 安装脚本
  - 创建 flux-cli.service.ts 封装 CLI 调用
  - 实现 installFlux 方法（使用 flux install 命令）
  - 实现 checkFluxHealth 方法
  - 实现 uninstallFlux 方法
  - _需求: 1.1, 1.2, 1.3, 1.4, 1.5_

- [x] 2.3 实现 Flux 资源 YAML 生成
  - 创建 yaml-generator.service.ts
  - 实现 generateGitRepositoryYAML 方法
  - 实现 generateKustomizationYAML 方法
  - 实现 generateHelmReleaseYAML 方法
  - 使用 yaml 库保持格式和注释
  - _需求: 3.1, 3.2, 3.3, 3.4, 3.5_

- [x] 2.4 实现 GitOps 资源管理
  - 实现 createGitOpsResource 方法
  - 实现 listGitOpsResources 方法
  - 实现 getGitOpsResource 方法
  - 实现 updateGitOpsResource 方法
  - 实现 deleteGitOpsResource 方法（软删除）
  - 生成 YAML 并应用到 K3s
  - _需求: 3.1, 3.2, 3.3, 3.4, 3.5_

- [x] 2.5 实现 Flux 事件监听
  - 创建 flux-watcher.service.ts
  - 使用 K8s Watch API 监听 Flux 资源
  - 监听 GitRepository、Kustomization、HelmRelease 事件
  - 解析事件并更新数据库状态
  - 实现自动重连机制
  - _需求: 5.1, 5.2, 5.3, 5.4, 5.5_

## 阶段 3: Git 操作服务（双向核心）

- [x] 3. 创建 Git Operations Service
- [x] 3.1 创建 GitOps Service 模块
  - 创建 packages/services/git-ops 目录
  - 创建 git-ops.module.ts
  - 创建 git-ops.service.ts
  - 安装 simple-git npm 包
  - 安装 yaml npm 包
  - _需求: 4.1, 4.2, 4.3, 4.4, 4.5_

- [x] 3.2 实现 Git 仓库操作
  - 实现 initRepository 方法（clone/pull）
  - 实现 checkoutBranch 方法
  - 实现 pullLatest 方法
  - 配置 Git 凭证管理（使用 K8s Secret）
  - _需求: 2.2, 2.3, 4.1, 4.2_

- [x] 3.3 实现 UI → Git 转换（核心功能）
  - 实现 commitFromUI 方法
  - 接收 UI 配置（image、replicas、env 等）
  - 生成或更新 K8s YAML 文件
  - 智能更新（保留注释和格式）
  - 生成友好的 commit 消息
  - Push 到远程仓库
  - _需求: 4.1, 4.2, 4.3, 4.4, 4.5_

- [x] 3.4 实现 YAML 智能更新
  - 读取现有 YAML 文件
  - 使用 yaml 库解析
  - 更新指定字段（image、replicas、env、resources）
  - 保留原有格式、注释、空行
  - 验证 YAML 语法
  - _需求: 4.2, 4.3, 15.1, 15.2, 15.3_

- [x] 3.5 实现冲突检测和解决
  - 检测并发编辑冲突
  - 实现自动合并策略（非重叠字段）
  - 实现智能合并
  - 提供冲突详情给 UI
  - _需求: 4.1, 4.2_

## 阶段 4: 扩展现有服务

- [x] 4. 扩展 Repositories Service
- [x] 4.1 添加 GitOps 相关方法
  - 在 packages/services/repositories 中添加方法
  - 实现 enableGitOps 方法（更新 gitopsConfig）
  - 实现 disableGitOps 方法
  - 实现 getFluxStatus 方法
  - 实现 updateFluxStatus 方法（由 Watcher 调用）
  - _需求: 2.1, 2.2, 2.3, 2.4, 2.5_

- [x] 5. 扩展 Deployments Service
- [x] 5.1 添加 GitOps 部署方法
  - 在 packages/services/deployments 中添加方法
  - 实现 deployWithGitOps 方法
  - 调用 GitOpsService.commitFromUI
  - 创建 deployment 记录（deploymentMethod: 'gitops-ui'）
  - 关联 gitopsResourceId
  - 复用现有审批流程
  - _需求: 4.1, 4.2, 4.3, 4.4, 4.5, 6.1, 6.2, 6.3_

- [x] 5.2 实现 Git → Deployment 记录
  - 监听 Flux 事件
  - 当 Flux 完成 reconciliation 时创建 deployment 记录
  - deploymentMethod: 'gitops-git'
  - 提取 commit SHA 和版本信息
  - _需求: 5.1, 5.2, 5.3, 5.4, 5.5, 6.1, 6.2_

- [x] 6. 扩展 Environments Service
- [x] 6.1 添加 GitOps 配置方法
  - 在 packages/services/environments 中添加方法
  - 实现 configureGitOps 方法（更新 config.gitops）
  - 实现 getGitOpsConfig 方法
  - 验证 Git 分支和路径存在
  - _需求: 8.1, 8.2, 8.3, 8.4, 8.5_

## 阶段 5: API 路由实现

- [x] 7. 创建 GitOps tRPC Router
- [x] 7.1 创建基础路由
  - 创建 apps/api-gateway/src/routers/gitops.router.ts
  - 定义 Zod schemas
  - 配置权限中间件（复用现有）
  - 注册到主路由（trpc.router.ts）
  - _需求: 13.1, 13.2, 13.3_

- [x] 7.2 实现 Flux 管理 API
  - installFlux endpoint
  - checkFluxHealth endpoint
  - uninstallFlux endpoint
  - _需求: 1.1, 1.2, 1.3, 1.4, 1.5_

- [x] 7.3 实现 GitOps 资源 API
  - createGitOpsResource endpoint
  - listGitOpsResources endpoint
  - getGitOpsResource endpoint
  - updateGitOpsResource endpoint
  - deleteGitOpsResource endpoint
  - triggerSync endpoint（手动触发）
  - _需求: 3.1, 3.2, 3.3, 3.4, 3.5, 10.1, 10.2, 10.3_

- [x] 7.4 实现双向部署 API（核心）
  - deployWithGitOps endpoint
  - commitConfigChanges endpoint
  - previewChanges endpoint（变更预览）
  - validateYAML endpoint
  - _需求: 4.1, 4.2, 4.3, 4.4, 4.5, 10.1, 10.2, 10.3_

- [x] 8. 扩展现有 Router
- [x] 8.1 扩展 Repositories Router
  - 在 apps/api-gateway/src/routers/repositories.router.ts 中添加
  - enableGitOps endpoint
  - getFluxStatus endpoint
  - _需求: 2.1, 2.2, 2.3, 2.4, 2.5_

- [x] 8.2 扩展 Deployments Router
  - 在 apps/api-gateway/src/routers/deployments.router.ts 中添加
  - 保持现有 create endpoint 不变
  - 新增 deployWithGitOps endpoint
  - 在 list 和 get 中返回 GitOps 相关字段
  - _需求: 6.1, 6.2, 6.3, 6.4, 6.5_

- [x] 8.3 扩展 Environments Router
  - 在 apps/api-gateway/src/routers/environments.router.ts 中添加
  - configureGitOps endpoint
  - getGitOpsConfig endpoint
  - _需求: 8.1, 8.2, 8.3, 8.4, 8.5_

## 阶段 6: 前端 UI 实现

- [x] 9. 创建 GitOps 管理页面
- [x] 9.1 创建 GitOps 设置页面
  - 创建 apps/web/src/views/gitops/GitOpsSettings.vue
  - 显示 Flux 安装状态
  - 提供安装/卸载按钮
  - 显示组件健康状态
  - 使用现有 UI 组件库
  - _需求: 1.1, 1.2, 1.3, 1.4, 1.5_

- [x] 9.2 创建 GitOps 资源列表页面
  - 创建 apps/web/src/views/gitops/GitOpsResources.vue
  - 显示项目的所有 GitOps 资源
  - 显示 reconciliation 状态
  - 提供手动同步按钮
  - 显示最后同步时间
  - _需求: 3.1, 3.2, 3.3, 3.5, 9.1, 9.2, 9.3_

- [x] 10. 扩展现有页面
- [x] 10.1 扩展 Repositories 页面
  - 修改 apps/web/src/views/Repositories.vue
  - 添加 GitOps 启用开关
  - 显示 Flux 同步状态徽章
  - 显示最后同步时间
  - 复用现有组件样式
  - _需求: 2.1, 2.2, 2.3, 2.4, 2.5_

- [x] 10.2 扩展 Deployments 页面
  - 修改 apps/web/src/views/Deployments.vue
  - 显示部署方式标识（manual/gitops-ui/gitops-git）
  - 显示 Git commit 信息（如果是 GitOps）
  - 添加 Git commit 链接
  - 复用现有部署卡片组件
  - _需求: 6.1, 6.2, 6.3, 6.4, 6.5, 9.1, 9.2_

- [x] 10.3 扩展 Environments 页面
  - 修改 apps/web/src/views/Environments.vue
  - 添加 GitOps 配置选项卡
  - 配置 Git 分支和路径
  - 配置自动同步开关
  - 显示环境的 GitOps 状态
  - _需求: 8.1, 8.2, 8.3, 8.4, 8.5_

- [x] 11. 创建双向部署对话框（核心 UI）
- [x] 11.1 创建部署对话框组件
  - 创建 apps/web/src/components/GitOpsDeployDialog.vue
  - 可视化表单（镜像、副本数、环境变量、资源限制）
  - 实时 YAML 预览
  - 变更对比视图（Diff Editor）
  - Commit 消息输入
  - GitOps 模式提示
  - _需求: 4.1, 4.2, 4.3, 4.4, 4.5, 9.1, 9.2, 10.1, 10.2_

- [x] 11.2 创建部署进度追踪组件
  - 创建 apps/web/src/components/GitOpsDeploymentProgress.vue
  - 显示 4 步流程（Commit → Flux → K8s → Health）
  - 实时状态更新（WebSocket 或轮询）
  - 错误提示和重试
  - 复用现有进度组件样式
  - _需求: 9.1, 9.2, 9.3, 9.4, 9.5, 10.4_

- [x] 11.3 创建可视化配置编辑器
  - 创建 apps/web/src/components/GitOpsConfigEditor.vue
  - 标签页：可视化 / YAML / Diff
  - 集成 Monaco Editor（YAML 编辑）
  - 集成 Diff Editor（变更对比）
  - 表单验证
  - _需求: 9.1, 9.2, 9.3, 9.4, 9.5, 15.1, 15.2_

## 阶段 7: 监控和可观测性

- [x] 12. 实现 GitOps 监控
- [x] 12.1 配置 Prometheus 指标
  - 在 FluxService 中添加指标收集
  - 收集 Flux 同步指标
  - 收集 Git 操作指标
  - 收集部署成功率
  - 暴露到现有 /metrics 端点
  - _需求: 12.1, 12.2, 12.3, 12.4, 12.5_

- [x] 12.2 创建 Grafana 仪表板
  - 创建 monitoring/dashboards/gitops.json
  - GitRepository 同步成功率面板
  - Kustomization 应用延迟面板
  - Flux 错误率面板
  - 活跃 GitOps 资源数面板
  - _需求: 12.1, 12.2, 12.3, 12.4, 12.5_

- [x] 12.3 配置告警规则
  - 在 monitoring/alerts.yml 中添加规则
  - Flux 同步失败告警
  - 高错误率告警
  - 组件不健康告警
  - 集成到现有通知系统
  - _需求: 1.4, 12.3, 12.4, 12.5, 14.1, 14.2_

## 阶段 8: 测试

- [ ] 13. 编写测试
- [ ] 13.1 编写 Flux Service 单元测试
  - 测试 Flux 安装
  - 测试资源创建
  - 测试 YAML 生成
  - 测试状态更新
  - _需求: 所有_

- [ ] 13.2 编写 GitOps Service 单元测试
  - 测试 Git 操作
  - 测试 YAML 更新
  - 测试 commit 生成
  - 测试冲突解决
  - _需求: 所有_

- [ ] 13.3 编写集成测试
  - 测试完整 GitOps 流程（UI → Git → Flux → K8s）
  - 测试双向同步
  - 测试多环境部署
  - 测试审批流程集成
  - _需求: 所有_

- [ ] 13.4 编写 E2E 测试
  - 测试 UI 部署流程
  - 测试 Git push 触发部署
  - 测试回滚流程
  - _需求: 所有_

## 阶段 9: 文档和部署

- [-] 14. 编写文档
- [x] 14.1 更新 API 文档
  - 文档化新增的 GitOps API
  - 文档化扩展的现有 API
  - 提供 API 使用示例
  - _需求: 所有_

- [x] 14.2 编写用户文档
  - GitOps 快速入门指南
  - UI 操作指南
  - Git 工作流指南
  - 故障排查指南
  - _需求: 22.1, 22.2, 22.3, 22.4, 22.5_

- [ ] 14.3 更新部署文档
  - 更新 Docker Compose 配置
  - 更新环境变量文档
  - 添加 Flux 安装说明
  - _需求: 1.1, 1.2, 1.3_

## 任务统计

- **总任务数**: 14 个主任务
- **子任务数**: 60+ 个子任务
- **预计工期**: 4-6 周
- **新增表数**: 1 个
- **扩展表数**: 3 个

## 开发优先级

### P0 (核心功能，必须完成)
- 阶段 1: 数据库 Schema 变更
- 阶段 2: Flux 核心服务
- 阶段 3: Git 操作服务（双向核心）
- 阶段 4: 扩展现有服务
- 阶段 5: API 路由实现

### P1 (重要功能，尽快完成)
- 阶段 6: 前端 UI 实现
- 阶段 7: 监控和可观测性
- 阶段 8: 测试

### P2 (文档和优化，可后续迭代)
- 阶段 9: 文档和部署

## 架构优势

✅ **最小化侵入**: 只新增 1 个表，扩展 3 个表
✅ **完全集成**: 复用现有服务、路由、UI 组件
✅ **向后兼容**: 不影响现有功能
✅ **双向 GitOps**: UI 和 Git 都支持
✅ **渐进式采用**: 用户可选择是否启用

## 成功标准

✅ 用户可以通过 UI 按钮部署，无需了解 Git
✅ 开发者可以直接 push 代码触发部署
✅ 所有操作都记录在 Git 历史中
✅ 支持多环境独立配置和审批
✅ 实时显示部署进度和状态
✅ 完整的监控和告警
✅ 与现有系统无缝集成
