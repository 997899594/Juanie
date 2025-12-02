#!/bin/bash

# 检查 Git 仓库结构
# 用法: ./scripts/check-git-repo-structure.sh <repo-url>

if [ -z "$1" ]; then
  echo "用法: $0 <repo-url>"
  echo "示例: $0 https://github.com/user/repo.git"
  exit 1
fi

REPO_URL="$1"
TMP_DIR="/tmp/check-repo-$$"

echo "🔍 检查 Git 仓库结构"
echo "仓库: $REPO_URL"
echo ""

# 克隆仓库
echo "📥 克隆仓库..."
git clone "$REPO_URL" "$TMP_DIR" 2>&1 | grep -v "Cloning into"

if [ $? -ne 0 ]; then
  echo "❌ 克隆失败"
  exit 1
fi

echo "✅ 克隆成功"
echo ""

# 检查目录结构
echo "📁 仓库根目录:"
ls -la "$TMP_DIR/" | grep -v "^total" | grep -v "^\.$" | grep -v "^\.git$"
echo ""

# 检查 k8s 目录
if [ -d "$TMP_DIR/k8s" ]; then
  echo "✅ k8s 目录存在"
  echo ""
  echo "📁 k8s 目录结构:"
  tree "$TMP_DIR/k8s" 2>/dev/null || find "$TMP_DIR/k8s" -type f
  echo ""
  
  # 检查 overlays
  if [ -d "$TMP_DIR/k8s/overlays" ]; then
    echo "✅ k8s/overlays 目录存在"
    
    for env in development staging production; do
      if [ -d "$TMP_DIR/k8s/overlays/$env" ]; then
        echo "  ✅ $env 环境存在"
      else
        echo "  ❌ $env 环境不存在"
      fi
    done
  else
    echo "❌ k8s/overlays 目录不存在"
  fi
else
  echo "❌ k8s 目录不存在！"
  echo ""
  echo "这就是 Kustomization 失败的原因。"
  echo "Flux 期望找到 k8s/overlays/{environment} 目录。"
fi

# 清理
rm -rf "$TMP_DIR"

echo ""
echo "检查完成"
