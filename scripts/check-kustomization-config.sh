#!/bin/bash

# 检查 Kustomization 配置
echo "🔍 检查 Kustomization 配置"
echo ""

# 获取所有 Kustomization
kubectl get kustomization -A -o json | jq -r '.items[] | 
  "名称: \(.metadata.name)\n" +
  "命名空间: \(.metadata.namespace)\n" +
  "路径: \(.spec.path)\n" +
  "状态: \(.status.conditions[] | select(.type=="Ready") | .message)\n" +
  "---"'
