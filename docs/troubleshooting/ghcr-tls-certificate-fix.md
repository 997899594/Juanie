# 修复 K3s 拉取 ghcr.io 镜像的 TLS 证书问题

**日期**: 2024-12-24  
**问题**: `x509: certificate is valid for *.github.io, *.github.com, not ghcr.io`  
**方案**: 使用 GitHub Container Registry (ghcr.io)

## 问题根因

K3s 节点的 containerd 无法验证 `ghcr.io` 的 TLS 证书，错误信息显示证书只对 `*.github.com` 有效。

**实际原因**: 这是一个**误导性错误**。真正的问题是：
1. K3s 节点的 CA 证书包不完整或过期
2. 系统时间不同步
3. containerd 配置问题

## 正确解决方案

### 方案 1: 更新 CA 证书（推荐）

这是**最正确**的方法，解决根本问题。

```bash
# SSH 到 K3s 节点
ssh root@49.232.237.136

# 1. 更新系统 CA 证书
apt-get update
apt-get install -y ca-certificates

# 2. 更新证书包
update-ca-certificates --fresh

# 3. 验证证书
openssl s_client -connect ghcr.io:443 -showcerts

# 4. 重启 containerd
systemctl restart containerd

# 5. 重启 K3s
systemctl restart k3s
```

**验证**:
```bash
# 测试拉取镜像
crictl pull ghcr.io/997899594/11444a:latest
```

---

### 方案 2: 同步系统时间

证书验证依赖系统时间，时间不准会导致证书验证失败。

```bash
# SSH 到 K3s 节点
ssh root@49.232.237.136

# 1. 安装 NTP
apt-get install -y ntp

# 2. 同步时间
ntpdate -u pool.ntp.org

# 3. 启用自动同步
timedatectl set-ntp true

# 4. 验证时间
date
timedatectl status

# 5. 重启 K3s
systemctl restart k3s
```

---

### 方案 3: 配置 containerd 镜像代理（国内加速）

如果是网络问题导致的证书验证失败，可以使用镜像代理。

```bash
# SSH 到 K3s 节点
ssh root@49.232.237.136

# 创建 containerd 镜像配置
cat > /etc/rancher/k3s/registries.yaml <<EOF
mirrors:
  ghcr.io:
    endpoint:
      - "https://ghcr.nju.edu.cn"  # 南京大学镜像
      - "https://ghcr.io"           # 备用原站
EOF

# 重启 K3s
systemctl restart k3s
```

**可用的 ghcr.io 镜像站**:
- `https://ghcr.nju.edu.cn` - 南京大学
- `https://ghcr.m.daocloud.io` - DaoCloud

---

### 方案 4: 配置 HTTP 代理（临时方案）

如果上述方案都不行，可以配置 HTTP 代理。

```bash
# SSH 到 K3s 节点
ssh root@49.232.237.136

# 配置 containerd 代理
mkdir -p /etc/systemd/system/containerd.service.d
cat > /etc/systemd/system/containerd.service.d/http-proxy.conf <<EOF
[Service]
Environment="HTTP_PROXY=http://your-proxy:port"
Environment="HTTPS_PROXY=http://your-proxy:port"
Environment="NO_PROXY=localhost,127.0.0.1,10.0.0.0/8"
EOF

# 重新加载配置
systemctl daemon-reload
systemctl restart containerd
systemctl restart k3s
```

---

## 自动化修复脚本

创建一个一键修复脚本：

```bash
#!/bin/bash
# fix-ghcr-tls.sh

set -e

echo "=== 修复 K3s ghcr.io TLS 证书问题 ==="

# 1. 更新 CA 证书
echo "📦 更新 CA 证书..."
apt-get update -qq
apt-get install -y ca-certificates
update-ca-certificates --fresh

# 2. 同步系统时间
echo "⏰ 同步系统时间..."
apt-get install -y ntp
ntpdate -u pool.ntp.org
timedatectl set-ntp true

# 3. 配置镜像加速（可选）
echo "🚀 配置镜像加速..."
cat > /etc/rancher/k3s/registries.yaml <<EOF
mirrors:
  ghcr.io:
    endpoint:
      - "https://ghcr.nju.edu.cn"
      - "https://ghcr.io"
EOF

# 4. 重启服务
echo "🔄 重启服务..."
systemctl restart containerd
systemctl restart k3s

# 5. 等待 K3s 就绪
echo "⏳ 等待 K3s 就绪..."
sleep 10

# 6. 验证
echo "✅ 验证镜像拉取..."
crictl pull ghcr.io/library/alpine:latest

echo ""
echo "✅ 修复完成！"
echo ""
echo "现在可以拉取 ghcr.io 镜像了"
```

**使用方法**:
```bash
# 复制脚本到 K3s 节点
scp fix-ghcr-tls.sh root@49.232.237.136:/tmp/

# SSH 到节点执行
ssh root@49.232.237.136
chmod +x /tmp/fix-ghcr-tls.sh
/tmp/fix-ghcr-tls.sh
```

