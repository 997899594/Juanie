#!/bin/bash

# 强制实施单一依赖树

set -e

echo "🧹 清理所有 node_modules..."
echo ""

# 1. 删除所有 node_modules
echo "1️⃣ 删除根 node_modules..."
rm -rf node_modules

echo "2️⃣ 删除子包 node_modules..."
find packages apps -name "node_modules" -type d -prune -exec rm -rf '{}' + 2>/dev/null || true

# 2. 删除缓存
echo "3️⃣ 删除缓存..."
rm -rf .turbo .bun-cache
rm -f bun.lock

# 3. 删除构建产物
echo "4️⃣ 删除构建产物..."
find packages apps -name "dist" -type d -prune -exec rm -rf '{}' + 2>/dev/null || true
find . -name "*.tsbuildinfo" -type f -delete 2>/dev/null || true

echo ""
echo "✅ 清理完成！"
echo ""

# 4. 重新安装
echo "📦 重新安装依赖（单一依赖树模式）..."
echo ""

bun install

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ 单一依赖树安装完成！"
echo ""

# 5. 验证
echo "🔍 验证依赖树结构..."
echo ""

SUBPACKAGE_MODULES=$(find packages apps -name "node_modules" -type d 2>/dev/null | wc -l)

if [ "$SUBPACKAGE_MODULES" -eq 0 ]; then
    echo "✅ 完美！子包没有独立的 node_modules"
    echo "✅ 所有依赖都在根 node_modules 中"
else
    echo "⚠️  警告：发现 $SUBPACKAGE_MODULES 个子包 node_modules"
    echo ""
    echo "子包 node_modules 列表："
    find packages apps -name "node_modules" -type d 2>/dev/null
    echo ""
    echo "这可能是因为："
    echo "  1. 某些包有 peer dependency 冲突"
    echo "  2. bunfig.toml 配置未生效"
    echo "  3. 需要手动删除这些目录"
fi

echo ""
echo "📊 依赖统计："
echo "   根 node_modules 大小: $(du -sh node_modules 2>/dev/null | cut -f1)"
echo "   包总数: $(ls node_modules | wc -l)"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
