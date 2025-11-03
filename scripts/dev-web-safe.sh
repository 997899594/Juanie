#!/bin/bash

# 安全启动 Web 应用的脚本
# 确保没有残留进程和缓存

echo "🚀 安全启动 Web 应用..."
echo ""

# 1. 清理进程
echo "1️⃣ 清理残留进程..."
pkill -9 -f "vite.*web" 2>/dev/null || true
pkill -9 -f "turbo.*web" 2>/dev/null || true
lsof -ti:1997 | xargs kill -9 2>/dev/null || true
sleep 1

# 2. 清理缓存
echo "2️⃣ 清理缓存..."
rm -rf apps/web/node_modules/.vite
rm -rf node_modules/.vite
echo "  ✓ 缓存已清理"

# 3. 检查 UI 包是否已构建
echo "3️⃣ 检查 UI 包..."
if [ ! -d "packages/ui/dist" ]; then
    echo "  ⚠️  UI 包未构建，正在构建..."
    cd packages/ui
    bun run build:fast
    cd ../..
    echo "  ✓ UI 包已构建"
else
    echo "  ✓ UI 包已存在"
fi

# 4. 启动开发服务器
echo ""
echo "4️⃣ 启动开发服务器..."
echo "================================"
echo ""

cd apps/web
exec bun run dev
