# 前端核心功能 - 任务列表（按依赖关系组织）

## 开发说明

本任务列表按照功能依赖关系组织，确保：
1. 基础功能先行，避免后续返工
2. 相关功能集中开发，便于复用代码
3. 每周都有可交付的功能模块

详细的需求索引和开发顺序说明请参考 `REQUIREMENTS_INDEX.md`

## Week 1: 基础设施

- [x] 1. 配置核心基础设施
- [x] 1.1 安装和配置依赖
  - 验证 @trpc/client, @vueuse/motion, vue-sonner 已安装
  - 配置 TypeScript 路径别名
  - _需求: 1_

- [x] 1.2 创建 tRPC 客户端
  - 创建 apps/web/src/lib/trpc.ts
  - 配置 httpBatchLink 和认证 header
  - 配置全局错误处理
  - _需求: 1_

- [x] 1.3 创建 useToast 组合式函数
  - 创建 apps/web/src/composables/useToast.ts
  - 在 App.vue 中添加 Toaster 组件
  - 测试 Toast 通知
  - _需求: 2_

- [x] 1.4 完善认证功能
  - 更新 apps/web/src/stores/auth.ts
  - 优化 apps/web/src/views/Login.vue
  - 配置路由守卫
  - 添加页面过渡动画
  - _需求: 3, 4, 18_

## Week 2: 组织和团队管理

- [x] 2. 实现组织管理完整流程
- [x] 2.1 创建 useOrganizations 组合式函数
  - 创建 apps/web/src/composables/useOrganizations.ts
  - 实现 CRUD 操作
  - 集成 Toast 通知
  - _需求: 5_

- [x] 2.2 开发组织列表页面
  - 创建 apps/web/src/views/Organizations.vue
  - 创建 OrganizationCard 组件
  - 创建 CreateOrganizationModal 组件
  - 添加卡片悬停动画
  - _需求: 6, 19_

- [x] 2.3 开发组织详情页面
  - 创建 apps/web/src/views/OrganizationDetail.vue
  - 创建 OrganizationMemberTable 组件
  - 使用 Tabs 组件（概览、成员、团队、设置）
  - _需求: 7_

- [x] 2.4 创建组织切换器
  - 创建 OrganizationSwitcher 组件
  - 集成到 AppLayout
  - 更新 App Store
  - _需求: 8_

- [x] 2.5 实现团队管理
  - 创建 useTeams 组合式函数
  - 创建 apps/web/src/views/Teams.vue
  - 创建团队卡片和表单组件
  - 在组织详情页集成团队标签
  - _需求: 38, 39_

## Week 3: 项目和仓库管理

- [ ] 3. 实现项目管理完整流程
- [x] 3.1 创建 useProjects 组合式函数
  - 创建 apps/web/src/composables/useProjects.ts
  - 实现 CRUD 操作
  - 支持按组织筛选
  - _需求: 9_

- [x] 3.2 优化项目卡片和表单
  - 更新 ProjectCard 组件
  - 更新 CreateProjectModal 组件
  - 使用 vee-validate + Zod 验证
  - _需求: 11, 13, 32_

- [x] 3.3 开发项目列表页面
  - 创建 apps/web/src/views/Projects.vue
  - 实现搜索和筛选
  - 添加交错进入动画
  - _需求: 10, 19, 34_

- [x] 3.4 开发项目详情页面
  - 创建 apps/web/src/views/ProjectDetail.vue
  - 使用 Tabs 组件（概览、仓库、环境、Pipeline、部署、成员、设置）
  - 创建 ProjectStats 组件
  - _需求: 12_

- [x] 3.5 实现仓库管理
  - 创建 useRepositories 组合式函数
  - 创建 apps/web/src/views/Repositories.vue
  - 在项目详情页集成仓库标签
  - 显示仓库同步状态
  - _需求: 36, 37_

## Week 4: 环境和模板配置

- [ ] 4. 实现环境管理和模板生成
- [x] 4.1 创建 useEnvironments 组合式函数
  - 创建 apps/web/src/composables/useEnvironments.ts
  - 实现 CRUD 操作
  - _需求: 14_

