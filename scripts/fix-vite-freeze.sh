#!/bin/bash

# Vite 卡死问题的终极解决方案
# 这个脚本会彻底清理所有可能导致 Vite 卡死的因素

set -e

echo "🔧 Vite 卡死问题修复工具"
echo "================================"
echo ""

# 1. 杀死所有相关进程
echo "1️⃣ 清理所有构建进程..."
pkill -9 -f "vite" 2>/dev/null && echo "  ✓ 已杀死 vite 进程" || echo "  - 没有 vite 进程"
pkill -9 -f "esbuild" 2>/dev/null && echo "  ✓ 已杀死 esbuild 进程" || echo "  - 没有 esbuild 进程"
pkill -9 -f "vue-tsc" 2>/dev/null && echo "  ✓ 已杀死 vue-tsc 进程" || echo "  - 没有 vue-tsc 进程"
pkill -9 -f "turbo" 2>/dev/null && echo "  ✓ 已杀死 turbo 进程" || echo "  - 没有 turbo 进程"
pkill -9 -f "node.*dev" 2>/dev/null && echo "  ✓ 已杀死 node dev 进程" || echo "  - 没有 node dev 进程"
pkill -9 -f "bun.*dev" 2>/dev/null && echo "  ✓ 已杀死 bun dev 进程" || echo "  - 没有 bun dev 进程"

sleep 2

# 2. 清理所有缓存和临时文件
echo ""
echo "2️⃣ 清理缓存和临时文件..."
rm -rf node_modules/.vite && echo "  ✓ 已清理 .vite 缓存"
rm -rf node_modules/.cache && echo "  ✓ 已清理 .cache 缓存"
rm -rf apps/web/node_modules/.vite && echo "  ✓ 已清理 web .vite 缓存"
rm -rf packages/ui/node_modules/.vite && echo "  ✓ 已清理 ui .vite 缓存"
rm -rf apps/web/dist && echo "  ✓ 已清理 web dist"
rm -rf packages/ui/dist && echo "  ✓ 已清理 ui dist"
rm -rf .turbo && echo "  ✓ 已清理 turbo 缓存"

# 3. 清理 macOS 文件系统事件缓存
echo ""
echo "3️⃣ 清理 macOS 文件系统事件..."
# 这个命令会清理 FSEvents 缓存，解决文件监听问题
# 注意：这需要 sudo 权限
if sudo -n true 2>/dev/null; then
    sudo rm -rf ~/.Trash/.fseventsd 2>/dev/null || true
    echo "  ✓ 已清理 FSEvents 缓存"
else
    echo "  ⚠️  跳过 FSEvents 清理（需要 sudo 权限）"
    echo "  💡 如果问题持续，手动运行: sudo rm -rf ~/.Trash/.fseventsd"
fi

# 4. 检查并清理僵尸端口
echo ""
echo "4️⃣ 检查端口占用..."
PORT_1997=$(lsof -ti:1997 2>/dev/null)
if [ ! -z "$PORT_1997" ]; then
    kill -9 $PORT_1997 2>/dev/null && echo "  ✓ 已释放端口 1997" || echo "  ⚠️  无法释放端口 1997"
else
    echo "  ✓ 端口 1997 空闲"
fi

PORT_5173=$(lsof -ti:5173 2>/dev/null)
if [ ! -z "$PORT_5173" ]; then
    kill -9 $PORT_5173 2>/dev/null && echo "  ✓ 已释放端口 5173" || echo "  ⚠️  无法释放端口 5173"
else
    echo "  ✓ 端口 5173 空闲"
fi

# 5. 清理 node_modules 中的符号链接（可能导致循环监听）
echo ""
echo "5️⃣ 检查 node_modules 符号链接..."
SYMLINK_COUNT=$(find node_modules -type l 2>/dev/null | wc -l | tr -d ' ')
echo "  发现 $SYMLINK_COUNT 个符号链接"

# 6. 重新安装依赖（可选，但推荐）
echo ""
read -p "是否重新安装依赖？这会花费一些时间 (y/N): " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo "6️⃣ 重新安装依赖..."
    rm -rf node_modules
    bun install
    echo "  ✓ 依赖已重新安装"
else
    echo "6️⃣ 跳过依赖重新安装"
fi

echo ""
echo "================================"
echo "✅ 修复完成！"
echo ""
echo "💡 建议："
echo "  1. 完全关闭并重新打开终端"
echo "  2. 运行: bun dev:web"
echo "  3. 如果还是卡死，重启电脑后再试"
echo ""
echo "🔍 如果问题持续，运行: bun run diagnose"
echo ""
