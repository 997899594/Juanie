#!/usr/bin/env bash
#
# 批量替换 console.log/error/warn 为统一 Logger
# 策略:
# 1. Services (backend) - 使用 @juanie/core Logger
# 2. Composables/Components (frontend) - 保留关键错误处理的 console.error
# 3. Scripts - 保留 console (调试工具)
#

set -e

ROOT="$(cd "$(dirname "$0")/.." && pwd)"

echo "🔍 统计 console 使用情况..."
TOTAL=$(grep -r "console\.\(log\|warn\|error\|info\|debug\)" \
  --include="*.ts" \
  --include="*.vue" \
  --exclude-dir=node_modules \
  --exclude-dir=dist \
  --exclude-dir=scripts \
  "$ROOT" | wc -l | tr -d ' ')

echo "📊 找到 $TOTAL 处 console 调用"

echo ""
echo "📝 建议手动处理:"
echo "  1. Services: 使用 Logger"
echo "  2. 前端组件: 保留必要的 console.error,删除 console.log"
echo "  3. 脚本: 保留所有 console"
echo ""
echo "详细列表:"
grep -rn "console\.\(log\|warn\|error\|info\|debug\)" \
  --include="*.ts" \
  --include="*.vue" \
  --exclude-dir=node_modules \
  --exclude-dir=dist \
  --exclude-dir=scripts \
  "$ROOT" | head -50

echo ""
echo "💡 提示: 使用 @juanie/core Logger 替代:"
echo "  import { createLogger } from '@juanie/core'"
echo "  const logger = createLogger('ServiceName')"
echo "  logger.info('message', { data })"
