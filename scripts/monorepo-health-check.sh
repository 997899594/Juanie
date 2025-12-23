#!/bin/bash

# Monorepo 健康检查脚本

set -e

echo "🔍 Monorepo 健康检查..."
echo ""

# 1. 检查 Bun 版本
echo "1️⃣ 检查 Bun 版本..."
if command -v bun &> /dev/null; then
    BUN_VERSION=$(bun --version)
    echo "✅ Bun 版本: $BUN_VERSION"
else
    echo "❌ Bun 未安装"
    exit 1
fi
echo ""

# 2. 检查 Turbo 版本
echo "2️⃣ 检查 Turbo 版本..."
if command -v turbo &> /dev/null; then
    TURBO_VERSION=$(turbo --version)
    echo "✅ Turbo 版本: $TURBO_VERSION"
else
    echo "⚠️  Turbo 未全局安装，使用本地版本"
fi
echo ""

# 3. 检查关键配置文件
echo "3️⃣ 检查配置文件..."
FILES=("package.json" "turbo.json" "bunfig.toml" ".npmrc")
for file in "${FILES[@]}"; do
    if [ -f "$file" ]; then
        echo "✅ $file 存在"
    else
        echo "❌ $file 缺失"
    fi
done
echo ""

# 4. 检查 resolutions 配置
echo "4️⃣ 检查依赖版本统一 (resolutions)..."
if grep -q "resolutions" package.json; then
    echo "✅ resolutions 已配置"
    echo "   关键依赖版本:"
    grep -A 7 '"resolutions"' package.json | grep -E '@nestjs|typescript|drizzle' | sed 's/^/   /'
else
    echo "⚠️  未配置 resolutions，可能导致版本冲突"
fi
echo ""

# 5. 检查 workspace 配置
echo "5️⃣ 检查 workspace 配置..."
WORKSPACE_COUNT=$(grep -c '"packages/\|"apps/' package.json || true)
echo "✅ 配置了 $WORKSPACE_COUNT 个 workspace"
echo ""

# 6. 检查 node_modules 结构
echo "6️⃣ 检查 node_modules 结构..."
if [ -d "node_modules" ]; then
    echo "✅ 根 node_modules 存在"
    
    # 检查是否有子包的 node_modules（应该没有）
    SUBPACKAGE_MODULES=$(find packages apps -name "node_modules" -type d 2>/dev/null | wc -l)
    if [ "$SUBPACKAGE_MODULES" -eq 0 ]; then
        echo "✅ 子包没有独立的 node_modules（正确的扁平化结构）"
    else
        echo "⚠️  发现 $SUBPACKAGE_MODULES 个子包 node_modules（可能需要清理）"
    fi
else
    echo "❌ node_modules 不存在，请运行 bun install"
fi
echo ""

# 7. 检查 Turbo 缓存
echo "7️⃣ 检查 Turbo 缓存..."
if [ -d ".turbo" ]; then
    CACHE_SIZE=$(du -sh .turbo 2>/dev/null | cut -f1)
    echo "✅ Turbo 缓存存在 (大小: $CACHE_SIZE)"
else
    echo "ℹ️  Turbo 缓存为空（首次构建后会生成）"
fi
echo ""

# 8. 检查 TypeScript 配置
echo "8️⃣ 检查 TypeScript 配置..."
if [ -f "tsconfig.json" ]; then
    if grep -q '"incremental": true' tsconfig.json; then
        echo "✅ 启用了增量构建"
    else
        echo "⚠️  未启用增量构建，建议添加 'incremental: true'"
    fi
fi
echo ""

# 9. 检查构建产物
echo "9️⃣ 检查构建产物..."
DIST_COUNT=$(find packages apps -name "dist" -type d 2>/dev/null | wc -l)
if [ "$DIST_COUNT" -gt 0 ]; then
    echo "✅ 发现 $DIST_COUNT 个构建产物目录"
else
    echo "ℹ️  没有构建产物，请运行 bun run build"
fi
echo ""

# 10. 版本一致性检查
echo "🔟 检查关键依赖版本一致性..."
echo "   检查 @nestjs/config 版本..."

# 收集所有 package.json 中的 @nestjs/config 版本
NESTJS_VERSIONS=$(find . -name "package.json" -not -path "*/node_modules/*" -exec grep -H "@nestjs/config" {} \; 2>/dev/null | grep -v "resolutions" || true)

if [ -z "$NESTJS_VERSIONS" ]; then
    echo "   ℹ️  未使用 @nestjs/config"
else
    echo "$NESTJS_VERSIONS" | while read -r line; do
        echo "   $line"
    done
    
    # 检查是否有不同版本（macOS 兼容）
    UNIQUE_VERSIONS=$(echo "$NESTJS_VERSIONS" | grep -o '[0-9]\+\.[0-9]\+\.[0-9]\+' | sort -u | wc -l | tr -d ' ')
    if [ "$UNIQUE_VERSIONS" -eq 1 ]; then
        echo "   ✅ 所有包使用相同版本"
    else
        echo "   ⚠️  发现 $UNIQUE_VERSIONS 个不同版本，建议使用 resolutions 统一"
    fi
fi
echo ""

# 总结
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ 健康检查完成！"
echo ""
echo "💡 建议操作:"
echo "   • 如果有警告，参考 docs/guides/monorepo-best-practices.md"
echo "   • 定期运行 'bun run clean' 清理缓存"
echo "   • 使用 'turbo build --filter=...[HEAD^1]' 只构建变更的包"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