- [x] 4.2 开发环境管理页面
  - 创建 apps/web/src/views/Environments.vue
  - 创建 EnvironmentCard 组件
  - 创建 EnvironmentStatusBadge 组件
  - 在项目详情页集成环境标签
  - _需求: 15, 16_

- [x] 4.3 实现模板生成功能
  - 创建 useTemplates 组合式函数
  - 创建 apps/web/src/views/Templates.vue
  - 使用 Code 组件预览模板
  - 实现复制和下载功能
  - _需求: 51, 52_

## Week 5-6: CI/CD 流程

- [ ] 5. 实现 Pipeline 管理
- [x] 5.1 创建 usePipelines 组合式函数
  - 创建 apps/web/src/composables/usePipelines.ts
  - 实现 CRUD 和触发操作
  - 实现 streamLogs subscription
  - 实现 watchRun subscription
  - _需求: 17, 30_

- [x] 5.2 开发 Pipeline 列表页面
  - 创建 apps/web/src/views/Pipelines.vue
  - 创建 PipelineTable 组件
  - 创建 PipelineStatusBadge 组件
  - 在项目详情页集成 Pipeline 标签
  - _需求: 18, 20_

- [x] 5.3 开发 Pipeline 运行详情页面
  - 创建 apps/web/src/views/PipelineRun.vue
  - 创建 PipelineLogViewer 组件
  - 实现实时日志订阅
  - 实现实时状态订阅
  - 添加日志滚动动画
  - _需求: 19, 20, 30_

- [ ] 6. 实现部署管理
- [x] 6.1 创建 useDeployments 组合式函数
  - 创建 apps/web/src/composables/useDeployments.ts
  - 实现 CRUD 和审批操作
  - _需求: 21_

- [x] 6.2 开发部署列表页面
  - 创建 apps/web/src/views/Deployments.vue
  - 创建 DeploymentTable 组件
  - 创建 DeploymentStatusBadge 组件
  - 实现环境筛选
  - 在项目详情页集成部署标签
  - _需求: 22_

- [x] 6.3 开发部署详情页面
  - 创建 apps/web/src/views/DeploymentDetail.vue
  - 创建 DeploymentTimeline 组件
  - 创建 DeploymentApprovalCard 组件
  - 实现审批功能
  - _需求: 23_

- [x] 6.4 开发 Dashboard 页面
  - 更新 apps/web/src/views/Dashboard.vue
  - 创建 StatsCard 组件
  - 显示项目、部署、Pipeline、成本统计
  - 添加页面进入动画
  - _需求: 8, 18_

## Week 7: 通知和可观测性

- [x] 7. 实现通知系统
- [x] 7.1 创建 useNotifications 组合式函数
  - 创建 apps/web/src/composables/useNotifications.ts
  - 实现标记已读和删除
  - 计算未读数量
  - _需求: 44_

- [x] 7.2 开发通知中心页面
  - 创建 apps/web/src/views/Notifications.vue
  - 在导航栏显示未读数量
  - 实现通知列表和操作
  - _需求: 45_

- [x] 8. 实现可观测性功能
- [x] 8.1 开发可观测性仪表板
  - 创建 apps/web/src/views/Observability.vue
  - 使用 Tabs 切换 Metrics/Traces/Logs
  - 嵌入 Grafana iframe
  - 嵌入 Jaeger iframe
  - _需求: 48, 49_

- [x] 8.2 开发监控告警页面
  - 创建 apps/web/src/views/Alerts.vue
  - 显示 Prometheus 告警
  - 实现告警静默和确认
  - _需求: 50_

## Week 8: 安全和审计

- [ ] 9. 实现安全管理
- [x] 9.1 创建 useSecurityPolicies 组合式函数
  - 创建 apps/web/src/composables/useSecurityPolicies.ts
  - 实现 CRUD 操作
  - _需求: 40_

- [x] 9.2 开发安全策略页面
  - 创建 apps/web/src/views/SecurityPolicies.vue
  - 实现 JSONB 规则编辑器
  - 显示策略违规记录
  - _需求: 41_

