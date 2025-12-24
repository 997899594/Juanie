#!/bin/bash

# 删除 K3s 集群中除了项目 11444a 之外的所有项目 Pod
# 项目 11444a 的命名空间: project-a5ca948d-2db3-437e-8504-bc7cc956013e

set -e

KUBECONFIG=".kube/k3s-remote.yaml"
KEEP_NAMESPACE="project-a5ca948d-2db3-437e-8504-bc7cc956013e"

echo "=== K3s Pod 清理脚本 ==="
echo "保留命名空间: $KEEP_NAMESPACE"
echo ""

# 获取所有 project-* 命名空间
echo "📋 获取所有项目命名空间..."
NAMESPACES=$(kubectl --kubeconfig="$KUBECONFIG" get namespaces -o json | jq -r '.items[].metadata.name | select(startswith("project-"))')

if [ -z "$NAMESPACES" ]; then
  echo "✅ 未找到任何项目命名空间"
  exit 0
fi

echo "找到以下命名空间:"
echo "$NAMESPACES" | tr ' ' '\n'
echo ""

# 删除除了保留命名空间之外的所有项目命名空间
for ns in $NAMESPACES; do
  if [ "$ns" = "$KEEP_NAMESPACE" ]; then
    echo "⏭️  跳过保留的命名空间: $ns"
    continue
  fi
  
  echo "🗑️  删除命名空间: $ns"
  kubectl --kubeconfig="$KUBECONFIG" delete namespace "$ns" --ignore-not-found=true
done

echo ""
echo "✅ 清理完成！"
echo ""
echo "剩余的项目命名空间:"
kubectl --kubeconfig="$KUBECONFIG" get namespaces | grep "^project-" || echo "  (无)"
