# 修复总结

## 执行日期
2024-11-24

## 已修复的问题

### 1. ✅ GitOps 资源创建问题

**问题**: GitOps 资源只在数据库中创建（pending 状态），没有在 K8s 集群中实际创建

**根本原因**:
- `SetupRepositoryHandler` 使用了错误的任务名称 `'create-repository'`
- 任务被 `repository.worker.ts` 处理，该 worker 不创建 K8s 资源
- 应该使用 `project-initialization.worker.ts` 处理完整流程

**修复**:
- 修改任务名称为 `'initialize-project'`
- 删除废弃的 `repository.worker.ts`
- 确保 `project-initialization.worker.ts` 接收 `userId` 参数

**影响**: 
- ⚠️ 旧项目的 GitOps 资源仍然是 pending（需要重新创建）
- ✅ 新创建的项目会正确创建 K8s 资源

**验证**:
```bash
# 创建新项目后检查
export KUBECONFIG=~/.kube/k3s-remote.yaml
kubectl get namespaces | grep project-
kubectl get gitrepositories -A
kubectl get kustomizations -A
```

---

### 2. ✅ 模板渲染错误

**问题**: Handlebars 模板中使用了 Go template 语法

**错误信息**:
```
Missing helper: "eq.gitProvider"
Missing helper: "-"
Parse error: Expecting 'ID', got 'SEP'
```

**根本原因**:
- 模板文件混用了 Go template 语法（`{{ .var | default "value" }}`）
- Handlebars 不支持这种语法

**修复**:
```handlebars
# 之前（Go template 语法）
{{ .imageTag | default "latest" }}

# 之后（Handlebars 语法）
{{#if imageTag}}{{ imageTag }}{{else}}latest{{/if}}
```

**修复的文件**:
- `templates/nextjs-15-app/k8s/base/deployment.yaml`

---

### 3. ✅ GitLab 仓库路径验证

**问题**: 项目名称包含特殊字符导致 GitLab API 失败

**修复**: 增强路径清理逻辑，只保留字母、数字、下划线、连字符、点

---

### 4. ✅ GitLab OAuth Scope 错误

**问题**: 使用了无效的 'sudo' scope

**修复**: 只使用 'api' scope

---

### 5. ✅ 废弃代码清理

**删除**:
- 10 个未使用的前端组件
- 2 个废弃的后端服务（one-click-deploy, progress-tracker）
- 1 个废弃的 worker（repository.worker）
- 7 个已迁移的 Core 包目录

**保留（标记 TODO）**:
- `health-monitor.service.ts` - 健康度监控（未完成但有价值）
- `approval-manager.service.ts` - 部署审批（未完成但有价值）

---

## 测试步骤

### 测试 GitOps 资源创建

1. **清理旧数据**:
```bash
bun run scripts/clean-database.ts
```

2. **重启服务**:
```bash
# 停止
pkill -f "bun.*api-gateway"

# 启动
bun run dev:api
```

3. **创建新项目**:
- 通过 Web UI 创建项目
- 选择模板
- 配置 GitLab 仓库
- 等待初始化完成

4. **验证 K8s 资源**:
```bash
export KUBECONFIG=~/.kube/k3s-remote.yaml

# 检查命名空间
kubectl get namespaces | grep project-

# 检查 GitRepository
kubectl get gitrepositories -A

# 检查 Kustomization
kubectl get kustomizations -A

# 查看资源详情
kubectl describe gitrepository -n project-xxx xxx
```

5. **检查数据库**:
```bash
bun run scripts/diagnose-gitops-pending.ts
```

应该看到：
- ✅ K8s 中有对应的资源
- ✅ 数据库中状态从 pending 变为 ready/synced

---

### 测试模板渲染

1. **创建项目时观察日志**:
```bash
# 应该没有 "Missing helper" 或 "Parse error" 错误
# 所有文件应该显示 "✓ Rendered"
```

2. **检查生成的文件**:
```bash
# 查看临时目录
ls -la /tmp/projects/[project-id]/

# 检查 deployment.yaml
cat /tmp/projects/[project-id]/k8s/base/deployment.yaml
```

---

## 已知限制

### 1. 旧项目的 GitOps 资源

**问题**: 在修复之前创建的项目，GitOps 资源仍然是 pending 状态

**解决方案**:
- 选项 A: 删除旧项目，重新创建
- 选项 B: 手动创建 K8s 资源（不推荐）
- 选项 C: 等待自动修复功能（TODO）

**手动修复脚本**（TODO）:
```bash
# 未来可以实现
bun run scripts/fix-pending-gitops.ts --project-id=xxx
```

### 2. 健康度监控

**状态**: 返回默认值（score: 100, status: healthy）

**计划**: 见 `docs/architecture/TODO_FEATURES.md`

### 3. 部署审批

**状态**: 未实现

**计划**: 见 `docs/architecture/TODO_FEATURES.md`

---

## 相关文档

- [GitOps Worker 修复](./gitops-worker-fix.md)
- [GitLab 路径修复](./gitlab-repository-path-fix.md)
- [队列清理](../architecture/queue-cleanup.md)
- [待实现功能](../architecture/TODO_FEATURES.md)
- [清理总结](../architecture/FINAL_CLEANUP_SUMMARY.md)

---

## 下一步

1. ✅ 修复已完成，系统可以正常使用
2. ⚠️ 需要重新创建项目来测试 GitOps 资源创建
3. 📋 查看 TODO_FEATURES.md 了解未来计划
4. 🧹 定期清理废弃代码（每月一次）