- [ ] 10. 实现审计日志
- [x] 10.1 创建 useAuditLogs 组合式函数
  - 创建 apps/web/src/composables/useAuditLogs.ts
  - 实现搜索和筛选
  - 实现导出功能
  - _需求: 42_

- [x] 10.2 开发审计日志页面
  - 创建 apps/web/src/views/AuditLogs.vue
  - 实现高级筛选
  - 实现日志导出
  - _需求: 43, 34_

## Week 9: 成本和 AI

- [ ] 11. 实现成本追踪
- [x] 11.1 开发成本追踪详情页面
  - 创建 apps/web/src/views/CostTracking.vue
  - 使用图表组件显示趋势
  - 显示成本分类和预算告警
  - _需求: 53_

- [ ] 12. 实现 AI 助手
- [x] 12.1 创建 useAIAssistants 组合式函数
  - 创建 apps/web/src/composables/useAIAssistants.ts
  - 实现对话和评分
  - 管理消息历史
  - _需求: 46_

- [x] 12.2 开发 AI 助手页面
  - 创建 apps/web/src/views/AIAssistants.vue
  - 实现对话界面
  - 支持流式响应
  - 实现评分功能
  - _需求: 47_

## 横切关注点（贯穿所有阶段）

- [ ] 13. 共享组件和优化
- [x] 13.1 创建共享状态组件
  - 创建 EmptyState 组件
  - 创建 LoadingState 组件
  - 创建 ErrorState 组件
  - 创建 ConfirmDialog 组件
  - _需求: 27, 28_

- [x] 13.2 实现性能优化
  - 配置路由懒加载
  - 添加 tRPC 缓存配置
  - 对大列表使用虚拟滚动
  - 使用 useDebounceFn 优化搜索
  - _需求: 29_

- [x] 13.3 实现响应式设计
  - 优化移动端布局
  - 使用 Sheet 组件实现抽屉导航
  - 优化卡片网格响应式
  - _需求: 26_

- [x] 13.4 完善主题系统
  - 在 AppLayout 中集成主题切换器
  - 验证所有组件支持多主题
  - 优化主题切换动画
  - _需求: 31_

- [x] 13.5 实现数据持久化
  - 配置 Pinia 持久化
  - 持久化认证 Token
  - 持久化当前组织
  - 持久化用户偏好
  - _需求: 33_

## 测试和文档（可选）

- [ ]* 14. 编写测试
- [ ]* 14.1 编写组合式函数测试
  - 测试核心组合式函数
  - 测试 API 调用和错误处理
  - _需求: 无_

- [ ]* 14.2 编写组件测试
  - 测试关键业务组件
  - 测试表单验证
  - 测试用户交互
  - _需求: 无_

- [ ] 14.3 编写开发文档
  - 编写组件使用文档
  - 编写组合式函数文档
  - 编写开发指南
  - _需求: 无_

## 任务统计

- **总任务数**: 14 个主任务
- **子任务数**: 70+ 个子任务
- **预计工期**: 9 周
- **技术栈**: Vue 3 + shadcn-vue + tRPC + Tailwind CSS 4

## 开发里程碑

**Week 1**: ✅ 可以登录和调用 API
**Week 2**: ✅ 可以管理组织和团队
**Week 3**: ✅ 可以创建项目和连接仓库
**Week 4**: ✅ 可以配置环境和生成配置
**Week 5-6**: ✅ 可以运行 Pipeline 和部署
**Week 7**: ✅ 可以查看监控和接收通知
**Week 8**: ✅ 可以管理安全策略和查看日志
**Week 9**: ✅ 可以查看成本和使用 AI 助手

## 开发建议

1. **严格按周执行** - 每周完成一个里程碑
2. **及时复用代码** - 相似组件抽象为共享组件
3. **持续集成测试** - 每完成一个模块就测试
4. **注重用户体验** - 动画和加载状态同步实现
5. **保持代码质量** - 统一的错误处理和通知
