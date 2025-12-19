#!/bin/bash

# 修复只在模板中使用的 props（添加下划线前缀）

echo "Fixing template-only props..."

# 获取所有报 TS6133 'props' is declared but its value is never read 的文件
files=$(bun run type-check 2>&1 | grep "error TS6133: 'props' is declared" | awk -F: '{print $1}' | sed 's/^src\//apps\/web\/src\//' | sort -u)

for file in $files; do
  if [ -f "$file" ]; then
    echo "Processing: $file"
    
    # 检查 props 是否只在模板中使用（script 中没有使用）
    # 如果 script 中没有 props. 的引用，则添加下划线
    if ! grep -q "props\." "$file"; then
      # 替换 const props = 为 const _props =
      sed -i '' 's/const props = defineProps/const _props = defineProps/g' "$file"
      sed -i '' 's/const props = withDefaults/const _props = withDefaults/g' "$file"
    fi
  fi
done

echo "✅ Fixed template-only props"
