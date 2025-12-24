#!/bin/bash

# 检查项目 201 的部署状态

PROJECT_ID="201"
NAMESPACE="project-${PROJECT_ID}-development"

echo "🔍 检查项目 ${PROJECT_ID} 的部署状态..."
echo ""

# 1. 检查 Namespace
echo "1️⃣ 检查 Namespace..."
kubectl get namespace ${NAMESPACE} --kubeconfig=.kube/k3s-remote.yaml 2>/dev/null
if [ $? -eq 0 ]; then
  echo "✅ Namespace 存在"
else
  echo "❌ Namespace 不存在"
fi
echo ""

# 2. 检查 ImagePullSecret
echo "2️⃣ 检查 ImagePullSecret..."
kubectl get secret ghcr-secret -n ${NAMESPACE} --kubeconfig=.kube/k3s-remote.yaml 2>/dev/null
if [ $? -eq 0 ]; then
  echo "✅ ImagePullSecret 存在"
  
  # 检查 Secret 内容
  echo ""
  echo "Secret 详情:"
  kubectl get secret ghcr-secret -n ${NAMESPACE} -o jsonpath='{.data.\.dockerconfigjson}' --kubeconfig=.kube/k3s-remote.yaml | base64 -d | jq .
else
  echo "❌ ImagePullSecret 不存在"
fi
echo ""

# 3. 检查 Deployment
echo "3️⃣ 检查 Deployment..."
kubectl get deployment -n ${NAMESPACE} --kubeconfig=.kube/k3s-remote.yaml
echo ""

# 4. 检查 Pod
echo "4️⃣ 检查 Pod..."
kubectl get pods -n ${NAMESPACE} --kubeconfig=.kube/k3s-remote.yaml
echo ""

# 5. 检查 Pod 详情（如果存在）
POD_NAME=$(kubectl get pods -n ${NAMESPACE} --kubeconfig=.kube/k3s-remote.yaml -o jsonpath='{.items[0].metadata.name}' 2>/dev/null)
if [ -n "$POD_NAME" ]; then
  echo "5️⃣ 检查 Pod 详情: ${POD_NAME}"
  kubectl describe pod ${POD_NAME} -n ${NAMESPACE} --kubeconfig=.kube/k3s-remote.yaml | tail -30
  echo ""
  
  echo "6️⃣ 检查 Pod 日志:"
  kubectl logs ${POD_NAME} -n ${NAMESPACE} --kubeconfig=.kube/k3s-remote.yaml --tail=20 2>/dev/null || echo "无法获取日志"
fi
echo ""

# 7. 检查 GitRepository
echo "7️⃣ 检查 Flux GitRepository..."
kubectl get gitrepository -n ${NAMESPACE} --kubeconfig=.kube/k3s-remote.yaml
echo ""

# 8. 检查 Kustomization
echo "8️⃣ 检查 Flux Kustomization..."
kubectl get kustomization -n ${NAMESPACE} --kubeconfig=.kube/k3s-remote.yaml
echo ""

echo "✅ 检查完成"
