# K3s + Flux 在腾讯云服务器重装记录（中国网络环境）

**日期**: 2024-12-18  
**问题**: 腾讯云服务器访问 GitHub 和 Docker Hub 超时，导致 K3s 和 Flux 安装失败  
**解决**: 配置 hosts + 国内镜像源

---

## 背景

在清理测试环境时，需要完全重装 K3s 和 Flux。但腾讯云服务器访问国外资源受限：
- GitHub 访问超时
- Docker Hub 镜像拉取失败
- GitHub Container Registry (ghcr.io) 无法访问

## 解决方案总结

### 1. GitHub 访问问题
**方法**: 配置 hosts 文件

```bash
sudo tee -a /etc/hosts <<EOF

# GitHub Hosts
140.82.112.4 github.com
140.82.114.4 github.com
199.232.69.194 github.global.ssl.fastly.net
185.199.108.153 assets-cdn.github.com
185.199.109.153 assets-cdn.github.com
185.199.110.153 assets-cdn.github.com
185.199.111.153 assets-cdn.github.com
185.199.108.133 raw.githubusercontent.com
185.199.109.133 raw.githubusercontent.com
185.199.110.133 raw.githubusercontent.com
185.199.111.133 raw.githubusercontent.com
140.82.113.3 api.github.com
EOF

sudo systemctl restart systemd-resolved
```

### 2. K3s 安装
**方法**: 使用 Rancher 官方国内镜像

```bash
curl -sfL https://rancher-mirror.rancher.cn/k3s/k3s-install.sh | \
  INSTALL_K3S_MIRROR=cn sh -s - --write-kubeconfig-mode 644
```

### 3. Docker Hub 镜像拉取问题
**方法**: 配置 K3s 使用国内镜像源

```bash
sudo mkdir -p /etc/rancher/k3s

sudo tee /etc/rancher/k3s/registries.yaml <<EOF
mirrors:
  docker.io:
    endpoint:
      - "https://docker.m.daocloud.io"
      - "https://dockerproxy.com"
      - "https://docker.mirrors.ustc.edu.cn"
      - "https://registry.docker-cn.com"
EOF

systemctl restart k3s
```

### 4. Flux 安装
**方法**: 使用 Flux CLI 安装（会自动生成 YAML）

```bash
# 安装 Flux CLI
curl -s https://fluxcd.io/install.sh | sudo bash

# 设置 KUBECONFIG
export KUBECONFIG=/etc/rancher/k3s/k3s.yaml

# 安装 Flux 到集群
flux install
```

**关键点**: 
- 不要在 hosts 中配置 `ghcr.io`，会导致 SSL 证书错误
- 让 K3s 的镜像源配置处理 ghcr.io 的访问

---

## 完整安装流程

### 步骤 1: 配置网络环境

```bash
# 1. 配置 GitHub hosts
sudo tee -a /etc/hosts <<EOF

# GitHub Hosts
140.82.112.4 github.com
140.82.114.4 github.com
199.232.69.194 github.global.ssl.fastly.net
185.199.108.153 assets-cdn.github.com
185.199.109.153 assets-cdn.github.com
185.199.110.153 assets-cdn.github.com
185.199.111.153 assets-cdn.github.com
185.199.108.133 raw.githubusercontent.com
185.199.109.133 raw.githubusercontent.com
185.199.110.133 raw.githubusercontent.com
185.199.111.133 raw.githubusercontent.com
140.82.113.3 api.github.com
EOF

# 2. 刷新 DNS
sudo systemctl restart systemd-resolved

# 3. 验证 GitHub 访问
curl -I https://github.com
```

### 步骤 2: 安装 K3s

```bash
# 使用国内镜像安装
curl -sfL https://rancher-mirror.rancher.cn/k3s/k3s-install.sh | \
  INSTALL_K3S_MIRROR=cn sh -s - --write-kubeconfig-mode 644

# 等待启动
sleep 30

# 验证
kubectl get nodes
```

### 步骤 3: 配置镜像源

