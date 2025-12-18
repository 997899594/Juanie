#!/bin/bash

# Flux source-controller 代理配置脚本
# 用法: ./infra/flux/configure-proxy.sh <proxy-url>
# 示例: ./infra/flux/configure-proxy.sh http://127.0.0.1:7890

set -e

PROXY_URL="${1:-}"

if [ -z "$PROXY_URL" ]; then
  echo "❌ 错误: 请提供代理 URL"
  echo "用法: $0 <proxy-url>"
  echo "示例: $0 http://127.0.0.1:7890"
  exit 1
fi

echo "🔧 配置 Flux source-controller 使用代理: $PROXY_URL"

# 检查 kubectl 连接
if ! kubectl get nodes &>/dev/null; then
  echo "❌ 错误: 无法连接到 Kubernetes 集群"
  echo "请检查 KUBECONFIG 环境变量"
  exit 1
fi

# 检查 source-controller 是否存在
if ! kubectl get deployment source-controller -n flux-system &>/dev/null; then
  echo "❌ 错误: source-controller deployment 不存在"
  exit 1
fi

echo "📝 创建代理配置 patch..."

# 创建 patch 文件
cat > /tmp/flux-proxy-patch.yaml <<EOF
spec:
  template:
    spec:
      containers:
      - name: manager
        env:
        - name: HTTPS_PROXY
          value: "$PROXY_URL"
        - name: HTTP_PROXY
          value: "$PROXY_URL"
        - name: NO_PROXY
          value: "10.0.0.0/8,172.16.0.0/12,192.168.0.0/16,127.0.0.1,localhost,.svc,.cluster.local"
EOF

echo "🚀 应用配置..."
kubectl patch deployment source-controller -n flux-system --patch-file /tmp/flux-proxy-patch.yaml

echo "⏳ 等待 source-controller 重启..."
kubectl rollout status deployment/source-controller -n flux-system --timeout=120s

echo "✅ 配置完成！"
echo ""
echo "📊 验证配置:"
echo "kubectl get deployment source-controller -n flux-system -o jsonpath='{.spec.template.spec.containers[0].env}' | jq"
echo ""
echo "📋 查看日志:"
echo "kubectl logs -n flux-system deployment/source-controller --tail=50"

# 清理临时文件
rm -f /tmp/flux-proxy-patch.yaml
