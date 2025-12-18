# Flux HTTP 代理配置指南

## 问题背景

在中国访问 GitHub 时经常遇到网络不稳定、超时等问题，导致 Flux 无法正常拉取 Git 仓库。配置 HTTP 代理可以解决这个问题。

## 方案 1: 配置 Flux source-controller 使用代理

### 1. 编辑 source-controller deployment

```bash
kubectl edit deployment source-controller -n flux-system
```

### 2. 添加环境变量

在 `spec.template.spec.containers[0].env` 中添加：

```yaml
env:
  - name: HTTPS_PROXY
    value: "http://your-proxy-server:port"
  - name: HTTP_PROXY
    value: "http://your-proxy-server:port"
  - name: NO_PROXY
    value: "10.0.0.0/8,172.16.0.0/12,192.168.0.0/16,127.0.0.1,localhost,.svc,.cluster.local"
```

### 3. 重启 source-controller

```bash
kubectl rollout restart deployment/source-controller -n flux-system
```

## 方案 2: 使用 Gitee 镜像

如果没有可用的代理，可以使用 Gitee 作为 GitHub 的镜像。

### 1. 在 Gitee 创建仓库镜像

1. 登录 Gitee
2. 点击"从 GitHub/GitLab 导入仓库"
3. 输入 GitHub 仓库 URL
4. 选择"定时同步"

### 2. 修改应用配置使用 Gitee

在创建项目时，使用 Gitee 仓库 URL 而不是 GitHub。

## 方案 3: 配置 Git 全局代理

在 K3s 节点上配置 Git 全局代理：

```bash
# SSH 到 K3s 节点
ssh root@your-k3s-node

# 配置 Git 代理
git config --global http.proxy http://your-proxy-server:port
git config --global https.proxy http://your-proxy-server:port

# 验证配置
git config --global --get http.proxy
```

## 验证代理配置

### 1. 检查 source-controller 日志

```bash
kubectl logs -n flux-system deployment/source-controller --tail=50
```

应该看到成功拉取仓库的日志，而不是超时错误。

### 2. 创建测试项目

创建一个新项目，观察 GitRepository 资源状态：

```bash
kubectl get gitrepository -n project-<project-id>-development -o yaml
```

`status.conditions` 应该显示 `Ready: True`。

## 推荐的代理服务

### 1. Clash

- 支持多种协议（Shadowsocks, VMess, Trojan 等）
- 提供 HTTP 代理端口
- 配置简单

### 2. V2Ray

- 功能强大
- 支持多种传输协议
- 可以配置为 HTTP 代理

### 3. 商业代理服务

- 稳定性高
- 速度快
- 有技术支持

## 注意事项

1. **安全性**：确保代理服务器安全可靠
2. **性能**：选择低延迟的代理服务器
3. **稳定性**：使用稳定的代理服务，避免频繁断线
4. **成本**：商业代理服务需要付费

## 故障排查

### 问题 1: 代理配置后仍然超时

**原因**：代理服务器不可用或配置错误

**解决**：
```bash
# 在 source-controller pod 中测试代理
kubectl exec -n flux-system deployment/source-controller -- curl -x http://your-proxy:port https://github.com
```

### 问题 2: 部分仓库可以访问，部分不行

**原因**：NO_PROXY 配置不正确

**解决**：检查 NO_PROXY 配置，确保内部服务不走代理。

### 问题 3: 代理认证失败

**原因**：代理需要用户名密码

**解决**：
```yaml
env:
  - name: HTTPS_PROXY
    value: "http://username:password@your-proxy:port"
```

## 相关文档

- [Flux 官方文档](https://fluxcd.io/docs/)
- [Kubernetes 环境变量配置](https://kubernetes.io/docs/tasks/inject-data-application/define-environment-variable-container/)
