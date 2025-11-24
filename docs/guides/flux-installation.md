# Flux CD 安装指南

## 前置要求

在使用本平台的 GitOps 功能之前，需要在 K3s 集群中预先安装 Flux CD。

## 安装步骤

### 1. 安装 Flux CLI

```bash
# macOS
brew install fluxcd/tap/flux

# Linux
curl -s https://fluxcd.io/install.sh | sudo bash

# 验证安装
flux --version
```

### 2. 检查集群兼容性

```bash
flux check --pre
```

### 3. 安装 Flux 到集群

```bash
# 使用默认配置安装
flux install --namespace=flux-system

# 或指定版本
flux install --namespace=flux-system --version=v2.2.0
```

### 4. 验证安装

```bash
# 检查 Flux 组件状态
flux check

# 查看 Flux 组件
kubectl get pods -n flux-system
```

预期输出：
```
NAME                                       READY   STATUS    RESTARTS   AGE
source-controller-xxx                      1/1     Running   0          1m
kustomize-controller-xxx                   1/1     Running   0          1m
helm-controller-xxx                        1/1     Running   0          1m
notification-controller-xxx                1/1     Running   0          1m
```

## 配置平台连接

安装完成后，确保平台可以访问 K3s 集群：

1. 配置 `KUBECONFIG_PATH` 环境变量
2. 确保 kubeconfig 文件有正确的权限
3. 重启平台服务

```bash
# .env 文件
KUBECONFIG_PATH=~/.kube/config
# 或
K3S_KUBECONFIG_PATH=/etc/rancher/k3s/k3s.yaml
```

## 卸载（可选）

如需卸载 Flux：

```bash
flux uninstall --namespace=flux-system
```

## 故障排查

### Flux 组件未就绪

```bash
# 查看组件日志
kubectl logs -n flux-system deployment/source-controller
kubectl logs -n flux-system deployment/kustomize-controller
```

### 平台无法检测到 Flux

1. 检查 kubeconfig 路径是否正确
2. 验证集群连接：`kubectl get ns flux-system`
3. 查看平台日志

## 参考资料

- [Flux 官方文档](https://fluxcd.io/docs/)
- [Flux 安装指南](https://fluxcd.io/docs/installation/)
