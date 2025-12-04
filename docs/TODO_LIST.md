# TODO 列表

> 自动生成于: 2025-12-03 18:26:36

## 统计

- TODO:       88
- FIXME:        0
- HACK:        0
- XXX:        0
- **总计**: 88

---

## TODO 列表

### 待办事项 (TODO)

- apps/api-gateway/src/routers/gitops.router.ts:237:          // TODO: 实现 GitOps 部署逻辑
- apps/api-gateway/src/routers/gitops.router.ts:261:          // TODO: 实现配置提交逻辑
- apps/api-gateway/src/routers/gitops.router.ts:281:          // TODO: 实现变更预览逻辑
- apps/api-gateway/src/routers/gitops.router.ts:283:            diff: '# 配置变更预览\n# TODO: 实现实际的 diff',
- apps/api-gateway/src/routers/deployments.router.ts:99:          // TODO: 实现获取项目部署列表的逻辑
- apps/api-gateway/src/routers/deployments.router.ts:124:          // TODO: 实现获取部署统计的逻辑
- apps/api-gateway/src/routers/projects.router.ts:487:          // TODO: 实现获取最近活动的逻辑
- apps/api-gateway/src/routers/projects.router.ts:512:          // TODO: 实现更新部署设置的逻辑
- apps/web/src/composables/useTemplates.ts:317:      // TODO: 调用 AI 服务生成 Dockerfile
- apps/web/src/composables/useTemplates.ts:332:      // TODO: 调用 AI 服务生成 CI/CD 配置
- apps/web/src/composables/useSecurityPolicies.ts:181:   * TODO: API 暂不支持更新 status 字段
- apps/web/src/stores/workspace.ts:85:      // TODO: 实现 API 调用
- apps/web/src/stores/workspace.ts:128:    // TODO: 刷新项目列表等
- apps/web/src/stores/workspace.ts:132:    // TODO: 实现创建组织
- apps/web/src/components/AIAssistant.vue:212:      // TODO: 显示确认对话框
- apps/web/src/views/organizations/OrganizationDetail.vue:444:    // TODO: 调用同步 API
- apps/web/src/views/Deployments.vue:72:                  <!-- TODO: 需要从项目的 git 配置中构建 commit URL -->
- apps/web/src/views/ProjectDetail.vue:804:  // TODO: 实现添加成员对话框
- apps/web/src/views/ProjectDetail.vue:809:  // TODO: 实现移除成员确认对话框
- apps/web/src/views/ProjectDetail.vue:1071:    // TODO: 实现获取待审批列表的 API 调用
- apps/web/src/views/ProjectDetail.vue:1084:  // TODO: 实现快速批准逻辑
- apps/web/src/views/ProjectDetail.vue:1090:  // TODO: 实现快速拒绝逻辑
- apps/web/src/views/repositories/Repositories.vue:242:    // TODO: 获取用户的组织列表，然后获取项目
- apps/web/src/views/repositories/Repositories.vue:327:  // TODO: 导航到仓库详情页
- apps/web/src/views/Documents.vue:97:  // TODO: 实现文档编辑功能
- apps/web/src/views/Documents.vue:102:  // TODO: 实现文档创建功能
- apps/web/src/views/DeploymentDetail.vue:200:    // TODO: Fetch approvals from API
- apps/web/src/views/DeploymentDetail.vue:242:  // TODO: Implement retry logic
- packages/shared/src/ai-diagnostic.ts:27:  // TODO: 后续接入本地推理，当前返回占位结果
- packages/services/business/dist/projects/health-monitor.service.d.ts:6: * TODO: 完整实现项目健康度监控
- packages/services/business/dist/projects/health-monitor.service.d.ts:27:     * TODO: 实现完整的健康度计算逻辑
- packages/services/business/dist/projects/health-monitor.service.d.ts:50:     * TODO: 获取部署历史
- packages/services/business/dist/projects/health-monitor.service.d.ts:54:     * TODO: 计算部署成功率
- packages/services/business/dist/projects/health-monitor.service.d.ts:58:     * TODO: 检查 GitOps 同步状态
- packages/services/business/dist/projects/health-monitor.service.d.ts:62:     * TODO: 检查 Pod 健康状态
- packages/services/business/dist/projects/health-monitor.service.d.ts:66:     * TODO: 综合计算健康度评分
- packages/services/business/dist/projects/health-monitor.service.d.ts:70:     * TODO: 生成健康问题列表
- packages/services/business/dist/projects/health-monitor.service.d.ts:74:     * TODO: 生成优化建议
- packages/services/business/dist/projects/approval-manager.service.d.ts:6: * TODO: 完整实现部署审批流程
- packages/services/business/dist/projects/approval-manager.service.d.ts:28:     * TODO: 实现审批请求创建
- packages/services/business/dist/projects/approval-manager.service.d.ts:46:     * TODO: 实现审批逻辑
- packages/services/business/dist/projects/approval-manager.service.d.ts:56:     * TODO: 实现拒绝逻辑
- packages/services/business/dist/projects/approval-manager.service.d.ts:66:     * TODO: 实现待审批查询
- packages/services/business/dist/projects/approval-manager.service.d.ts:72:     * TODO: 实现审批历史查询
- packages/services/business/dist/projects/approval-manager.service.d.ts:76:     * TODO: 检查是否需要审批
- packages/services/business/dist/projects/approval-manager.service.d.ts:80:     * TODO: 确定审批者
- packages/services/business/dist/projects/approval-manager.service.d.ts:84:     * TODO: 创建审批记录
- packages/services/business/dist/projects/approval-manager.service.d.ts:88:     * TODO: 通知审批者
- packages/services/business/dist/projects/project-status.service.d.ts:23:     * TODO: 实现完整的健康度计算逻辑
- packages/services/business/dist/projects/project-status.service.d.ts:39:     * TODO: 实现完整的健康度计算逻辑
- packages/services/business/src/projects/project-status.service.ts:115:   * TODO: 实现完整的健康度计算逻辑
- packages/services/business/src/projects/project-status.service.ts:135:   * TODO: 实现完整的健康度计算逻辑
- packages/services/business/src/projects/approval-manager.service.ts:10: * TODO: 完整实现部署审批流程
- packages/services/business/src/projects/approval-manager.service.ts:34:   * TODO: 实现审批请求创建
- packages/services/business/src/projects/approval-manager.service.ts:52:    // TODO: 实现审批请求创建
- packages/services/business/src/projects/approval-manager.service.ts:68:   * TODO: 实现审批逻辑
- packages/services/business/src/projects/approval-manager.service.ts:74:    // TODO: 实现审批逻辑
- packages/services/business/src/projects/approval-manager.service.ts:87:   * TODO: 实现拒绝逻辑
- packages/services/business/src/projects/approval-manager.service.ts:93:    // TODO: 实现拒绝逻辑
- packages/services/business/src/projects/approval-manager.service.ts:105:   * TODO: 实现待审批查询
- packages/services/business/src/projects/approval-manager.service.ts:111:    // TODO: 实现待审批查询
- packages/services/business/src/projects/approval-manager.service.ts:121:   * TODO: 实现审批历史查询
- packages/services/business/src/projects/approval-manager.service.ts:127:    // TODO: 实现审批历史查询
- packages/services/business/src/projects/approval-manager.service.ts:135:   * TODO: 检查是否需要审批
- packages/services/business/src/projects/approval-manager.service.ts:144:   * TODO: 确定审批者
- packages/services/business/src/projects/approval-manager.service.ts:153:   * TODO: 创建审批记录
- packages/services/business/src/projects/approval-manager.service.ts:161:   * TODO: 通知审批者
- packages/services/business/src/projects/health-monitor.service.ts:11: * TODO: 完整实现项目健康度监控
- packages/services/business/src/projects/health-monitor.service.ts:34:   * TODO: 实现完整的健康度计算逻辑
- packages/services/business/src/projects/health-monitor.service.ts:48:    // TODO: 实现真实的健康度计算
- packages/services/business/src/projects/health-monitor.service.ts:75:   * TODO: 获取部署历史
- packages/services/business/src/projects/health-monitor.service.ts:83:   * TODO: 计算部署成功率
- packages/services/business/src/projects/health-monitor.service.ts:91:   * TODO: 检查 GitOps 同步状态
- packages/services/business/src/projects/health-monitor.service.ts:99:   * TODO: 检查 Pod 健康状态
- packages/services/business/src/projects/health-monitor.service.ts:107:   * TODO: 综合计算健康度评分
- packages/services/business/src/projects/health-monitor.service.ts:115:   * TODO: 生成健康问题列表
- packages/services/business/src/projects/health-monitor.service.ts:123:   * TODO: 生成优化建议
- packages/services/business/src/projects/index.ts:8:// TODO: 未完成的服务（暂不导出，避免误用）
- packages/services/business/src/projects/projects.service.ts:466:    // TODO: 实现 handleRepositoryOnDelete
- packages/services/business/src/gitops/git-ops/git-ops.service.ts:613:    // TODO: Implement using K3sService.getSecret()
- packages/services/business/src/gitops/flux/flux-watcher.service.ts:124:    // TODO: Implement watch using one of these approaches:
- packages/services/business/src/gitops/flux/flux-watcher.service.ts:359:    // 如果失败，可以发送通知（TODO: 集成通知服务）
- packages/services/business/src/gitops/flux/flux-watcher.service.ts:486:    // 如果失败，可以发送通知（TODO: 集成通知服务）
- packages/services/business/src/gitops/git-sync/organization-sync.service.ts:540:      // TODO: 创建 Git 组织
- packages/services/business/src/gitops/webhooks/git-platform-sync.service.ts:427:          // TODO: 更新项目的默认分支配置
- packages/services/business/src/gitops/credentials/credential-manager.service.ts:93:        'github', // TODO: 从选项中获取
- packages/services/business/src/gitops/credentials/credential-factory.ts:82:    const provider: GitProvider = 'github' // TODO: 从数据库或配置中获取
- packages/services/business/src/deployments/deployments.service.ts:396:    // 5. Record to audit log (TODO: integrate with audit service)

### 需要修复 (FIXME)


### 临时方案 (HACK)


### 需要注意 (XXX)

