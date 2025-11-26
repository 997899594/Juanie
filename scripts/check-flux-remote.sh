#!/bin/bash

# 检查远程 K3s 集群上的 Flux 状态

KUBECONFIG=~/.kube/k3s-remote.yaml

echo "=== Flux 组件状态 ==="
kubectl --kubeconfig=$KUBECONFIG get pods -n flux-system

echo -e "\n=== GitRepository 资源 ==="
kubectl --kubeconfig=$KUBECONFIG get gitrepository -A

echo -e "\n=== GitRepository 详细信息 ==="
kubectl --kubeconfig=$KUBECONFIG get gitrepository -A -o wide

echo -e "\n=== 最近创建的 GitRepository ==="
LATEST_REPO=$(kubectl --kubeconfig=$KUBECONFIG get gitrepository -A --sort-by=.metadata.creationTimestamp -o jsonpath='{.items[-1].metadata.name}' 2>/dev/null)
LATEST_NS=$(kubectl --kubeconfig=$KUBECONFIG get gitrepository -A --sort-by=.metadata.creationTimestamp -o jsonpath='{.items[-1].metadata.namespace}' 2>/dev/null)

if [ -n "$LATEST_REPO" ]; then
  echo "Repository: $LATEST_REPO (namespace: $LATEST_NS)"
  echo -e "\n=== 详细状态 ==="
  kubectl --kubeconfig=$KUBECONFIG describe gitrepository -n $LATEST_NS $LATEST_REPO
  
  echo -e "\n=== source-controller 日志 ==="
  kubectl --kubeconfig=$KUBECONFIG logs -n flux-system deployment/source-controller --tail=50 | grep -A 5 -B 5 "$LATEST_REPO"
fi

echo -e "\n=== Kustomization 资源 ==="
kubectl --kubeconfig=$KUBECONFIG get kustomization -A
