#!/bin/bash

echo "🔍 服务架构分析报告"
echo "===================="
echo ""

echo "📊 服务统计"
echo "----------"
echo "Foundation 层: $(find packages/services/foundation/src -name "*.service.ts" | wc -l) 个服务"
echo "Business 层: $(find packages/services/business/src -name "*.service.ts" | wc -l) 个服务"
echo "Extensions 层: $(find packages/services/extensions/src -name "*.service.ts" | wc -l) 个服务"
echo ""

echo "📦 Foundation 层服务"
echo "-------------------"
find packages/services/foundation/src -name "*.service.ts" -exec basename {} \; | sort
echo ""

echo "📦 Business 层服务"
echo "-----------------"
find packages/services/business/src -name "*.service.ts" -exec basename {} \; | sort
echo ""

echo "📦 Extensions 层服务"
echo "-------------------"
find packages/services/extensions/src -name "*.service.ts" -exec basename {} \; | sort
echo ""

echo "🔗 依赖关系分析"
echo "-------------"
echo "检查循环依赖..."
for service in $(find packages/services -name "*.service.ts"); do
  imports=$(grep -h "^import.*from.*@juanie/service" "$service" 2>/dev/null | wc -l)
  if [ "$imports" -gt 0 ]; then
    echo "$(basename $service): $imports 个跨层导入"
  fi
done
echo ""

echo "📏 代码规模分析"
echo "-------------"
for service in $(find packages/services -name "*.service.ts" | head -10); do
  lines=$(wc -l < "$service")
  name=$(basename "$service")
  if [ "$lines" -gt 500 ]; then
    echo "⚠️  $name: $lines 行 (过大)"
  elif [ "$lines" -gt 300 ]; then
    echo "⚡ $name: $lines 行 (较大)"
  fi
done
