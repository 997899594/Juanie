#!/bin/bash

# 诊断构建问题的脚本

echo "🔍 诊断构建环境..."
echo ""

# 1. 检查运行中的进程
echo "1️⃣ 检查运行中的构建进程："
echo "-----------------------------------"
ps aux | grep -E "(vite|esbuild|vue-tsc|node.*build|bun.*build)" | grep -v grep | head -10
if [ $? -ne 0 ]; then
    echo "  ✓ 没有发现运行中的构建进程"
fi
echo ""

# 2. 检查端口占用
echo "2️⃣ 检查端口占用情况："
echo "-----------------------------------"
lsof -i :1997 2>/dev/null && echo "  ⚠️  端口 1997 (Web) 被占用" || echo "  ✓ 端口 1997 (Web) 空闲"
lsof -i :5173 2>/dev/null && echo "  ⚠️  端口 5173 (Vite) 被占用" || echo "  ✓ 端口 5173 (Vite) 空闲"
echo ""

# 3. 检查内存使用
echo "3️⃣ 检查系统内存："
echo "-----------------------------------"
vm_stat | perl -ne '/page size of (\d+)/ and $size=$1; /Pages\s+([^:]+)[^\d]+(\d+)/ and printf("%-16s % 16.2f Mi\n", "$1:", $2 * $size / 1048576);'
echo ""

# 4. 检查磁盘空间
echo "4️⃣ 检查磁盘空间："
echo "-----------------------------------"
df -h . | tail -1 | awk '{print "  可用空间: " $4 " / " $2 " (" $5 " 已使用)"}'
echo ""

# 5. 检查 node_modules 大小
echo "5️⃣ 检查 node_modules 大小："
echo "-----------------------------------"
if [ -d "node_modules" ]; then
    du -sh node_modules 2>/dev/null | awk '{print "  根目录: " $1}'
fi
if [ -d "packages/ui/node_modules" ]; then
    du -sh packages/ui/node_modules 2>/dev/null | awk '{print "  UI 包: " $1}'
fi
if [ -d "apps/web/node_modules" ]; then
    du -sh apps/web/node_modules 2>/dev/null | awk '{print "  Web 应用: " $1}'
fi
echo ""

# 6. 检查缓存目录
echo "6️⃣ 检查缓存目录："
echo "-----------------------------------"
if [ -d "node_modules/.vite" ]; then
    du -sh node_modules/.vite 2>/dev/null | awk '{print "  .vite 缓存: " $1}'
else
    echo "  ✓ 没有 .vite 缓存"
fi
if [ -d "node_modules/.cache" ]; then
    du -sh node_modules/.cache 2>/dev/null | awk '{print "  .cache 缓存: " $1}'
else
    echo "  ✓ 没有 .cache 缓存"
fi
echo ""

# 7. 检查构建产物
echo "7️⃣ 检查构建产物："
echo "-----------------------------------"
if [ -d "packages/ui/dist" ]; then
    du -sh packages/ui/dist 2>/dev/null | awk '{print "  UI dist: " $1}'
    echo "  文件数: $(find packages/ui/dist -type f | wc -l | tr -d ' ')"
else
    echo "  - UI 包未构建"
fi
echo ""

# 8. 检查循环依赖
echo "8️⃣ 检查可能的循环依赖："
echo "-----------------------------------"
echo "  (这需要安装 madge: npm i -g madge)"
if command -v madge &> /dev/null; then
    cd packages/ui && madge --circular src/index.ts 2>/dev/null
    if [ $? -eq 0 ]; then
        echo "  ✓ 没有发现循环依赖"
    fi
else
    echo "  - madge 未安装，跳过检查"
fi
echo ""

# 9. 建议
echo "💡 建议："
echo "-----------------------------------"
echo "  如果构建经常卡住，可能的原因："
echo "  1. 内存不足 - 关闭其他应用或增加系统内存"
echo "  2. 循环依赖 - 检查代码中的 import 循环"
echo "  3. 进程僵死 - 运行 'bun run clean:stuck' 清理"
echo "  4. 缓存问题 - 运行 'bun run ui:clean' 清理 UI 包"
echo "  5. esbuild 问题 - 尝试重启终端或电脑"
echo ""
