#!/bin/bash

# 提取所有 TODO 到文件

set -e

echo "📝 提取所有 TODO..."

OUTPUT_FILE="docs/TODO_LIST.md"

# 创建 Markdown 文件头
cat > "$OUTPUT_FILE" <<EOF
# TODO 列表

> 自动生成于: $(date '+%Y-%m-%d %H:%M:%S')

## 统计

EOF

# 统计各类标记
TODO_COUNT=$(grep -r "TODO" apps/ packages/ --include="*.ts" --include="*.vue" 2>/dev/null | grep -v "node_modules" | wc -l || echo "0")
FIXME_COUNT=$(grep -r "FIXME" apps/ packages/ --include="*.ts" --include="*.vue" 2>/dev/null | grep -v "node_modules" | wc -l || echo "0")
HACK_COUNT=$(grep -r "HACK" apps/ packages/ --include="*.ts" --include="*.vue" 2>/dev/null | grep -v "node_modules" | wc -l || echo "0")
XXX_COUNT=$(grep -r "XXX" apps/ packages/ --include="*.ts" --include="*.vue" 2>/dev/null | grep -v "node_modules" | wc -l || echo "0")

# 写入统计
cat >> "$OUTPUT_FILE" <<EOF
- TODO: $TODO_COUNT
- FIXME: $FIXME_COUNT
- HACK: $HACK_COUNT
- XXX: $XXX_COUNT
- **总计**: $((TODO_COUNT + FIXME_COUNT + HACK_COUNT + XXX_COUNT))

---

## TODO 列表

EOF

# 提取 TODO
echo "### 待办事项 (TODO)" >> "$OUTPUT_FILE"
echo "" >> "$OUTPUT_FILE"
grep -rn "TODO" apps/ packages/ --include="*.ts" --include="*.vue" 2>/dev/null | \
  grep -v "node_modules" | \
  sed 's/^/- /' >> "$OUTPUT_FILE" 2>/dev/null || echo "无" >> "$OUTPUT_FILE"

# 提取 FIXME
echo "" >> "$OUTPUT_FILE"
echo "### 需要修复 (FIXME)" >> "$OUTPUT_FILE"
echo "" >> "$OUTPUT_FILE"
grep -rn "FIXME" apps/ packages/ --include="*.ts" --include="*.vue" 2>/dev/null | \
  grep -v "node_modules" | \
  sed 's/^/- /' >> "$OUTPUT_FILE" 2>/dev/null || echo "无" >> "$OUTPUT_FILE"

# 提取 HACK
echo "" >> "$OUTPUT_FILE"
echo "### 临时方案 (HACK)" >> "$OUTPUT_FILE"
echo "" >> "$OUTPUT_FILE"
grep -rn "HACK" apps/ packages/ --include="*.ts" --include="*.vue" 2>/dev/null | \
  grep -v "node_modules" | \
  sed 's/^/- /' >> "$OUTPUT_FILE" 2>/dev/null || echo "无" >> "$OUTPUT_FILE"

# 提取 XXX
echo "" >> "$OUTPUT_FILE"
echo "### 需要注意 (XXX)" >> "$OUTPUT_FILE"
echo "" >> "$OUTPUT_FILE"
grep -rn "XXX" apps/ packages/ --include="*.ts" --include="*.vue" 2>/dev/null | \
  grep -v "node_modules" | \
  sed 's/^/- /' >> "$OUTPUT_FILE" 2>/dev/null || echo "无" >> "$OUTPUT_FILE"

echo "✅ TODO 列表已生成: $OUTPUT_FILE"
echo ""
echo "📊 统计:"
echo "  TODO:  $TODO_COUNT"
echo "  FIXME: $FIXME_COUNT"
echo "  HACK:  $HACK_COUNT"
echo "  XXX:   $XXX_COUNT"
echo "  总计:  $((TODO_COUNT + FIXME_COUNT + HACK_COUNT + XXX_COUNT))"
