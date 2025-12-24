#!/bin/bash

# 快速删除 K3s 集群中除了项目 11444a 之外的所有项目命名空间
# 项目 11444a 的 ID: a5ca948d-2db3-437e-8504-bc7cc956013e

set -e

KUBECONFIG=".kube/k3s-remote.yaml"
KEEP_PROJECT_ID="a5ca948d-2db3-437e-8504-bc7cc956013e"

echo "=== K3s 快速清理脚本 ==="
echo "保留项目 ID: $KEEP_PROJECT_ID"
echo ""

# 获取所有 project-* 命名空间，排除保留的项目
echo "📋 获取需要删除的命名空间..."
NAMESPACES=$(kubectl --kubeconfig="$KUBECONFIG" get namespaces -o json | \
  jq -r ".items[].metadata.name | select(startswith(\"project-\") and (contains(\"$KEEP_PROJECT_ID\") | not))")

if [ -z "$NAMESPACES" ]; then
  echo "✅ 未找到需要删除的命名空间"
  exit 0
fi

NAMESPACE_COUNT=$(echo "$NAMESPACES" | wc -l | tr -d ' ')
echo "找到 $NAMESPACE_COUNT 个命名空间需要删除"
echo ""

# 批量删除（后台并行）
echo "🗑️  开始批量删除..."
echo "$NAMESPACES" | xargs -P 10 -I {} kubectl --kubeconfig="$KUBECONFIG" delete namespace {} --ignore-not-found=true &

# 等待所有删除完成
wait

echo ""
echo "✅ 清理完成！"
echo ""
echo "剩余的项目命名空间:"
kubectl --kubeconfig="$KUBECONFIG" get namespaces | grep "^project-" || echo "  (无)"
