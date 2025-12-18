#!/bin/bash

# 更新 K3s kubeconfig 配置脚本

set -e

NEW_TOKEN="K10073057febc381339f47df14e8dac65faf7cfec461dec7c9d91437f8a937f3050::server:52cf86ace880cd89a7ab6e87b817e9bf"
K3S_HOST="43.134.245.122"

echo "📝 更新 K3s kubeconfig..."

# 创建项目 .kube 目录
mkdir -p .kube

# 生成新的 kubeconfig
cat > .kube/config <<EOF
apiVersion: v1
kind: Config
clusters:
- cluster:
    certificate-authority-data: LS0tLS1CRUdJTiBDRVJUSUZJQ0FURS0tLS0tCk1JSUJkekNDQVIyZ0F3SUJBZ0lCQURBS0JnZ3Foa2pPUFFRREFqQWpNU0V3SHdZRFZRUUREQmhyTTNNdGMyVnkKZG1WeUxXTmhRREUzTXpRd01UQXdNRGd3SGhjTk1qUXhNVEl6TURjd01EQTRXaGNOTXpReE1USXhNRGN3TURBNApXakFqTVNFd0h3WURWUVFEREJock0zTXRjMlZ5ZG1WeUxXTmhRREUzTXpRd01UQXdNRGd3V1RBVEJnY3Foa2pPClBRSUJCZ2dxaGtqT1BRTUJCd05DQUFUcjBnL2lYRGhYVGhYcGhYcGhYcGhYcGhYcGhYcGhYcGhYcGhYcGhYcGgKWHBoWHBoWHBoWHBoWHBoWHBoWHBoWHBoWHBoWHBoWHBoWHBoWHBoWHBoWG8wSXdRREFPQmdOVkhROEJBZjhFCkJBTUNBcVF3RHdZRFZSMFRBUUgvQkFVd0F3RUIvekFkQmdOVkhRNEVGZ1FVcGhYcGhYcGhYcGhYcGhYcGhYcGgKWHBoWHBoWHBNQW9HQ0NxR1NNNDlCQU1DQTBnQU1FVUNJUUN4cGhYcGhYcGhYcGhYcGhYcGhYcGhYcGhYcGhYcApBaUVBcGhYcGhYcGhYcGhYcGhYcGhYcGhYcGhYcGhYcGhYcGhYcGhYcGhYcGhYcGhYcGhYcGhYcGhYcGhYcGhYCnBoWHBoWHBoWHBoWD0KLS0tLS1FTkQgQ0VSVElGSUNBVEUtLS0tLQo=
    server: https://${K3S_HOST}:6443
  name: default
contexts:
- context:
    cluster: default
    user: default
  name: default
current-context: default
users:
- name: default
  user:
    token: ${NEW_TOKEN}
EOF

echo "✅ kubeconfig 已更新到 .kube/config"
echo ""
echo "📝 更新 .env 配置..."

# 更新 .env 中的路径
if grep -q "K3S_KUBECONFIG_PATH" .env; then
    sed -i.bak 's|K3S_KUBECONFIG_PATH=.*|K3S_KUBECONFIG_PATH=.kube/config|' .env
    echo "✅ .env 已更新"
else
    echo "⚠️  请手动在 .env 中设置: K3S_KUBECONFIG_PATH=.kube/config"
fi

echo ""
echo "🧪 测试连接..."
export KUBECONFIG=.kube/config
kubectl get nodes

echo ""
echo "✅ 完成！"
