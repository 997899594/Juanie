#!/bin/bash

# UI 包清理构建脚本
# 用于解决构建卡住的问题

echo "🧹 清理 UI 包构建环境..."

# 1. 杀死可能卡住的进程
echo "1️⃣ 清理可能卡住的进程..."
pkill -f "vite.*@juanie/ui" 2>/dev/null || true
pkill -f "vue-tsc.*@juanie/ui" 2>/dev/null || true
pkill -f "esbuild" 2>/dev/null || true

# 2. 清理构建产物
echo "2️⃣ 清理构建产物..."
rm -rf dist
rm -rf node_modules/.vite
rm -rf .tsbuildinfo

# 3. 清理缓存
echo "3️⃣ 清理缓存..."
rm -rf ../../node_modules/.cache

# 4. 等待进程完全退出
echo "4️⃣ 等待进程清理..."
sleep 2

echo "✅ 清理完成！现在可以重新构建了"
echo ""
echo "运行以下命令开始构建："
echo "  bun run build"
