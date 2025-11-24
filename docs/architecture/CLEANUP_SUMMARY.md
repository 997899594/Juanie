# 鸡肋功能清理总结

## 执行日期
2024-11-24

## 删除的功能

### Flux 安装/卸载功能

**原因**：
- 安全风险：Web 应用不应有权限安装系统级组件
- 权限问题：需要 cluster-admin 级别权限
- 一次性操作：Flux 只需安装一次
- 运维习惯：运维人员更习惯命令行操作

**删除的代码**：
1. `FluxService.installFlux()` - 安装方法
2. `FluxService.uninstallFlux()` - 卸载方法
3. `gitops.router.ts` - installFlux/uninstallFlux/checkFluxHealth 路由
4. `useGitOps.ts` - 前端调用方法
5. `GitOpsSettings.vue` - 整个设置页面
6. `Onboarding.vue` - 引导页面
7. `Settings.vue` - Flux 安装部分

**新增文档**：
- `docs/guides/flux-installation.md` - Flux 手动安装指南

## 检查结果

未发现其他明显的鸡肋功能：
- ✅ 无 K3s 安装功能
- ✅ 无数据库管理功能  
- ✅ 无 SSH/服务器管理功能
- ✅ 无 Prometheus/Grafana 安装功能

## 构建结果

```bash
✅ 所有 16 个包构建成功
Tasks:    16 successful, 16 total
```

## 架构改进

**之前**：平台试图管理基础设施安装
**之后**：平台专注于应用层 GitOps 管理

## 用户影响

- 需要预先手动安装 Flux（一次性操作）
- 更安全的权限模型
- 更符合实际运维流程

---

**状态**：✅ 清理完成，构建通过
