#!/bin/bash

# 清理孤立的 GitRepository 资源
# 用法: ./scripts/cleanup-orphaned-gitrepositories.sh

set -e

KUBECONFIG="${KUBECONFIG:-~/.kube/k3s-remote.yaml}"

echo "🔍 检查孤立的 GitRepository 资源..."

# 获取所有存在的 namespace
EXISTING_NS=$(kubectl --kubeconfig="$KUBECONFIG" get namespace -o jsonpath='{.items[*].metadata.name}')

# 获取所有 GitRepository 及其 namespace
TOTAL=0
DELETED=0

while IFS= read -r line; do
  NAMESPACE=$(echo "$line" | awk '{print $1}')
  NAME=$(echo "$line" | awk '{print $2}')
  
  TOTAL=$((TOTAL + 1))
  
  # 检查 namespace 是否存在
  if ! echo "$EXISTING_NS" | grep -q "\b$NAMESPACE\b"; then
    echo "🗑️  删除孤立资源: $NAMESPACE/$NAME"
    # 先移除 finalizer
    kubectl --kubeconfig="$KUBECONFIG" patch gitrepository "$NAME" -n "$NAMESPACE" \
      -p '{"metadata":{"finalizers":[]}}' --type=merge 2>/dev/null || true
    # 强制删除
    kubectl --kubeconfig="$KUBECONFIG" delete gitrepository "$NAME" -n "$NAMESPACE" \
      --grace-period=0 --force --ignore-not-found=true 2>/dev/null || true
    DELETED=$((DELETED + 1))
  fi
done < <(kubectl --kubeconfig="$KUBECONFIG" get gitrepository -A -o custom-columns=NAMESPACE:.metadata.namespace,NAME:.metadata.name --no-headers)

echo ""
echo "✅ 清理完成！"
echo "  - 总数: $TOTAL"
echo "  - 删除: $DELETED"
echo "  - 保留: $((TOTAL - DELETED))"
echo ""

# 验证
REMAINING=$(kubectl --kubeconfig="$KUBECONFIG" get gitrepository -A --no-headers 2>/dev/null | wc -l)
echo "📊 剩余 GitRepository: $REMAINING"
