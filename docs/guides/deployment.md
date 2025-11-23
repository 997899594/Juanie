# 服务器部署指南

## 前置条件

- Ubuntu 22.04 服务器
- 2核4GB 内存（最低）
- 公网 IP

## 一、安装 K3s

```bash
curl -sfL https://get.k3s.io | sh -
export KUBECONFIG=/etc/rancher/k3s/k3s.yaml
kubectl get nodes
```

## 二、安装 Flux

```bash
# 安装 Flux CLI
curl -s https://fluxcd.io/install.sh | sudo bash

# 安装到集群
flux install

# 等待就绪
kubectl wait --for=condition=ready pod -n flux-system --all --timeout=5m
```

## 三、部署应用

```bash
# 克隆代码
git clone https://github.com/YOUR_USERNAME/Juanie.git
cd Juanie

# 安装 Bun
curl -fsSL https://bun.sh/install | bash

# 安装依赖
bun install

# 配置环境变量
cp .env.example .env
vim .env

# 构建
bun run build

# 启动（使用 PM2）
npm install -g pm2
pm2 start "bun run dev" --name juanie
pm2 save
pm2 startup
```

## 四、配置域名（可选）

1. 添加 A 记录指向服务器 IP
2. 配置 Nginx 反向代理
3. 使用 Certbot 配置 SSL

详见 [GitOps 指南](./gitops.md)