```bash
# 创建镜像配置
sudo mkdir -p /etc/rancher/k3s

sudo tee /etc/rancher/k3s/registries.yaml <<EOF
mirrors:
  docker.io:
    endpoint:
      - "https://docker.m.daocloud.io"
      - "https://dockerproxy.com"
      - "https://docker.mirrors.ustc.edu.cn"
      - "https://registry.docker-cn.com"
EOF

# 重启 K3s
systemctl restart k3s
sleep 30
```

### 步骤 4: 安装 Flux

```bash
# 安装 Flux CLI
curl -s https://fluxcd.io/install.sh | sudo bash

# 设置 KUBECONFIG
export KUBECONFIG=/etc/rancher/k3s/k3s.yaml

# 安装 Flux
flux install

# 等待启动
kubectl wait --for=condition=ready pod -n flux-system --all --timeout=300s

# 验证
flux check
kubectl get pods -n flux-system
```

### 步骤 5: 获取 K3s Token

```bash
cat /var/lib/rancher/k3s/server/node-token
```

---

## 遇到的问题和解决

### 问题 1: Docker Hub 超时
**错误**:
```
failed to pull image "rancher/mirrored-pause:3.6": 
dial tcp 116.89.243.8:443: i/o timeout
```

**解决**: 配置 K3s 镜像源（见步骤 3）

### 问题 2: ghcr.io SSL 证书错误
**错误**:
```
tls: failed to verify certificate: x509: certificate is valid for 
*.github.io, *.github.com, not ghcr.io
```

**原因**: hosts 文件中把 ghcr.io 指向了 GitHub 的 IP，但证书不匹配

**解决**: 
```bash
# 删除 ghcr.io 的 hosts 配置
sudo sed -i '/ghcr.io/d' /etc/hosts
sudo systemctl restart systemd-resolved
systemctl restart k3s
```

### 问题 3: Flux 镜像拉取失败
**错误**: `ImagePullBackOff`

**解决**: 
1. 确保没有 ghcr.io 的 hosts 配置
2. 重启 K3s 让它重新拉取镜像
3. 等待 1-2 分钟，镜像会通过国内源拉取成功

---

## 验证清单

安装完成后，验证以下内容：

```bash
# 1. K3s 运行正常
kubectl get nodes
# 应该显示: Ready

# 2. Flux 所有组件运行
kubectl get pods -n flux-system
# 应该显示: 4个 pod 都是 Running 且 READY 1/1

# 3. Flux 检查通过
flux check
# 应该显示: ✔ all checks passed

# 4. 查看 Flux 版本
flux version
# 应该显示版本信息
```

---

## 最终配置

### K3s 配置
- **安装方式**: 国内镜像 (`INSTALL_K3S_MIRROR=cn`)
- **Kubeconfig**: `/etc/rancher/k3s/k3s.yaml`
- **镜像源**: DaoCloud + DockerProxy + USTC

### Flux 配置
- **版本**: v2.7.3
- **组件**:
  - helm-controller: v1.4.3
  - kustomize-controller: v1.7.2
  - notification-controller: v1.7.4
  - source-controller: v1.7.3

### 网络配置
- **GitHub**: hosts 文件解析
- **Docker Hub**: 国内镜像源
- **ghcr.io**: 通过镜像源访问（不配置 hosts）

---

## 注意事项

1. **hosts 文件维护**: GitHub IP 可能变化，需要定期更新
2. **镜像源稳定性**: 如果某个镜像源失败，会自动尝试下一个
3. **SSL 证书**: 不要给 ghcr.io 配置 hosts，会导致证书错误
4. **Token 安全**: K3s token 是敏感信息，不要提交到 Git

---

## 相关文档

- [K3s 官方文档](https://docs.k3s.io/)
- [Flux 官方文档](https://fluxcd.io/docs/)
- [K3s 国内镜像](https://docs.rancher.cn/docs/k3s/_index/)
- [DaoCloud 镜像加速](https://github.com/DaoCloud/public-image-mirror)