---

## 验证修复

修复后，验证镜像拉取：

```bash
# 1. 测试拉取公共镜像
kubectl --kubeconfig=.kube/k3s-remote.yaml run test-ghcr \
  --image=ghcr.io/library/alpine:latest \
  --restart=Never \
  --rm -it -- sh

# 2. 检查项目 11444a 的 Pod
kubectl --kubeconfig=.kube/k3s-remote.yaml delete pod --all \
  -n project-a5ca948d-2db3-437e-8504-bc7cc956013e-development

# 3. 等待新 Pod 创建
sleep 10

# 4. 查看 Pod 状态
kubectl --kubeconfig=.kube/k3s-remote.yaml get pods \
  -n project-a5ca948d-2db3-437e-8504-bc7cc956013e-development

# 5. 查看 Pod 事件
kubectl --kubeconfig=.kube/k3s-remote.yaml describe pod \
  -n project-a5ca948d-2db3-437e-8504-bc7cc956013e-development
```

---

## 为什么不跳过 TLS 验证

**不推荐**配置 `insecure_skip_verify: true`，原因：

1. **安全风险** - 容易遭受中间人攻击
2. **不符合最佳实践** - 生产环境禁止
3. **治标不治本** - 没有解决根本问题
4. **审计问题** - 安全审计会标记为高危

```yaml
# ❌ 不要这样做
configs:
  "ghcr.io":
    tls:
      insecure_skip_verify: true  # 危险！
```

---

## 长期解决方案

### 1. 自动化 CA 证书更新

```bash
# 添加到 crontab
0 0 * * 0 update-ca-certificates --fresh && systemctl restart k3s
```

### 2. 监控证书有效期

```bash
# 检查证书有效期
echo | openssl s_client -connect ghcr.io:443 2>/dev/null | \
  openssl x509 -noout -dates
```

### 3. 使用 Cert-Manager 管理证书

如果需要更高级的证书管理，可以部署 Cert-Manager：

```bash
kubectl apply -f https://github.com/cert-manager/cert-manager/releases/download/v1.13.0/cert-manager.yaml
```

---

## 常见问题

### Q: 为什么错误信息说证书不包含 ghcr.io？

A: 这是误导性错误。实际上 ghcr.io 的证书是正确的，问题在于客户端的 CA 证书包不完整。

### Q: 更新 CA 证书后还是失败？

A: 检查系统时间是否正确。证书验证依赖时间，时间不准会导致失败。

### Q: 可以使用 Docker Hub 代替 ghcr.io 吗？

A: 可以，但 ghcr.io 与 GitHub 集成更好，支持 GitHub Actions 自动推送，推荐继续使用。

### Q: 镜像加速会影响安全性吗？

A: 不会。镜像加速只是缓存，不会修改镜像内容。但要选择可信的镜像站。

---

## 执行步骤

**立即执行**（5 分钟）:

```bash
# 1. 创建修复脚本
cat > /tmp/fix-ghcr-tls.sh <<'EOF'
#!/bin/bash
set -e
apt-get update -qq
apt-get install -y ca-certificates ntp
update-ca-certificates --fresh
ntpdate -u pool.ntp.org
timedatectl set-ntp true
systemctl restart containerd
systemctl restart k3s
sleep 10
echo "✅ 修复完成"
EOF

# 2. 上传到 K3s 节点
scp /tmp/fix-ghcr-tls.sh root@49.232.237.136:/tmp/

# 3. 执行修复
ssh root@49.232.237.136 'bash /tmp/fix-ghcr-tls.sh'

# 4. 验证项目 11444a
kubectl --kubeconfig=.kube/k3s-remote.yaml delete pod --all \
  -n project-a5ca948d-2db3-437e-8504-bc7cc956013e-development

# 5. 等待并检查
sleep 15
kubectl --kubeconfig=.kube/k3s-remote.yaml get pods \
  -n project-a5ca948d-2db3-437e-8504-bc7cc956013e-development
```

---

## 参考资料

- [K3s Private Registry Configuration](https://docs.k3s.io/installation/private-registry)
- [Containerd Registry Hosts](https://github.com/containerd/containerd/blob/main/docs/hosts.md)
- [GitHub Container Registry Documentation](https://docs.github.com/en/packages/working-with-a-github-packages-registry/working-with-the-container-registry)
- [Ubuntu CA Certificates](https://ubuntu.com/server/docs/security-trust-store)

## 总结

**正确的解决方案**:
1. ✅ 更新 CA 证书（治本）
2. ✅ 同步系统时间（必要）
3. ✅ 配置镜像加速（可选，提升速度）
4. ❌ 跳过 TLS 验证（危险，不推荐）

**预期结果**: 项目 11444a 的 Pod 成功拉取镜像并运行。
