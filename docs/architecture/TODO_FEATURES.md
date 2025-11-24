# 待实现功能清单

## 高优先级功能

### 1. 项目健康度监控

**文件**: `packages/services/business/src/projects/health-monitor.service.ts`

**状态**: 🟡 部分实现（仅返回默认值）

**功能描述**:
- 实时监控项目健康状态
- 部署成功率统计
- GitOps 同步状态检查
- Pod 健康状态监控
- 资源使用率分析
- 自动生成优化建议

**依赖**:
- Prometheus 指标收集
- K8s API 集成
- 历史数据分析引擎

**实现步骤**:
1. [ ] 集成 Prometheus 客户端
2. [ ] 实现部署历史查询
3. [ ] 实现 GitOps 状态检查
4. [ ] 实现 Pod 健康检查
5. [ ] 设计健康度评分算法
6. [ ] 实现问题检测逻辑
7. [ ] 实现优化建议生成
8. [ ] 添加定时任务更新健康度
9. [ ] 添加健康度告警

**预估工作量**: 2-3 周

---

### 2. 部署审批流程

**文件**: `packages/services/business/src/projects/approval-manager.service.ts`

**状态**: 🔴 未实现

**功能描述**:
- 创建部署审批请求
- 多级审批流程
- 审批/拒绝部署
- 审批历史记录
- 审批通知（邮件、Slack、站内信）
- 自动审批规则

**依赖**:
- 权限系统（RBAC）
- 通知服务
- 审批工作流引擎
- 数据库 Schema（approvals 表）

**实现步骤**:
1. [ ] 设计审批数据库 Schema
2. [ ] 实现审批请求创建
3. [ ] 实现审批者确定逻辑
4. [ ] 实现审批/拒绝功能
5. [ ] 集成通知服务
6. [ ] 实现多级审批流程
7. [ ] 实现自动审批规则
8. [ ] 添加审批历史查询
9. [ ] 前端审批界面

**预估工作量**: 3-4 周

---

## 中优先级功能

### 3. 一键部署

**状态**: 🔴 已删除（功能被 ProjectWizard 取代）

**评估**: 
- 当前通过 ProjectWizard 实现项目创建和初始化
- 如果需要更简化的部署流程，可以重新实现
- 建议：先观察用户反馈，再决定是否需要

---

### 4. 进度追踪服务

**状态**: 🔴 已删除（功能被 BullMQ + SSE 取代）

**评估**:
- 当前通过 BullMQ 的 job progress + SSE 实现实时进度
- 独立的 ProgressTrackerService 可能提供更灵活的追踪
- 建议：当前方案足够，暂不需要

---

## 低优先级功能

### 5. 前端组件

以下组件已删除，如需要可以重新实现：

- **ProjectOverview.vue** - 独立的项目概览页面
  - 当前：ProjectDetail 的 Overview Tab
  - 建议：观察用户体验，如果 Tab 不够用再实现

- **ProjectSettings.vue** - 独立的项目设置页面
  - 当前：ProjectDetail 的 Settings Tab + EditProjectModal
  - 建议：观察用户体验，如果 Tab 不够用再实现

- **ApprovalStatus.vue** - 审批状态显示组件
  - 依赖：ApprovalManagerService
  - 建议：等审批功能实现后再添加

---

## 实现优先级建议

### Phase 1: 基础监控（1-2 个月）
1. ✅ 项目创建和初始化（已完成）
2. ✅ GitOps 资源管理（已完成）
3. 🟡 项目健康度监控（部分完成）
   - 先实现基础指标收集
   - 后续添加高级分析

### Phase 2: 企业级功能（2-3 个月）
1. 🔴 部署审批流程
   - 企业客户必需功能
   - 需要完整的权限系统支持
2. 🔴 审批通知系统
3. 🔴 审批历史和审计

### Phase 3: 优化和增强（持续）
1. 健康度告警
2. 自动优化建议
3. 成本分析
4. 性能优化建议

---

## 技术债务

### 当前占位实现

**ProjectStatusService.getHealth()**:
```typescript
// 临时实现，返回固定值
return {
  score: 100,
  status: 'healthy',
  // ...
}
```

**建议**: 
- 短期：保持当前实现，不影响功能
- 中期：集成 HealthMonitorService
- 长期：实现完整的监控系统

---

## 如何贡献

如果你想实现这些功能：

1. 查看对应的服务文件中的 TODO 注释
2. 阅读功能描述和实现步骤
3. 创建 feature branch
4. 实现功能并添加测试
5. 提交 PR

---

## 相关文档

- [架构设计](./architecture.md)
- [服务架构](./service-architecture-review.md)
- [清理决策](./CLEANUP_DECISION.md)
