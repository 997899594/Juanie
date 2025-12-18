#!/bin/bash
# 强制删除卡住的 namespace

export KUBECONFIG=~/.kube/k3s-remote.yaml

echo "获取所有 project namespace..."
NAMESPACES=$(kubectl get namespace | grep "^project-" | awk '{print $1}')

for NS in $NAMESPACES; do
    echo "强制删除 $NS..."
    kubectl get namespace "$NS" -o json | jq '.spec.finalizers = []' | kubectl replace --raw "/api/v1/namespaces/$NS/finalize" -f - 2>/dev/null || true
done

echo "完成！"
