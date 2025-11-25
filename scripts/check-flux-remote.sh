#!/bin/bash

echo "=== Checking Flux on Remote K3s ==="
echo ""

# 使用远程 kubeconfig
export KUBECONFIG=~/.kube/k3s-remote.yaml

echo "1. Checking Flux namespace..."
kubectl get ns flux-system

echo ""
echo "2. Checking Flux pods..."
kubectl get pods -n flux-system

echo ""
echo "3. Checking Flux CRDs..."
kubectl get crd | grep flux

echo ""
echo "4. Checking GitRepository resources..."
kubectl get gitrepositories -A

echo ""
echo "5. Checking Kustomization resources..."
kubectl get kustomizations -A

echo ""
echo "6. Checking recent GitRepository (if exists)..."
LATEST_REPO=$(kubectl get gitrepositories -A --sort-by=.metadata.creationTimestamp -o name | tail -1)
if [ -n "$LATEST_REPO" ]; then
  echo "Describing: $LATEST_REPO"
  kubectl describe $LATEST_REPO
fi

echo ""
echo "7. Checking Flux logs (last 50 lines)..."
kubectl logs -n flux-system -l app=source-controller --tail=50
