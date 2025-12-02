#!/bin/bash

# 诊断 GitRepository 资源
echo "🔍 诊断 GitRepository 资源"
echo ""

# 1. 检查 GitRepository 状态
echo "📋 1. GitRepository 状态"
echo "=" | tr '=' '=' | head -c 60; echo ""
kubectl get gitrepository -A
echo ""

# 2. 检查详细状态
echo "📋 2. GitRepository 详细信息"
echo "=" | tr '=' '=' | head -c 60; echo ""

for repo in $(kubectl get gitrepository -A -o jsonpath='{range .items[*]}{.metadata.namespace}/{.metadata.name}{"\n"}{end}'); do
  namespace=$(echo $repo | cut -d'/' -f1)
  name=$(echo $repo | cut -d'/' -f2)
  
  echo "Repository: $namespace/$name"
  
  # 获取状态
  ready=$(kubectl get gitrepository $name -n $namespace -o jsonpath='{.status.conditions[?(@.type=="Ready")].status}')
  reason=$(kubectl get gitrepository $name -n $namespace -o jsonpath='{.status.conditions[?(@.type=="Ready")].reason}')
  message=$(kubectl get gitrepository $name -n $namespace -o jsonpath='{.status.conditions[?(@.type=="Ready")].message}')
  url=$(kubectl get gitrepository $name -n $namespace -o jsonpath='{.spec.url}')
  
  echo "  URL: $url"
  echo "  Ready: $ready"
  echo "  Reason: $reason"
  echo "  Message: $message"
  echo ""
done

# 3. 检查 source-controller 日志
echo "📋 3. source-controller 日志（最近 30 行）"
echo "=" | tr '=' '=' | head -c 60; echo ""
kubectl logs -n flux-system deployment/source-controller --tail=30 | grep -i "error\|failed\|gitrepository" || echo "无相关错误"
echo ""

# 4. 检查 Secret（如果有）
echo "📋 4. 检查 Git 认证 Secret"
echo "=" | tr '=' '=' | head -c 60; echo ""
kubectl get secret -A | grep -E "git|flux" || echo "无 Git 相关 Secret"
echo ""

echo "诊断完成"
echo ""
echo "常见问题："
echo "1. GitRepository 无法连接 - 检查 URL 和认证"
echo "2. SSH 认证失败 - 检查 Deploy Key 或 SSH Secret"
echo "3. HTTPS 认证失败 - 检查 Access Token"
