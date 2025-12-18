#!/bin/bash

# 移除 Flux source-controller 代理配置
# 用法: ./infra/flux/remove-proxy.sh

set -e

echo "🔧 移除 Flux source-controller 代理配置..."

# 检查 kubectl 连接
if ! kubectl get nodes &>/dev/null; then
  echo "❌ 错误: 无法连接到 Kubernetes 集群"
  exit 1
fi

# 获取当前配置
echo "📝 获取当前环境变量..."
CURRENT_ENV=$(kubectl get deployment source-controller -n flux-system -o jsonpath='{.spec.template.spec.containers[0].env}')

if echo "$CURRENT_ENV" | grep -q "HTTPS_PROXY"; then
  echo "🗑️  移除代理配置..."
  
  # 创建 patch 文件（移除代理相关环境变量）
  cat > /tmp/flux-remove-proxy-patch.yaml <<EOF
spec:
  template:
    spec:
      containers:
      - name: manager
        env: []
EOF

  kubectl patch deployment source-controller -n flux-system --patch-file /tmp/flux-remove-proxy-patch.yaml
  
  echo "⏳ 等待 source-controller 重启..."
  kubectl rollout status deployment/source-controller -n flux-system --timeout=120s
  
  echo "✅ 代理配置已移除！"
  
  # 清理临时文件
  rm -f /tmp/flux-remove-proxy-patch.yaml
else
  echo "ℹ️  未检测到代理配置，无需移除"
fi
