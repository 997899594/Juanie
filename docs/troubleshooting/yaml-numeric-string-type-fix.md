# YAML 数字字符串类型修复

## 问题描述

用户创建了名为 "8888" 的项目，代码成功推送到 GitHub，镜像已构建，但 K3s 部署失败。

### 错误信息

```bash
kubectl get kustomization -n flux-system
NAME                                                      AGE   READY   STATUS
project-d4084b6c-3e85-4315-8ff7-a493ff574cdb-development 10m   False   error unmarshaling JSON: while decoding JSON: json: cannot unmarshal number into Go struct field Selector.patches.target.ResId.name of type string
```

## 根本原因

当 `projectName` 是纯数字（如 "8888"）时，EJS 模板引擎会将其渲染为 YAML 数字类型：

```yaml
# ❌ 错误 - 渲染为数字类型
name: 8888

# ✅ 正确 - 强制为字符串类型
name: !!str 8888
```

Kustomize 要求 `patches.target.name` 必须是字符串类型。

## 解决方案

使用 YAML 官方的类型标签 `!!str` 强制将值解析为字符串：

```yaml
# 在模板中使用
name: !!str <%= projectName %>
```

### 为什么选择 `!!str`？

1. **YAML 官方规范** - `!!str` 是 YAML 1.2 标准的类型标签
2. **简洁正确** - 不需要额外的 helper 函数或变量转换
3. **通用解决方案** - 适用于所有可能被解析为数字的字符串（如 "123", "8888", "1e10"）

### 修复的文件

所有使用 `<%= projectName %>` 作为 K8s 资源名称的 YAML 模板：

1. `k8s/overlays/*/kustomization.yaml` - patches.target.name
2. `k8s/base/deployment.yaml` - metadata.name, labels, selector, container name
3. `k8s/base/service.yaml` - metadata.name, labels, selector
4. `k8s/base/ingress.yaml` - metadata.name, labels, service name

## 验证

1. 提交代码并推送到 GitHub
2. 等待 Flux 重新同步（默认 1 分钟）
3. 检查 Kustomization 状态：
   ```bash
   kubectl get kustomization -n flux-system
   ```
   应该看到 `READY` 列为 `True`

## 注意事项

- **域名部分不需要 `!!str`**: `<%= projectName %>.example.com` 是字符串拼接，不会被解析为数字
- **所有资源名称都使用 `!!str`**: 统一使用，避免遗漏

## 参考资料

- [YAML 1.2 Type Tags](https://yaml.org/spec/1.2/spec.html#id2761292)
- [Kustomize Patches](https://kubectl.docs.kubernetes.io/references/kustomize/patches/)
