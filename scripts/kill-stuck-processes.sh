#!/bin/bash

# 清理所有可能卡住的构建进程
# 当 Vite/esbuild 构建卡住时运行此脚本

echo "🔍 查找并清理卡住的进程..."

# 查找并杀死 Vite 相关进程
echo "清理 Vite 进程..."
pkill -f "vite" 2>/dev/null && echo "  ✓ 已清理 vite 进程" || echo "  - 没有 vite 进程"

# 查找并杀死 vue-tsc 进程
echo "清理 vue-tsc 进程..."
pkill -f "vue-tsc" 2>/dev/null && echo "  ✓ 已清理 vue-tsc 进程" || echo "  - 没有 vue-tsc 进程"

# 查找并杀死 esbuild 进程
echo "清理 esbuild 进程..."
pkill -f "esbuild" 2>/dev/null && echo "  ✓ 已清理 esbuild 进程" || echo "  - 没有 esbuild 进程"

# 查找并杀死 node 相关的构建进程
echo "清理 node 构建进程..."
pkill -f "node.*build" 2>/dev/null && echo "  ✓ 已清理 node 构建进程" || echo "  - 没有 node 构建进程"

# 查找并杀死 bun 相关的构建进程
echo "清理 bun 构建进程..."
pkill -f "bun.*build" 2>/dev/null && echo "  ✓ 已清理 bun 构建进程" || echo "  - 没有 bun 构建进程"

# 清理缓存目录
echo ""
echo "🧹 清理缓存目录..."
rm -rf node_modules/.vite && echo "  ✓ 已清理 .vite 缓存"
rm -rf node_modules/.cache && echo "  ✓ 已清理 .cache 缓存"
rm -rf packages/ui/dist && echo "  ✓ 已清理 UI 包构建产物"
rm -rf apps/web/dist && echo "  ✓ 已清理 Web 应用构建产物"

# 等待进程完全退出
echo ""
echo "⏳ 等待进程完全退出..."
sleep 2

echo ""
echo "✅ 清理完成！"
echo ""
echo "💡 提示："
echo "  - 如果问题仍然存在，尝试重启终端"
echo "  - 如果经常遇到此问题，可能是内存不足或循环依赖"
echo ""
echo "现在可以重新运行构建命令："
echo "  bun run dev        # 启动开发服务器"
echo "  bun run build      # 构建项目"
