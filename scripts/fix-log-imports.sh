#!/bin/bash

# 修复前端 Vue 文件中缺少的 log 导入
# 查找使用了 log.error/warn/info/debug 但没有导入 log 的文件

set -e

echo "🔍 检查前端 Vue 文件中缺少的 log 导入..."

# 查找所有使用 log 但没有导入的文件
files_to_fix=$(grep -l "log\.(error\|warn\|info\|debug)" apps/web/src/**/*.vue apps/web/src/**/**/*.vue 2>/dev/null | while read file; do
  if ! grep -q "import.*log.*from" "$file"; then
    echo "$file"
  fi
done | sort -u)

if [ -z "$files_to_fix" ]; then
  echo "✅ 所有文件都已正确导入 log"
  exit 0
fi

echo "📝 发现以下文件需要修复:"
echo "$files_to_fix"
echo ""

# 统计
count=$(echo "$files_to_fix" | wc -l | tr -d ' ')
echo "📊 共 $count 个文件需要修复"
echo ""

# 提示用户
echo "⚠️  这些文件使用了 log 但没有导入"
echo "💡 建议手动检查并添加: import { log } from '@juanie/ui'"
echo ""
echo "示例修复:"
echo "  import { Button, Card } from '@juanie/ui'"
echo "  改为:"
echo "  import { Button, Card, log } from '@juanie/ui'"
echo ""

exit 1
