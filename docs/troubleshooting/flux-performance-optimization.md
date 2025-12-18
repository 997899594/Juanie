# Flux 性能优化和资源管理

## 问题总结

在测试环境中发现，当集群中存在大量失败的 GitRepository 资源时（~130个，87%失败率），Flux source-controller 会被拖垮，导致：

1. 新资源无法及时处理（`observedGeneration: -1`）
2. CPU 和内存占用高
3. 大量重试消耗网络资源

## 根本原因

1. **GitHub 访问不稳定**：中国访问 GitHub 经常超时
2. **无限重试**：失败的资源会不断重试，没有限制
3. **缺少自动清理**：失败的项目资源没有自动清理机制

## 解决方案

### 1. 限制 Flux 重试和超时

**修改内容**：`packages/services/business/src/gitops/flux/yaml-generator.service.ts`

```typescript
// GitRepository 配置
spec:
  interval: 5m      // 检查间隔
  timeout: 5m       // 单次操作超时（从 60s 增加到 5m）
  suspend: false    // 不暂停 reconcile
```

**效果**：
- 增加 timeout 到 5m，适应中国网络环境
- 添加 `reconcile.fluxcd.io/requestedAt` annotation 触发立即 reconcile

### 2. 自动清理失败项目

**新增服务**：`packages/services/business/src/projects/project-cleanup.service.ts`

**功能**：
- **每小时清理**：清理超过 24 小时的失败项目
- **每天清理**：清理超过 7 天未使用的测试项目（名称包含 test/demo/tmp）
- **手动清理**：提供 API 手动清理指定项目

**清理流程**：
1. 查找符合条件的项目
2. 调用 `FluxResourcesService.cleanupProjectGitOps()` 删除 K8s 资源
3. 将项目状态标记为 `archived`

### 3. 配置 HTTP 代理

**文档**：`docs/guides/flux-http-proxy-setup.md`

**推荐方案**：

#### 方案 A: 配置 Flux 使用代理

```bash
kubectl edit deployment source-controller -n flux-system
```

添加环境变量：
```yaml
env:
  - name: HTTPS_PROXY
    value: "http://your-proxy:port"
  - name: NO_PROXY
    value: "10.0.0.0/8,172.16.0.0/12,192.168.0.0/16"
```

#### 方案 B: 使用 Gitee 镜像

1. 在 Gitee 创建 GitHub 仓库镜像
2. 配置定时同步
3. 使用 Gitee URL 创建项目

#### 方案 C: 配置 Git 全局代理

```bash
git config --global http.proxy http://your-proxy:port
git config --global https.proxy http://your-proxy:port
```

## 性能指标

### 优化前
- GitRepository 资源：129 个
- 失败率：87% (112/129)
- 未处理资源：45 个 (`observedGeneration: -1`)
- source-controller CPU：2m（但频繁重试）

### 优化后（预期）
- 失败项目自动清理（24小时后）
- 测试项目自动清理（7天后）
- 新资源立即处理（annotation 触发）
- 网络稳定性提升（代理）

## 监控和告警

### 1. 监控 Flux 资源数量

```bash
# 查看 GitRepository 总数
kubectl get gitrepository -A --no-headers | wc -l

# 查看失败的 GitRepository
kubectl get gitrepository -A -o json | \
  jq '[.items[] | select(.status.conditions // [] | any(.type == "Ready" and .status == "False"))] | length'
```

### 2. 监控清理任务

查看 ProjectCleanupService 日志：
```bash
kubectl logs -n <namespace> deployment/api-gateway | grep ProjectCleanupService
```

### 3. 设置告警

当失败资源超过阈值时发送告警：
```typescript
if (failedCount > 50) {
  await notificationService.send({
    type: 'warning',
    title: 'Flux 资源过多失败',
    message: `当前有 ${failedCount} 个 GitRepository 资源失败`,
  })
}
```

## 最佳实践

### 1. 项目命名规范

- 生产项目：`prod-<name>`
- 测试项目：`test-<name>` 或 `demo-<name>`
- 临时项目：`tmp-<name>`

这样可以自动识别并清理测试项目。

### 2. 资源配额

为每个 namespace 设置资源配额：
```yaml
apiVersion: v1
kind: ResourceQuota
metadata:
  name: project-quota
spec:
  hard:
    pods: "10"
    requests.cpu: "2"
    requests.memory: "4Gi"
```

### 3. 定期审计

每月审计一次：
- 长时间未使用的项目
- 失败率高的项目
- 资源占用异常的项目

## 故障排查

### 问题 1: 清理任务没有执行

**检查**：
```bash
# 查看 cron 任务日志
kubectl logs -n <namespace> deployment/api-gateway | grep "Starting cleanup"
```

**原因**：
- ScheduleModule 未正确配置
- 服务未注册到模块

### 问题 2: 资源删除失败

**检查**：
```bash
# 查看 namespace 状态
kubectl get namespace <namespace> -o yaml
```

**原因**：
- Finalizer 阻止删除
- 资源依赖未清理

**解决**：
```bash
# 强制删除
kubectl patch namespace <namespace> -p '{"metadata":{"finalizers":[]}}' --type=merge
```

### 问题 3: 代理配置后仍然超时

**检查**：
```bash
# 测试代理连接
kubectl exec -n flux-system deployment/source-controller -- \
  curl -x http://your-proxy:port https://github.com
```

**原因**：
- 代理服务器不可用
- 代理认证失败
- NO_PROXY 配置错误

## 相关文档

- [Flux 官方文档](https://fluxcd.io/docs/)
- [flux-http-proxy-setup.md](../guides/flux-http-proxy-setup.md)
- [flux-reconcile-delay.md](./flux-reconcile-delay.md)

## 更新日志

- 2024-12-18: 初始版本，添加三个核心优化
