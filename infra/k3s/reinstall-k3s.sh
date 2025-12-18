#!/bin/bash

# K3s 完全重装脚本
# 用法: 在 K3s 服务器上执行此脚本
# curl -sfL https://raw.githubusercontent.com/your-repo/main/infra/k3s/reinstall-k3s.sh | bash

set -e

echo "🚨 警告: 此脚本将完全卸载并重装 K3s"
echo "所有数据将被删除，包括："
echo "  - 所有 Kubernetes 资源"
echo "  - 所有持久化数据"
echo "  - 所有配置"
echo ""
read -p "确认继续？(输入 YES 继续): " CONFIRM

if [ "$CONFIRM" != "YES" ]; then
  echo "❌ 取消操作"
  exit 1
fi

echo ""
echo "🗑️  步骤 1/4: 卸载 K3s..."

# 卸载 K3s
if [ -f /usr/local/bin/k3s-uninstall.sh ]; then
  /usr/local/bin/k3s-uninstall.sh
  echo "✅ K3s 已卸载"
else
  echo "ℹ️  K3s 未安装或已卸载"
fi

echo ""
echo "🧹 步骤 2/4: 清理残留数据..."

# 清理所有 K3s 相关目录
rm -rf /var/lib/rancher/k3s
rm -rf /etc/rancher/k3s
rm -rf /var/lib/kubelet
rm -rf /var/lib/cni
rm -rf /opt/cni
rm -rf /run/k3s
rm -rf ~/.kube

echo "✅ 残留数据已清理"

echo ""
echo "📦 步骤 3/4: 安装 K3s..."

# 安装 K3s
curl -sfL https://get.k3s.io | sh -s - \
  --write-kubeconfig-mode 644 \
  --disable traefik \
  --disable servicelb

echo "✅ K3s 已安装"

echo ""
echo "⏳ 等待 K3s 启动..."
sleep 30

# 检查 K3s 状态
if systemctl is-active --quiet k3s; then
  echo "✅ K3s 服务运行正常"
else
  echo "❌ K3s 服务启动失败"
  systemctl status k3s
  exit 1
fi

echo ""
echo "🔧 步骤 4/4: 安装 Flux CD..."

# 安装 Flux CLI
if ! command -v flux &> /dev/null; then
  echo "安装 Flux CLI..."
  curl -s https://fluxcd.io/install.sh | bash
fi

# 安装 Flux 到集群
flux install

echo "⏳ 等待 Flux 启动..."
kubectl wait --for=condition=ready pod -n flux-system --all --timeout=300s

echo ""
echo "✅ 安装完成！"
echo ""
echo "📋 集群信息:"
kubectl get nodes
echo ""
kubectl get pods -n flux-system
echo ""
echo "🔑 Kubeconfig 位置: /etc/rancher/k3s/k3s.yaml"
echo ""
echo "📝 后续步骤:"
echo "1. 复制 kubeconfig 到本地:"
echo "   scp root@your-server:/etc/rancher/k3s/k3s.yaml ~/.kube/k3s-remote.yaml"
echo ""
echo "2. 修改 kubeconfig 中的 server 地址:"
echo "   sed -i 's/127.0.0.1/your-server-ip/g' ~/.kube/k3s-remote.yaml"
echo ""
echo "3. 测试连接:"
echo "   export KUBECONFIG=~/.kube/k3s-remote.yaml"
echo "   kubectl get nodes"
