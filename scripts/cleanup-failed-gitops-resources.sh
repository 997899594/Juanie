#!/bin/bash

# 清理失败的 GitOps 资源
# 用法: ./scripts/cleanup-failed-gitops-resources.sh

set -e

KUBECONFIG="${KUBECONFIG:-~/.kube/k3s-remote.yaml}"

echo "🔍 检查集群中的 GitRepository 资源..."

# 统计信息
TOTAL=$(kubectl --kubeconfig="$KUBECONFIG" get gitrepository -A --no-headers | wc -l)
FAILED=$(kubectl --kubeconfig="$KUBECONFIG" get gitrepository -A -o json | jq '[.items[] | select(.status.conditions // [] | any(.type == "Ready" and .status == "False"))] | length')
UNPROCESSED=$(kubectl --kubeconfig="$KUBECONFIG" get gitrepository -A -o json | jq '[.items[] | select(.status.observedGeneration == -1 or .status.observedGeneration == null)] | length')

echo "📊 统计信息:"
echo "  - 总数: $TOTAL"
echo "  - 失败: $FAILED"
echo "  - 未处理: $UNPROCESSED"
echo ""

# 列出所有项目 namespace
echo "🗂️  项目 Namespace 列表:"
kubectl --kubeconfig="$KUBECONFIG" get namespace | grep "^project-" | awk '{print $1}' | head -20
echo ""

# 询问是否继续
read -p "⚠️  是否要删除所有失败的项目 namespace？这将删除其中的所有资源。(yes/no): " CONFIRM

if [ "$CONFIRM" != "yes" ]; then
    echo "❌ 取消操作"
    exit 0
fi

echo ""
echo "🗑️  开始清理..."

# 获取所有项目 namespace
NAMESPACES=$(kubectl --kubeconfig="$KUBECONFIG" get namespace | grep "^project-" | awk '{print $1}')

DELETED=0
SKIPPED=0

for NS in $NAMESPACES; do
    # 检查该 namespace 中的 GitRepository 是否失败
    READY=$(kubectl --kubeconfig="$KUBECONFIG" get gitrepository -n "$NS" -o json 2>/dev/null | jq -r '.items[0].status.conditions // [] | map(select(.type == "Ready")) | .[0].status // "Unknown"')
    
    if [ "$READY" == "False" ] || [ "$READY" == "Unknown" ]; then
        echo "  🗑️  删除 $NS (状态: $READY)"
        kubectl --kubeconfig="$KUBECONFIG" delete namespace "$NS" --timeout=30s &
        DELETED=$((DELETED + 1))
    else
        echo "  ✅ 保留 $NS (状态: $READY)"
        SKIPPED=$((SKIPPED + 1))
    fi
done

# 等待所有删除操作完成
wait

echo ""
echo "✅ 清理完成!"
echo "  - 删除: $DELETED"
echo "  - 保留: $SKIPPED"
echo ""
echo "🔄 等待 30 秒让 Flux 重新同步..."
sleep 30

# 再次统计
TOTAL_AFTER=$(kubectl --kubeconfig="$KUBECONFIG" get gitrepository -A --no-headers | wc -l)
echo ""
echo "📊 清理后统计:"
echo "  - 剩余 GitRepository: $TOTAL_AFTER"
