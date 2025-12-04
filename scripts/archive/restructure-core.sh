#!/bin/bash

# Core 包结构重构脚本
# 将 packages/core/core/ 拆分为独立的包

set -e

echo "🚀 开始 Core 包结构重构..."

# 1. 创建新的包目录结构
echo "📁 创建新的包目录..."
mkdir -p packages/core/database/src
mkdir -p packages/core/queue/src
mkdir -p packages/core/observability/src
mkdir -p packages/core/events/src
mkdir -p packages/core/tokens/src

# 2. 移动文件
echo "📦 移动 database 包..."
cp -r packages/core/core/src/database/* packages/core/database/src/

echo "📦 移动 queue 包..."
cp -r packages/core/core/src/queue/* packages/core/queue/src/

echo "📦 移动 observability 包..."
cp -r packages/core/core/src/observability/* packages/core/observability/src/

echo "📦 移动 events 包..."
cp -r packages/core/core/src/events/* packages/core/events/src/

echo "📦 移动 tokens 包..."
cp -r packages/core/core/src/tokens/* packages/core/tokens/src/

echo "✅ 文件移动完成"
echo ""
echo "⚠️  接下来需要手动操作："
echo "1. 为每个新包创建 package.json"
echo "2. 更新根目录 package.json 的 workspaces"
echo "3. 更新所有导入语句（约 50+ 文件）"
echo "4. 删除旧的 packages/core/core 目录"
echo ""
echo "建议使用 find-and-replace 工具批量更新导入："
echo "  @juanie/core/database -> @juanie/core-database"
echo "  @juanie/core/queue -> @juanie/core-queue"
echo "  @juanie/core/observability -> @juanie/core-observability"
echo "  @juanie/core/events -> @juanie/core-events"
echo "  @juanie/core/tokens -> @juanie/core-tokens"
