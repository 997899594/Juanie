# K8s Namespace 统一使用完整 UUID

**日期**: 2025-01-22  
**问题**: Kustomization 资源报错 namespace 不存在  
**根因**: Flux 资源和 K8s 模板使用了不同的 namespace 命名规则  
**解决方案**: 统一使用完整 UUID 作为 namespace

---

## 问题描述

创建项目后，GitOps 资源状态检查发现：
- ✅ GitRepository 创建成功
- ❌ 所有 Kustomization 失败，报错 namespace 不存在

```bash
# 错误信息
ERROR: namespaces "project-7df3ff1d-c0d7-412d-aebf-d7cb73c4cdf7-development" not found
ERROR: namespaces "project-7df3ff1d-c0d7-412d-aebf-d7cb73c4cdf7-staging" not found
ERROR: namespaces "project-7df3ff1d-c0d7-412d-aebf-d7cb73c4cdf7-production" not found
```

## 根本原因

**命名不一致**：

1. **FluxResourcesService** 创建 namespace：
   ```typescript
   const namespace = `project-${projectId.slice(0, 8)}`
   // 结果: project-7df3ff1d
   ```

2. **K8s 模板文件** 引用 namespace：
   ```yaml
   namespace: project-<%= projectId %>-development
   # 结果: project-7df3ff1d-c0d7-412d-aebf-d7cb73c4cdf7-development
   ```

**冲突**：
- Flux 资源在 `project-7df3ff1d` namespace 中
- Kustomization 尝试在 `project-7df3ff1d-c0d7-412d-aebf-d7cb73c4cdf7-development` 中部署
- 该 namespace 不存在 → 失败

## 解决方案

### 方案选择

**❌ 方案 A**: 使用短 ID + 环境后缀
```
namespace: project-7df3ff1d-development
namespace: project-7df3ff1d-staging
namespace: project-7df3ff1d-production
```
- 缺点：需要为每个环境创建独立 namespace
- 缺点：增加管理复杂度

**✅ 方案 B**: 统一使用完整 UUID（采用）
```
namespace: project-7df3ff1d-c0d7-412d-aebf-d7cb73c4cdf7
```
- 优点：所有环境共享一个 namespace
- 优点：简化管理，符合 K8s 最佳实践
- 优点：通过 namePrefix 区分环境（dev-, staging-, prod-）

### 实施步骤

#### 1. 修改 FluxResourcesService

**文件**: `packages/services/business/src/gitops/flux/flux-resources.service.ts`

```typescript
// ❌ 之前：使用前 8 位
const namespace = `project-${options.projectId.slice(0, 8)}`

// ✅ 现在：使用完整 UUID
const namespace = `project-${options.projectId}`
```

#### 2. 修改 K8s 模板文件

**文件**: `templates/nextjs-15-app/k8s/overlays/*/kustomization.yaml`

```yaml
# ❌ 之前：UUID + 环境后缀
namespace: project-<%= projectId %>-development

# ✅ 现在：完整 UUID
namespace: project-<%= projectId %>
```

修改的文件：
- `templates/nextjs-15-app/k8s/overlays/development/kustomization.yaml`
- `templates/nextjs-15-app/k8s/overlays/staging/kustomization.yaml`
- `templates/nextjs-15-app/k8s/overlays/production/kustomization.yaml`

#### 3. 重新构建

```bash
cd packages/services/business
bun run build
```

## 验证

### 1. 创建新项目

创建新项目后，检查 namespace：

```bash
kubectl get ns | grep project-
```

应该看到：
```
project-7df3ff1d-c0d7-412d-aebf-d7cb73c4cdf7   Active   1m
```

### 2. 检查 GitOps 资源

```bash
# 检查 GitRepository
kubectl get gitrepository -n project-7df3ff1d-c0d7-412d-aebf-d7cb73c4cdf7

# 检查 Kustomization
kubectl get kustomization -n project-7df3ff1d-c0d7-412d-aebf-d7cb73c4cdf7
```

应该看到：
```
NAME                    READY   STATUS
7df3ff1d-repo          True    stored artifact

NAME                    READY   STATUS
7df3ff1d-development   True    Applied revision: main@sha1:xxx
7df3ff1d-staging       True    Applied revision: main@sha1:xxx
7df3ff1d-production    True    Applied revision: main@sha1:xxx
```

### 3. 检查部署的资源

```bash
kubectl get all -n project-7df3ff1d-c0d7-412d-aebf-d7cb73c4cdf7
```

应该看到三个环境的资源（通过 namePrefix 区分）：
```
NAME                                    READY   STATUS
pod/dev-7df3ff1d-xxx                   1/1     Running
pod/staging-7df3ff1d-xxx               1/1     Running
pod/prod-7df3ff1d-xxx                  1/1     Running

NAME                          TYPE        CLUSTER-IP
service/dev-7df3ff1d         ClusterIP   10.x.x.x
service/staging-7df3ff1d     ClusterIP   10.x.x.x
service/prod-7df3ff1d        ClusterIP   10.x.x.x
```

## 架构优势

### 单 Namespace 多环境模式

```
project-7df3ff1d-c0d7-412d-aebf-d7cb73c4cdf7/
├── dev-7df3ff1d-deployment
├── dev-7df3ff1d-service
├── dev-7df3ff1d-ingress
├── staging-7df3ff1d-deployment
├── staging-7df3ff1d-service
├── staging-7df3ff1d-ingress
├── prod-7df3ff1d-deployment
├── prod-7df3ff1d-service
└── prod-7df3ff1d-ingress
```

**优点**：
1. **简化管理** - 一个项目一个 namespace
2. **资源共享** - Secret、ConfigMap 可以跨环境共享
3. **RBAC 简化** - 一次授权覆盖所有环境
4. **符合最佳实践** - K8s 推荐按应用/项目划分 namespace

## 相关文件

- `packages/services/business/src/gitops/flux/flux-resources.service.ts`
- `templates/nextjs-15-app/k8s/overlays/development/kustomization.yaml`
- `templates/nextjs-15-app/k8s/overlays/staging/kustomization.yaml`
- `templates/nextjs-15-app/k8s/overlays/production/kustomization.yaml`

## 参考

- [Kubernetes Namespaces Best Practices](https://kubernetes.io/docs/concepts/overview/working-with-objects/namespaces/)
- [Kustomize namePrefix](https://kubectl.docs.kubernetes.io/references/kustomize/kustomization/nameprefix/)
