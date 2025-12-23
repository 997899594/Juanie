# Kustomization 数字类型错误修复

## 问题描述

用户创建了名为 "8888" 的项目，代码成功推送到 GitHub，镜像已构建并发布到 GHCR，但 K3s 部署失败。

### 错误信息

```bash
kubectl get kustomization -n flux-system
NAME                                                      AGE   READY   STATUS
project-d4084b6c-3e85-4315-8ff7-a493ff574cdb-development 10m   False   error unmarshaling JSON: while decoding JSON: json: cannot unmarshal number into Go struct field Selector.patches.target.ResId.name of type string
```

## 根本原因

在 Kustomization YAML 模板中，当 `projectName` 是纯数字（如 "8888"）时，EJS 模板引擎会将其渲染为 YAML 数字类型而不是字符串类型：

```yaml
# ❌ 错误 - 渲染为数字
patches:
  - path: deployment-patch.yaml
    target:
      kind: Deployment
      name: 8888  # 这是数字类型！

# ✅ 正确 - 渲染为字符串
patches:
  - path: deployment-patch.yaml
    target:
      kind: Deployment
      name: "8888"  # 这是字符串类型
```

Kustomize 要求 `patches.target.name` 必须是字符串类型，否则会抛出 JSON 解析错误。

## 影响范围

所有使用 `<%= projectName %>` 的 YAML 模板文件都可能受影响：

1. **Kustomization 文件**:
   - `k8s/overlays/development/kustomization.yaml`
   - `k8s/overlays/staging/kustomization.yaml`
   - `k8s/overlays/production/kustomization.yaml`

2. **K8s 资源文件**:
   - `k8s/base/deployment.yaml` - metadata.name, labels, selector, container name
   - `k8s/base/service.yaml` - metadata.name, labels, selector
   - `k8s/base/ingress.yaml` - metadata.name, labels, service name

## 解决方案

在所有 YAML 模板中，为 `<%= projectName %>` 添加引号，强制转换为字符串类型：

### 1. Kustomization 文件

```yaml
# 修改前
patches:
  - path: deployment-patch.yaml
    target:
      kind: Deployment
      name: <%= projectName %>

# 修改后
patches:
  - path: deployment-patch.yaml
    target:
      kind: Deployment
      name: "<%= projectName %>"
```

### 2. Deployment

```yaml
# 修改前
metadata:
  name: <%= projectName %>
  labels:
    app: <%= projectName %>

# 修改后
metadata:
  name: "<%= projectName %>"
  labels:
    app: "<%= projectName %>"
```

### 3. Service

```yaml
# 修改前
metadata:
  name: <%= projectName %>
  labels:
    app: <%= projectName %>
spec:
  selector:
    app: <%= projectName %>

# 修改后
metadata:
  name: "<%= projectName %>"
  labels:
    app: "<%= projectName %>"
spec:
  selector:
    app: "<%= projectName %>"
```

### 4. Ingress

```yaml
# 修改前
metadata:
  name: <%= projectName %>
  labels:
    app: <%= projectName %>
spec:
  rules:
  - host: <%= projectName %>.example.com
    http:
      paths:
      - backend:
          service:
            name: <%= projectName %>

# 修改后
metadata:
  name: "<%= projectName %>"
  labels:
    app: "<%= projectName %>"
spec:
  rules:
  - host: <%= projectName %>.example.com  # 域名部分不需要引号
    http:
      paths:
      - backend:
          service:
            name: "<%= projectName %>"  # 资源名称需要引号
```

## 修复文件列表

1. ✅ `templates/nextjs-15-app/k8s/overlays/development/kustomization.yaml`
2. ✅ `templates/nextjs-15-app/k8s/overlays/staging/kustomization.yaml`
3. ✅ `templates/nextjs-15-app/k8s/overlays/production/kustomization.yaml`
4. ✅ `templates/nextjs-15-app/k8s/base/deployment.yaml`
5. ✅ `templates/nextjs-15-app/k8s/base/service.yaml`
6. ✅ `templates/nextjs-15-app/k8s/base/ingress.yaml`

## 验证步骤

1. **提交代码并推送到 GitHub**
2. **等待 Flux 重新同步**（默认 1 分钟）
3. **检查 Kustomization 状态**:
   ```bash
   kubectl get kustomization -n flux-system
   ```
   应该看到 `READY` 列为 `True`

4. **检查 Pod 状态**:
   ```bash
   kubectl get pods -n project-<projectId>-development
   ```
   应该看到 Pod 正常运行

5. **检查 Service 和 Ingress**:
   ```bash
   kubectl get svc,ingress -n project-<projectId>-development
   ```

## 注意事项

1. **域名部分不需要引号**: 
   - `<%= projectName %>.example.com` 不需要引号，因为它是字符串拼接的一部分
   - 只有作为 YAML 值的 `<%= projectName %>` 需要引号

2. **标签值需要引号**:
   - `app: "<%= projectName %>"` 需要引号，因为标签值可能是纯数字

3. **选择器需要引号**:
   - `matchLabels.app: "<%= projectName %>"` 需要引号
   - `selector.app: "<%= projectName %>"` 需要引号

4. **容器名称需要引号**:
   - `containers[].name: "<%= projectName %>"` 需要引号

## 相关问题

- 如果项目名称包含特殊字符（如 `-`, `_`），也建议添加引号
- 如果项目名称以数字开头（如 `123abc`），也需要添加引号
- 建议在所有 YAML 模板中统一使用引号，避免类似问题

## 参考资料

- [Kustomize Patches Documentation](https://kubectl.docs.kubernetes.io/references/kustomize/patches/)
- [YAML Specification - Scalars](https://yaml.org/spec/1.2/spec.html#id2760844)
- [EJS Template Engine](https://ejs.co/)
