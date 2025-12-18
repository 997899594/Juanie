# Flux 代理配置

## 快速开始

### 1. 配置代理

```bash
# 使用本地 Clash/V2Ray 代理（默认端口 7890）
./infra/flux/configure-proxy.sh http://127.0.0.1:7890

# 使用自定义代理
./infra/flux/configure-proxy.sh http://your-proxy-server:port

# 使用需要认证的代理
./infra/flux/configure-proxy.sh http://username:password@your-proxy:port
```

### 2. 验证配置

```bash
# 查看环境变量
kubectl get deployment source-controller -n flux-system -o jsonpath='{.spec.template.spec.containers[0].env}' | jq

# 查看 Pod 状态
kubectl get pods -n flux-system

# 查看日志
kubectl logs -n flux-system deployment/source-controller --tail=50
```

### 3. 测试代理

创建一个测试项目，观察 GitRepository 是否能成功拉取：

```bash
# 查看 GitRepository 状态
kubectl get gitrepository -A

# 查看详细信息
kubectl describe gitrepository <name> -n <namespace>
```

### 4. 移除代理

```bash
./infra/flux/remove-proxy.sh
```

## 常见代理配置

### Clash

默认 HTTP 代理端口：`7890`

```bash
./infra/flux/configure-proxy.sh http://127.0.0.1:7890
```

### V2Ray

默认 HTTP 代理端口：`10809`

```bash
./infra/flux/configure-proxy.sh http://127.0.0.1:10809
```

### Shadowsocks + Privoxy

如果使用 Shadowsocks，需要配合 Privoxy 转换为 HTTP 代理：

```bash
# 安装 Privoxy
apt-get install privoxy

# 配置 Privoxy 转发到 Shadowsocks
echo "forward-socks5 / 127.0.0.1:1080 ." >> /etc/privoxy/config

# 重启 Privoxy
systemctl restart privoxy

# 配置 Flux 使用 Privoxy
./infra/flux/configure-proxy.sh http://127.0.0.1:8118
```

## 远程代理配置

如果代理服务器在远程机器上，需要确保 K3s 节点能访问：

### 方案 1: 使用远程代理

```bash
# 直接使用远程代理 IP
./infra/flux/configure-proxy.sh http://remote-proxy-ip:port
```

### 方案 2: SSH 隧道

```bash
# 在本地机器上创建 SSH 隧道
ssh -L 7890:localhost:7890 user@remote-proxy-server -N &

# 配置 Flux 使用本地隧道
./infra/flux/configure-proxy.sh http://127.0.0.1:7890
```

### 方案 3: 在 K3s 节点上运行代理

```bash
# SSH 到 K3s 节点
ssh root@k3s-node

# 安装并配置代理客户端（以 Clash 为例）
wget https://github.com/Dreamacro/clash/releases/download/v1.18.0/clash-linux-amd64-v1.18.0.gz
gunzip clash-linux-amd64-v1.18.0.gz
chmod +x clash-linux-amd64-v1.18.0
mv clash-linux-amd64-v1.18.0 /usr/local/bin/clash

# 配置 Clash
mkdir -p ~/.config/clash
# 上传你的 Clash 配置文件到 ~/.config/clash/config.yaml

# 运行 Clash
nohup clash -d ~/.config/clash > /var/log/clash.log 2>&1 &

# 配置 Flux
./infra/flux/configure-proxy.sh http://127.0.0.1:7890
```

## 故障排查

### 问题 1: 配置后仍然超时

**检查代理是否可用**：

```bash
# 在 source-controller pod 中测试
kubectl exec -n flux-system deployment/source-controller -- \
  curl -x http://your-proxy:port -I https://github.com
```

**可能原因**：
- 代理服务器不可用
- 代理端口错误
- 防火墙阻止连接

### 问题 2: 内部服务无法访问

**检查 NO_PROXY 配置**：

```bash
kubectl get deployment source-controller -n flux-system \
  -o jsonpath='{.spec.template.spec.containers[0].env[?(@.name=="NO_PROXY")].value}'
```

应该包含：`10.0.0.0/8,172.16.0.0/12,192.168.0.0/16,127.0.0.1,localhost,.svc,.cluster.local`

### 问题 3: 代理需要认证

**使用带认证的代理 URL**：

```bash
./infra/flux/configure-proxy.sh http://username:password@your-proxy:port
```

### 问题 4: source-controller 无法启动

**查看日志**：

```bash
kubectl logs -n flux-system deployment/source-controller --tail=100
```

**可能原因**：
- 代理 URL 格式错误
- 环境变量配置错误

**解决方案**：

```bash
# 移除代理配置
./infra/flux/remove-proxy.sh

# 重新配置
./infra/flux/configure-proxy.sh http://correct-proxy:port
```

## 性能优化

### 1. 使用本地代理

本地代理延迟最低，推荐在 K3s 节点上运行代理客户端。

### 2. 选择稳定的代理节点

选择延迟低、稳定性高的代理节点。

### 3. 配置代理缓存

某些代理支持缓存，可以减少重复请求。

## 安全建议

1. **不要在公网暴露代理端口**
2. **使用认证保护代理**
3. **定期更新代理客户端**
4. **监控代理流量**

## 相关文档

- [flux-http-proxy-setup.md](../../docs/guides/flux-http-proxy-setup.md)
- [flux-performance-optimization.md](../../docs/troubleshooting/flux-performance-optimization.md)
