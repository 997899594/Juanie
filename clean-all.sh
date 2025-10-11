#!/bin/bash
echo "🧹 开始清理所有缓存和产物..."

# 清理 turbo
echo "清理 Turbo 缓存..."
bun turbo clean
rm -rf .turbo

# 清理 node_modules
echo "删除 node_modules..."
rm -rf node_modules apps/*/node_modules packages/*/node_modules

# 清理构建产物
echo "清理构建产物..."
rm -rf apps/*/dist apps/*/build apps/*/.next packages/*/dist packages/*/build
find . -name "*.tsbuildinfo" -delete

# 清理 vite 缓存
echo "清理 Vite 缓存..."
rm -rf apps/web/node_modules/.vite packages/ui/node_modules/.vite
rm -rf apps/web/.vite packages/ui/.vite

# 清理 bun 缓存
echo "清理 Bun 缓存..."
bun pm cache rm

echo "✅ 清理完成！重新安装依赖..."
bun install

echo "🎉 全部完成！"
